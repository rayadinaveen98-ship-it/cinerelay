import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing device-registration API environment');

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
const PLATFORMS = new Set(['ANDROID', 'IOS', 'WEB']);

type DeviceAction = 'register' | 'unregister' | 'list';

type RegistrationRequest = {
  action?: unknown;
  provider?: unknown;
  targetKind?: unknown;
  targetValue?: unknown;
  platform?: unknown;
  installationId?: unknown;
  appId?: unknown;
  registrationId?: unknown;
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

function asAction(value: unknown): DeviceAction | null {
  return value === 'register' || value === 'unregister' || value === 'list' ? value : null;
}

function optionalBoundedString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length <= max ? normalized : undefined;
}

async function register(userId: string, body: RegistrationRequest): Promise<Response> {
  const provider = typeof body.provider === 'string' ? body.provider.trim().toUpperCase() : 'FCM';
  const targetKind = typeof body.targetKind === 'string' ? body.targetKind.trim().toUpperCase() : 'TOKEN';
  const targetValue = typeof body.targetValue === 'string' ? body.targetValue.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim().toUpperCase() : '';
  const installationId = optionalBoundedString(body.installationId, 255);
  const appId = optionalBoundedString(body.appId, 200) ?? 'cinerelay';

  if (provider !== 'FCM') return json(400, { error: 'unsupported_provider' });
  // The schema can store FIDs for a future adapter, but this live HTTP-v1 sender
  // intentionally registers only the target type it can currently deliver to.
  if (targetKind !== 'TOKEN') return json(400, { error: 'unsupported_target_kind' });
  if (targetValue.length < 20 || targetValue.length > 4096) return json(400, { error: 'invalid_target' });
  if (!PLATFORMS.has(platform)) return json(400, { error: 'invalid_platform' });
  if (installationId === undefined || appId === undefined || appId === null) return json(400, { error: 'invalid_registration_metadata' });

  const { data, error } = await admin.rpc('upsert_push_device_registration', {
    p_user_id: userId,
    p_provider: provider,
    p_target_kind: targetKind,
    p_target_value: targetValue,
    p_platform: platform,
    p_installation_id: installationId,
    p_app_id: appId,
  });
  if (error) throw error;

  const safe = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return json(200, {
    ok: true,
    registration: {
      registrationId: safe.registrationId ?? null,
      provider: safe.provider ?? provider,
      targetKind: safe.targetKind ?? targetKind,
      platform: safe.platform ?? platform,
      installationId: safe.installationId ?? installationId,
      active: safe.active ?? true,
    },
  });
}

async function unregister(userId: string, body: RegistrationRequest): Promise<Response> {
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId.trim() : '';
  if (!UUID_PATTERN.test(registrationId)) return json(400, { error: 'invalid_registration_id' });

  const { data, error } = await admin.rpc('deactivate_push_device_registration', {
    p_user_id: userId,
    p_registration_id: registrationId,
    p_reason: 'USER_UNREGISTERED',
  });
  if (error) throw error;
  return json(200, { ok: true, deactivated: data === true });
}

async function list(userId: string): Promise<Response> {
  const { data, error } = await admin
    .from('push_device_registrations')
    .select('id,provider,target_kind,platform,installation_id,app_id,active,last_seen_at,last_success_at,disabled_at,disable_reason,created_at,updated_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return json(200, {
    ok: true,
    registrations: (data ?? []).map((row) => ({
      registrationId: row.id,
      provider: row.provider,
      targetKind: row.target_kind,
      platform: row.platform,
      installationId: row.installation_id,
      appId: row.app_id,
      active: row.active,
      lastSeenAt: row.last_seen_at,
      lastSuccessAt: row.last_success_at,
      disabledAt: row.disabled_at,
      disableReason: row.disable_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const body = await request.json().catch(() => ({})) as RegistrationRequest;
    const action = asAction(body.action);
    if (!action) return json(400, { error: 'invalid_action' });

    if (action === 'register') return await register(user.id, body);
    if (action === 'unregister') return await unregister(user.id, body);
    return await list(user.id);
  } catch (error) {
    console.error('device-registration-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
