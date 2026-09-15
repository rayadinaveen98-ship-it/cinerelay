import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import { YOUTUBE_QUOTA_POLICY_V1, decideQuota } from '../../../packages/youtube-connector/dist/index.js';
// @deno-types="../../../packages/youtube-connector/dist/fallback.d.ts"
import { buildUploadsPlaylistItemsUrl, decideDiscoveryIntervalMs, decideFallbackHealth, normalizeUploadsPlaylistItemsResponse } from '../../../packages/youtube-connector/dist/fallback.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
if (!supabaseUrl || !serviceRoleKey || !internalSecret || !youtubeApiKey) throw new Error('Missing YouTube discovery-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const PLAYLIST_WINDOW = 50;

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  return difference === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function updateSourceHealth(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.from('source_health').update({ ...values, updated_at: new Date().toISOString() }).eq('source_identity_id', sourceIdentityId).select('source_identity_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({ source_identity_id: sourceIdentityId, health_state: String(values.health_state ?? 'HEALTHY'), ...values });
    if (insertError) throw insertError;
  }
}

function nextCheck(now: Date, existingErrorCode?: string | null, providerFailure = false): string {
  return new Date(now.getTime() + decideDiscoveryIntervalMs({ existingErrorCode, providerFailure })).toISOString();
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: dueRows, error: dueError } = await supabase
      .from('youtube_channel_state')
      .select('source_identity_id,channel_id,uploads_playlist_id,latest_known_video_id,last_fallback_check_at,next_fallback_check_at,fallback_gap_count,consecutive_websub_events')
      .not('uploads_playlist_id', 'is', null)
      .or(`next_fallback_check_at.is.null,next_fallback_check_at.lte.${nowIso}`)
      .order('next_fallback_check_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (dueError) throw dueError;
    if (!dueRows || dueRows.length === 0) return json(200, { due: 0, checked: 0, discoveredUploads: 0 });

    const sourceIds = dueRows.map((row: Record<string, unknown>) => String(row.source_identity_id));
    const { data: activeSources, error: activeError } = await supabase.from('source_identities').select('id').in('id', sourceIds).eq('active', true);
    if (activeError) throw activeError;
    const activeIds = new Set((activeSources ?? []).map((row: Record<string, unknown>) => String(row.id)));

    const { data: healthRows, error: healthError } = await supabase.from('source_health').select('source_identity_id,last_error_code').in('source_identity_id', sourceIds);
    if (healthError) throw healthError;
    const healthErrors = new Map((healthRows ?? []).map((row: Record<string, unknown>) => [String(row.source_identity_id), typeof row.last_error_code === 'string' ? row.last_error_code : null]));

    const { data: quotaUsed, error: quotaError } = await supabase.rpc('connector_quota_used_today', { p_provider: 'YOUTUBE_DATA_API', p_quota_bucket: 'GENERAL_READ' });
    if (quotaError) throw quotaError;
    let usedUnits = Number(quotaUsed ?? 0);
    let checked = 0;
    let discoveredUploads = 0;
    let baselineSources = 0;
    let gapSources = 0;

    for (const row of dueRows as Record<string, unknown>[]) {
      const sourceIdentityId = String(row.source_identity_id);
      if (!activeIds.has(sourceIdentityId)) continue;
      const playlistId = String(row.uploads_playlist_id ?? '');
      const channelId = String(row.channel_id ?? '');
      const previousKnownVideoId = typeof row.latest_known_video_id === 'string' ? row.latest_known_video_id : undefined;
      const existingHealthError = healthErrors.get(sourceIdentityId) ?? null;

      const quota = decideQuota({
        usedUnits,
        requestedUnits: YOUTUBE_QUOTA_POLICY_V1.playlistItemsList.unitsPerRequest,
        hardLimit: YOUTUBE_QUOTA_POLICY_V1.generalReadDefaultDailyUnits,
        reserveUnits: 500,
      });
      if (!quota.allowed) {
        await updateSourceHealth(sourceIdentityId, {
          health_state: 'BUDGET_EXHAUSTED',
          last_attempt_at: nowIso,
          last_error_code: quota.reason,
          last_error_message: 'YouTube quota reserve guard blocked authoritative uploads discovery',
        });
        await supabase.from('youtube_channel_state').update({ next_fallback_check_at: nextCheck(now, existingHealthError, true) }).eq('source_identity_id', sourceIdentityId);
        continue;
      }

      const apiResponse = await fetch(buildUploadsPlaylistItemsUrl(playlistId, youtubeApiKey!, PLAYLIST_WINDOW));
      usedUnits += YOUTUBE_QUOTA_POLICY_V1.playlistItemsList.unitsPerRequest;
      await supabase.from('connector_quota_usage').insert({
        provider: 'YOUTUBE_DATA_API',
        quota_bucket: 'GENERAL_READ',
        method: 'playlistItems.list',
        units: YOUTUBE_QUOTA_POLICY_V1.playlistItemsList.unitsPerRequest,
        request_count: 1,
        source_identity_id: sourceIdentityId,
        response_status: apiResponse.status,
        metadata: { playlistId, maxResults: PLAYLIST_WINDOW, role: 'AUTHORITATIVE_DISCOVERY' },
      });

      if (!apiResponse.ok) {
        const rateLimited = apiResponse.status === 403 || apiResponse.status === 429;
        await updateSourceHealth(sourceIdentityId, {
          health_state: rateLimited ? 'RATE_LIMITED' : 'DEGRADED',
          last_attempt_at: nowIso,
          last_http_status: apiResponse.status,
          last_error_code: 'YOUTUBE_DISCOVERY_API_ERROR',
          last_error_message: `playlistItems.list returned ${apiResponse.status}`,
        });
        await supabase.from('youtube_channel_state').update({ last_fallback_check_at: nowIso, next_fallback_check_at: nextCheck(now, existingHealthError, true) }).eq('source_identity_id', sourceIdentityId);
        continue;
      }

      const uploads = normalizeUploadsPlaylistItemsResponse(await apiResponse.json());
      checked += 1;
      if (uploads.length === 0) {
        const health = decideFallbackHealth({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: existingHealthError });
        await supabase.from('youtube_channel_state').update({ last_fallback_check_at: nowIso, next_fallback_check_at: nextCheck(now, health.errorCode ?? null) }).eq('source_identity_id', sourceIdentityId);
        await updateSourceHealth(sourceIdentityId, {
          health_state: health.degraded ? 'DEGRADED' : 'HEALTHY',
          last_attempt_at: nowIso,
          last_success_at: nowIso,
          last_http_status: 200,
          last_error_code: health.errorCode ?? null,
          last_error_message: health.errorMessage ?? null,
        });
        continue;
      }

      const newest = uploads[0]!;
      if (!previousKnownVideoId) {
        baselineSources += 1;
        const health = decideFallbackHealth({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: existingHealthError });
        await supabase.from('youtube_channel_state').update({
          latest_known_video_id: newest.videoId,
          last_fallback_check_at: nowIso,
          next_fallback_check_at: nextCheck(now, health.errorCode ?? null),
        }).eq('source_identity_id', sourceIdentityId);
        await updateSourceHealth(sourceIdentityId, {
          health_state: health.degraded ? 'DEGRADED' : 'HEALTHY',
          last_attempt_at: nowIso,
          last_success_at: nowIso,
          last_http_status: 200,
          last_error_code: health.errorCode ?? null,
          last_error_message: health.errorMessage ?? null,
        });
        continue;
      }

      const previousIndex = uploads.findIndex((item) => item.videoId === previousKnownVideoId);
      const gapExceededWindow = previousIndex === -1;
      const missing = previousIndex === 0 ? [] : previousIndex > 0 ? uploads.slice(0, previousIndex) : uploads;
      for (const upload of [...missing].reverse()) {
        const timestamp = upload.publishedAt ?? nowIso;
        const { error: enqueueError } = await supabase.rpc('enqueue_job', {
          p_job_type: 'YOUTUBE_ENRICH_VIDEO',
          p_idempotency_key: `youtube:enrich:playlist:${sourceIdentityId}:${upload.videoId}`,
          p_payload: {
            sourceIdentityId,
            notification: {
              videoId: upload.videoId,
              channelId,
              title: upload.title ?? '',
              watchUrl: `https://www.youtube.com/watch?v=${upload.videoId}`,
              publishedAt: upload.publishedAt ?? null,
              updatedAt: timestamp,
              discoveredBy: 'UPLOADS_PLAYLIST_PRIMARY',
            },
          },
          p_priority: 25,
        });
        if (enqueueError) throw enqueueError;
        discoveredUploads += 1;
      }

      if (gapExceededWindow) gapSources += 1;
      const health = decideFallbackHealth({
        gapExceededWindow,
        recoveredUploadCount: missing.length,
        existingErrorCode: existingHealthError,
      });
      const channelUpdate: Record<string, unknown> = {
        latest_known_video_id: newest.videoId,
        last_fallback_check_at: nowIso,
        next_fallback_check_at: nextCheck(now, health.errorCode ?? null),
        fallback_gap_count: Number(row.fallback_gap_count ?? 0) + (gapExceededWindow ? 1 : 0),
      };
      if (missing.length > 0) channelUpdate.consecutive_websub_events = 0;
      await supabase.from('youtube_channel_state').update(channelUpdate).eq('source_identity_id', sourceIdentityId);
      await updateSourceHealth(sourceIdentityId, {
        health_state: health.degraded ? 'DEGRADED' : 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_http_status: 200,
        last_error_code: health.errorCode ?? null,
        last_error_message: health.errorMessage ?? null,
      });
    }

    return json(200, { due: dueRows.length, checked, discoveredUploads, baselineSources, gapSources, quotaUsedBefore: Number(quotaUsed ?? 0), quotaUsedAfter: usedUnits, discoveryMode: 'UPLOADS_PLAYLIST_PRIMARY', webSubRole: 'ACCELERATOR' });
  } catch (error) {
    console.error('youtube-discovery-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
