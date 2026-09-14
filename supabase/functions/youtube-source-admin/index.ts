import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/index.d.ts"
import {
  YOUTUBE_QUOTA_POLICY_V1,
  assertYouTubeChannelId,
  buildChannelsListUrl,
  decideQuota,
  normalizeChannelsListResponse,
} from '../../../packages/youtube-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
if (!supabaseUrl || !serviceRoleKey || !internalSecret || !youtubeApiKey) throw new Error('Missing YouTube source-admin environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

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

async function quotaAllowed(): Promise<boolean> {
  const { data, error } = await supabase.rpc('connector_quota_used_today', { p_provider: 'YOUTUBE_DATA_API', p_quota_bucket: 'GENERAL_READ' });
  if (error) throw error;
  return decideQuota({
    usedUnits: Number(data ?? 0),
    requestedUnits: YOUTUBE_QUOTA_POLICY_V1.channelsList.unitsPerRequest,
    hardLimit: YOUTUBE_QUOTA_POLICY_V1.generalReadDefaultDailyUnits,
    reserveUnits: 500,
  }).allowed;
}

async function validateChannel(channelId: string) {
  if (!(await quotaAllowed())) throw new Error('YouTube quota reserve guard is active');
  const apiResponse = await fetch(buildChannelsListUrl([channelId], youtubeApiKey!));
  await supabase.from('connector_quota_usage').insert({
    provider: 'YOUTUBE_DATA_API',
    quota_bucket: 'GENERAL_READ',
    method: 'channels.list',
    units: YOUTUBE_QUOTA_POLICY_V1.channelsList.unitsPerRequest,
    request_count: 1,
    response_status: apiResponse.status,
    metadata: { channelId, purpose: 'SOURCE_REGISTRATION' },
  });
  if (!apiResponse.ok) throw new Error(`YouTube channels.list failed with ${apiResponse.status}`);
  const snapshots = normalizeChannelsListResponse(await apiResponse.json());
  const snapshot = snapshots.find((item) => item.channelId === channelId);
  if (!snapshot) throw new Error('YouTube channel was not returned by channels.list');
  return snapshot;
}

async function callSubscriptionAdmin(sourceIdentityId: string, action: 'subscribe' | 'unsubscribe'): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${supabaseUrl!.replace(/\/$/, '')}/functions/v1/youtube-subscription-admin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cinerelay-internal-key': internalSecret!,
    },
    body: JSON.stringify({ sourceIdentityId, action }),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function replaceScope(sourceIdentityId: string, entityIds: string[]): Promise<number> {
  const ids = [...new Set(entityIds.filter(Boolean))];
  const { data, error } = await supabase.rpc('replace_source_entity_candidates', {
    p_source_identity_id: sourceIdentityId,
    p_entity_ids: ids,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function register(body: {
  channelId?: string;
  displayName?: string;
  authorityTier?: number;
  sourceRole?: string;
  entityIds?: string[];
  subscribe?: boolean;
}) {
  const channelId = body.channelId ?? '';
  assertYouTubeChannelId(channelId);
  const authorityTier = Number(body.authorityTier ?? 1);
  if (!Number.isInteger(authorityTier) || authorityTier < 1 || authorityTier > 5) throw new Error('authorityTier must be between 1 and 5');
  const sourceRole = (body.sourceRole ?? 'PRODUCTION_HOUSE').trim();
  if (!sourceRole || sourceRole.length > 100) throw new Error('Invalid sourceRole');

  const channel = await validateChannel(channelId);
  const displayName = (body.displayName ?? channel.title).trim();
  if (!displayName || displayName.length > 300) throw new Error('Invalid displayName');

  const { data: existingIdentity, error: existingError } = await supabase
    .from('source_identities')
    .select('id,source_id,active')
    .eq('platform', 'YOUTUBE')
    .eq('platform_identity_id', channelId)
    .maybeSingle();
  if (existingError) throw existingError;

  let sourceId: string;
  let sourceIdentityId: string;
  let created = false;

  if (existingIdentity) {
    sourceId = String(existingIdentity.source_id);
    sourceIdentityId = String(existingIdentity.id);
    const { error: sourceUpdateError } = await supabase.from('sources').update({
      display_name: displayName,
      authority_tier: authorityTier,
      source_role: sourceRole,
      active: true,
    }).eq('id', sourceId);
    if (sourceUpdateError) throw sourceUpdateError;
    const { error: identityUpdateError } = await supabase.from('source_identities').update({
      canonical_url: `https://www.youtube.com/channel/${channelId}`,
      connector_type: 'YOUTUBE_WEBSUB',
      poll_class: 'PUSH',
      access_mode: 'WEBHOOK',
      active: true,
    }).eq('id', sourceIdentityId);
    if (identityUpdateError) throw identityUpdateError;
  } else {
    const { data: source, error: sourceError } = await supabase.from('sources').insert({
      display_name: displayName,
      authority_tier: authorityTier,
      source_role: sourceRole,
      active: true,
      notes: 'Registered by youtube-source-admin',
    }).select('id').single();
    if (sourceError) throw sourceError;
    sourceId = String(source.id);

    const { data: identity, error: identityError } = await supabase.from('source_identities').insert({
      source_id: sourceId,
      platform: 'YOUTUBE',
      platform_identity_id: channelId,
      handle: channel.customUrl ?? null,
      canonical_url: `https://www.youtube.com/channel/${channelId}`,
      connector_type: 'YOUTUBE_WEBSUB',
      poll_class: 'PUSH',
      access_mode: 'WEBHOOK',
      connector_config: { schemaVersion: 1 },
      active: true,
    }).select('id').single();
    if (identityError) throw identityError;
    sourceIdentityId = String(identity.id);
    created = true;
  }

  const nowIso = new Date().toISOString();
  const { error: channelStateError } = await supabase.from('youtube_channel_state').upsert({
    source_identity_id: sourceIdentityId,
    channel_id: channelId,
    uploads_playlist_id: channel.uploadsPlaylistId ?? null,
    next_fallback_check_at: channel.uploadsPlaylistId ? nowIso : null,
  }, { onConflict: 'source_identity_id' });
  if (channelStateError) throw channelStateError;

  const { error: healthError } = await supabase.from('source_health').upsert({
    source_identity_id: sourceIdentityId,
    health_state: 'HEALTHY',
    last_attempt_at: nowIso,
    last_success_at: nowIso,
    next_due_at: null,
    consecutive_failures: 0,
    last_http_status: 200,
    last_error_code: null,
    last_error_message: null,
    parser_version: 'youtube-v1',
  }, { onConflict: 'source_identity_id' });
  if (healthError) throw healthError;

  const scopeCount = await replaceScope(sourceIdentityId, body.entityIds ?? []);
  const shouldSubscribe = body.subscribe !== false;
  const subscription = shouldSubscribe ? await callSubscriptionAdmin(sourceIdentityId, 'subscribe') : null;
  if (subscription && !subscription.ok) {
    await supabase.from('source_health').update({
      health_state: 'DEGRADED',
      last_error_code: 'WEBSUB_SUBSCRIBE_FAILED',
      last_error_message: `Subscription admin returned ${subscription.status}`,
      updated_at: new Date().toISOString(),
    }).eq('source_identity_id', sourceIdentityId);
  }

  return {
    created,
    sourceId,
    sourceIdentityId,
    channel: {
      id: channel.channelId,
      title: channel.title,
      customUrl: channel.customUrl ?? null,
      uploadsPlaylistId: channel.uploadsPlaylistId ?? null,
    },
    scopeCount,
    subscription,
  };
}

async function updateScope(body: { sourceIdentityId?: string; entityIds?: string[] }) {
  const sourceIdentityId = body.sourceIdentityId ?? '';
  if (!sourceIdentityId) throw new Error('sourceIdentityId_required');
  const scopeCount = await replaceScope(sourceIdentityId, body.entityIds ?? []);
  return { sourceIdentityId, scopeCount };
}

async function disable(body: { sourceIdentityId?: string }) {
  const sourceIdentityId = body.sourceIdentityId ?? '';
  if (!sourceIdentityId) throw new Error('sourceIdentityId_required');
  const subscription = await callSubscriptionAdmin(sourceIdentityId, 'unsubscribe');
  const { error: identityError } = await supabase.from('source_identities').update({ active: false }).eq('id', sourceIdentityId);
  if (identityError) throw identityError;
  await supabase.from('source_entity_candidates').update({ active: false, valid_to: new Date().toISOString() }).eq('source_identity_id', sourceIdentityId);
  await supabase.from('source_health').upsert({ source_identity_id: sourceIdentityId, health_state: 'DISABLED', updated_at: new Date().toISOString() }, { onConflict: 'source_identity_id' });
  return { sourceIdentityId, disabled: true, subscription };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : 'register';

    if (action === 'register') {
      const result = await register({
        channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
        displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
        authorityTier: typeof body.authorityTier === 'number' ? body.authorityTier : undefined,
        sourceRole: typeof body.sourceRole === 'string' ? body.sourceRole : undefined,
        entityIds: Array.isArray(body.entityIds) ? body.entityIds.filter((value): value is string => typeof value === 'string') : undefined,
        subscribe: typeof body.subscribe === 'boolean' ? body.subscribe : undefined,
      });
      return json(result.subscription && !result.subscription.ok ? 207 : result.created ? 201 : 200, result as unknown as Record<string, unknown>);
    }

    if (action === 'update_scope') {
      const result = await updateScope({
        sourceIdentityId: typeof body.sourceIdentityId === 'string' ? body.sourceIdentityId : undefined,
        entityIds: Array.isArray(body.entityIds) ? body.entityIds.filter((value): value is string => typeof value === 'string') : undefined,
      });
      return json(200, result);
    }

    if (action === 'disable') {
      const result = await disable({ sourceIdentityId: typeof body.sourceIdentityId === 'string' ? body.sourceIdentityId : undefined });
      return json(200, result as unknown as Record<string, unknown>);
    }

    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('youtube-source-admin failure', error);
    return json(500, { error: 'internal_error', detail: String(error) });
  }
});
