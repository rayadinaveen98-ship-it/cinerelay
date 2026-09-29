import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay archive API environment');

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

async function archive(page: number, pageSize: number) {
  const now = Date.now();
  const freshCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const archiveCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data: raws, error, count } = await admin.from('raw_items')
    .select(
      'id,source_identity_id,canonical_url,published_at,first_seen_at,item_type,raw_title,raw_text,language_code,media_type,metadata,created_at,deleted_or_unavailable_at',
      { count: 'exact' },
    )
    .is('deleted_or_unavailable_at', null)
    .gte('created_at', archiveCutoff)
    .lt('created_at', freshCutoff)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;

  const rows = raws ?? [];
  const identityIds = [...new Set(rows.map((row) => row.source_identity_id).filter(Boolean))];
  const identityResult = identityIds.length
    ? await admin.from('source_identities')
      .select('id,source_id,platform,handle,connector_config')
      .in('id', identityIds)
    : { data: [], error: null };
  if (identityResult.error) throw identityResult.error;

  const identities = identityResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources')
      .select('id,display_name,source_role,authority_tier')
      .in('id', sourceIds)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));

  const items = rows.map((raw) => {
    const identity = identityMap.get(raw.source_identity_id);
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    return {
      id: raw.id,
      title: raw.raw_title ?? 'CineRelay update',
      text: raw.raw_text ?? null,
      languageCode: raw.language_code ?? null,
      itemType: raw.item_type ?? null,
      mediaType: raw.media_type ?? null,
      thumbnailUrl: thumbnailUrlOf(raw.metadata),
      canonicalUrl: raw.canonical_url ?? null,
      observedAt: raw.published_at ?? raw.first_seen_at ?? raw.created_at,
      source: {
        identityId: identity?.id ?? raw.source_identity_id,
        name: source?.display_name ?? identity?.handle ?? 'CineRelay source',
        handle: identity?.handle ?? null,
        platform: identity?.platform ?? null,
        role: source?.source_role ?? null,
        authorityTier: source?.authority_tier ?? null,
        artworkUrl: artworkUrlOf(identity?.connector_config),
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    retentionDays: 90,
    activeWindowHours: 24,
    page,
    pageSize,
    total: count ?? items.length,
    hasMore: from + items.length < (count ?? items.length),
    items,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== 'archive') return json(400, { error: 'unsupported_action' });

    const page = Math.max(0, Math.min(1000, Number(body.page ?? 0) || 0));
    const pageSize = Math.max(10, Math.min(100, Number(body.pageSize ?? 60) || 60));
    return json(200, await archive(page, pageSize));
  } catch (error) {
    console.error('cinerelay-archive-api failed', error);
    return json(500, { error: 'archive_unavailable' });
  }
});
