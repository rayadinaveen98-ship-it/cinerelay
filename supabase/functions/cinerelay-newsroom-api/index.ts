import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/domain/dist/newsroom-filter.d.ts"
import {
  newsroomClipFamilyKey,
  newsroomNoiseReason,
  normalizedNewsroomTitleKey,
  type NewsroomFilterReason,
} from '../../../packages/domain/dist/newsroom-filter.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay newsroom API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

const ACTIVE_EVENT_STATUSES = ['ACTIVE', 'NEEDS_REVIEW'];
type NewsroomPlatform = 'YOUTUBE' | 'X';

type AuthenticatedUser = { id: string; email: string | null };
type EventRow = {
  id: string;
  primary_entity_id: string;
  event_type: string;
  verification_state: string;
  priority_band: string;
  headline: string;
  summary: string | null;
  status: string;
  detected_at: string | null;
};

type FilterReason = NewsroomFilterReason | 'duplicate_title';

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

async function optionalUser(request: Request): Promise<AuthenticatedUser | null | Response> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id, email: data.user.email ?? null };
}

function limitOf(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : 50;
}

function platformOf(value: unknown): NewsroomPlatform | null {
  if (value === undefined || value === null || value === '') return 'YOUTUBE';
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'YOUTUBE' || normalized === 'X') return normalized;
  return null;
}

function optionalIdentityId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function newsroomState(verificationState: string | null, authorityTier: number | null, conflictCount: number): string {
  if (conflictCount > 0) return 'CONFLICT_RUMOR';
  switch (verificationState) {
    case 'OFFICIAL':
    case 'CONFIRMED':
      return 'VERIFIED';
    case 'RELIABLE_REPORT':
    case 'DEVELOPING':
      return 'DEVELOPING';
    case 'RUMOR':
      return 'CONFLICT_RUMOR';
  }
  if (authorityTier !== null && authorityTier <= 1) return 'VERIFIED';
  if (authorityTier !== null && authorityTier <= 3) return 'DEVELOPING';
  if (authorityTier !== null && authorityTier === 4) return 'UNCONFIRMED';
  return 'CONFLICT_RUMOR';
}

function evidenceRank(role: unknown): number {
  return role === 'PRIMARY' ? 0 : role === 'CORROBORATING' ? 1 : role === 'REPEAT' ? 2 : role === 'CONFLICTING' ? 3 : 4;
}

async function newsroom(
  userId: string | null,
  limit: number,
  platform: NewsroomPlatform,
  sourceIdentityId: string | null,
) {
  let identityQuery = admin.from('source_identities')
    .select('id,source_id,platform,handle,canonical_url,connector_type,poll_class,active')
    .eq('active', true)
    .eq('platform', platform);
  if (sourceIdentityId) identityQuery = identityQuery.eq('id', sourceIdentityId);

  const identityResult = await identityQuery;
  if (identityResult.error) throw identityResult.error;

  const identities = identityResult.data ?? [];
  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const identityIds = identities.map((row) => row.id);
  if (identityIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      guest: userId === null,
      platform,
      sourceIdentityId,
      scanCount: 0,
      filteredOut: 0,
      filterCounts: { empty_content: 0, archive_or_library_clip: 0, celebrity_lifestyle: 0, duplicate_title: 0 },
      items: [],
    };
  }

  const scanLimit = sourceIdentityId
    ? Math.min(500, Math.max(100, limit * 5))
    : Math.min(300, Math.max(80, limit * 5));
  const { data: rawRows, error: rawError } = await admin.from('raw_items')
    .select('id,source_identity_id,canonical_url,published_at,first_seen_at,item_type,raw_title,raw_text,language_code,media_type,created_at')
    .in('source_identity_id', identityIds)
    .is('deleted_or_unavailable_at', null)
    .order('first_seen_at', { ascending: false })
    .limit(scanLimit);
  if (rawError) throw rawError;

  const raws = rawRows ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources')
      .select('id,display_name,authority_tier,source_role,territory,languages,active')
      .in('id', sourceIds)
      .eq('active', true)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const sources = sourceResult.data ?? [];
  const sourceMap = new Map(sources.map((row) => [row.id, row]));

  const selected: typeof raws = [];
  const seenTitleKeys = new Set<string>();
  const seenClipFamilyKeys = new Set<string>();
  const filterCounts: Record<FilterReason, number> = {
    empty_content: 0,
    archive_or_library_clip: 0,
    celebrity_lifestyle: 0,
    duplicate_title: 0,
  };

  for (const raw of raws) {
    const identity = identityMap.get(raw.source_identity_id);
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    if (!identity || !source) continue;

    const reason = newsroomNoiseReason(raw, { sourceRole: source.source_role ?? null });
    if (reason) {
      filterCounts[reason] += 1;
      continue;
    }

    const normalizedTitle = normalizedNewsroomTitleKey(raw.raw_title);
    if (normalizedTitle) {
      const duplicateKey = `${raw.source_identity_id}:${normalizedTitle}`;
      if (seenTitleKeys.has(duplicateKey)) {
        filterCounts.duplicate_title += 1;
        continue;
      }
      seenTitleKeys.add(duplicateKey);
    }

    const clipFamily = newsroomClipFamilyKey(raw.raw_title);
    if (clipFamily) {
      const clipFamilyKey = `${raw.source_identity_id}:${clipFamily}`;
      if (seenClipFamilyKeys.has(clipFamilyKey)) {
        filterCounts.duplicate_title += 1;
        continue;
      }
      seenClipFamilyKeys.add(clipFamilyKey);
    }

    selected.push(raw);
    if (selected.length >= limit) break;
  }

  const rawIds = selected.map((row) => row.id);
  const evidenceResult = rawIds.length
    ? await admin.from('event_evidence')
      .select('event_id,raw_item_id,evidence_role,weight')
      .in('raw_item_id', rawIds)
    : { data: [], error: null };
  if (evidenceResult.error) throw evidenceResult.error;

  const rawEvidence = evidenceResult.data ?? [];
  const candidateEventIds = [...new Set(rawEvidence.map((row) => row.event_id).filter(Boolean))];
  const eventResult = candidateEventIds.length
    ? await admin.from('events')
      .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,status,detected_at')
      .in('id', candidateEventIds)
      .in('status', ACTIVE_EVENT_STATUSES)
    : { data: [], error: null };
  if (eventResult.error) throw eventResult.error;

  const events = (eventResult.data ?? []) as EventRow[];
  const eventMap = new Map(events.map((row) => [row.id, row]));
  const eventIds = events.map((row) => row.id);
  const allEventEvidenceResult = eventIds.length
    ? await admin.from('event_evidence')
      .select('event_id,raw_item_id,evidence_role,weight')
      .in('event_id', eventIds)
    : { data: [], error: null };
  if (allEventEvidenceResult.error) throw allEventEvidenceResult.error;

  const allEventEvidence = allEventEvidenceResult.data ?? [];
  const evidenceByEvent = new Map<string, typeof allEventEvidence>();
  for (const evidence of allEventEvidence) {
    const list = evidenceByEvent.get(evidence.event_id) ?? [];
    list.push(evidence);
    evidenceByEvent.set(evidence.event_id, list);
  }

  const eventByRaw = new Map<string, EventRow>();
  const evidenceByRaw = new Map<string, { event_id: string; raw_item_id: string; evidence_role: string; weight: number }[]>();
  for (const evidence of rawEvidence) {
    if (!eventMap.has(evidence.event_id)) continue;
    const list = evidenceByRaw.get(evidence.raw_item_id) ?? [];
    list.push(evidence as { event_id: string; raw_item_id: string; evidence_role: string; weight: number });
    evidenceByRaw.set(evidence.raw_item_id, list);
  }
  for (const [rawId, list] of evidenceByRaw) {
    const strongest = [...list].sort((left, right) => {
      const roleDelta = evidenceRank(left.evidence_role) - evidenceRank(right.evidence_role);
      return roleDelta !== 0 ? roleDelta : Number(right.weight ?? 0) - Number(left.weight ?? 0);
    })[0];
    const event = strongest ? eventMap.get(strongest.event_id) : undefined;
    if (event) eventByRaw.set(rawId, event);
  }

  const entityIds = [...new Set(events.map((row) => row.primary_entity_id).filter(Boolean))];
  const entityResult = entityIds.length
    ? await admin.from('entities').select('id,canonical_name,entity_type,primary_language').in('id', entityIds)
    : { data: [], error: null };
  if (entityResult.error) throw entityResult.error;
  const entityMap = new Map((entityResult.data ?? []).map((row) => [row.id, row]));

  let followedIds: string[] = [];
  if (userId && entityIds.length) {
    const followResult = await admin.from('user_entity_follows')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('active', true)
      .in('entity_id', entityIds);
    if (followResult.error) throw followResult.error;
    followedIds = (followResult.data ?? []).map((row) => row.entity_id);
  }
  const followed = new Set(followedIds);

  const items = selected.map((raw) => {
    const identity = identityMap.get(raw.source_identity_id)!;
    const source = sourceMap.get(identity.source_id)!;
    const event = eventByRaw.get(raw.id) ?? null;
    const eventEvidence = event ? evidenceByEvent.get(event.id) ?? [] : [];
    const conflictingEvidenceCount = eventEvidence.filter((row) => row.evidence_role === 'CONFLICTING').length;
    const entity = event ? entityMap.get(event.primary_entity_id) : undefined;
    const observedAt = raw.published_at ?? raw.first_seen_at ?? raw.created_at;
    const ingestedAt = raw.first_seen_at ?? raw.created_at;
    const canonicalEvent = event ? {
      id: event.id,
      entityId: event.primary_entity_id,
      entityName: entity?.canonical_name ?? null,
      entityType: entity?.entity_type ?? null,
      primaryLanguage: entity?.primary_language ?? null,
      followed: followed.has(event.primary_entity_id),
      eventType: event.event_type,
      verificationState: event.verification_state,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: event.summary,
      summaryStatus: null,
      evidenceCount: eventEvidence.length,
      conflictingEvidenceCount,
      status: event.status,
      detectedAt: event.detected_at,
      evidence: {
        sourceName: source.display_name ?? null,
        authorityTier: source.authority_tier ?? null,
        sourceRole: source.source_role ?? null,
        platform: identity.platform ?? null,
        handle: identity.handle ?? null,
        title: raw.raw_title ?? null,
        canonicalUrl: raw.canonical_url ?? null,
        publishedAt: raw.published_at ?? null,
      },
      radar: null,
    } : null;

    return {
      id: raw.id,
      state: newsroomState(event?.verification_state ?? null, source.authority_tier ?? null, conflictingEvidenceCount),
      source: {
        name: source.display_name ?? null,
        authorityTier: source.authority_tier ?? null,
        role: source.source_role ?? null,
        platform: identity.platform ?? null,
        handle: identity.handle ?? null,
      },
      itemType: raw.item_type ?? null,
      mediaType: raw.media_type ?? null,
      languageCode: raw.language_code ?? null,
      title: raw.raw_title ?? 'Untitled source update',
      text: raw.raw_text ?? null,
      canonicalUrl: raw.canonical_url ?? null,
      sourceObservedAt: raw.published_at ?? null,
      observedAt,
      ingestedAt,
      enrichmentState: canonicalEvent ? 'CANONICALIZED' : 'RAW',
      canonicalEvent,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    guest: userId === null,
    platform,
    sourceIdentityId,
    scanCount: raws.length,
    filteredOut: Object.values(filterCounts).reduce((sum, count) => sum + count, 0),
    filterCounts,
    items,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as {
      action?: unknown;
      limit?: unknown;
      platform?: unknown;
      sourceIdentityId?: unknown;
    };
    if (body.action !== undefined && body.action !== 'newsroom') return json(400, { error: 'unsupported_action' });
    const platform = platformOf(body.platform);
    if (!platform) return json(400, { error: 'unsupported_platform' });
    const sourceIdentityId = optionalIdentityId(body.sourceIdentityId);

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;
    return json(200, await newsroom(maybeUser?.id ?? null, limitOf(body.limit), platform, sourceIdentityId));
  } catch (error) {
    console.error('cinerelay-newsroom-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
