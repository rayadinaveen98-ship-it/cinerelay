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
const OTT_WINDOWS = ['today', 'this_week', 'upcoming', 'released', 'tba', 'all'];

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
type OttProviderRow = {
  id: string;
  code: string;
  display_name: string;
  homepage_url: string | null;
  territory: string;
  active: boolean;
  sort_order: number;
};
type OttReleaseRow = {
  id: string;
  entity_id: string;
  provider_id: string;
  territory: string;
  languages: string[] | null;
  release_type: string;
  release_date: string | null;
  date_precision: string;
  state: string;
  evidence_status: string;
  previous_release_date: string | null;
  first_observed_at: string;
  last_verified_at: string;
};
type OttEvidenceRow = {
  ott_release_id: string;
  raw_item_id: string;
  event_id: string | null;
  evidence_role: string;
  is_first_party: boolean;
  observed_at: string;
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

function normalizedUpper(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function normalizedLower(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function indiaDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDateDays(date: string, days: number): string {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
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

async function activeOttProviders(): Promise<OttProviderRow[]> {
  const { data, error } = await admin
    .from('ott_providers')
    .select('id,code,display_name,homepage_url,territory,active,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OttProviderRow[];
}

async function ottReleases(user: AuthenticatedUser | null, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const requestedWindow = normalizedLower(body.window) ?? 'this_week';
  const window = OTT_WINDOWS.includes(requestedWindow) ? requestedWindow : 'this_week';
  const territory = normalizedUpper(body.territory) ?? 'IN';
  const providerCode = normalizedUpper(body.providerCode ?? body.provider);
  const language = normalizedLower(body.language);
  const contentType = normalizedUpper(body.contentType ?? body.type);
  const state = normalizedUpper(body.state);
  const evidenceStatus = normalizedUpper(body.evidenceStatus);
  const entityId = typeof body.entityId === 'string' && UUID_PATTERN.test(body.entityId.trim()) ? body.entityId.trim() : null;
  const limit = boundedLimit(body.limit, 30, 75);
  const fetchLimit = Math.min(250, Math.max(limit * 4, 80));
  const today = indiaDateString();
  const weekEnd = addDateDays(today, 6);

  const providers = await activeOttProviders();
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const requestedProvider = providerCode ? providers.find((provider) => provider.code === providerCode) : undefined;
  if (providerCode && !requestedProvider) {
    return {
      generatedAt: new Date().toISOString(),
      guest: user === null,
      window,
      territory,
      providers: providers.map((provider) => ({
        code: provider.code,
        name: provider.display_name,
        homepageUrl: provider.homepage_url,
      })),
      count: 0,
      items: [],
    };
  }

  let query = admin
    .from('ott_releases')
    .select('id,entity_id,provider_id,territory,languages,release_type,release_date,date_precision,state,evidence_status,previous_release_date,first_observed_at,last_verified_at')
    .eq('territory', territory);

  if (entityId) query = query.eq('entity_id', entityId);
  if (requestedProvider) query = query.eq('provider_id', requestedProvider.id);
  if (language) query = query.contains('languages', [language]);
  if (state) query = query.eq('state', state);
  if (evidenceStatus) query = query.eq('evidence_status', evidenceStatus);

  if (window === 'today') {
    query = query.eq('release_date', today);
  } else if (window === 'this_week') {
    query = query.gte('release_date', today).lte('release_date', weekEnd).neq('state', 'RELEASED');
  } else if (window === 'upcoming') {
    query = query.gte('release_date', today).neq('state', 'RELEASED');
  } else if (window === 'released') {
    query = query.eq('state', 'RELEASED');
  } else if (window === 'tba') {
    query = query.eq('date_precision', 'TBA').is('release_date', null);
  }

  query = window === 'released'
    ? query.order('release_date', { ascending: false, nullsFirst: false })
    : query.order('release_date', { ascending: true, nullsFirst: false });
  const { data, error } = await query.limit(fetchLimit);
  if (error) throw error;
  let releases = (data ?? []) as OttReleaseRow[];

  const entityIds = [...new Set(releases.map((release) => release.entity_id))];
  const entityResult = entityIds.length
    ? await admin
      .from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .in('id', entityIds)
      .eq('status', 'ACTIVE')
      .in('entity_type', ENTITY_TYPES)
    : { data: [], error: null };
  if (entityResult.error) throw entityResult.error;
  const entityMap = new Map(((entityResult.data ?? []) as EntityRow[]).map((entity) => [entity.id, entity]));

  if (contentType && ENTITY_TYPES.includes(contentType)) {
    releases = releases.filter((release) => entityMap.get(release.entity_id)?.entity_type === contentType);
  }
  releases = releases.filter((release) => entityMap.has(release.entity_id)).slice(0, limit);

  const releaseIds = releases.map((release) => release.id);
  const evidenceResult = releaseIds.length
    ? await admin
      .from('ott_release_evidence')
      .select('ott_release_id,raw_item_id,event_id,evidence_role,is_first_party,observed_at')
      .in('ott_release_id', releaseIds)
      .order('observed_at', { ascending: false })
    : { data: [], error: null };
  if (evidenceResult.error) throw evidenceResult.error;
  const evidenceRows = (evidenceResult.data ?? []) as OttEvidenceRow[];
  const rawIds = [...new Set(evidenceRows.map((evidence) => evidence.raw_item_id))];
  const rawResult = rawIds.length
    ? await admin
      .from('raw_items')
      .select('id,source_identity_id,canonical_url,raw_title,raw_text,item_type,media_type,published_at,first_seen_at')
      .in('id', rawIds)
    : { data: [], error: null };
  if (rawResult.error) throw rawResult.error;
  const rawRows = (rawResult.data ?? []) as RawRow[];
  const rawMap = new Map(rawRows.map((raw) => [raw.id, raw]));

  const identityIds = [...new Set(rawRows.map((raw) => raw.source_identity_id))];
  const identityResult = identityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,handle').in('id', identityIds)
    : { data: [], error: null };
  if (identityResult.error) throw identityResult.error;
  const identities = identityResult.data ?? [];
  const identityMap = new Map(identities.map((identity) => [String(identity.id), identity]));
  const sourceIds = [...new Set(identities.map((identity) => String(identity.source_id)).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;
  const sourceMap = new Map((sourceResult.data ?? []).map((source) => [String(source.id), source]));
  const followed = await followedEntityIds(user?.id ?? null, releases.map((release) => release.entity_id));

  const evidenceByRelease = new Map<string, OttEvidenceRow[]>();
  for (const evidence of evidenceRows) {
    const list = evidenceByRelease.get(evidence.ott_release_id) ?? [];
    list.push(evidence);
    evidenceByRelease.set(evidence.ott_release_id, list);
  }

  const items = releases.map((release) => {
    const entity = entityMap.get(release.entity_id)!;
    const provider = providerById.get(release.provider_id);
    const releaseEvidence = evidenceByRelease.get(release.id) ?? [];
    const refs = releaseEvidence.slice(0, 8).map((evidence) => {
      const raw = rawMap.get(evidence.raw_item_id);
      const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
      const source = identity ? sourceMap.get(String(identity.source_id)) : undefined;
      return {
        rawItemId: evidence.raw_item_id,
        eventId: evidence.event_id,
        role: evidence.evidence_role,
        firstParty: evidence.is_first_party,
        observedAt: evidence.observed_at,
        title: raw?.raw_title ?? null,
        canonicalUrl: raw?.canonical_url ?? null,
        publishedAt: raw?.published_at ?? null,
        source: {
          name: source?.display_name ?? null,
          authorityTier: source?.authority_tier ?? null,
          role: source?.source_role ?? null,
          platform: identity?.platform ?? null,
          handle: identity?.handle ?? null,
        },
      };
    });
    return {
      id: release.id,
      entity: {
        id: entity.id,
        type: entity.entity_type,
        name: entity.canonical_name,
        slug: entity.slug,
        primaryLanguage: entity.primary_language,
        countryCode: entity.country_code,
        followed: followed.has(entity.id),
      },
      provider: {
        code: provider?.code ?? null,
        name: provider?.display_name ?? null,
        homepageUrl: provider?.homepage_url ?? null,
      },
      territory: release.territory,
      languages: release.languages ?? [],
      releaseType: release.release_type,
      releaseDate: release.release_date,
      datePrecision: release.date_precision,
      state: release.state,
      evidenceStatus: release.evidence_status,
      previousReleaseDate: release.previous_release_date,
      firstObservedAt: release.first_observed_at,
      lastVerifiedAt: release.last_verified_at,
      evidence: {
        total: releaseEvidence.length,
        firstParty: releaseEvidence.filter((evidence) => evidence.is_first_party).length,
        conflicting: releaseEvidence.filter((evidence) => evidence.evidence_role === 'CONFLICTING').length,
        refs,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    guest: user === null,
    window,
    territory,
    today,
    windowEnd: window === 'this_week' ? weekEnd : null,
    filters: {
      providerCode,
      language,
      contentType,
      state,
      evidenceStatus,
    },
    providers: providers.map((provider) => ({
      code: provider.code,
      name: provider.display_name,
      homepageUrl: provider.homepage_url,
    })),
    count: items.length,
    items,
  };
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

  const ott = await ottReleases(user, { window: 'all', entityId: entity.id, territory: entity.country_code ?? 'IN', limit: 20 });

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
    ottReleases: Array.isArray(ott.items) ? ott.items : [],
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
    else if (action === 'ott') payload = await ottReleases(maybeUser, body);
    else return json(400, { error: 'unsupported_action' });

    const statusCode = typeof payload.statusCode === 'number' ? payload.statusCode : 200;
    if ('statusCode' in payload) delete payload.statusCode;
    return json(statusCode, payload);
  } catch (error) {
    console.error('cinerelay-intelligence-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
