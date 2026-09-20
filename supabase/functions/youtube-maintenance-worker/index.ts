import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import {
  YOUTUBE_QUOTA_POLICY_V1,
  buildChannelsListUrl,
  decideQuota,
  normalizeChannelsListResponse,
} from '../../../packages/youtube-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
if (!supabaseUrl || !serviceRoleKey || !internalSecret || !youtubeApiKey) throw new Error('Missing YouTube maintenance-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const VERIFICATION_TIMEOUT_MS = 15 * 60 * 1000;
const ARTWORK_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const ARTWORK_BATCH_SIZE = 50;

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

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function callSubscriptionAdmin(sourceIdentityId: string, action: 'renew'): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(`${supabaseUrl!.replace(/\/$/, '')}/functions/v1/youtube-subscription-admin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cinerelay-internal-key': internalSecret!,
    },
    body: JSON.stringify({ sourceIdentityId, action }),
  });
  return { ok: response.ok, status: response.status };
}

async function markHealth(sourceIdentityId: string, healthState: string, code: string | null, message: string | null): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('source_health').update({
    health_state: healthState,
    last_attempt_at: now,
    last_error_code: code,
    last_error_message: message,
    updated_at: now,
  }).eq('source_identity_id', sourceIdentityId).select('source_identity_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: healthState,
      last_attempt_at: now,
      last_error_code: code,
      last_error_message: message,
    });
    if (insertError) throw insertError;
  }
}

async function refreshSourceArtwork(limit: number): Promise<{
  due: number;
  refreshed: number;
  apiRequests: number;
  failures: number;
  quotaSkipped: boolean;
}> {
  const { data: identityRows, error: identityError } = await supabase
    .from('source_identities')
    .select('id,platform_identity_id,connector_config')
    .eq('platform', 'YOUTUBE')
    .eq('active', true)
    .limit(250);
  if (identityError) throw identityError;

  const staleBefore = Date.now() - ARTWORK_REFRESH_MS;
  const dueRows = (identityRows ?? []).filter((row: Record<string, unknown>) => {
    const config = recordValue(row.connector_config);
    const artworkUrl = stringValue(config.artworkUrl);
    const refreshedAt = stringValue(config.artworkRefreshedAt);
    const refreshedMs = refreshedAt ? Date.parse(refreshedAt) : Number.NaN;
    return !artworkUrl || !Number.isFinite(refreshedMs) || refreshedMs < staleBefore;
  }).slice(0, limit);

  if (dueRows.length === 0) return { due: 0, refreshed: 0, apiRequests: 0, failures: 0, quotaSkipped: false };

  const channelIds = [...new Set(dueRows
    .map((row: Record<string, unknown>) => stringValue(row.platform_identity_id))
    .filter((value): value is string => value !== null))];
  if (channelIds.length === 0) return { due: dueRows.length, refreshed: 0, apiRequests: 0, failures: dueRows.length, quotaSkipped: false };

  const batches: string[][] = [];
  for (let index = 0; index < channelIds.length; index += ARTWORK_BATCH_SIZE) batches.push(channelIds.slice(index, index + ARTWORK_BATCH_SIZE));

  const { data: usedUnits, error: quotaError } = await supabase.rpc('connector_quota_used_today', {
    p_provider: 'YOUTUBE_DATA_API',
    p_quota_bucket: 'GENERAL_READ',
  });
  if (quotaError) throw quotaError;

  const quota = decideQuota({
    usedUnits: Number(usedUnits ?? 0),
    requestedUnits: batches.length * YOUTUBE_QUOTA_POLICY_V1.channelsList.unitsPerRequest,
    hardLimit: YOUTUBE_QUOTA_POLICY_V1.generalReadDefaultDailyUnits,
    reserveUnits: 500,
  });
  if (!quota.allowed) return { due: dueRows.length, refreshed: 0, apiRequests: 0, failures: 0, quotaSkipped: true };

  const snapshotMap = new Map<string, ReturnType<typeof normalizeChannelsListResponse>[number]>();
  let apiRequests = 0;
  let failures = 0;

  for (const batch of batches) {
    const response = await fetch(buildChannelsListUrl(batch, youtubeApiKey!));
    apiRequests += 1;
    const { error: usageError } = await supabase.from('connector_quota_usage').insert({
      provider: 'YOUTUBE_DATA_API',
      quota_bucket: 'GENERAL_READ',
      method: 'channels.list',
      units: YOUTUBE_QUOTA_POLICY_V1.channelsList.unitsPerRequest,
      request_count: 1,
      response_status: response.status,
      metadata: { purpose: 'SOURCE_ARTWORK_REFRESH', channelCount: batch.length },
    });
    if (usageError) throw usageError;

    if (!response.ok) {
      failures += batch.length;
      continue;
    }
    for (const snapshot of normalizeChannelsListResponse(await response.json())) snapshotMap.set(snapshot.channelId, snapshot);
  }

  const refreshedAt = new Date().toISOString();
  let refreshed = 0;
  for (const row of dueRows as Record<string, unknown>[]) {
    const identityId = stringValue(row.id);
    const channelId = stringValue(row.platform_identity_id);
    if (!identityId || !channelId) {
      failures += 1;
      continue;
    }
    const snapshot = snapshotMap.get(channelId);
    if (!snapshot) {
      failures += 1;
      continue;
    }

    const existingConfig = recordValue(row.connector_config);
    const nextConfig: Record<string, unknown> = {
      ...existingConfig,
      artworkRefreshedAt: refreshedAt,
      providerTitle: snapshot.title,
    };
    if (snapshot.thumbnailUrl) nextConfig.artworkUrl = snapshot.thumbnailUrl;
    if (snapshot.customUrl) nextConfig.providerCustomUrl = snapshot.customUrl;

    const { error: updateError } = await supabase.from('source_identities')
      .update({ connector_config: nextConfig, updated_at: refreshedAt })
      .eq('id', identityId);
    if (updateError) {
      failures += 1;
      continue;
    }
    refreshed += 1;
  }

  return { due: dueRows.length, refreshed, apiRequests, failures, quotaSkipped: false };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number; artworkLimit?: number };
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 50)));
    const artworkLimit = Math.max(1, Math.min(100, Number(body.artworkLimit ?? 100)));
    const now = new Date();
    const nowIso = now.toISOString();
    const timeoutCutoff = new Date(now.getTime() - VERIFICATION_TIMEOUT_MS).toISOString();

    const { data: expiredRows, error: expiredError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .eq('state', 'ACTIVE')
      .lt('expires_at', nowIso)
      .limit(limit);
    if (expiredError) throw expiredError;

    for (const row of expiredRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      await supabase.from('connector_subscriptions').update({ state: 'EXPIRED', renew_after: null, last_error: 'lease expired before renewal activation' }).eq('id', (row as Record<string, unknown>).id);
      await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_LEASE_EXPIRED', 'WebSub lease expired before a replacement generation became active');
    }

    const { data: timedOutRows, error: timeoutError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation,state')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .in('state', ['PENDING', 'RENEWING'])
      .lt('requested_at', timeoutCutoff)
      .limit(limit);
    if (timeoutError) throw timeoutError;

    for (const row of timedOutRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      await supabase.from('connector_subscriptions').update({ state: 'ERROR', renew_after: null, last_error: 'hub verification timeout' }).eq('id', (row as Record<string, unknown>).id);
      await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_VERIFICATION_TIMEOUT', 'WebSub hub did not verify the requested generation within the timeout window');
    }

    const { data: inFlightRows, error: inFlightError } = await supabase
      .from('connector_subscriptions')
      .select('source_identity_id')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .in('state', ['PENDING', 'RENEWING'])
      .gte('requested_at', timeoutCutoff);
    if (inFlightError) throw inFlightError;
    const inFlightSources = new Set((inFlightRows ?? []).map((row: Record<string, unknown>) => String(row.source_identity_id)));

    const { data: dueRows, error: dueError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation,renew_after,expires_at')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .eq('state', 'ACTIVE')
      .lte('renew_after', nowIso)
      .gt('expires_at', nowIso)
      .order('renew_after', { ascending: true })
      .limit(limit);
    if (dueError) throw dueError;

    let renewed = 0;
    let renewalFailures = 0;
    let skippedInFlight = 0;
    for (const row of dueRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      if (inFlightSources.has(sourceIdentityId)) {
        skippedInFlight += 1;
        continue;
      }
      const result = await callSubscriptionAdmin(sourceIdentityId, 'renew');
      if (result.ok) {
        renewed += 1;
      } else {
        renewalFailures += 1;
        await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_RENEW_REQUEST_FAILED', `Subscription admin returned ${result.status}`);
      }
    }

    const artwork = await refreshSourceArtwork(artworkLimit);

    return json(200, {
      expired: expiredRows?.length ?? 0,
      verificationTimeouts: timedOutRows?.length ?? 0,
      renewalDue: dueRows?.length ?? 0,
      renewed,
      renewalFailures,
      skippedInFlight,
      artwork,
    });
  } catch (error) {
    console.error('youtube-maintenance-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
