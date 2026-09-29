import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay sources API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

type SourcePlatform = 'YOUTUBE' | 'WEB' | 'X';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function platformOf(value: unknown): SourcePlatform | null {
  if (value === undefined || value === null || value === '') return 'YOUTUBE';
  const normalized = String(value).trim().toUpperCase();
  return normalized === 'YOUTUBE' || normalized === 'WEB' || normalized === 'X' ? normalized : null;
}

function storagePlatforms(platform: SourcePlatform): string[] {
  return platform === 'WEB' ? ['WEB', 'RSS'] : [platform];
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function sourceDirectory(platform: SourcePlatform) {
  const identityResult = await admin.from('source_identities')
    .select('id,source_id,platform,handle,canonical_url,connector_config,active')
    .eq('active', true)
    .in('platform', storagePlatforms(platform));
  if (identityResult.error) throw identityResult.error;

  const identities = identityResult.data ?? [];
  if (identities.length === 0) {
    return { generatedAt: new Date().toISOString(), platform, items: [] };
  }

  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources')
      .select('id,display_name,authority_tier,source_role,territory,languages,active')
      .in('id', sourceIds)
      .eq('active', true)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const identityIds = identities.map((row) => row.id);

  // Keep this bounded while still comfortably covering the current source mesh.
  // Activity is judged by the provider-published timestamp when present, falling back to
  // CineRelay's first-seen time only when the provider timestamp is unavailable.
  const rawResult = await admin.from('raw_items')
    .select('source_identity_id,published_at,first_seen_at,created_at')
    .in('source_identity_id', identityIds)
    .is('deleted_or_unavailable_at', null)
    .order('first_seen_at', { ascending: false })
    .limit(5000);
  if (rawResult.error) throw rawResult.error;

  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const activity = new Map<string, { newCount24h: number; latestObservedAt: string | null }>();

  for (const raw of rawResult.data ?? []) {
    const identityId = raw.source_identity_id as string | null;
    if (!identityId) continue;
    const observedAt = (raw.published_at ?? raw.first_seen_at ?? raw.created_at) as string | null;
    if (!observedAt) continue;
    const timestamp = Date.parse(observedAt);
    if (!Number.isFinite(timestamp)) continue;

    const current = activity.get(identityId) ?? { newCount24h: 0, latestObservedAt: null };
    if (!current.latestObservedAt || timestamp > Date.parse(current.latestObservedAt)) {
      current.latestObservedAt = observedAt;
    }
    if (timestamp >= cutoffMs) current.newCount24h += 1;
    activity.set(identityId, current);
  }

  const items = identities
    .map((identity) => {
      const source = sourceMap.get(identity.source_id);
      if (!source) return null;
      const sourceActivity = activity.get(identity.id) ?? { newCount24h: 0, latestObservedAt: null };
      const connectorConfig = recordValue(identity.connector_config);
      return {
        identityId: identity.id,
        sourceId: identity.source_id,
        name: source.display_name ?? identity.handle ?? 'CineRelay source',
        handle: identity.handle ?? null,
        platform: identity.platform,
        lane: platform,
        role: source.source_role ?? null,
        authorityTier: source.authority_tier ?? null,
        canonicalUrl: identity.canonical_url ?? null,
        artworkUrl: stringValue(connectorConfig.artworkUrl),
        newCount24h: sourceActivity.newCount24h,
        latestObservedAt: sourceActivity.latestObservedAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const activityDelta = Number(right!.newCount24h) - Number(left!.newCount24h);
      if (activityDelta !== 0) return activityDelta;
      const authorityDelta = Number(left!.authorityTier ?? 99) - Number(right!.authorityTier ?? 99);
      if (authorityDelta !== 0) return authorityDelta;
      return String(left!.name).localeCompare(String(right!.name));
    });

  return {
    generatedAt: new Date().toISOString(),
    platform,
    sourceCount: items.length,
    activeInLast24h: items.filter((item) => Number(item!.newCount24h) > 0).length,
    newItems24h: items.reduce((sum, item) => sum + Number(item!.newCount24h), 0),
    items,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as { action?: unknown; platform?: unknown };
    if (body.action !== undefined && body.action !== 'sources') return json(400, { error: 'unsupported_action' });
    const platform = platformOf(body.platform);
    if (!platform) return json(400, { error: 'unsupported_platform' });

    return json(200, await sourceDirectory(platform));
  } catch (error) {
    console.error('cinerelay-sources-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
