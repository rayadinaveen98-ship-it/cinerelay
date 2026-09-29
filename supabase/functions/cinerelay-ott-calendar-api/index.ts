import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay OTT calendar API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

const ENTITY_TYPES = ['MOVIE', 'SERIES', 'SEASON'];
const WINDOWS = ['today', 'this_week', 'next_30_days', 'upcoming', 'released', 'tba', 'all'];
const CANDIDATE_STATUSES = ['PENDING', 'REVIEWING', 'APPROVED'];

type AuthenticatedUser = { id: string; email: string | null };
type ProviderRow = {
  id: string;
  code: string;
  display_name: string;
  homepage_url: string | null;
  territory: string;
  active: boolean;
  sort_order: number;
};
type EntityRow = {
  id: string;
  entity_type: string;
  canonical_name: string;
  slug: string;
  primary_language: string | null;
  country_code: string | null;
  status: string;
};
type ReleaseRow = {
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
type ReleaseEvidenceRow = {
  ott_release_id: string;
  raw_item_id: string;
  event_id: string | null;
  evidence_role: string;
  is_first_party: boolean;
  observed_at: string;
};
type CandidateRow = {
  id: string;
  proposed_entity_type: string;
  proposed_name: string;
  normalized_name: string;
  primary_language: string | null;
  country_code: string | null;
  confidence: number;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};
type CandidateEvidenceRow = {
  id: string;
  candidate_id: string;
  raw_item_id: string;
  source_identity_id: string;
  evidence_role: string;
  match_method: string;
  weight: number;
  is_first_party: boolean;
  observed_at: string;
  metadata: Record<string, unknown> | null;
};
type RawRow = {
  id: string;
  source_identity_id: string;
  canonical_url: string | null;
  raw_title: string | null;
  raw_text: string | null;
  published_at: string | null;
};

type SourceIdentityRow = {
  id: string;
  source_id: string;
  platform: string | null;
  handle: string | null;
};

type SourceRow = {
  id: string;
  display_name: string;
  authority_tier: number;
  source_role: string;
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

function boundedLimit(value: unknown, fallback = 75, max = 100): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
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

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function releaseMatchesWindow(
  releaseDate: string | null,
  state: string,
  window: string,
  today: string,
  weekEnd: string,
  monthEnd: string,
): boolean {
  if (window === 'all') return true;
  if (window === 'released') return state === 'RELEASED';
  if (window === 'tba') return releaseDate === null;
  if (!releaseDate) return false;
  if (window === 'today') return releaseDate === today;
  if (window === 'this_week') return releaseDate >= today && releaseDate <= weekEnd && state !== 'RELEASED';
  if (window === 'next_30_days') return releaseDate >= today && releaseDate <= monthEnd && state !== 'RELEASED';
  if (window === 'upcoming') return releaseDate >= today && state !== 'RELEASED';
  return false;
}

async function activeProviders(): Promise<ProviderRow[]> {
  const { data, error } = await admin
    .from('ott_providers')
    .select('id,code,display_name,homepage_url,territory,active,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProviderRow[];
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

async function loadSourceContext(rawIds: string[]): Promise<{
  rawMap: Map<string, RawRow>;
  identityMap: Map<string, SourceIdentityRow>;
  sourceMap: Map<string, SourceRow>;
}> {
  if (rawIds.length === 0) {
    return { rawMap: new Map(), identityMap: new Map(), sourceMap: new Map() };
  }
  const { data: rawData, error: rawError } = await admin
    .from('raw_items')
    .select('id,source_identity_id,canonical_url,raw_title,raw_text,published_at')
    .in('id', rawIds);
  if (rawError) throw rawError;
  const raws = (rawData ?? []) as RawRow[];
  const rawMap = new Map(raws.map((row) => [row.id, row]));
  const identityIds = [...new Set(raws.map((row) => row.source_identity_id).filter(Boolean))];
  if (identityIds.length === 0) {
    return { rawMap, identityMap: new Map(), sourceMap: new Map() };
  }
  const { data: identityData, error: identityError } = await admin
    .from('source_identities')
    .select('id,source_id,platform,handle')
    .in('id', identityIds);
  if (identityError) throw identityError;
  const identities = (identityData ?? []) as SourceIdentityRow[];
  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  if (sourceIds.length === 0) {
    return { rawMap, identityMap, sourceMap: new Map() };
  }
  const { data: sourceData, error: sourceError } = await admin
    .from('sources')
    .select('id,display_name,authority_tier,source_role')
    .in('id', sourceIds);
  if (sourceError) throw sourceError;
  const sourceMap = new Map(((sourceData ?? []) as SourceRow[]).map((row) => [row.id, row]));
  return { rawMap, identityMap, sourceMap };
}

function evidenceRef(
  rawId: string,
  role: string,
  firstParty: boolean,
  observedAt: string | null,
  context: {
    rawMap: Map<string, RawRow>;
    identityMap: Map<string, SourceIdentityRow>;
    sourceMap: Map<string, SourceRow>;
  },
  eventId: string | null = null,
): Record<string, unknown> {
  const raw = context.rawMap.get(rawId);
  const identity = raw ? context.identityMap.get(raw.source_identity_id) : undefined;
  const source = identity ? context.sourceMap.get(identity.source_id) : undefined;
  return {
    rawItemId: rawId,
    eventId,
    role,
    firstParty,
    observedAt,
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
}

async function canonicalItems(args: {
  user: AuthenticatedUser | null;
  providers: ProviderRow[];
  territory: string;
  providerCode: string | null;
  language: string | null;
  contentType: string | null;
  evidenceStatus: string | null;
  window: string;
  today: string;
  weekEnd: string;
  monthEnd: string;
}): Promise<Record<string, unknown>[]> {
  const providerById = new Map(args.providers.map((provider) => [provider.id, provider]));
  const requestedProvider = args.providerCode
    ? args.providers.find((provider) => provider.code === args.providerCode)
    : undefined;
  if (args.providerCode && !requestedProvider) return [];

  let query = admin
    .from('ott_releases')
    .select('id,entity_id,provider_id,territory,languages,release_type,release_date,date_precision,state,evidence_status,previous_release_date,first_observed_at,last_verified_at')
    .eq('territory', args.territory);
  if (requestedProvider) query = query.eq('provider_id', requestedProvider.id);
  if (args.language) query = query.contains('languages', [args.language]);
  if (args.evidenceStatus && args.evidenceStatus !== 'TBA') query = query.eq('evidence_status', args.evidenceStatus);
  const { data, error } = await query.limit(300);
  if (error) throw error;
  let releases = (data ?? []) as ReleaseRow[];
  releases = releases.filter((release) => releaseMatchesWindow(
    release.release_date,
    release.state,
    args.window,
    args.today,
    args.weekEnd,
    args.monthEnd,
  ));
  if (args.evidenceStatus === 'TBA') {
    releases = releases.filter((release) => release.date_precision === 'TBA');
  }

  const entityIds = [...new Set(releases.map((release) => release.entity_id))];
  if (entityIds.length === 0) return [];
  const { data: entityData, error: entityError } = await admin
    .from('entities')
    .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
    .in('id', entityIds)
    .eq('status', 'ACTIVE')
    .in('entity_type', ENTITY_TYPES);
  if (entityError) throw entityError;
  const entityMap = new Map(((entityData ?? []) as EntityRow[]).map((row) => [row.id, row]));
  if (args.contentType && ENTITY_TYPES.includes(args.contentType)) {
    releases = releases.filter((release) => entityMap.get(release.entity_id)?.entity_type === args.contentType);
  }
  releases = releases.filter((release) => entityMap.has(release.entity_id));
  const followed = await followedEntityIds(args.user?.id ?? null, releases.map((release) => release.entity_id));

  const releaseIds = releases.map((release) => release.id);
  const { data: evidenceData, error: evidenceError } = releaseIds.length
    ? await admin
      .from('ott_release_evidence')
      .select('ott_release_id,raw_item_id,event_id,evidence_role,is_first_party,observed_at')
      .in('ott_release_id', releaseIds)
      .order('observed_at', { ascending: false })
    : { data: [], error: null };
  if (evidenceError) throw evidenceError;
  const evidenceRows = (evidenceData ?? []) as ReleaseEvidenceRow[];
  const context = await loadSourceContext([...new Set(evidenceRows.map((row) => row.raw_item_id))]);
  const evidenceByRelease = new Map<string, ReleaseEvidenceRow[]>();
  for (const row of evidenceRows) {
    const list = evidenceByRelease.get(row.ott_release_id) ?? [];
    list.push(row);
    evidenceByRelease.set(row.ott_release_id, list);
  }

  return releases.map((release) => {
    const entity = entityMap.get(release.entity_id)!;
    const provider = providerById.get(release.provider_id);
    const evidence = evidenceByRelease.get(release.id) ?? [];
    return {
      id: release.id,
      provisional: false,
      entity: {
        id: entity.id,
        type: entity.entity_type,
        name: entity.canonical_name,
        slug: entity.slug,
        primaryLanguage: entity.primary_language,
        countryCode: entity.country_code,
        followed: followed.has(entity.id),
        aliases: [],
      },
      provider: {
        code: provider?.code ?? '',
        name: provider?.display_name ?? '',
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
        total: evidence.length,
        firstParty: evidence.filter((row) => row.is_first_party).length,
        conflicting: evidence.filter((row) => row.evidence_role === 'CONFLICTING').length,
        refs: evidence.slice(0, 8).map((row) => evidenceRef(
          row.raw_item_id,
          row.evidence_role,
          row.is_first_party,
          row.observed_at,
          context,
          row.event_id,
        )),
      },
    };
  });
}

async function provisionalReportedItems(args: {
  providers: ProviderRow[];
  territory: string;
  providerCode: string | null;
  language: string | null;
  contentType: string | null;
  evidenceStatus: string | null;
  window: string;
  today: string;
  weekEnd: string;
  monthEnd: string;
  canonicalKeys: Set<string>;
}): Promise<Record<string, unknown>[]> {
  if (args.evidenceStatus && args.evidenceStatus !== 'REPORTED') return [];
  if (args.window === 'released' || args.window === 'tba') return [];

  const providerByCode = new Map(args.providers.map((provider) => [provider.code, provider]));
  const { data: candidateData, error: candidateError } = await admin
    .from('entity_discovery_candidates')
    .select('id,proposed_entity_type,proposed_name,normalized_name,primary_language,country_code,confidence,status,first_seen_at,last_seen_at')
    .in('status', CANDIDATE_STATUSES)
    .in('proposed_entity_type', ENTITY_TYPES)
    .gte('confidence', 0.88)
    .order('last_seen_at', { ascending: false })
    .limit(500);
  if (candidateError) throw candidateError;
  const candidates = (candidateData ?? []) as CandidateRow[];
  if (candidates.length === 0) return [];
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  const { data: evidenceData, error: evidenceError } = await admin
    .from('entity_discovery_evidence')
    .select('id,candidate_id,raw_item_id,source_identity_id,evidence_role,match_method,weight,is_first_party,observed_at,metadata')
    .in('candidate_id', candidates.map((candidate) => candidate.id))
    .eq('match_method', 'DETERMINISTIC_TITLE')
    .order('observed_at', { ascending: false })
    .limit(1000);
  if (evidenceError) throw evidenceError;
  const allEvidence = (evidenceData ?? []) as CandidateEvidenceRow[];
  const reportedEvidence = allEvidence.filter((row) => {
    const metadata = row.metadata ?? {};
    return metadata.signalType === 'OTT_RELEASE'
      && metadata.evidenceStatus === 'REPORTED'
      && typeof metadata.providerCode === 'string'
      && typeof metadata.releaseDate === 'string'
      && row.weight >= 0.85
      && row.is_first_party === false;
  });
  if (reportedEvidence.length === 0) return [];

  const context = await loadSourceContext([...new Set(reportedEvidence.map((row) => row.raw_item_id))]);
  const evidenceByKey = new Map<string, CandidateEvidenceRow[]>();
  for (const row of reportedEvidence) {
    const candidate = candidateMap.get(row.candidate_id);
    if (!candidate) continue;
    const metadata = row.metadata ?? {};
    const providerCode = String(metadata.providerCode ?? '').toUpperCase();
    const provider = providerByCode.get(providerCode);
    const releaseDate = String(metadata.releaseDate ?? '');
    if (!provider || !releaseDate) continue;
    if (args.providerCode && providerCode !== args.providerCode) continue;
    if (args.contentType && candidate.proposed_entity_type !== args.contentType) continue;
    if (args.language && candidate.primary_language !== args.language) continue;
    const state = typeof metadata.state === 'string' ? metadata.state : (releaseDate >= args.today ? 'UPCOMING' : 'RELEASED');
    if (!releaseMatchesWindow(releaseDate, state, args.window, args.today, args.weekEnd, args.monthEnd)) continue;
    const key = `${candidate.id}:${providerCode}`;
    const list = evidenceByKey.get(key) ?? [];
    list.push(row);
    evidenceByKey.set(key, list);
  }

  const items: Record<string, unknown>[] = [];
  for (const [key, evidence] of evidenceByKey) {
    const latest = evidence[0];
    const candidate = candidateMap.get(latest.candidate_id);
    if (!candidate) continue;
    const metadata = latest.metadata ?? {};
    const providerCode = String(metadata.providerCode ?? '').toUpperCase();
    const provider = providerByCode.get(providerCode);
    const releaseDate = String(metadata.releaseDate ?? '');
    if (!provider || !releaseDate) continue;
    const canonicalKey = `${normalizeName(candidate.proposed_name)}:${providerCode}:${releaseDate}`;
    if (args.canonicalKeys.has(canonicalKey)) continue;
    const state = typeof metadata.state === 'string' ? metadata.state : (releaseDate >= args.today ? 'UPCOMING' : 'RELEASED');
    items.push({
      id: `reported:${key}:${releaseDate}`,
      provisional: true,
      entity: {
        id: candidate.id,
        type: candidate.proposed_entity_type,
        name: candidate.proposed_name,
        slug: '',
        primaryLanguage: candidate.primary_language,
        countryCode: candidate.country_code ?? 'IN',
        followed: false,
        aliases: [],
      },
      provider: {
        code: provider.code,
        name: provider.display_name,
        homepageUrl: provider.homepage_url,
      },
      territory: args.territory,
      languages: candidate.primary_language ? [candidate.primary_language] : [],
      releaseType: typeof metadata.releaseType === 'string' ? metadata.releaseType : 'POST_THEATRICAL',
      releaseDate,
      datePrecision: typeof metadata.datePrecision === 'string' ? metadata.datePrecision : 'DAY',
      state,
      evidenceStatus: 'REPORTED',
      previousReleaseDate: null,
      firstObservedAt: candidate.first_seen_at,
      lastVerifiedAt: latest.observed_at,
      evidence: {
        total: evidence.length,
        firstParty: 0,
        conflicting: 0,
        refs: evidence.slice(0, 8).map((row) => evidenceRef(
          row.raw_item_id,
          row.evidence_role,
          false,
          row.observed_at,
          context,
          null,
        )),
      },
    });
  }
  return items;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const user = await optionalUser(request);
    if (user instanceof Response) return user;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedWindow = normalizedLower(body.window) ?? 'next_30_days';
    const window = WINDOWS.includes(requestedWindow) ? requestedWindow : 'next_30_days';
    const territory = normalizedUpper(body.territory) ?? 'IN';
    const providerCode = normalizedUpper(body.providerCode ?? body.provider);
    const language = normalizedLower(body.language);
    const contentType = normalizedUpper(body.contentType ?? body.type);
    const evidenceStatus = normalizedUpper(body.evidenceStatus);
    const limit = boundedLimit(body.limit, 75, 100);
    const today = indiaDateString();
    const weekEnd = addDateDays(today, 6);
    const monthEnd = addDateDays(today, 29);

    const providers = await activeProviders();
    const canonical = await canonicalItems({
      user,
      providers,
      territory,
      providerCode,
      language,
      contentType,
      evidenceStatus,
      window,
      today,
      weekEnd,
      monthEnd,
    });
    const canonicalKeys = new Set(canonical.map((item) => {
      const entity = item.entity as Record<string, unknown>;
      const provider = item.provider as Record<string, unknown>;
      return `${normalizeName(String(entity.name ?? ''))}:${String(provider.code ?? '').toUpperCase()}:${String(item.releaseDate ?? '')}`;
    }));
    const provisional = await provisionalReportedItems({
      providers,
      territory,
      providerCode,
      language,
      contentType,
      evidenceStatus,
      window,
      today,
      weekEnd,
      monthEnd,
      canonicalKeys,
    });

    const items = [...canonical, ...provisional]
      .sort((left, right) => {
        const leftDate = String(left.releaseDate ?? '9999-12-31');
        const rightDate = String(right.releaseDate ?? '9999-12-31');
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        const leftStatus = String(left.evidenceStatus ?? '');
        const rightStatus = String(right.evidenceStatus ?? '');
        if (leftStatus !== rightStatus) return leftStatus === 'CONFIRMED' ? -1 : 1;
        const leftEntity = left.entity as Record<string, unknown>;
        const rightEntity = right.entity as Record<string, unknown>;
        return String(leftEntity.name ?? '').localeCompare(String(rightEntity.name ?? ''));
      })
      .slice(0, limit);

    return json(200, {
      generatedAt: new Date().toISOString(),
      guest: user === null,
      window,
      territory,
      today,
      windowEnd: window === 'this_week' ? weekEnd : (window === 'next_30_days' ? monthEnd : null),
      filters: { providerCode, language, contentType, evidenceStatus },
      providers: providers.map((provider) => ({
        code: provider.code,
        name: provider.display_name,
        homepageUrl: provider.homepage_url,
      })),
      count: items.length,
      confirmedCount: items.filter((item) => item.evidenceStatus === 'CONFIRMED').length,
      reportedCount: items.filter((item) => item.evidenceStatus === 'REPORTED').length,
      items,
    });
  } catch (error) {
    console.error('cinerelay-ott-calendar-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
