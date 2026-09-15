import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/domain/dist/index.d.ts"
import { normalizeText } from '../../../packages/domain/dist/index.js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import {
  YOUTUBE_QUOTA_POLICY_V1,
  buildVideosListUrl,
  decideQuota,
  normalizeVideosListResponse,
} from '../../../packages/youtube-connector/dist/index.js';
// @deno-types="../../../packages/youtube-connector/dist/enrichment.d.ts"
import { projectVideoSnapshotToRawItem } from '../../../packages/youtube-connector/dist/enrichment.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
if (!supabaseUrl || !serviceRoleKey || !internalSecret || !youtubeApiKey) throw new Error('Missing YouTube enrichment-worker environment');
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  return difference === 0;
}

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function failJob(job: Record<string, unknown>, workerId: string, error: string): Promise<void> {
  const attemptCount = Number(job.attempt_count ?? 1);
  const retrySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1));
  await supabase.rpc('fail_job', { p_job_id: String(job.id), p_worker_id: workerId, p_error: error, p_retry_after_seconds: retrySeconds });
}

async function setSourceHealth(sourceIdentityId: string, healthState: string, details: Record<string, unknown> = {}): Promise<void> {
  await supabase.from('source_health').upsert({ source_identity_id: sourceIdentityId, health_state: healthState, updated_at: new Date().toISOString(), ...details }, { onConflict: 'source_identity_id' });
}

Deno.serve(async (request) => {
  const workerId = `youtube-enrichment:${crypto.randomUUID()}`;
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return response(401, { error: 'unauthorized' });
    const requested = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(requested.limit ?? 25)));
    const { data: jobs, error: leaseError } = await supabase.rpc('lease_jobs', { p_job_type: 'YOUTUBE_ENRICH_VIDEO', p_worker_id: workerId, p_limit: limit, p_lease_seconds: 120 });
    if (leaseError) throw leaseError;
    if (!jobs || jobs.length === 0) return response(200, { leased: 0, processed: 0 });

    const { data: quotaUsed, error: quotaError } = await supabase.rpc('connector_quota_used_today', { p_provider: 'YOUTUBE_DATA_API', p_quota_bucket: 'GENERAL_READ' });
    if (quotaError) throw quotaError;
    const quota = decideQuota({ usedUnits: Number(quotaUsed ?? 0), requestedUnits: 1, hardLimit: YOUTUBE_QUOTA_POLICY_V1.generalReadDefaultDailyUnits, reserveUnits: 500 });
    if (!quota.allowed) {
      for (const job of jobs as Record<string, unknown>[]) {
        const payload = job.payload as Record<string, unknown> | undefined;
        const sourceIdentityId = typeof payload?.sourceIdentityId === 'string' ? payload.sourceIdentityId : '';
        if (sourceIdentityId) await setSourceHealth(sourceIdentityId, 'BUDGET_EXHAUSTED', { last_error_code: quota.reason, last_error_message: 'YouTube quota reserve guard is active' });
        await failJob(job, workerId, `quota:${quota.reason}`);
      }
      return response(429, { leased: jobs.length, processed: 0, quota });
    }

    const parsedJobs = (jobs as Record<string, unknown>[]).map((job) => {
      const payload = job.payload as Record<string, unknown> | undefined;
      const notification = payload?.notification as Record<string, unknown> | undefined;
      return { job, sourceIdentityId: typeof payload?.sourceIdentityId === 'string' ? payload.sourceIdentityId : '', externalKey: notification && typeof notification.videoId === 'string' && typeof notification.updatedAt === 'string' ? `${notification.videoId}:${notification.updatedAt}` : '', videoId: notification && typeof notification.videoId === 'string' ? notification.videoId : '' };
    });
    const validJobs = parsedJobs.filter((item) => item.sourceIdentityId && item.videoId);
    const videoIds = [...new Set(validJobs.map((item) => item.videoId))];
    if (videoIds.length === 0) {
      for (const item of parsedJobs) await failJob(item.job, workerId, 'invalid_job_payload');
      return response(400, { leased: jobs.length, processed: 0, error: 'invalid_job_payload' });
    }

    const apiResponse = await fetch(buildVideosListUrl(videoIds, youtubeApiKey!));
    await supabase.from('connector_quota_usage').insert({ provider: 'YOUTUBE_DATA_API', quota_bucket: 'GENERAL_READ', method: 'videos.list', units: 1, request_count: 1, response_status: apiResponse.status, metadata: { videoCount: videoIds.length } });
    if (!apiResponse.ok) {
      for (const item of validJobs) {
        await setSourceHealth(item.sourceIdentityId, apiResponse.status === 403 ? 'RATE_LIMITED' : 'DEGRADED', { last_attempt_at: new Date().toISOString(), last_http_status: apiResponse.status, last_error_code: 'YOUTUBE_API_ERROR', last_error_message: `videos.list returned ${apiResponse.status}` });
        await failJob(item.job, workerId, `youtube_api:${apiResponse.status}`);
      }
      return response(502, { leased: jobs.length, processed: 0, youtubeStatus: apiResponse.status });
    }

    const snapshots = normalizeVideosListResponse(await apiResponse.json());
    const byId = new Map(snapshots.map((snapshot) => [snapshot.videoId, snapshot]));
    let processed = 0;
    for (const item of validJobs) {
      try {
        const snapshot = byId.get(item.videoId);
        if (!snapshot) {
          await supabase.rpc('mark_raw_item_unavailable', { p_source_identity_id: item.sourceIdentityId, p_platform_item_id: item.videoId });
          if (item.externalKey) await supabase.from('connector_receipts').update({ status: 'IGNORED', processed_at: new Date().toISOString(), error_message: 'video_not_returned_by_api' }).eq('provider', 'YOUTUBE_WEBSUB').eq('external_key', item.externalKey);
          await supabase.rpc('complete_job', { p_job_id: String(item.job.id), p_worker_id: workerId });
          continue;
        }
        const projection = await projectVideoSnapshotToRawItem(snapshot);
        const { data: persisted, error: persistError } = await supabase.rpc('upsert_raw_item_revision', {
          p_source_identity_id: item.sourceIdentityId,
          p_platform_item_id: projection.platformItemId,
          p_canonical_url: projection.canonicalUrl,
          p_published_at: projection.publishedAt,
          p_item_type: projection.itemType,
          p_raw_title: projection.rawTitle,
          p_raw_text: projection.rawText,
          p_normalized_text: normalizeText(`${projection.rawTitle} ${projection.rawText}`),
          p_media_type: projection.mediaType,
          p_metadata: projection.metadata,
          p_content_fingerprint: projection.contentFingerprint,
        });
        if (persistError) throw persistError;
        const row = Array.isArray(persisted) ? persisted[0] : persisted;
        const rawItemId = row?.raw_item_id;
        if (!rawItemId) throw new Error('raw item persistence returned no id');
        if (row.is_new || row.is_changed) {
          const { error: queueError } = await supabase.rpc('enqueue_job', { p_job_type: 'PROCESS_RAW_ITEM', p_idempotency_key: `process:raw:${rawItemId}:${projection.contentFingerprint}`, p_payload: { rawItemId, sourceIdentityId: item.sourceIdentityId }, p_priority: 30 });
          if (queueError) throw queueError;
        }
        const now = new Date().toISOString();
        const { error: healthError } = await supabase.rpc('record_youtube_enrichment_success', {
          p_source_identity_id: item.sourceIdentityId,
          p_succeeded_at: now,
          p_item_at: snapshot.publishedAt ?? now,
        });
        if (healthError) throw healthError;
        await supabase.from('youtube_channel_state').update({ last_enriched_at: now, latest_known_video_id: snapshot.videoId }).eq('source_identity_id', item.sourceIdentityId);
        if (item.externalKey) await supabase.from('connector_receipts').update({ status: 'PROCESSED', processed_at: now, error_message: null }).eq('provider', 'YOUTUBE_WEBSUB').eq('external_key', item.externalKey);
        await supabase.rpc('complete_job', { p_job_id: String(item.job.id), p_worker_id: workerId });
        processed += 1;
      } catch (error) {
        await setSourceHealth(item.sourceIdentityId, 'DEGRADED', { last_attempt_at: new Date().toISOString(), last_error_code: 'ENRICHMENT_FAILED', last_error_message: String(error) });
        await failJob(item.job, workerId, String(error));
      }
    }
    return response(200, { leased: jobs.length, processed, quota: { usedBefore: Number(quotaUsed ?? 0), charged: 1 } });
  } catch (error) {
    console.error('youtube-enrichment-worker failure', error);
    return response(500, { error: 'internal_error', workerId });
  }
});
