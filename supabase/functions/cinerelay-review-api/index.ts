import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay review API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

type OperatorAuth =
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; response: Response };

async function requireOperator(request: Request): Promise<OperatorAuth> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };
  const { data: operator, error } = await admin.from('operator_users').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

async function reviewQueue(limit: number) {
  const bounded = Math.max(1, Math.min(100, limit));
  const { data: resolutions, error: resolutionError } = await admin.from('current_entity_resolution_results')
    .select('id,raw_item_id,entity_id,score,resolution_state,methods,engine_version,created_at')
    .in('resolution_state', ['UNRESOLVED', 'AMBIGUOUS'])
    .order('created_at', { ascending: false })
    .limit(bounded);
  if (resolutionError) throw resolutionError;
  const rows = resolutions ?? [];
  if (rows.length === 0) return { generatedAt: new Date().toISOString(), items: [] };

  const rawIds = rows.map((row) => row.raw_item_id);
  const [{ data: raws, error: rawError }, { data: overrides, error: overrideError }] = await Promise.all([
    admin.from('raw_items').select('id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,raw_title,raw_text,metadata').in('id', rawIds),
    admin.from('operator_resolution_overrides').select('id,raw_item_id,entity_id,active,reason,created_by,created_at,updated_at').in('raw_item_id', rawIds),
  ]);
  if (rawError) throw rawError;
  if (overrideError) throw overrideError;

  const rawMap = new Map((raws ?? []).map((row) => [row.id, row]));
  const overrideMap = new Map((overrides ?? []).map((row) => [row.raw_item_id, row]));
  const sourceIdentityIds = [...new Set((raws ?? []).map((row) => row.source_identity_id).filter(Boolean))];
  const entityIds = [...new Set([
    ...rows.map((row) => row.entity_id).filter(Boolean),
    ...(overrides ?? []).map((row) => row.entity_id).filter(Boolean),
  ])];

  const [{ data: identities, error: identityError }, { data: entities, error: entityError }] = await Promise.all([
    sourceIdentityIds.length
      ? admin.from('source_identities').select('id,source_id,platform,handle,canonical_url,connector_type,access_mode').in('id', sourceIdentityIds)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length
      ? admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').in('id', entityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (identityError) throw identityError;
  if (entityError) throw entityError;

  const identityMap = new Map((identities ?? []).map((row) => [row.id, row]));
  const sourceIds = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const entityMap = new Map((entities ?? []).map((row) => [row.id, row]));

  const items = rows.map((resolution) => {
    const raw = rawMap.get(resolution.raw_item_id);
    const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    const override = overrideMap.get(resolution.raw_item_id);
    return {
      resolution,
      rawItem: raw ?? null,
      source: source && identity ? {
        name: source.display_name,
        authorityTier: source.authority_tier,
        sourceRole: source.source_role,
        platform: identity.platform,
        handle: identity.handle,
        canonicalUrl: identity.canonical_url,
        connectorType: identity.connector_type,
        accessMode: identity.access_mode,
      } : null,
      resolvedEntity: resolution.entity_id ? entityMap.get(resolution.entity_id) ?? null : null,
      override: override ? { ...override, entity: entityMap.get(override.entity_id) ?? null } : null,
    };
  });

  return { generatedAt: new Date().toISOString(), items };
}

async function entitySearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return { items: [] };
  const pattern = `%${q.slice(0, 80)}%`;
  const [{ data: direct, error: directError }, { data: aliases, error: aliasError }] = await Promise.all([
    admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').eq('status', 'ACTIVE').in('entity_type', ['MOVIE', 'SERIES', 'SEASON']).ilike('canonical_name', pattern).limit(20),
    admin.from('entity_aliases').select('entity_id,alias').ilike('alias', pattern).limit(40),
  ]);
  if (directError) throw directError;
  if (aliasError) throw aliasError;
  const aliasEntityIds = [...new Set((aliases ?? []).map((row) => row.entity_id).filter(Boolean))];
  const { data: aliasEntities, error: aliasEntityError } = aliasEntityIds.length
    ? await admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').eq('status', 'ACTIVE').in('entity_type', ['MOVIE', 'SERIES', 'SEASON']).in('id', aliasEntityIds)
    : { data: [], error: null };
  if (aliasEntityError) throw aliasEntityError;
  const map = new Map<string, Record<string, unknown>>();
  for (const row of [...(direct ?? []), ...(aliasEntities ?? [])]) map.set(String(row.id), row as Record<string, unknown>);
  return { items: [...map.values()].slice(0, 30) };
}

async function reviewBootstrap(limit: number) {
  const [queue, typesResult, auditResult] = await Promise.all([
    reviewQueue(limit),
    admin.from('event_types').select('code,family,default_importance,taxonomy_version').eq('active', true).order('family').order('code'),
    admin.from('audit_actions').select('id,actor_type,actor_id,action_type,target_type,target_id,before_json,after_json,reason,created_at').eq('actor_type', 'ADMIN').order('created_at', { ascending: false }).limit(50),
  ]);
  if (typesResult.error) throw typesResult.error;
  if (auditResult.error) throw auditResult.error;
  return { ...queue, eventTypes: typesResult.data ?? [], audit: auditResult.data ?? [] };
}

async function rpcAction(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function reasonOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : null;
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'bootstrap') return json(200, await reviewBootstrap(Number(body.limit ?? 100)));
    if (action === 'entitySearch') return json(200, await entitySearch(typeof body.query === 'string' ? body.query : ''));

    const reason = reasonOf(body.reason);
    if (!reason && ['resolveRawItem', 'clearResolutionOverride', 'suppressEvent', 'reclassifyEvent', 'mergeEvents'].includes(action)) {
      return json(400, { error: 'valid_reason_required' });
    }

    if (action === 'resolveRawItem') {
      if (!validUuid(body.rawItemId)) return json(400, { error: 'invalid_raw_item_id' });
      const entityId = validUuid(body.entityId) ? body.entityId : null;
      const newEntityName = typeof body.newEntityName === 'string' ? body.newEntityName.trim() : null;
      if (!entityId && !newEntityName) return json(400, { error: 'entity_selection_required' });
      const result = await rpcAction('operator_resolve_raw_item', {
        p_actor_id: auth.user.id,
        p_raw_item_id: body.rawItemId,
        p_reason: reason,
        p_entity_id: entityId,
        p_new_entity_name: newEntityName,
        p_new_entity_type: typeof body.newEntityType === 'string' ? body.newEntityType : 'MOVIE',
        p_primary_language: typeof body.primaryLanguage === 'string' ? body.primaryLanguage : null,
        p_country_code: typeof body.countryCode === 'string' ? body.countryCode : null,
      });
      return json(200, { ok: true, result });
    }

    if (action === 'clearResolutionOverride') {
      if (!validUuid(body.rawItemId)) return json(400, { error: 'invalid_raw_item_id' });
      return json(200, { ok: true, result: await rpcAction('operator_clear_resolution_override', { p_actor_id: auth.user.id, p_raw_item_id: body.rawItemId, p_reason: reason }) });
    }

    if (action === 'suppressEvent') {
      if (!validUuid(body.eventId)) return json(400, { error: 'invalid_event_id' });
      return json(200, { ok: true, result: await rpcAction('operator_suppress_event', { p_actor_id: auth.user.id, p_event_id: body.eventId, p_reason: reason }) });
    }

    if (action === 'reclassifyEvent') {
      if (!validUuid(body.eventId) || typeof body.eventType !== 'string') return json(400, { error: 'invalid_reclassification' });
      return json(200, { ok: true, result: await rpcAction('operator_reclassify_event', { p_actor_id: auth.user.id, p_event_id: body.eventId, p_event_type: body.eventType, p_reason: reason }) });
    }

    if (action === 'mergeEvents') {
      if (!validUuid(body.fromEventId) || !validUuid(body.intoEventId)) return json(400, { error: 'invalid_merge_event_ids' });
      return json(200, { ok: true, result: await rpcAction('operator_merge_events', { p_actor_id: auth.user.id, p_from_event_id: body.fromEventId, p_into_event_id: body.intoEventId, p_reason: reason }) });
    }

    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-review-api failure', error);
    const message = error instanceof Error ? error.message : 'review_action_failed';
    return json(400, { error: 'review_action_failed', message });
  }
});
