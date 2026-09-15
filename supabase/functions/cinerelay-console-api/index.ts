import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay console API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type AuthorizedOperator = { ok: true; user: { id: string; email?: string | null }; operator: { display_name: string | null } };
type RejectedOperator = { ok: false; response: Response };
type OperatorAuthResult = AuthorizedOperator | RejectedOperator;

async function requireOperator(request: Request): Promise<OperatorAuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };
  const { data: operator, error: operatorError } = await admin.from('operator_users').select('user_id,display_name,active').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (operatorError) throw operatorError;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null }, operator: { display_name: operator.display_name ?? null } };
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
    exactCount('raw_items'), exactCount('events'), exactCount('source_identities', (q) => q.eq('active', true)),
    exactCount('entity_resolution_results', (q) => q.eq('resolution_state', 'UNRESOLVED')),
    admin.from('source_health').select('health_state'), admin.from('youtube_channel_state').select('fallback_gap_count'),
  ]);
  if (healthResult.error) throw healthResult.error;
  if (channelResult.error) throw channelResult.error;
  const healthRows = healthResult.data ?? [];
  return {
    generatedAt: new Date().toISOString(),
    operator: { userId: user.id, email: user.email ?? null, displayName: operator.display_name ?? null },
    counts: { rawItems, events, sources, unresolved },
    health: {
      healthy: healthRows.filter((row) => row.health_state === 'HEALTHY').length,
      degraded: healthRows.filter((row) => row.health_state === 'DEGRADED').length,
      rateLimited: healthRows.filter((row) => row.health_state === 'RATE_LIMITED').length,
      budgetExhausted: healthRows.filter((row) => row.health_state === 'BUDGET_EXHAUSTED').length,
      gapSources: (channelResult.data ?? []).filter((row) => Number(row.fallback_gap_count ?? 0) > 0).length,
    },
  };
}

async function feed(limit: number) {
  const bounded = Math.max(1, Math.min(100, limit));
  const { data: events, error: eventsError } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
    .order('detected_at', { ascending: false }).limit(bounded);
  if (eventsError) throw eventsError;
  if (!events?.length) return { generatedAt: new Date().toISOString(), items: [] };

  const eventIds = events.map((row) => row.id);
  const entityIds = [...new Set(events.map((row) => row.primary_entity_id).filter(Boolean))];
  const [{ data: entities, error: entityError }, { data: evidence, error: evidenceError }] = await Promise.all([
    admin.from('entities').select('id,canonical_name').in('id', entityIds),
    admin.from('event_evidence').select('event_id,raw_item_id,evidence_role,weight').in('event_id', eventIds),
  ]);
  if (entityError) throw entityError;
  if (evidenceError) throw evidenceError;

  const rawIds = [...new Set((evidence ?? []).map((row) => row.raw_item_id).filter(Boolean))];
  const { data: raws, error: rawError } = rawIds.length
    ? await admin.from('raw_items').select('id,source_identity_id,platform_item_id,canonical_url,raw_title,published_at').in('id', rawIds)
    : { data: [], error: null };
  if (rawError) throw rawError;

  const sourceIdentityIds = [...new Set((raws ?? []).map((row) => row.source_identity_id).filter(Boolean))];
  const { data: identities, error: identityError } = sourceIdentityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform').in('id', sourceIdentityIds)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const sourceIds = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources').select('id,display_name').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;

  const entityMap = new Map((entities ?? []).map((row) => [row.id, row.canonical_name]));
  const rawMap = new Map((raws ?? []).map((row) => [row.id, row]));
  const identityMap = new Map((identities ?? []).map((row) => [row.id, row]));
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row.display_name]));
  const evidenceByEvent = new Map<string, Record<string, unknown>[]>();
  for (const row of evidence ?? []) {
    const list = evidenceByEvent.get(row.event_id) ?? [];
    list.push(row);
    evidenceByEvent.set(row.event_id, list);
  }

  const items = events.map((event) => {
    const primaryEvidence = (evidenceByEvent.get(event.id) ?? [])[0];
    const raw = primaryEvidence ? rawMap.get(String(primaryEvidence.raw_item_id)) : undefined;
    const identity = raw ? identityMap.get(String(raw.source_identity_id)) : undefined;
    return {
      id: event.id,
      entityName: entityMap.get(event.primary_entity_id) ?? null,
      eventType: event.event_type,
      verificationState: event.verification_state,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: event.summary,
      status: event.status,
      detectedAt: event.detected_at,
      announcedAt: event.announced_at,
      occurredAt: event.occurred_at,
      structuredData: event.structured_data ?? {},
      evidence: raw ? {
        role: primaryEvidence?.evidence_role ?? null,
        weight: primaryEvidence?.weight ?? null,
        sourceName: identity ? sourceMap.get(identity.source_id) ?? null : null,
        platform: identity?.platform ?? null,
        rawTitle: raw.raw_title ?? null,
        platformItemId: raw.platform_item_id ?? null,
        canonicalUrl: raw.canonical_url ?? null,
        publishedAt: raw.published_at ?? null,
      } : null,
    };
  });
  return { generatedAt: new Date().toISOString(), items };
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({})) as { action?: string; limit?: number };
    if (body.action === 'overview') return json(200, await overview(auth.user, auth.operator));
    if (body.action === 'feed') return json(200, await feed(Number(body.limit ?? 25)));
    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-console-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
