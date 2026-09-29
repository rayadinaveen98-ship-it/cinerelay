import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing notification preferences API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreferencesAction = 'get' | 'replace' | 'setSource' | 'setMaster';
type PreferencesRequest = {
  action?: unknown;
  sourceIdentityIds?: unknown;
  sourceIdentityId?: unknown;
  enabled?: unknown;
  includeVideos?: unknown;
  includeShorts?: unknown;
  completeSetup?: unknown;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireUser(request: Request): Promise<{ id: string } | Response> {
  const token = bearerToken(request);
  if (!token) return json(401, { error: 'authentication_required' });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id };
}

function actionOf(value: unknown): PreferencesAction | null {
  return value === 'get' || value === 'replace' || value === 'setSource' || value === 'setMaster' ? value : null;
}

function booleanOf(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function sourceIdsOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean))];
  if (ids.length > 100 || ids.some((id) => !UUID_PATTERN.test(id))) return null;
  return ids;
}

async function stateFor(userId: string) {
  const [preferenceResult, subscriptionResult] = await Promise.all([
    admin.from('user_source_activity_preferences')
      .select('enabled,include_videos,include_shorts,official_youtube_only,activated_at,setup_completed_at,updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('user_source_activity_subscriptions')
      .select('source_identity_id,enabled,include_videos,include_shorts,activated_at,updated_at')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);
  if (preferenceResult.error) throw preferenceResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;

  const pref = preferenceResult.data;
  const subscriptions = subscriptionResult.data ?? [];
  return {
    ok: true,
    masterEnabled: pref?.enabled ?? false,
    includeVideos: pref?.include_videos ?? true,
    includeShorts: pref?.include_shorts ?? false,
    officialYouTubeOnly: pref?.official_youtube_only ?? true,
    setupCompleted: Boolean(pref?.setup_completed_at),
    setupCompletedAt: pref?.setup_completed_at ?? null,
    selectedSourceCount: subscriptions.length,
    subscriptions: subscriptions.map((row) => ({
      sourceIdentityId: row.source_identity_id,
      enabled: row.enabled,
      includeVideos: row.include_videos,
      includeShorts: row.include_shorts,
      activatedAt: row.activated_at,
      updatedAt: row.updated_at,
    })),
  };
}

async function replaceSelection(userId: string, body: PreferencesRequest): Promise<Response> {
  const sourceIds = sourceIdsOf(body.sourceIdentityIds);
  if (sourceIds === null) return json(400, { error: 'invalid_source_identity_ids' });

  const includeVideos = booleanOf(body.includeVideos, true);
  const includeShorts = booleanOf(body.includeShorts, false);
  const masterEnabled = booleanOf(body.enabled, true);
  const completeSetup = booleanOf(body.completeSetup, true);

  const { data, error } = await admin.rpc('replace_user_source_activity_selection', {
    p_user_id: userId,
    p_source_identity_ids: sourceIds,
    p_include_videos: includeVideos,
    p_include_shorts: includeShorts,
    p_master_enabled: masterEnabled,
    p_complete_setup: completeSetup,
  });
  if (error) throw error;

  return json(200, {
    ...(data && typeof data === 'object' ? data as Record<string, unknown> : { ok: true }),
    state: await stateFor(userId),
  });
}

async function validateOfficialYouTubeSource(sourceIdentityId: string): Promise<boolean> {
  const identityResult = await admin.from('source_identities')
    .select('id,source_id,platform,active')
    .eq('id', sourceIdentityId)
    .maybeSingle();
  if (identityResult.error) throw identityResult.error;
  const identity = identityResult.data;
  if (!identity || !identity.active || identity.platform !== 'YOUTUBE') return false;

  const sourceResult = await admin.from('sources')
    .select('id,active,authority_tier')
    .eq('id', identity.source_id)
    .maybeSingle();
  if (sourceResult.error) throw sourceResult.error;
  return Boolean(sourceResult.data?.active && sourceResult.data?.authority_tier === 1);
}

async function setSource(userId: string, body: PreferencesRequest): Promise<Response> {
  const sourceIdentityId = typeof body.sourceIdentityId === 'string' ? body.sourceIdentityId.trim() : '';
  if (!UUID_PATTERN.test(sourceIdentityId)) return json(400, { error: 'invalid_source_identity_id' });
  if (!await validateOfficialYouTubeSource(sourceIdentityId)) return json(400, { error: 'source_not_available' });

  const enabled = booleanOf(body.enabled, true);
  const includeVideos = booleanOf(body.includeVideos, true);
  const includeShorts = booleanOf(body.includeShorts, false);
  const now = new Date().toISOString();

  const existingResult = await admin.from('user_source_activity_subscriptions')
    .select('enabled,include_videos,include_shorts,activated_at')
    .eq('user_id', userId)
    .eq('source_identity_id', sourceIdentityId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data;
  const shouldReactivate = enabled && (!existing?.enabled || existing.include_videos !== includeVideos || existing.include_shorts !== includeShorts);

  const { error: subscriptionError } = await admin.from('user_source_activity_subscriptions').upsert({
    user_id: userId,
    source_identity_id: sourceIdentityId,
    enabled,
    include_videos: includeVideos,
    include_shorts: includeShorts,
    activated_at: shouldReactivate || !existing ? now : existing.activated_at,
    updated_at: now,
  }, { onConflict: 'user_id,source_identity_id' });
  if (subscriptionError) throw subscriptionError;

  const activeResult = await admin.from('user_source_activity_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enabled', true);
  if (activeResult.error) throw activeResult.error;
  const selectedSourceCount = activeResult.count ?? 0;

  const prefResult = await admin.from('user_source_activity_preferences')
    .select('enabled,include_videos,include_shorts,setup_completed_at,activated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefResult.error) throw prefResult.error;
  const pref = prefResult.data;
  const masterEnabled = selectedSourceCount > 0 && (pref?.enabled ?? true);

  const { error: preferenceError } = await admin.from('user_source_activity_preferences').upsert({
    user_id: userId,
    enabled: masterEnabled,
    include_videos: pref?.include_videos ?? true,
    include_shorts: pref?.include_shorts ?? false,
    official_youtube_only: true,
    activated_at: masterEnabled && !pref?.enabled ? now : (pref?.activated_at ?? now),
    setup_completed_at: pref?.setup_completed_at ?? now,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (preferenceError) throw preferenceError;

  return json(200, { ok: true, sourceIdentityId, enabled, state: await stateFor(userId) });
}

async function setMaster(userId: string, body: PreferencesRequest): Promise<Response> {
  const enabled = booleanOf(body.enabled, true);
  const now = new Date().toISOString();
  const currentResult = await admin.from('user_source_activity_preferences')
    .select('enabled,include_videos,include_shorts,official_youtube_only,activated_at,setup_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (currentResult.error) throw currentResult.error;
  const current = currentResult.data;

  const activeResult = await admin.from('user_source_activity_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enabled', true);
  if (activeResult.error) throw activeResult.error;
  const effectiveEnabled = enabled && (activeResult.count ?? 0) > 0;

  const { error } = await admin.from('user_source_activity_preferences').upsert({
    user_id: userId,
    enabled: effectiveEnabled,
    include_videos: current?.include_videos ?? true,
    include_shorts: current?.include_shorts ?? false,
    official_youtube_only: true,
    activated_at: effectiveEnabled && !current?.enabled ? now : (current?.activated_at ?? now),
    setup_completed_at: current?.setup_completed_at ?? now,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (error) throw error;

  return json(200, { ok: true, state: await stateFor(userId) });
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const body = await request.json().catch(() => ({})) as PreferencesRequest;
    const action = actionOf(body.action);
    if (!action) return json(400, { error: 'invalid_action' });

    if (action === 'get') return json(200, await stateFor(user.id));
    if (action === 'replace') return await replaceSelection(user.id, body);
    if (action === 'setSource') return await setSource(user.id, body);
    return await setMaster(user.id, body);
  } catch (error) {
    console.error('notification-preferences-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
