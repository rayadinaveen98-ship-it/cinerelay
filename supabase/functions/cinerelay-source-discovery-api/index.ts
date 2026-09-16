import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay source discovery API environment');

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
const CANDIDATE_KINDS = new Set(['YOUTUBE_CHANNEL', 'RSS_ATOM', 'PUBLIC_WEB', 'INSTAGRAM_PROFILE', 'THREADS_PROFILE', 'X_PROFILE', 'OTHER']);
const DISCOVERY_METHODS = new Set(['OPERATOR', 'OFFICIAL_LINK', 'CONNECTOR_HINT', 'IMPORT']);
const EVIDENCE_TYPES = new Set(['OFFICIAL_LINK', 'PROFILE_BIO_LINK', 'PAGE_METADATA', 'CONNECTOR_HINT', 'OPERATOR_NOTE', 'OTHER']);
const REVIEW_STATUSES = new Set(['REVIEWING', 'APPROVED', 'REJECTED', 'DUPLICATE']);
const MEDIA_POLL_CLASSES = new Set(['ACTIVE_15M', 'NORMAL_60M', 'COLD_6H', 'DAILY']);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
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

  const { data: operator, error } = await admin.from('operator_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

function normalizeHttpsUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error('candidate_url_required');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:') throw new Error('candidate_url_must_be_https');
  if (url.username || url.password) throw new Error('candidate_url_credentials_not_allowed');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(lower)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function optionalHttpsUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizeHttpsUrl(value);
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function reasonOf(value: unknown): string | null {
  const reason = boundedText(value, 500);
  return reason && reason.length >= 3 ? reason : null;
}

function upperChoice(value: unknown, allowed: Set<string>, errorCode: string): string {
  const choice = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!allowed.has(choice)) throw new Error(errorCode);
  return choice;
}

function languageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(item)))]
    .slice(0, 12);
}

async function bootstrap(limit: number, status?: string) {
  const bounded = Math.max(1, Math.min(200, Number(limit || 100)));
  let candidateQuery = admin.from('source_discovery_candidates')
    .select('id,candidate_url,normalized_url,display_name,candidate_kind,discovery_method,discovered_from_source_identity_id,proposed_source_role,territory,languages,confidence,status,duplicate_of_source_identity_id,promoted_source_identity_id,first_seen_at,last_seen_at,reviewed_by,reviewed_at,review_reason,metadata,created_at,updated_at')
    .order('last_seen_at', { ascending: false })
    .limit(bounded);
  if (status && ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'PROMOTED'].includes(status)) {
    candidateQuery = candidateQuery.eq('status', status);
  }
  const { data: candidates, error: candidateError } = await candidateQuery;
  if (candidateError) throw candidateError;
  const rows = candidates ?? [];
  const candidateIds = rows.map((row) => row.id);

  const { data: evidence, error: evidenceError } = candidateIds.length
    ? await admin.from('source_discovery_evidence')
      .select('id,candidate_id,evidence_type,evidence_url,note,observed_at,metadata,created_at')
      .in('candidate_id', candidateIds)
      .order('observed_at', { ascending: false })
    : { data: [], error: null };
  if (evidenceError) throw evidenceError;

  const exactUrls = [...new Set(rows.flatMap((row) => [row.normalized_url, row.candidate_url]).filter(Boolean))];
  const { data: exactIdentities, error: identityError } = exactUrls.length
    ? await admin.from('source_identities')
      .select('id,source_id,platform,canonical_url,connector_type,access_mode,active')
      .in('canonical_url', exactUrls)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const sourceIds = [...new Set((exactIdentities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources')
      .select('id,display_name,authority_tier,source_role,territory,active')
      .in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;

  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const evidenceByCandidate = new Map<string, Record<string, unknown>[]>();
  for (const item of evidence ?? []) {
    const list = evidenceByCandidate.get(item.candidate_id) ?? [];
    list.push(item);
    evidenceByCandidate.set(item.candidate_id, list);
  }

  return {
    generatedAt: new Date().toISOString(),
    items: rows.map((candidate) => ({
      candidate,
      evidence: evidenceByCandidate.get(candidate.id) ?? [],
      exactRegistryMatches: (exactIdentities ?? [])
        .filter((identity) => identity.canonical_url === candidate.normalized_url || identity.canonical_url === candidate.candidate_url)
        .map((identity) => ({ identity, source: sourceMap.get(identity.source_id) ?? null })),
    })),
  };
}

async function sourceSearch(query: string) {
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return { items: [] };
  const pattern = `%${q}%`;
  const [{ data: sources, error: sourceError }, { data: identities, error: identityError }] = await Promise.all([
    admin.from('sources')
      .select('id,display_name,authority_tier,source_role,territory,active')
      .ilike('display_name', pattern)
      .limit(30),
    admin.from('source_identities')
      .select('id,source_id,platform,canonical_url,connector_type,access_mode,active')
      .ilike('canonical_url', pattern)
      .limit(30),
  ]);
  if (sourceError) throw sourceError;
  if (identityError) throw identityError;

  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const sourceIdsFromIdentities = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))]
    .filter((id) => !sourceMap.has(id));
  if (sourceIdsFromIdentities.length) {
    const { data: extraSources, error } = await admin.from('sources')
      .select('id,display_name,authority_tier,source_role,territory,active')
      .in('id', sourceIdsFromIdentities);
    if (error) throw error;
    for (const source of extraSources ?? []) sourceMap.set(source.id, source);
  }

  const identitiesBySource = new Map<string, Record<string, unknown>[]>();
  for (const identity of identities ?? []) {
    const list = identitiesBySource.get(identity.source_id) ?? [];
    list.push(identity);
    identitiesBySource.set(identity.source_id, list);
  }
  return {
    items: [...sourceMap.values()].map((source) => ({
      source,
      identities: identitiesBySource.get(String(source.id)) ?? [],
    })).slice(0, 40),
  };
}

async function submit(body: Record<string, unknown>) {
  const candidateUrl = normalizeHttpsUrl(body.candidateUrl);
  const normalizedUrl = normalizeHttpsUrl(body.candidateUrl);
  const candidateKind = upperChoice(body.candidateKind, CANDIDATE_KINDS, 'invalid_candidate_kind');
  const discoveryMethod = upperChoice(body.discoveryMethod ?? 'OPERATOR', DISCOVERY_METHODS, 'invalid_discovery_method');
  const evidenceType = body.evidenceType === undefined || body.evidenceType === null || body.evidenceType === ''
    ? null
    : upperChoice(body.evidenceType, EVIDENCE_TYPES, 'invalid_evidence_type');
  const confidence = Number(body.confidence ?? 0.5);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('invalid_candidate_confidence');
  const sourceIdentityId = typeof body.discoveredFromSourceIdentityId === 'string' && UUID_PATTERN.test(body.discoveredFromSourceIdentityId)
    ? body.discoveredFromSourceIdentityId
    : null;
  const evidenceUrl = optionalHttpsUrl(body.evidenceUrl);
  const evidenceNote = boundedText(body.evidenceNote, 1000);
  if (evidenceType && !evidenceUrl && !evidenceNote) throw new Error('evidence_url_or_note_required');

  const { data, error } = await admin.rpc('submit_source_discovery_candidate', {
    p_candidate_url: candidateUrl,
    p_normalized_url: normalizedUrl,
    p_candidate_kind: candidateKind,
    p_discovery_method: discoveryMethod,
    p_display_name: boundedText(body.displayName, 200),
    p_discovered_from_source_identity_id: sourceIdentityId,
    p_proposed_source_role: boundedText(body.proposedSourceRole, 100),
    p_territory: boundedText(body.territory, 8)?.toUpperCase() ?? null,
    p_languages: languageList(body.languages),
    p_confidence: confidence,
    p_metadata: typeof body.metadata === 'object' && body.metadata !== null && !Array.isArray(body.metadata) ? body.metadata : {},
    p_evidence_type: evidenceType,
    p_evidence_url: evidenceUrl,
    p_evidence_note: evidenceNote,
    p_evidence_metadata: typeof body.evidenceMetadata === 'object' && body.evidenceMetadata !== null && !Array.isArray(body.evidenceMetadata) ? body.evidenceMetadata : {},
  });
  if (error) throw new Error(error.message);
  return { candidateId: data, normalizedUrl };
}

async function review(actorId: string, body: Record<string, unknown>) {
  if (typeof body.candidateId !== 'string' || !UUID_PATTERN.test(body.candidateId)) throw new Error('invalid_candidate_id');
  const status = upperChoice(body.status, REVIEW_STATUSES, 'invalid_candidate_review_status');
  const reason = reasonOf(body.reason);
  if (!reason) throw new Error('valid_reason_required');
  const duplicateIdentityId = typeof body.duplicateSourceIdentityId === 'string' && UUID_PATTERN.test(body.duplicateSourceIdentityId)
    ? body.duplicateSourceIdentityId
    : null;
  const { data, error } = await admin.rpc('operator_review_source_candidate', {
    p_actor_id: actorId,
    p_candidate_id: body.candidateId,
    p_status: status,
    p_reason: reason,
    p_duplicate_source_identity_id: duplicateIdentityId,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function promoteMediaFeed(actorId: string, body: Record<string, unknown>) {
  if (typeof body.candidateId !== 'string' || !UUID_PATTERN.test(body.candidateId)) throw new Error('invalid_candidate_id');
  const authorityTier = Number(body.authorityTier);
  if (authorityTier !== 3 && authorityTier !== 4) throw new Error('media_authority_tier_must_be_3_or_4');
  const pollClass = upperChoice(body.pollClass ?? 'NORMAL_60M', MEDIA_POLL_CLASSES, 'invalid_media_feed_poll_class');
  const reason = reasonOf(body.reason);
  if (!reason) throw new Error('valid_reason_required');

  const { data, error } = await admin.rpc('operator_promote_media_feed_candidate', {
    p_actor_id: actorId,
    p_candidate_id: body.candidateId,
    p_authority_tier: authorityTier,
    p_poll_class: pollClass,
    p_reason: reason,
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
    if (action === 'sourceSearch') {
      return json(200, await sourceSearch(typeof body.query === 'string' ? body.query : ''));
    }
    if (action === 'submit') return json(200, { ok: true, result: await submit(body) });
    if (action === 'review') return json(200, { ok: true, result: await review(auth.user.id, body) });
    if (action === 'promoteMediaFeed') return json(200, { ok: true, result: await promoteMediaFeed(auth.user.id, body) });
    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-source-discovery-api failure', error);
    const message = error instanceof Error ? error.message : 'source_discovery_action_failed';
    return json(400, { error: 'source_discovery_action_failed', message });
  }
});
