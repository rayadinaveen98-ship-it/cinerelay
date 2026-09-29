import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing scheduler-dispatch environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Action = 'youtube-enrichment' | 'process-raw-item' | 'youtube-fallback' | 'youtube-maintenance' | 'feed-poll' | 'page-poll' | 'ott-provider-detail' | 'threads-profile-poll' | 'instagram-business-poll' | 'x-profile-poll' | 'push-delivery' | 'source-activity-push' | 'digest-compose' | 'creator-radar' | 'evidence-summary';

type DispatchTarget = {
  slug: string;
  body: Record<string, unknown>;
};

const TARGETS: Record<Action, DispatchTarget> = {
  'youtube-enrichment': { slug: 'youtube-enrichment-worker', body: { limit: 25 } },
  'process-raw-item': { slug: 'process-raw-item-worker', body: { limit: 25 } },
  'youtube-fallback': { slug: 'youtube-fallback-worker', body: { limit: 20 } },
  'youtube-maintenance': { slug: 'youtube-maintenance-worker', body: { limit: 50 } },
  'feed-poll': { slug: 'feed-poll-worker', body: { limit: 20 } },
  'page-poll': { slug: 'page-poll-worker', body: { limit: 20 } },
  'ott-provider-detail': { slug: 'ott-provider-detail-worker', body: { limit: 20 } },
  'threads-profile-poll': { slug: 'threads-profile-poll-worker', body: { limit: 20 } },
  'instagram-business-poll': { slug: 'instagram-business-poll-worker', body: { limit: 20 } },
  'x-profile-poll': { slug: 'x-profile-poll-worker', body: { limit: 20 } },
  'push-delivery': { slug: 'push-delivery-worker', body: { limit: 25 } },
  'source-activity-push': { slug: 'source-activity-push-worker', body: { limit: 50 } },
  'digest-compose': { slug: 'digest-compose-worker', body: { limit: 200 } },
  'creator-radar': { slug: 'creator-radar-worker', body: { limit: 100 } },
  'evidence-summary': { slug: 'evidence-summary-worker', body: { limit: 100 } },
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get('x-cinerelay-scheduler-key') ?? '';
  if (token.length < 32 || token.length > 256) return false;
  const { data, error } = await supabase.rpc('verify_scheduler_token', { p_token: token });
  return !error && data === true;
}

function isAction(value: unknown): value is Action {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGETS, value);
}

function sanitizedUpstreamError(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const value = (result as Record<string, unknown>).error;
  if (typeof value !== 'string') return null;
  return /^(?:fcm|x_api)_[a-z0-9_]+$/i.test(value) ? value : null;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });

    const body = await request.json().catch(() => ({})) as { action?: unknown };
    if (!isAction(body.action)) return json(400, { error: 'invalid_action' });

    const target = TARGETS[body.action];
    const upstream = await fetch(`${supabaseUrl!.replace(/\/$/, '')}/functions/v1/${target.slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cinerelay-internal-key': internalSecret!,
      },
      body: JSON.stringify(target.body),
      signal: AbortSignal.timeout(45_000),
    });

    const raw = await upstream.text();
    let result: unknown = null;
    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch {
        result = { body: raw.slice(0, 1000) };
      }
    }

    if (!upstream.ok) {
      const upstreamError = sanitizedUpstreamError(result);
      console.error('scheduler dispatch upstream failure', {
        action: body.action,
        slug: target.slug,
        status: upstream.status,
        upstreamError,
      });
      return json(502, {
        error: 'upstream_failure',
        action: body.action,
        upstreamStatus: upstream.status,
        ...(upstreamError ? { upstreamError } : {}),
      });
    }

    return json(200, {
      ok: true,
      action: body.action,
      upstreamStatus: upstream.status,
      result,
    });
  } catch (error) {
    console.error('scheduler-dispatch failure', error);
    return json(500, { error: 'internal_error' });
  }
});
