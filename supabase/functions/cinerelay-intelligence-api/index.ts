import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay intelligence API environment');

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
const ENTITY_TYPES = ['MOVIE', 'SERIES', 'SEASON'];
const ACTIVE_EVENT_STATUSES = ['ACTIVE', 'NEEDS_REVIEW'];

type AuthenticatedUser = { id: string; email: string | null };
type EntityRow = {
  id: string;
  entity_type: string;
  canonical_name: string;
  slug: string;
  primary_language: string | null;
  country_code: string | null;
  status: string;
};
type AliasRow = {
  entity_id: string;
  alias: string;
  normalized_alias: string;
  language_code: string | null;
  alias_type: string;
};
type EventRow = {
  id: string;
  primary_entity_id: string;
  event_type: string;
  verification_state: string;
  verification_confidence: number | null;
  priority_band: string | null;
  headline: string;
  summary: string | null;
  structured_data: Record<string, unknown> | null;
  status: string;
  detected_at: string;
  occurred_at: string | null;
  announced_at: string | null;
};

type EvidenceRow = { event_id: string; evidence_role: string };

type ResolutionRow = { raw_item_id: string; score: number | null; resolution_state: string };

type RawRow = {
  id: string;
  source_identity_id: string;
  canonical_url: string | null;
  raw_title: string | null;
  raw_text: string | null;
  item_type: string | null;
  media_type: string | null;
  published_at: string | null;
  first_seen_at: string | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function optionalUser(request: Request): Promise<AuthenticatedUser | null | Response> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id, email: data.user.email ?? null };
}

function boundedLimit(value: unknown, fallback = 25, max = 50): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function normalizeQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function entityRank(entity: EntityRow, aliases: AliasRow[], query: string): number {
  const canonical = normalizeQuery(entity.canonical_name);
  if (canonical === query) return 0;
  if (aliases.some((alias) => alias.normalized_alias === query)) return 1;
  if (canonical.startsWith(query)) return 2;
  if (aliases.some((alias) => alias.normalized_alias.startsWith(query))) return 3;
  if (canonical.includes(query)) return 4;
  return 5;
}

async function followedEntityIds(userId: string | null, entityIds: string[]): Promise<Set<string>> {
  if (!userId || entityIds.length === 0) return new Set();
  const { data, error } = await admin
    .from('user_entity_follows')
    .select('entity_id')
    .eq('user_id', userId)
    .eq('active', true)
    .in('entity_id', entityIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String(row.entity_id)));
}

async function aliasesFor(entityIds: string[]): Promise<AliasRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await admin
    .from('entity_aliases')
    .select('entity_id,alias,normalized_alias,language_code,alias_type')
    .in('entity_id', entityIds)
    .is('valid_to', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AliasRow[];
}

function evidenceCounts(rows: EvidenceRow[]): Map<string, { total: number; primary: number; corroborating: number; conflicting: number }> {
  const map = new Map<string, { total: number; primary: number; corroborating: number; conflicting: number }>();
  for (const row of rows) {
    const current = map.get(row.event_id) ?? { total: 0, primary: 0, corroborating: 0, conflicting: 0 };
    current.total += 1;
    if (row.evidence_role === 'PRIMARY') current.primary += 1;
    else if (row.evidence_role === 'CORROBORATING') current.corroborating += 1;
    else if (row.evidence_role === 'CONFLICTING') current.conflicting += 1;
    map.set(row.event_id, current);
  }
  return map;
}

async function eventEvidenceCounts(eventIds: string[]): Promise<Map<string, { total: number; primary: number; corroborating: number; conflicting: number }>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await admin
    .from('event_evidence')
    .select('event_id,evidence_role')
    .in('event_id', eventIds);
  if (error) throw error;
  return evidenceCounts((data ?? []) as EvidenceRow[]);
}

async function searchEntities(user: AuthenticatedUser | null, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const query = normalizeQuery(body.query ?? body.q);
  if (query.length < 2) return { error: 'search_query_too_short', statusCode: 400 };
  const limit = boundedLimit(body.limit, 20, 40);
  const fetchLimit = Math.min(100, limit * 4);

  const [canonicalResult, aliasResult] = await Promise.all([
    admin
      .from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .eq('status', 'ACTIVE')
      .in('entity_type', ENTITY_TYPES)
      .ilike('canonical_name', `%${query}%`)
      .limit(fetchLimit),
    admin
      .from('entity_aliases')
      .select('entity_id,alias,normalized_alias,language_code,alias_type')
      .ilike('normalized_alias', `%${query}%`)
      .limit(fetchLimit),
  ]);
  if (canonicalResult.error) throw canonicalResult.error;
  if (aliasResult.error) throw aliasResult.error;

  const canonicalEntities = (canonicalResult.data ?? []) as EntityRow[];
  const aliasHits = (aliasResult.data ?? []) as AliasRow[];
  const entityIds = [...new Set([
    ...canonicalEntities.map((row) => row.id),
    ...aliasHits.map((row) => row.entity_id),
  ])];

  const missingIds = entityIds.filter((id) => !canonicalEntities.some((row) => row.id === id));
  const missingResult = missingIds.length
    ? await admin
      .from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .in('id', missingIds)
      .eq('status', 'ACTIVE')
      .in('entity_type', ENTITY_TYPES)
    : { data: [], error: null };
  if (missingResult.error) throw missingResult.error;

  const entities = [...canonicalEntities, ...((missingResult.data ?? []) as EntityRow[])];
  const activeIds = entities.map((row) => row.id);
  const allAliases = await aliasesFor(activeIds);
  const aliasesByEntity = new Map<string, AliasRow[]>();
  for (const alias of allAliases) {
    const list = aliasesByEntity.get(alias.entity_id) ?? [];
    list.push(alias);
    aliasesByEntity.set(alias.entity_id, list);
  }
  const followed = await followedEntityIds(user?.id ?? null, activeIds);

  const items = entities
    .map((entity) => {
      const aliases = aliasesByEntity.get(entity.id) ?? [];
      return {
        id: entity.id,
        type: entity.entity_type,
        name: entity.canonical_name,
        slug: entity.slug,
        primaryLanguage: entity.primary_language,
        countryCode: entity.country_code,
        followed: followed.has(entity.id),
        aliases: aliases.map((alias) => ({
          value: alias.alias,
          type: alias.alias_type,
          languageCode: alias.language_code,
        })),
        _rank: entityRank(entity, aliases, query),
      };
    })
    .sort((left, right) => {
      if (left._rank !== right._rank) return left._rank - right._rank;
      return left.name.localeCompare(right.name);
    })
    .slice(0, limit)
    .map(({ _rank, ...item }) => item);

  return {
    generatedAt: new Date().toISOString(),
    guest: user === null,
    query,
    count: items.length,
    items,
  };
}

async function loadEntity(body: Record<string, unknown>): Promise<EntityRow | null> {
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLocaleLowerCase('en-US') : '';
  if (!entityId && !slug) return null;
  if (entityId && !UUID_PATTERN.test(entityId)) return null;

  let query = admin
    .from('entities')
    .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
    .eq('status', 'ACTIVE')
    .in('entity_type', ENTITY_TYPES);
  query = entityId ? query.eq('id', entityId) : query.eq('slug', slug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data ?? null) as EntityRow | null;
}

async function entityHub(user: AuthenticatedUser | null, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const entity = await loadEntity(body);
  if (!entity) return { error: 'entity_not_found', statusCode: 404 };
  const eventLimit = boundedLimit(body.eventLimit, 30, 75);
  const activityLimit = boundedLimit(body.activityLimit, 20, 50);

  const [aliasRows, eventsResult, resolutionsResult, followed] = await Promise.all([
    aliasesFor([entity.id]),
    admin
      .from('events')
      .select('id,primary_entity_id,event_type,verification_state,verification_confidence,priority_band,headline,summary,structured_data,status,detected_at,occurred_at,announced_at')
      .eq('primary_entity_id', entity.id)
      .in('status', ACTIVE_EVENT_STATUSES)
      .order('detected_at', { ascending: false })
      .limit(eventLimit),
    admin
      .from('current_entity_resolution_results')
      .select('raw_item_id,score,resolution_state')
      .eq('entity_id', entity.id)
      .eq('resolution_state', 'RESOLVED')
      .order('created_at', { ascending: false })
      .limit(activityLimit),
    followedEntityIds(user?.id ?? null, [entity.id]),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (resolutionsResult.error) throw resolutionsResult.error;

  const events = (eventsResult.data ?? []) as EventRow[];
  const counts = await eventEvidenceCounts(events.map((row) => row.id));
  const resolutions = (resolutionsResult.data ?? []) as ResolutionRow[];
  const rawIds = resolutions.map((row) => row.raw_item_id);
  const rawResult = rawIds.length
    ? await admin
      .from('raw_items')
      .select('id,source_identity_id,canonical_url,raw_title,raw_text,item_type,media_type,published_at,first_seen_at')
      .in('id', rawIds)
    : { data: [], error: null };
  if (rawResult.error) throw rawResult.error;
  const raws = (rawResult.data ?? []) as RawRow[];

  const identityIds = [...new Set(raws.map((row) => row.source_identity_id))];
  const identitiesResult = identityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,handle').in('id', identityIds)
    : { data: [], error: null };
  if (identitiesResult.error) throw identitiesResult.error;
  const identities = identitiesResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourcesResult = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourcesResult.error) throw sourcesResult.error;

  const rawMap = new Map(raws.map((row) => [row.id, row]));
  const resolutionMap = new Map(resolutions.map((row) => [row.raw_item_id, row]));
  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourcesResult.data ?? []).map((row) => [row.id, row]));

  const activity = rawIds
    .map((rawId) => {
      const raw = rawMap.get(rawId);
      if (!raw) return null;
      const identity = identityMap.get(raw.source_identity_id);
      const source = identity ? sourceMap.get(identity.source_id) : undefined;
      const resolution = resolutionMap.get(rawId);
      return {
        rawItemId: raw.id,
        title: raw.raw_title,
        text: raw.raw_text,
        itemType: raw.item_type,
        mediaType: raw.media_type,
        canonicalUrl: raw.canonical_url,
        publishedAt: raw.published_at,
        observedAt: raw.published_at ?? raw.first_seen_at,
        resolutionScore: resolution?.score ?? null,
        source: {
          name: source?.display_name ?? null,
          authorityTier: source?.authority_tier ?? null,
          role: source?.source_role ?? null,
          platform: identity?.platform ?? null,
          handle: identity?.handle ?? null,
        },
      };
    })
    .filter((item) => item !== null);

  return {
    generatedAt: new Date().toISOString(),
    guest: user === null,
    entity: {
      id: entity.id,
      type: entity.entity_type,
      name: entity.canonical_name,
      slug: entity.slug,
      primaryLanguage: entity.primary_language,
      countryCode: entity.country_code,
      followed: followed.has(entity.id),
      aliases: aliasRows.map((alias) => ({ value: alias.alias, type: alias.alias_type, languageCode: alias.language_code })),
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.event_type,
      verificationState: event.verification_state,
      verificationConfidence: event.verification_confidence,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: event.summary,
      structuredData: event.structured_data,
      status: event.status,
      detectedAt: event.detected_at,
      occurredAt: event.occurred_at,
      announcedAt: event.announced_at,
      evidence: counts.get(event.id) ?? { total: 0, primary: 0, corroborating: 0, conflicting: 0 },
    })),
    activity,
  };
}

async function storyClusters(user: AuthenticatedUser | null, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const limit = boundedLimit(body.limit, 25, 50);
  const { data, error } = await admin
    .from('events')
    .select('id,primary_entity_id,event_type,verification_state,verification_confidence,priority_band,headline,summary,structured_data,status,detected_at,occurred_at,announced_at')
    .in('status', ACTIVE_EVENT_STATUSES)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const events = (data ?? []) as EventRow[];
  const entityIds = [...new Set(events.map((row) => row.primary_entity_id).filter(Boolean))];
  const entityResult = entityIds.length
    ? await admin
      .from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .in('id', entityIds)
      .eq('status', 'ACTIVE')
    : { data: [], error: null };
  if (entityResult.error) throw entityResult.error;
  const entityMap = new Map(((entityResult.data ?? []) as EntityRow[]).map((row) => [row.id, row]));
  const [counts, followed] = await Promise.all([
    eventEvidenceCounts(events.map((row) => row.id)),
    followedEntityIds(user?.id ?? null, entityIds),
  ]);

  const items = events.map((event) => {
    const entity = entityMap.get(event.primary_entity_id);
    return {
      id: event.id,
      eventType: event.event_type,
      verificationState: event.verification_state,
      verificationConfidence: event.verification_confidence,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: event.summary,
      structuredData: event.structured_data,
      detectedAt: event.detected_at,
      occurredAt: event.occurred_at,
      announcedAt: event.announced_at,
      evidence: counts.get(event.id) ?? { total: 0, primary: 0, corroborating: 0, conflicting: 0 },
      entity: entity ? {
        id: entity.id,
        type: entity.entity_type,
        name: entity.canonical_name,
        slug: entity.slug,
        primaryLanguage: entity.primary_language,
        followed: followed.has(entity.id),
      } : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    guest: user === null,
    count: items.length,
    items,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action.trim().toLocaleLowerCase('en-US') : 'clusters';

    let payload: Record<string, unknown>;
    if (action === 'search') payload = await searchEntities(maybeUser, body);
    else if (action === 'hub') payload = await entityHub(maybeUser, body);
    else if (action === 'clusters') payload = await storyClusters(maybeUser, body);
    else return json(400, { error: 'unsupported_action' });

    const statusCode = typeof payload.statusCode === 'number' ? payload.statusCode : 200;
    if ('statusCode' in payload) delete payload.statusCode;
    return json(statusCode, payload);
  } catch (error) {
    console.error('cinerelay-intelligence-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
