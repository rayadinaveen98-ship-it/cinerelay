import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');

if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
  throw new Error('Missing creator-radar-worker environment');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    if (!authorized(request)) return json(401, { error: 'unauthorized' });

    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const parsedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.floor(body.limit)
      : 100;
    const limit = Math.max(1, Math.min(parsedLimit, 500));

    const { data, error } = await supabase.rpc('refresh_creator_radar', {
      p_limit: limit,
    });
    if (error) throw error;

    return json(200, {
      ok: true,
      limit,
      refreshed: Number(data ?? 0),
      engineVersion: 'creator-radar-v1',
    });
  } catch (error) {
    console.error('creator-radar-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
