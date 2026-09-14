import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import {
  YOUTUBE_WEBSUB_PROVIDER,
  assertNotificationBodySize,
  buildVerificationResponse,
  calculateSubscriptionTimes,
  deriveWebSubCredential,
  notificationExternalKey,
  parseWebSubVerification,
  parseYouTubeAtomFeed,
  sha256Hex,
  verifyHubSignature,
} from '../../../packages/youtube-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webSubMasterSecret = Deno.env.get('CINERELAY_WEBSUB_MASTER_SECRET');
if (!supabaseUrl || !serviceRoleKey || !webSubMasterSecret) throw new Error('Missing required CineRelay WebSub environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function subscriptionForToken(token: string) {
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from('connector_subscriptions')
    .select('id,source_identity_id,topic_url,generation,signature_required,state,expires_at')
    .eq('provider', YOUTUBE_WEBSUB_PROVIDER)
    .eq('callback_token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function channelForSource(sourceIdentityId: string) {
  const { data, error } = await supabase
    .from('youtube_channel_state')
    .select('channel_id')
    .eq('source_identity_id', sourceIdentityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleVerification(requestUrl: URL, subscription: Record<string, unknown>): Promise<Response> {
  let verification;
  try {
    verification = parseWebSubVerification(requestUrl.searchParams);
  } catch {
    return new Response('Not Found', { status: 404 });
  }
  if (verification.topic !== subscription.topic_url) return new Response('Not Found', { status: 404 });
  const subscriptionId = String(subscription.id);
  if (verification.mode === 'subscribe') {
    const allowedStates = new Set(['PENDING', 'ACTIVE', 'RENEWING']);
    if (!allowedStates.has(String(subscription.state)) || verification.leaseSeconds === undefined) return new Response('Not Found', { status: 404 });
    const now = new Date();
    const times = calculateSubscriptionTimes(now, verification.leaseSeconds);
    const { error } = await supabase.rpc('activate_connector_subscription', {
      p_subscription_id: subscriptionId,
      p_lease_seconds: verification.leaseSeconds,
      p_verified_at: now.toISOString(),
      p_expires_at: times.expiresAt,
      p_renew_after: times.renewAfter,
    });
    if (error) throw error;
  } else {
    const allowedStates = new Set(['ACTIVE', 'RENEWING', 'SUPERSEDED', 'UNSUBSCRIBING', 'INACTIVE']);
    if (!allowedStates.has(String(subscription.state))) return new Response('Not Found', { status: 404 });
    const { error } = await supabase.rpc('deactivate_connector_subscription', { p_subscription_id: subscriptionId });
    if (error) throw error;
  }
  return buildVerificationResponse(verification.challenge);
}

function subscriptionCanReceive(subscription: Record<string, unknown>): boolean {
  const state = String(subscription.state);
  if (state === 'ACTIVE') return true;
  if (state !== 'SUPERSEDED') return false;
  const expiresAt = typeof subscription.expires_at === 'string' ? Date.parse(subscription.expires_at) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function handleNotification(request: Request, subscription: Record<string, unknown>): Promise<Response> {
  if (!subscriptionCanReceive(subscription)) return new Response(null, { status: 410 });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 0) {
    try { assertNotificationBodySize(contentLength); } catch { return json(413, { error: 'payload_too_large' }); }
  }
  const body = new Uint8Array(await request.arrayBuffer());
  try { assertNotificationBodySize(body.byteLength); } catch { return json(413, { error: 'payload_too_large' }); }
  const sourceIdentityId = String(subscription.source_identity_id);
  const generation = Number(subscription.generation);
  const hubSecret = await deriveWebSubCredential(webSubMasterSecret!, sourceIdentityId, generation, 'hub-secret');
  const signatureRequired = subscription.signature_required !== false;
  if (signatureRequired && !(await verifyHubSignature(body, request.headers.get('x-hub-signature'), hubSecret))) {
    return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } });
  }
  const xml = new TextDecoder().decode(body);
  let notifications;
  try { notifications = parseYouTubeAtomFeed(xml); } catch { return json(400, { error: 'invalid_youtube_atom' }); }
  const channel = await channelForSource(sourceIdentityId);
  if (!channel) return json(409, { error: 'youtube_channel_state_missing' });
  const expectedChannelId = String(channel.channel_id);
  const payloadSha256 = await sha256Hex(body);
  let accepted = 0;
  let latestVideoId: string | null = null;
  for (const notification of notifications) {
    if (notification.channelId !== expectedChannelId) continue;
    const externalKey = notificationExternalKey(notification);
    const { error: receiptError } = await supabase.from('connector_receipts').upsert({ provider: YOUTUBE_WEBSUB_PROVIDER, source_identity_id: sourceIdentityId, external_key: externalKey, payload_sha256: payloadSha256, status: 'QUEUED', metadata: notification }, { onConflict: 'provider,external_key', ignoreDuplicates: true });
    if (receiptError) throw receiptError;
    const { error: jobError } = await supabase.rpc('enqueue_job', { p_job_type: 'YOUTUBE_ENRICH_VIDEO', p_idempotency_key: `youtube:enrich:${externalKey}`, p_payload: { sourceIdentityId, subscriptionId: String(subscription.id), notification }, p_priority: 20 });
    if (jobError) throw jobError;
    latestVideoId = notification.videoId;
    accepted += 1;
  }
  if (accepted > 0) {
    const { error } = await supabase.from('youtube_channel_state').update({ last_websub_at: new Date().toISOString(), latest_known_video_id: latestVideoId, consecutive_websub_events: accepted }).eq('source_identity_id', sourceIdentityId);
    if (error) throw error;
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token || token.length > 256) return new Response('Not Found', { status: 404 });
    const subscription = await subscriptionForToken(token);
    if (!subscription) return new Response('Not Found', { status: 404 });
    if (request.method === 'GET') return await handleVerification(url, subscription);
    if (request.method === 'POST') return await handleNotification(request, subscription);
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  } catch (error) {
    console.error('youtube-websub failure', error);
    return json(500, { error: 'internal_error' });
  }
});
