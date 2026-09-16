import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import {
  YOUTUBE_QUOTA_POLICY_V1,
  YOUTUBE_WEBSUB_HUB_URL,
  YOUTUBE_WEBSUB_PROVIDER,
  assertYouTubeChannelId,
  buildChannelsListUrl,
  decideQuota,
  normalizeChannelsListResponse,
} from '../../../packages/youtube-connector/dist/index.js';
// @deno-types="../../../packages/youtube-connector/dist/subscription.d.ts"
import {
  HUB_RETRY_POLICY,
  decideHubRetry,
  planSubscription,
  planUnsubscription,
} from '../../../packages/youtube-connector/dist/subscription.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const masterSecret = Deno.env.get('CINERELAY_WEBSUB_MASTER_SECRET');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
if (!supabaseUrl || !serviceRoleKey || !masterSecret || !internalSecret || !youtubeApiKey) throw new Error('Missing YouTube subscription-admin environment');
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const callbackBaseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/youtube-websub`;

type HubRequest = { url: string; headers: Record<string, string>; body: string };

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

async function postHubWithRetry(request: HubRequest): Promise<{ response: Response; attempts: number }> {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= HUB_RETRY_POLICY.maxAttempts; attempt += 1) {
    const hubResponse = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(15_000),
    });
    lastResponse = hubResponse;
    if (hubResponse.ok) return { response: hubResponse, attempts: attempt };
    const retry = decideHubRetry({ attempt, status: hubResponse.status });
    if (!retry.retry) return { response: hubResponse, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, retry.delayMs));
  }
  if (!lastResponse) throw new Error('Hub retry loop completed without a response');
  return { response: lastResponse, attempts: HUB_RETRY_POLICY.maxAttempts };
}

async function quotaAllowed(): Promise<boolean> {
  const { data, error } = await supabase.rpc('connector_quota_used_today', { p_provider: 'YOUTUBE_DATA_API', p_quota_bucket: 'GENERAL_READ' });
  if (error) throw error;
  return decideQuota({ usedUnits: Number(data ?? 0), requestedUnits: 1, hardLimit: YOUTUBE_QUOTA_POLICY_V1.generalReadDefaultDailyUnits, reserveUnits: 500 }).allowed;
}

async function validateChannel(sourceIdentityId: string, channelId: string) {
  if (!(await quotaAllowed())) throw new Error('YouTube quota reserve guard is active');
  const apiResponse = await fetch(buildChannelsListUrl([channelId], youtubeApiKey!));
  await supabase.from('connector_quota_usage').insert({ provider: 'YOUTUBE_DATA_API', quota_bucket: 'GENERAL_READ', method: 'channels.list', units: 1, source_identity_id: sourceIdentityId, response_status: apiResponse.status });
  if (!apiResponse.ok) throw new Error(`YouTube channels.list failed with ${apiResponse.status}`);
  const snapshots = normalizeChannelsListResponse(await apiResponse.json());
  const snapshot = snapshots.find((item) => item.channelId === channelId);
  if (!snapshot) throw new Error('YouTube channel was not returned by channels.list');
  const { error } = await supabase.from('youtube_channel_state').upsert({ source_identity_id: sourceIdentityId, channel_id: channelId, uploads_playlist_id: snapshot.uploadsPlaylistId ?? null }, { onConflict: 'source_identity_id' });
  if (error) throw error;
  return snapshot;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return response(401, { error: 'unauthorized' });
    const body = await request.json() as { sourceIdentityId?: string; action?: 'subscribe' | 'renew' | 'unsubscribe' };
    const sourceIdentityId = body.sourceIdentityId ?? '';
    const action = body.action ?? 'subscribe';
    if (!sourceIdentityId) return response(400, { error: 'sourceIdentityId_required' });

    const { data: identity, error: identityError } = await supabase.from('source_identities').select('id,platform,platform_identity_id,active').eq('id', sourceIdentityId).maybeSingle();
    if (identityError) throw identityError;
    if (!identity || identity.active !== true || identity.platform !== 'YOUTUBE' || typeof identity.platform_identity_id !== 'string') return response(404, { error: 'active_youtube_source_identity_not_found' });
    const channelId = identity.platform_identity_id;
    assertYouTubeChannelId(channelId);

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('connector_subscriptions')
      .select('id,generation,state,requested_at,verified_at,expires_at,renew_after')
      .eq('provider', YOUTUBE_WEBSUB_PROVIDER)
      .eq('source_identity_id', sourceIdentityId)
      .order('generation', { ascending: false })
      .limit(20);
    if (subscriptionError) throw subscriptionError;
    const rows = subscriptions ?? [];
    const latestGeneration = Math.max(0, ...rows.map((item) => Number(item.generation)));

    if (action === 'unsubscribe') {
      const alreadyStopping = rows.find((item) => item.state === 'UNSUBSCRIBING');
      if (alreadyStopping) return response(200, { action, skipped: true, reason: 'unsubscribe_already_in_flight', generation: Number(alreadyStopping.generation), state: alreadyStopping.state });
      const active = rows.find((item) => item.state === 'ACTIVE') ?? rows.find((item) => item.state === 'SUPERSEDED');
      if (!active) return response(409, { error: 'no_active_subscription' });
      const plan = await planUnsubscription({ sourceIdentityId, channelId, generation: Number(active.generation), callbackBaseUrl, masterSecret: masterSecret! });
      const hub = await postHubWithRetry(plan.hubRequest);
      if (!hub.response.ok) return response(502, { error: 'hub_unsubscribe_rejected', status: hub.response.status, attempts: hub.attempts });
      const { error } = await supabase.from('connector_subscriptions').update({ state: 'UNSUBSCRIBING', last_error: null }).eq('id', active.id);
      if (error) throw error;
      return response(202, { action, generation: Number(active.generation), hub: YOUTUBE_WEBSUB_HUB_URL, hubAttempts: hub.attempts });
    }

    if (action === 'subscribe') {
      const existing = rows.find((item) => ['ACTIVE', 'PENDING', 'RENEWING'].includes(String(item.state)));
      if (existing) {
        return response(200, {
          action,
          skipped: true,
          reason: 'subscription_already_present',
          generation: Number(existing.generation),
          state: String(existing.state),
          expiresAt: existing.expires_at ?? null,
        });
      }
    }

    if (action === 'renew') {
      const inFlight = rows.find((item) => item.state === 'PENDING' || item.state === 'RENEWING');
      if (inFlight) {
        return response(200, {
          action,
          skipped: true,
          reason: 'renewal_already_in_flight',
          generation: Number(inFlight.generation),
          state: String(inFlight.state),
        });
      }
      const active = rows.find((item) => item.state === 'ACTIVE');
      if (!active) return response(409, { error: 'no_active_subscription_to_renew' });
    }

    const channel = await validateChannel(sourceIdentityId, channelId);
    const requestedLeaseSeconds = 864000;
    const plan = await planSubscription({ sourceIdentityId, channelId, currentGeneration: latestGeneration, callbackBaseUrl, masterSecret: masterSecret!, requestedLeaseSeconds });
    const { error: insertError } = await supabase.from('connector_subscriptions').insert({ source_identity_id: sourceIdentityId, provider: YOUTUBE_WEBSUB_PROVIDER, hub_url: YOUTUBE_WEBSUB_HUB_URL, topic_url: plan.topicUrl, callback_token_hash: plan.callbackTokenHash, generation: plan.generation, signature_required: true, state: plan.state });
    if (insertError) throw insertError;

    const hub = await postHubWithRetry(plan.hubRequest);
    if (!hub.response.ok) {
      await supabase.from('connector_subscriptions').update({ state: 'ERROR', last_error: `hub request failed with ${hub.response.status} after ${hub.attempts} attempt(s)` }).eq('provider', YOUTUBE_WEBSUB_PROVIDER).eq('source_identity_id', sourceIdentityId).eq('generation', plan.generation);
      return response(502, { error: 'hub_subscribe_rejected', status: hub.response.status, attempts: hub.attempts });
    }

    return response(202, {
      action,
      generation: plan.generation,
      channel: { id: channel.channelId, title: channel.title, uploadsPlaylistId: channel.uploadsPlaylistId ?? null },
      hub: YOUTUBE_WEBSUB_HUB_URL,
      hubAttempts: hub.attempts,
    });
  } catch (error) {
    console.error('youtube-subscription-admin failure', error);
    return response(500, { error: 'internal_error' });
  }
});
