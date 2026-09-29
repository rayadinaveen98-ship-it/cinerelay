import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay consumer API environment');

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
const PERSONALIZATION_VERSION = 1;
const STORY_WINDOW_DAYS = 90;

type User = { id: string; email: string | null };
type Action = 'personalization' | 'savePersonalization' | 'rawItem' | 'event';

type Body = {
  action?: unknown;
  sourceIdentityIds?: unknown;
  languageCodes?: unknown;
  complete?: unknown;
  rawItemId?: unknown;
  eventId?: unknown;
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

function requireUser(user: User | null): User | Response {
  return user ?? json(401, { error: 'authentication_required' });
}

function actionOf(value: unknown): Action | null {
  return value === 'personalization' || value === 'savePersonalization' || value === 'rawItem' || value === 'event'
    ? value
    : null;
}

function stringArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
  return normalized.length <= max ? normalized : null;
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

function storyLifecycle(input: {
  eventType: string | null;
  verificationState: string | null;
  status: string | null;
  sourceCount: number;
  timelineCount: number;
}): string {
  if (input.status === 'RETRACTED' || input.status === 'SUPPRESSED') return 'RETRACTED';
  if (input.eventType?.endsWith('_RELEASED') || input.eventType === 'THEATRICAL_RELEASED' || input.eventType === 'OTT_RELEASED') return 'RELEASED';
  if ((input.verificationState === 'OFFICIAL' || input.verificationState === 'CONFIRMED') && input.sourceCount >= 2) return 'CONFIRMED';
  if (input.timelineCount > 1) return 'UPDATED';
  if (input.verificationState === 'RELIABLE_REPORT' || input.verificationState === 'DEVELOPING' || input.verificationState === 'RUMOR') return 'DEVELOPING';
  return 'NEW';
}

async function personalization(user: User) {
  const [preferenceResult, favoriteSourceResult, languageResult, sourceDirectoryResult] = await Promise.all([
    admin.from('user_personalization_preferences')
      .select('onboarding_version,completed_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('user_favorite_source_identities')
      .select('source_identity_id')
      .eq('user_id', user.id)
      .eq('active', true),
    admin.from('user_favorite_languages')
      .select('language_code')
      .eq('user_id', user.id)
      .eq('active', true),
    admin.from('source_identities')
      .select('id,source_id,platform,handle,canonical_url,connector_config,active')
      .eq('platform', 'YOUTUBE')
      .eq('active', true),
  ]);

  for (const result of [preferenceResult, favoriteSourceResult, languageResult, sourceDirectoryResult]) {
    if (result.error) throw result.error;
  }

  const identities = sourceDirectoryResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources')
      .select('id,display_name,authority_tier,source_role,active')
      .in('id', sourceIds)
      .eq('active', true)
      .lte('authority_tier', 2)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const availableSources = identities.flatMap((identity) => {
    const source = sourceMap.get(identity.source_id);
    if (!source) return [];
    return [{
      identityId: identity.id,
      sourceId: identity.source_id,
      name: source.display_name,
      handle: identity.handle ?? null,
      role: source.source_role ?? null,
      artworkUrl: artworkUrlOf(identity.connector_config),
    }];
  }).sort((left, right) => String(left.name).localeCompare(String(right.name)));

  const preference = preferenceResult.data;
  return {
    generatedAt: new Date().toISOString(),
    onboardingVersion: preference?.onboarding_version ?? 0,
    requiredVersion: PERSONALIZATION_VERSION,
    completed: Boolean(preference?.completed_at) && (preference?.onboarding_version ?? 0) >= PERSONALIZATION_VERSION,
    favoriteSourceIdentityIds: (favoriteSourceResult.data ?? []).map((row) => row.source_identity_id),
    favoriteLanguages: (languageResult.data ?? []).map((row) => row.language_code),
    availableLanguages: [
      { code: 'te', label: 'Telugu' },
      { code: 'hi', label: 'Hindi' },
      { code: 'ta', label: 'Tamil' },
      { code: 'ml', label: 'Malayalam' },
      { code: 'kn', label: 'Kannada' },
      { code: 'en', label: 'English / International' },
    ],
    availableSources,
  };
}

async function savePersonalization(user: User, body: Body) {
  const sourceIdentityIds = stringArray(body.sourceIdentityIds, 50);
  const languageCodes = stringArray(body.languageCodes, 12)?.map((value) => value.toLowerCase());
  if (!sourceIdentityIds || !languageCodes) return { ok: false, error: 'invalid_selection' };
  if (!sourceIdentityIds.every((id) => UUID_PATTERN.test(id))) return { ok: false, error: 'invalid_source_identity' };

  const { data, error } = await admin.rpc('replace_user_personalization_selection', {
    p_user_id: user.id,
    p_source_identity_ids: sourceIdentityIds,
    p_language_codes: languageCodes,
    p_complete: body.complete !== false,
    p_onboarding_version: PERSONALIZATION_VERSION,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function rawItem(rawItemId: string) {
  if (!UUID_PATTERN.test(rawItemId)) return { ok: false, error: 'invalid_raw_item_id' };

  const { data: raw, error } = await admin.from('raw_items')
    .select('id,source_identity_id,canonical_url,published_at,first_seen_at,item_type,raw_title,raw_text,language_code,media_type,metadata,created_at,deleted_or_unavailable_at')
    .eq('id', rawItemId)
    .maybeSingle();
  if (error) throw error;
  if (!raw || raw.deleted_or_unavailable_at) return { ok: false, error: 'update_not_available' };

  const { data: identity, error: identityError } = await admin.from('source_identities')
    .select('id,source_id,platform,handle,canonical_url,connector_config')
    .eq('id', raw.source_identity_id)
    .maybeSingle();
  if (identityError) throw identityError;

  const sourceResult = identity?.source_id
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').eq('id', identity.source_id).maybeSingle()
    : { data: null, error: null };
  if (sourceResult.error) throw sourceResult.error;

  const { data: evidenceRows, error: evidenceError } = await admin.from('event_evidence')
    .select('event_id,evidence_role,weight')
    .eq('raw_item_id', raw.id)
    .order('weight', { ascending: false })
    .limit(5);
  if (evidenceError) throw evidenceError;

  return {
    ok: true,
    kind: 'SOURCE_UPDATE',
    item: {
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
        name: sourceResult.data?.display_name ?? identity?.handle ?? 'CineRelay source',
        handle: identity?.handle ?? null,
        platform: identity?.platform ?? null,
        role: sourceResult.data?.source_role ?? null,
        artworkUrl: artworkUrlOf(identity?.connector_config),
      },
      eventId: evidenceRows?.[0]?.event_id ?? null,
    },
  };
}

async function event(eventId: string, userId: string | null) {
  if (!UUID_PATTERN.test(eventId)) return { ok: false, error: 'invalid_event_id' };

  const { data: eventRow, error } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,status,detected_at,announced_at,occurred_at')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!eventRow) return { ok: false, error: 'event_not_available' };

  const storySince = new Date(Date.now() - STORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [entityResult, evidenceResult, timelineResult] = await Promise.all([
    admin.from('entities').select('id,canonical_name,entity_type,primary_language,country_code,slug,status').eq('id', eventRow.primary_entity_id).maybeSingle(),
    admin.from('event_evidence').select('raw_item_id,evidence_role,weight').eq('event_id', eventRow.id),
    admin.from('events')
      .select('id,event_type,verification_state,priority_band,headline,summary,status,detected_at,announced_at,occurred_at')
      .eq('primary_entity_id', eventRow.primary_entity_id)
      .in('status', ['ACTIVE', 'SUPERSEDED'])
      .gte('detected_at', storySince)
      .order('detected_at', { ascending: false })
      .limit(18),
  ]);
  if (entityResult.error) throw entityResult.error;
  if (evidenceResult.error) throw evidenceResult.error;
  if (timelineResult.error) throw timelineResult.error;

  const timelineRows = timelineResult.data ?? [];
  const timelineEventIds = timelineRows.map((row) => row.id).filter(Boolean);
  const storyEvidenceResult = timelineEventIds.length
    ? await admin.from('event_evidence').select('event_id,raw_item_id,evidence_role,weight').in('event_id', timelineEventIds)
    : { data: [], error: null };
  if (storyEvidenceResult.error) throw storyEvidenceResult.error;

  const currentEvidenceRows = evidenceResult.data ?? [];
  const storyEvidenceRows = storyEvidenceResult.data ?? [];
  const rawIds = [...new Set([
    ...currentEvidenceRows.map((row) => row.raw_item_id),
    ...storyEvidenceRows.map((row) => row.raw_item_id),
  ].filter(Boolean))];
  const rawResult = rawIds.length
    ? await admin.from('raw_items').select('id,source_identity_id,canonical_url,raw_title,published_at,metadata').in('id', rawIds)
    : { data: [], error: null };
  if (rawResult.error) throw rawResult.error;

  const raws = rawResult.data ?? [];
  const identityIds = [...new Set(raws.map((row) => row.source_identity_id).filter(Boolean))];
  const identityResult = identityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,handle,connector_config').in('id', identityIds)
    : { data: [], error: null };
  if (identityResult.error) throw identityResult.error;

  const identities = identityResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const rawMap = new Map(raws.map((row) => [row.id, row]));
  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const evidence = currentEvidenceRows.map((row) => {
    const raw = rawMap.get(row.raw_item_id);
    const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    return {
      role: row.evidence_role,
      weight: row.weight,
      title: raw?.raw_title ?? null,
      canonicalUrl: raw?.canonical_url ?? null,
      publishedAt: raw?.published_at ?? null,
      thumbnailUrl: thumbnailUrlOf(raw?.metadata),
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
  }).sort((left, right) => Number(right.weight ?? 0) - Number(left.weight ?? 0));

  const storySourceDescriptors = storyEvidenceRows.map((row) => {
    const raw = rawMap.get(row.raw_item_id);
    const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    return {
      rawItemId: row.raw_item_id,
      sourceKey: identity?.source_id ?? identity?.id ?? source?.display_name ?? null,
      authorityTier: source?.authority_tier ?? null,
      publishedAt: raw?.published_at ?? null,
    };
  });
  const sourceKeys = new Set(storySourceDescriptors.map((item) => item.sourceKey).filter(Boolean));
  const officialSourceKeys = new Set(
    storySourceDescriptors
      .filter((item) => Number(item.authorityTier ?? 99) <= 1)
      .map((item) => item.sourceKey)
      .filter(Boolean),
  );
  const storyRawIds = new Set(storySourceDescriptors.map((item) => item.rawItemId).filter(Boolean));
  const timeline = timelineRows.map((row) => ({
    id: row.id,
    current: row.id === eventRow.id,
    eventType: row.event_type,
    verificationState: row.verification_state,
    priorityBand: row.priority_band,
    headline: row.headline,
    summary: row.summary ?? null,
    status: row.status,
    detectedAt: row.detected_at,
    announcedAt: row.announced_at,
    occurredAt: row.occurred_at,
  }));
  const evidenceTimes = storySourceDescriptors
    .map((item) => item.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const story = {
    lifecycle: storyLifecycle({
      eventType: eventRow.event_type ?? null,
      verificationState: eventRow.verification_state ?? null,
      status: eventRow.status ?? null,
      sourceCount: sourceKeys.size,
      timelineCount: timeline.length,
    }),
    evidenceCount: storyRawIds.size,
    sourceCount: sourceKeys.size,
    officialSourceCount: officialSourceKeys.size,
    firstEvidenceAt: evidenceTimes[0] ?? timeline[timeline.length - 1]?.detectedAt ?? eventRow.detected_at,
    latestEvidenceAt: evidenceTimes[evidenceTimes.length - 1] ?? timeline[0]?.detectedAt ?? eventRow.detected_at,
    timeline,
  };

  let followed = false;
  if (userId && eventRow.primary_entity_id) {
    const { data: follow, error: followError } = await admin.from('user_entity_follows')
      .select('active')
      .eq('user_id', userId)
      .eq('entity_id', eventRow.primary_entity_id)
      .eq('active', true)
      .maybeSingle();
    if (followError) throw followError;
    followed = Boolean(follow?.active);
  }

  return {
    ok: true,
    kind: 'EVENT',
    event: {
      id: eventRow.id,
      entityId: eventRow.primary_entity_id,
      entityName: entityResult.data?.canonical_name ?? null,
      entityType: entityResult.data?.entity_type ?? null,
      primaryLanguage: entityResult.data?.primary_language ?? null,
      followed,
      eventType: eventRow.event_type,
      verificationState: eventRow.verification_state,
      priorityBand: eventRow.priority_band,
      headline: eventRow.headline,
      summary: eventRow.summary,
      status: eventRow.status,
      detectedAt: eventRow.detected_at,
      announcedAt: eventRow.announced_at,
      occurredAt: eventRow.occurred_at,
      story,
      evidence,
    },
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as Body;
    const action = actionOf(body.action);
    if (!action) return json(400, { error: 'unsupported_action' });

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;

    if (action === 'rawItem') {
      const rawItemId = typeof body.rawItemId === 'string' ? body.rawItemId.trim() : '';
      const result = await rawItem(rawItemId);
      return result.ok ? json(200, result) : json(404, result);
    }
    if (action === 'event') {
      const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
      const result = await event(eventId, maybeUser?.id ?? null);
      return result.ok ? json(200, result) : json(404, result);
    }

    const user = requireUser(maybeUser);
    if (user instanceof Response) return user;

    if (action === 'personalization') return json(200, await personalization(user));
    const result = await savePersonalization(user, body);
    return result.ok === false ? json(400, result) : json(200, result);
  } catch (error) {
    console.error('cinerelay-consumer-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
