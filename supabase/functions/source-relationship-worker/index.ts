import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');

if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
  throw new Error('Missing source-relationship-worker environment');
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

    const body = await request.json().catch(() => ({})) as { lookbackDays?: unknown };
    const requestedLookback = typeof body.lookbackDays === 'number' && Number.isFinite(body.lookbackDays)
      ? Math.floor(body.lookbackDays)
      : 21;
    const lookbackDays = Math.max(1, Math.min(60, requestedLookback));

    const { data, error } = await supabase.rpc('refresh_source_entity_relationship_proposals', {
      p_now: new Date().toISOString(),
      p_lookback_days: lookbackDays,
    });
    if (error) throw error;

    return json(200, {
      ok: true,
      lookbackDays,
      result: data,
      trustMutation: 'PROPOSAL_ONLY',
    });
  } catch (error) {
    console.error('source-relationship-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
