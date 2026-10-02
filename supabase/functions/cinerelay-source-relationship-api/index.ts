import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay source relationship API environment');

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

type OperatorAuth =
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; response: Response };

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function requireOperator(request: Request): Promise<OperatorAuth> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };

  const { data: operator, error } = await admin.from('operator_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

function boundedReason(value: unknown): string {
  if (typeof value !== 'string') throw new Error('valid_reason_required');
  const reason = value.trim().slice(0, 500);
  if (reason.length < 3) throw new Error('valid_reason_required');
  return reason;
}

async function bootstrap(limit: number, status?: string) {
  const bounded = Math.max(1, Math.min(200, Number(limit || 100)));
  let query = admin.from('source_entity_relationship_proposals')
    .select('id,source_identity_id,entity_id,relationship,confidence,evidence_count,recommended_valid_days,status,rationale,first_seen_at,last_seen_at,reviewed_by,reviewed_at,review_reason,resolved_at,created_at,updated_at')
    .order('status', { ascending: true })
    .order('confidence', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(bounded);
  if (status && ['OPEN', 'STALE', 'APPROVED', 'REJECTED'].includes(status)) query = query.eq('status', status);

  const [{ data: proposals, error: proposalError }, { data: summaryRows, error: summaryError }] = await Promise.all([
    query,
    admin.from('source_entity_relationship_proposals').select('status'),
  ]);
  if (proposalError) throw proposalError;
  if (summaryError) throw summaryError;
  const rows = proposals ?? [];
  const proposalIds = rows.map((row) => row.id);
  const identityIds = [...new Set(rows.map((row) => row.source_identity_id))];
  const entityIds = [...new Set(rows.map((row) => row.entity_id))];

  const [identityResult, entityResult, evidenceResult] = await Promise.all([
    identityIds.length
      ? admin.from('source_identities').select('id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,active').in('id', identityIds)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length
      ? admin.from('entities').select('id,entity_type,canonical_name,slug,primary_language,country_code,status').in('id', entityIds)
      : Promise.resolve({ data: [], error: null }),
    proposalIds.length
      ? admin.from('source_entity_relationship_evidence').select('proposal_id,raw_item_id,resolution_result_id,resolution_score,observed_at').in('proposal_id', proposalIds).order('observed_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (identityResult.error) throw identityResult.error;
  if (entityResult.error) throw entityResult.error;
  if (evidenceResult.error) throw evidenceResult.error;

  const identities = identityResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id))];
  const rawItemIds = [...new Set((evidenceResult.data ?? []).map((row) => row.raw_item_id))];
  const [sourceResult, rawResult] = await Promise.all([
    sourceIds.length
      ? admin.from('sources').select('id,display_name,authority_tier,source_role,territory,languages,active').in('id', sourceIds)
      : Promise.resolve({ data: [], error: null }),
    rawItemIds.length
      ? admin.from('raw_items').select('id,canonical_url,published_at,first_seen_at,raw_title,item_type').in('id', rawItemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceResult.error) throw sourceResult.error;
  if (rawResult.error) throw rawResult.error;

  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const entityMap = new Map((entityResult.data ?? []).map((row) => [row.id, row]));
  const rawMap = new Map((rawResult.data ?? []).map((row) => [row.id, row]));
  const evidenceMap = new Map<string, Record<string, unknown>[]>();
  for (const evidence of evidenceResult.data ?? []) {
    const list = evidenceMap.get(evidence.proposal_id) ?? [];
    list.push({ ...evidence, rawItem: rawMap.get(evidence.raw_item_id) ?? null });
    evidenceMap.set(evidence.proposal_id, list);
  }

  const summary = { open: 0, stale: 0, approved: 0, rejected: 0 };
  for (const row of summaryRows ?? []) {
    if (row.status === 'OPEN') summary.open += 1;
    if (row.status === 'STALE') summary.stale += 1;
    if (row.status === 'APPROVED') summary.approved += 1;
    if (row.status === 'REJECTED') summary.rejected += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items: rows.map((proposal) => {
      const identity = identityMap.get(proposal.source_identity_id) ?? null;
      return {
        proposal,
        sourceIdentity: identity,
        source: identity ? sourceMap.get(identity.source_id) ?? null : null,
        entity: entityMap.get(proposal.entity_id) ?? null,
        evidence: evidenceMap.get(proposal.id) ?? [],
      };
    }),
  };
}

async function review(actorId: string, body: Record<string, unknown>) {
  if (typeof body.proposalId !== 'string' || !UUID_PATTERN.test(body.proposalId)) throw new Error('invalid_relationship_proposal_id');
  const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : '';
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw new Error('invalid_relationship_decision');
  const reason = boundedReason(body.reason);
  let validDays: number | null = null;
  if (decision === 'APPROVE') {
    validDays = Number(body.validDays ?? 60);
    if (!Number.isInteger(validDays) || validDays < 7 || validDays > 180) throw new Error('relationship_valid_days_out_of_range');
  }

  const { data, error } = await admin.rpc('operator_review_source_entity_relationship', {
    p_actor_id: actorId,
    p_proposal_id: body.proposalId,
    p_decision: decision,
    p_reason: reason,
    p_valid_days: validDays,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action === 'bootstrap') {
      const status = typeof body.status === 'string' ? body.status.toUpperCase() : undefined;
      return json(200, await bootstrap(Number(body.limit ?? 100), status));
    }
    if (action === 'review') return json(200, { ok: true, result: await review(auth.user.id, body) });
    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-source-relationship-api failure', error);
    const message = error instanceof Error ? error.message : 'source_relationship_action_failed';
    return json(400, { error: 'source_relationship_action_failed', message });
  }
});
