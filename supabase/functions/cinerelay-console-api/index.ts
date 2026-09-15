import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay console API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireOperator(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: json(401, { error: 'authentication_required' }) } as const;

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { error: json(401, { error: 'invalid_session' }) } as const;

  const { data: operator, error: operatorError } = await admin
    .from('operator_users')
    .select('user_id,display_name,active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (operatorError) throw operatorError;
  if (!operator) return { error: json(403, { error: 'operator_access_required' }) } as const;

  return { user, operator } as const;
}

async function exactCount(table: string, filter?: (query: any) => any): Promise<number> {
  let query = admin.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function overview(user: { id: string; email?: string | null }, operator: { display_name?: string | null }) {
  const [rawItems, events, sources, unresolved, healthResult, channelResult] = await Promise.all([
    exactCount('raw_items'),
    exactCount('events'),
    exactCount('source_identities', (query) => query.eq('active', true)),
    exactCount('entity_resolution_results', (query) => query.eq('resolution_state', 'UNRESOLVED')),
    admin.from('source_health').select('health_state'),
    admin.from('youtube_channel_state').select('fallback_gap_count'),
  ]);

  if (healthResult.error) throw healthResult.error;
  if (channelResult.error) throw channelResult.error;

  const healthRows = healthResult.data ?? [];
  const health = {
    healthy: healthRows.filter((row) => row.health_state === 'HEALTHY').length,
    degraded: healthRows.filter((row) => row.health_state === 'DEGRADED').length,
    rateLimited: healthRows.filter((row) => row.health_state === 'RATE_LIMITED').length,
    budgetExhausted: healthRows.filter((row) => row.health_state === 'BUDGET_EXHAUSTED').length,
    gapSources: (channelResult.data ?? []).filter((row) => Number(row.fallback_gap_count ?? 0) > 0).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    operator: {
      userId: user.id,
      email: user.email ?? null,
      displayName: operator.display_name ?? null,
    },
    counts: { rawItems, events, sources, unresolved },
    health,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const auth = await requireOperator(request);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({})) as { action?: string };
    if (body.action !== 'overview') return json(400, { error: 'unsupported_action' });

    return json(200, await overview(auth.user, auth.operator));
  } catch (error) {
    console.error('cinerelay-console-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
