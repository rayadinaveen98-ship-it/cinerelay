import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay universal search environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

type User = { id: string; email: string | null };
type EntityRow = {
  id: string;
  entity_type: string;
  canonical_name: string;
  slug: string;
  primary_language: string | null;
  country_code: string | null;
  status: string;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function optionalUser(request: Request): Promise<User | null | Response> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id, email: data.user.email ?? null };
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function thumbnailUrlOf(metadata: unknown): string | null {
  const root = recordValue(metadata);
  const youtube = recordValue(root.youtube);
  const page = recordValue(root.page);
  const article = recordValue(root.article);
  const openGraph = recordValue(root.openGraph);
  return stringValue(youtube.thumbnailUrl) ??
    stringValue(root.thumbnailUrl) ??
    stringValue(root.imageUrl) ??
    stringValue(page.imageUrl) ??
    stringValue(article.imageUrl) ??
    stringValue(openGraph.imageUrl) ??
    stringValue(openGraph.image);
}

function artworkUrlOf(connectorConfig: unknown): string | null {
  return stringValue(recordValue(connectorConfig).artworkUrl);
}

function cleanQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\\%_(),]/g, ' ').replace(/\s+/g, ' ');
  return normalized.length >= 2 && normalized.length <= 80 ? normalized : null;
}

function sectionLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(4, Math.min(25, Math.trunc(parsed))) : 12;
}

function timestampOf(row: { published_at?: string | null; first_seen_at?: string | null; created_at?: string | null }): number {
  const value = row.published_at ?? row.first_seen_at ?? row.created_at ?? '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('en-IN');
}

async function canonicalTitles(query: string, userId: string | null, limit: number) {
  const pattern = `%${query}%`;
  const [nameResult, aliasResult] = await Promise.all([
    admin.from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .eq('status', 'ACTIVE')
      .in('entity_type', ['MOVIE', 'SERIES', 'SEASON'])
      .ilike('canonical_name', pattern)
      .limit(limit * 2),
    admin.from('entity_aliases')
      .select('entity_id,alias')
      .ilike('alias', pattern)
      .limit(limit * 2),
  ]);
  if (nameResult.error) throw nameResult.error;
  if (aliasResult.error) throw aliasResult.error;

  const byId = new Map<string, EntityRow>();
  for (const row of (nameResult.data ?? []) as EntityRow[]) byId.set(row.id, row);

  const aliasEntityIds = [...new Set((aliasResult.data ?? []).map((row) => row.entity_id).filter(Boolean))];
  if (aliasEntityIds.length) {
    const aliasEntitiesResult = await admin.from('entities')
      .select('id,entity_type,canonical_name,slug,primary_language,country_code,status')
      .in('id', aliasEntityIds)
      .eq('status', 'ACTIVE')
      .in('entity_type', ['MOVIE', 'SERIES', 'SEASON']);
    if (aliasEntitiesResult.error) throw aliasEntitiesResult.error;
    for (const row of (aliasEntitiesResult.data ?? []) as EntityRow[]) byId.set(row.id, row);
  }

  const entityIds = [...byId.keys()];
  const aliasesResult = entityIds.length
    ? await admin.from('entity_aliases').select('entity_id,alias').in('entity_id', entityIds)
    : { data: [], error: null };
  if (aliasesResult.error) throw aliasesResult.error;

  const aliasesByEntity = new Map<string, string[]>();
  for (const row of aliasesResult.data ?? []) {
    const list = aliasesByEntity.get(row.entity_id) ?? [];
    if (typeof row.alias === 'string' && row.alias.trim()) list.push(row.alias);
    aliasesByEntity.set(row.entity_id, list);
  }

  let followedIds = new Set<string>();
  if (userId && entityIds.length) {
    const followedResult = await admin.from('user_entity_follows')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('active', true)
      .in('entity_id', entityIds);
    if (followedResult.error) throw followedResult.error;
    followedIds = new Set((followedResult.data ?? []).map((row) => row.entity_id));
  }

  const needle = normalized(query);
  const rank = (row: EntityRow): number => {
    const name = normalized(row.canonical_name);
    const aliases = aliasesByEntity.get(row.id) ?? [];
    if (name === needle) return 0;
    if (aliases.some((value) => normalized(value) === needle)) return 1;
    if (name.startsWith(needle)) return 2;
    if (aliases.some((value) => normalized(value).startsWith(needle))) return 3;
    return 4;
  };

  return [...byId.values()]
    .sort((left, right) => rank(left) - rank(right) || left.canonical_name.localeCompare(right.canonical_name))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      type: row.entity_type,
      name: row.canonical_name,
      slug: row.slug,
      primaryLanguage: row.primary_language,
      countryCode: row.country_code,
      followed: followedIds.has(row.id),
      aliases: aliasesByEntity.get(row.id) ?? [],
    }));
}

async function latestUpdates(query: string, limit: number) {
  const pattern = `%${query}%`;
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const selection = 'id,source_identity_id,canonical_url,published_at,first_seen_at,raw_title,raw_text,language_code,item_type,media_type,metadata,created_at,deleted_or_unavailable_at';
  const [titleResult, textResult] = await Promise.all([
    admin.from('raw_items')
      .select(selection)
      .is('deleted_or_unavailable_at', null)
      .gte('first_seen_at', cutoff)
      .ilike('raw_title', pattern)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit * 2),
    admin.from('raw_items')
      .select(selection)
      .is('deleted_or_unavailable_at', null)
      .gte('first_seen_at', cutoff)
      .ilike('raw_text', pattern)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit * 2),
  ]);
  if (titleResult.error) throw titleResult.error;
  if (textResult.error) throw textResult.error;

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...(titleResult.data ?? []), ...(textResult.data ?? [])]) byId.set(row.id, row);
  const raws = [...byId.values()]
    .sort((left, right) => timestampOf(right as never) - timestampOf(left as never))
    .slice(0, limit);

  const identityIds = [...new Set(raws.map((row) => String(row.source_identity_id ?? '')).filter(Boolean))];
  const identityResult = identityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,handle,connector_config').in('id', identityIds)
    : { data: [], error: null };
  if (identityResult.error) throw identityResult.error;
  const identities = identityResult.data ?? [];

  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources').select('id,display_name,source_role,authority_tier').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));

  return raws.map((raw) => {
    const identity = identityMap.get(String(raw.source_identity_id ?? ''));
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    return {
      id: String(raw.id),
      title: stringValue(raw.raw_title) ?? 'CineRelay update',
      text: stringValue(raw.raw_text),
      languageCode: stringValue(raw.language_code),
      itemType: stringValue(raw.item_type),
      mediaType: stringValue(raw.media_type),
      thumbnailUrl: thumbnailUrlOf(raw.metadata),
      canonicalUrl: stringValue(raw.canonical_url),
      observedAt: stringValue(raw.published_at) ?? stringValue(raw.first_seen_at) ?? stringValue(raw.created_at),
      source: {
        identityId: identity?.id ?? null,
        sourceId: identity?.source_id ?? null,
        name: source?.display_name ?? identity?.handle ?? null,
        handle: identity?.handle ?? null,
        platform: identity?.platform ?? null,
        role: source?.source_role ?? null,
        authorityTier: source?.authority_tier ?? null,
        artworkUrl: artworkUrlOf(identity?.connector_config),
      },
    };
  });
}

async function channels(query: string, limit: number) {
  const [identityResult, sourceResult] = await Promise.all([
    admin.from('source_identities')
      .select('id,source_id,platform,handle,canonical_url,connector_config,active')
      .eq('active', true)
      .eq('platform', 'YOUTUBE')
      .limit(500),
    admin.from('sources')
      .select('id,display_name,source_role,authority_tier,active')
      .eq('active', true)
      .limit(500),
  ]);
  if (identityResult.error) throw identityResult.error;
  if (sourceResult.error) throw sourceResult.error;

  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const needle = normalized(query);
  return (identityResult.data ?? []).flatMap((identity) => {
    const source = sourceMap.get(identity.source_id);
    if (!source) return [];
    const name = String(source.display_name ?? '');
    const handle = String(identity.handle ?? '');
    if (!normalized(name).includes(needle) && !normalized(handle).includes(needle)) return [];
    return [{
      identityId: identity.id,
      sourceId: identity.source_id,
      name,
      handle: identity.handle ?? null,
      platform: identity.platform,
      role: source.source_role ?? null,
      authorityTier: source.authority_tier ?? null,
      canonicalUrl: identity.canonical_url ?? null,
      artworkUrl: artworkUrlOf(identity.connector_config),
    }];
  })
    .sort((left, right) => {
      const leftName = normalized(left.name);
      const rightName = normalized(right.name);
      const leftRank = leftName === needle ? 0 : leftName.startsWith(needle) ? 1 : 2;
      const rightRank = rightName === needle ? 0 : rightName.startsWith(needle) ? 1 : 2;
      return leftRank - rightRank || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

async function streaming(titleIds: string[], limit: number) {
  if (!titleIds.length) return [];
  const releaseResult = await admin.from('ott_releases')
    .select('id,entity_id,provider_id,territory,languages,release_type,release_date,date_precision,state,evidence_status,last_verified_at')
    .in('entity_id', titleIds)
    .order('release_date', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (releaseResult.error) throw releaseResult.error;
  const releases = releaseResult.data ?? [];
  if (!releases.length) return [];

  const [entityResult, providerResult] = await Promise.all([
    admin.from('entities').select('id,canonical_name,entity_type,primary_language').in('id', [...new Set(releases.map((row) => row.entity_id))]),
    admin.from('ott_providers').select('id,code,display_name').in('id', [...new Set(releases.map((row) => row.provider_id))]),
  ]);
  if (entityResult.error) throw entityResult.error;
  if (providerResult.error) throw providerResult.error;
  const entityMap = new Map((entityResult.data ?? []).map((row) => [row.id, row]));
  const providerMap = new Map((providerResult.data ?? []).map((row) => [row.id, row]));

  return releases.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    title: entityMap.get(row.entity_id)?.canonical_name ?? 'Streaming title',
    contentType: entityMap.get(row.entity_id)?.entity_type ?? null,
    primaryLanguage: entityMap.get(row.entity_id)?.primary_language ?? null,
    providerCode: providerMap.get(row.provider_id)?.code ?? null,
    providerName: providerMap.get(row.provider_id)?.display_name ?? null,
    territory: row.territory,
    languages: row.languages ?? [],
    releaseType: row.release_type,
    releaseDate: row.release_date,
    datePrecision: row.date_precision,
    state: row.state,
    evidenceStatus: row.evidence_status,
    lastVerifiedAt: row.last_verified_at,
  }));
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== undefined && body.action !== 'search') return json(400, { error: 'unsupported_action' });
    const query = cleanQuery(body.query);
    if (!query) return json(400, { error: 'search_query_required' });
    const limit = sectionLimit(body.limit);

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;

    const [titles, updates, channelItems] = await Promise.all([
      canonicalTitles(query, maybeUser?.id ?? null, limit),
      latestUpdates(query, limit),
      channels(query, limit),
    ]);
    const streamingItems = await streaming(titles.map((item) => item.id), limit);

    return json(200, {
      generatedAt: new Date().toISOString(),
      query,
      sections: {
        titles,
        updates,
        channels: channelItems,
        streaming: streamingItems,
      },
    });
  } catch (error) {
    console.error('cinerelay-universal-search-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
