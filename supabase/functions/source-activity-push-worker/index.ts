import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const serviceAccountJson = Deno.env.get('CINERELAY_FCM_SERVICE_ACCOUNT');

if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
  throw new Error('Missing source-activity-push-worker environment');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();
const TRANSIENT_HTTP = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(['QUOTA_EXCEEDED', 'UNAVAILABLE', 'INTERNAL']);

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type LeasedTarget = {
  target_id: string;
  source_activity_delivery_id: string;
  device_registration_id: string;
  user_id: string;
  target_kind: string;
  target_value: string;
  platform: string;
  app_id: string;
  payload: Record<string, unknown> | null;
  attempt_count: number;
  lease_token: string;
  leased_until: string;
};

type FcmErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<Record<string, unknown>>;
  };
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i += 1) {
    difference |= supplied.charCodeAt(i) ^ internalSecret!.charCodeAt(i);
  }
  return difference === 0;
}

function parseServiceAccount(): ServiceAccount {
  if (!serviceAccountJson) throw new Error('fcm_service_account_missing');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('fcm_service_account_invalid_json');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('fcm_service_account_invalid');
  const row = parsed as Record<string, unknown>;
  const projectId = typeof row.project_id === 'string' ? row.project_id.trim() : '';
  const clientEmail = typeof row.client_email === 'string' ? row.client_email.trim() : '';
  const privateKey = typeof row.private_key === 'string' ? row.private_key.trim() : '';
  if (!/^[a-z0-9][a-z0-9-]{3,100}$/i.test(projectId)) throw new Error('fcm_project_id_invalid');
  if (!clientEmail.includes('@') || clientEmail.length > 320) throw new Error('fcm_client_email_invalid');
  if (!privateKey.includes('BEGIN PRIVATE KEY')) throw new Error('fcm_private_key_invalid');
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlText(value: string): string {
  return base64Url(encoder.encode(value));
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function mintAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlText(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  const token = typeof body.access_token === 'string' ? body.access_token : '';
  if (!response.ok || !token) {
    console.error('FCM OAuth token mint failed', { status: response.status });
    throw new Error('fcm_oauth_failed');
  }
  return token;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function messageData(target: LeasedTarget): Record<string, string> {
  const payload = target.payload ?? {};
  const pairs: Array<[string, unknown]> = [
    ['notificationClass', payload.notificationClass],
    ['sourceActivityDeliveryId', target.source_activity_delivery_id],
    ['rawItemId', payload.rawItemId],
    ['sourceIdentityId', payload.sourceIdentityId],
    ['sourceName', payload.sourceName],
    ['platform', payload.platform],
    ['activityKind', payload.activityKind],
    ['canonicalUrl', payload.canonicalUrl],
  ];
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) {
    const normalized = asString(value);
    if (normalized !== null) data[key] = normalized;
  }
  return data;
}

function findFcmErrorCode(body: FcmErrorBody): string | null {
  for (const detail of body.error?.details ?? []) {
    const candidate = detail.errorCode;
    if (typeof candidate === 'string') return candidate;
  }
  const status = body.error?.status;
  if (typeof status === 'string' && ['UNREGISTERED', 'QUOTA_EXCEEDED', 'UNAVAILABLE', 'INTERNAL'].includes(status)) return status;
  return null;
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

async function complete(
  target: LeasedTarget,
  outcome: 'SENT' | 'INVALID_REGISTRATION' | 'PERMANENT_ERROR' | 'TRANSIENT_ERROR',
  values: {
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    retryAfterSeconds?: number | null;
  } = {},
): Promise<void> {
  const { error } = await supabase.rpc('complete_source_activity_target', {
    p_target_id: target.target_id,
    p_lease_token: target.lease_token,
    p_outcome: outcome,
    p_provider_message_id: values.providerMessageId ?? null,
    p_error_code: values.errorCode ?? null,
    p_error_message: values.errorMessage ?? null,
    p_retry_after_seconds: values.retryAfterSeconds ?? null,
  });
  if (error) throw error;
}

async function sendOne(account: ServiceAccount, accessToken: string, target: LeasedTarget): Promise<string> {
  if (target.target_kind !== 'TOKEN') {
    await complete(target, 'PERMANENT_ERROR', { errorCode: 'UNSUPPORTED_TARGET_KIND' });
    return 'permanentFailure';
  }

  const payload = target.payload ?? {};
  const sourceName = asString(payload.sourceName) ?? 'Official source';
  const headline = asString(payload.headline) ?? 'New YouTube upload';
  const bodyText = `${sourceName}: ${headline}`.slice(0, 240);

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        message: {
          token: target.target_value,
          notification: { title: 'CineRelay • Official Upload', body: bodyText },
          data: messageData(target),
          android: { priority: 'high' },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  const raw = await response.text();
  let body: FcmErrorBody & { name?: string } = {};
  if (raw) {
    try {
      body = JSON.parse(raw) as FcmErrorBody & { name?: string };
    } catch {
      body = {};
    }
  }

  if (response.ok) {
    await complete(target, 'SENT', {
      providerMessageId: typeof body.name === 'string' ? body.name : null,
    });
    return 'sent';
  }

  const errorCode = findFcmErrorCode(body);
  const errorMessage = body.error?.message?.slice(0, 1000) ?? `FCM HTTP ${response.status}`;
  const retryAfter = parseRetryAfterSeconds(response.headers.get('retry-after'));

  if (errorCode === 'UNREGISTERED') {
    await complete(target, 'INVALID_REGISTRATION', { errorCode, errorMessage });
    return 'invalidRegistration';
  }

  if (TRANSIENT_HTTP.has(response.status) || (errorCode && TRANSIENT_CODES.has(errorCode))) {
    await complete(target, 'TRANSIENT_ERROR', {
      errorCode: errorCode ?? `HTTP_${response.status}`,
      errorMessage,
      retryAfterSeconds: retryAfter,
    });
    return 'retry';
  }

  await complete(target, 'PERMANENT_ERROR', {
    errorCode: errorCode ?? body.error?.status ?? `HTTP_${response.status}`,
    errorMessage,
  });
  return 'permanentFailure';
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });

    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const requested = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : 50;
    const limit = Math.max(1, Math.min(requested, 100));

    // Validate provider auth first so a missing/invalid FCM credential cannot create
    // a growing source-activity outbox that is impossible to drain.
    const account = parseServiceAccount();
    const accessToken = await mintAccessToken(account);

    const { data: planned, error: planError } = await supabase.rpc('plan_due_source_activity_notifications', {
      p_limit: Math.max(limit * 4, 200),
    });
    if (planError) throw planError;

    const { data: materialized, error: materializeError } = await supabase.rpc('materialize_due_source_activity_targets', {
      p_limit: Math.max(limit * 2, 100),
    });
    if (materializeError) throw materializeError;

    const { data: leased, error: leaseError } = await supabase.rpc('lease_source_activity_targets', {
      p_limit: limit,
      p_lease_seconds: 60,
    });
    if (leaseError) throw leaseError;

    const targets = (leased ?? []) as LeasedTarget[];
    const counts = { sent: 0, retry: 0, invalidRegistration: 0, permanentFailure: 0, transportFailure: 0 };

    for (const target of targets) {
      try {
        const result = await sendOne(account, accessToken, target);
        counts[result as keyof typeof counts] += 1;
      } catch (error) {
        console.error('source activity push transport failure', {
          targetId: target.target_id,
          sourceActivityDeliveryId: target.source_activity_delivery_id,
          attemptCount: target.attempt_count,
        });
        try {
          await complete(target, 'TRANSIENT_ERROR', {
            errorCode: 'TRANSPORT_ERROR',
            errorMessage: error instanceof Error ? error.message : 'transport failure',
          });
          counts.transportFailure += 1;
        } catch (completionError) {
          console.error('source activity completion failure', {
            targetId: target.target_id,
            error: completionError instanceof Error ? completionError.message : String(completionError),
          });
        }
      }
    }

    return json(200, {
      ok: true,
      planned: Number(planned ?? 0),
      materialized: Number(materialized ?? 0),
      leased: targets.length,
      counts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    console.error('source-activity-push-worker failure', { message });
    if (message.startsWith('fcm_')) return json(503, { error: message });
    return json(500, { error: 'internal_error' });
  }
});
