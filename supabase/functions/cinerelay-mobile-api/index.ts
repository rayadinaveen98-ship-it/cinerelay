import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay mobile API environment');

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
const ACTIVE_EVENT_STATUSES = ['ACTIVE', 'NEEDS_REVIEW'];

type MobileAction = 'bootstrap' | 'live' | 'following' | 'radar' | 'alerts' | 'setFollow';
type MobileRequest = {
  action?: unknown;
  limit?: unknown;
  entityId?: unknown;
  active?: unknown;
};
type AuthenticatedUser = { id: string; email: string | null };
type EventRow = {
  id: string;
  primary_entity_id: string;
  event_type: string;
  verification_state: string;
  priority_band: string;
  headline: string;
  summary: string | null;
  structured_data: Record<string, unknown> | null;
  status: string;
  detected_at: string | null;
  announced_at: string | null;
  occurred_at: string | null;
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

async function optionalUser(request: Request): Promise<AuthenticatedUser | null | Response> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id, email: data.user.email ?? null };
}

function requireAuthenticated(user: AuthenticatedUser | null): AuthenticatedUser | Response {
  return user ?? json(401, { error: 'authentication_required' });
}

function actionOf(value: unknown): MobileAction | null {
  return value === 'bootstrap' || value === 'live' || value === 'following' || value === 'radar' || value === 'alerts' || value === 'setFollow'
    ? value
    : null;
}

function limitOf(value: unknown, fallback = 30): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : fallback;
}

async function eventCards(events: EventRow[], userId: string | null): Promise<Record<string, unknown>[]> {
  if (!events.length) return [];

  const eventIds = events.map((row) => row.id);
  const entityIds = [...new Set(events.map((row) => row.primary_entity_id).filter(Boolean))];

  const [entityResult, evidenceResult, radarResult, summaryResult] = await Promise.all([
    admin.from('entities').select('id,canonical_name,entity_type,primary_language,country_code').in('id', entityIds),
    admin.from('event_evidence').select('event_id,raw_item_id,evidence_role,weight').in('event_id', eventIds),
    admin.from('creator_radar_entries').select('event_id,creator_score,opportunity_label,reason_codes,generated_at').in('event_id', eventIds),
    admin.from('event_summary_entries').select('event_id,summary_status,summary_text,evidence_count,conflicting_evidence_count,reason_codes,generated_at').in('event_id', eventIds),
  ]);

  for (const result of [entityResult, evidenceResult, radarResult, summaryResult]) {
    if (result.error) throw result.error;
  }

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

  const evidence = evidenceResult.data ?? [];
  const rawIds = [...new Set(evidence.map((row) => row.raw_item_id).filter(Boolean))];
  const rawResult = rawIds.length
    ? await admin.from('raw_items').select('id,source_identity_id,canonical_url,raw_title,published_at').in('id', rawIds)
    : { data: [], error: null };
  if (rawResult.error) throw rawResult.error;

  const raws = rawResult.data ?? [];
  const identityIds = [...new Set(raws.map((row) => row.source_identity_id).filter(Boolean))];
  const identityResult = identityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,handle').in('id', identityIds)
    : { data: [], error: null };
  if (identityResult.error) throw identityResult.error;

  const identities = identityResult.data ?? [];
  const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
  const sourceResult = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const entityMap = new Map((entityResult.data ?? []).map((row) => [row.id, row]));
  const radarMap = new Map((radarResult.data ?? []).map((row) => [row.event_id, row]));
  const summaryMap = new Map((summaryResult.data ?? []).map((row) => [row.event_id, row]));
  const followed = new Set(followedIds);
  const rawMap = new Map(raws.map((row) => [row.id, row]));
  const identityMap = new Map(identities.map((row) => [row.id, row]));
  const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const evidenceByEvent = new Map<string, Record<string, unknown>[]>();

  for (const row of evidence) {
    const list = evidenceByEvent.get(row.event_id) ?? [];
    list.push(row);
    evidenceByEvent.set(row.event_id, list);
  }

  return events.map((event) => {
    const entity = entityMap.get(event.primary_entity_id);
    const eventEvidence = evidenceByEvent.get(event.id) ?? [];
    const strongest = [...eventEvidence].sort((left, right) => {
      const rank = (role: unknown) => role === 'PRIMARY' ? 0 : role === 'CORROBORATING' ? 1 : role === 'REPEAT' ? 2 : 3;
      const roleDelta = rank(left.evidence_role) - rank(right.evidence_role);
      return roleDelta !== 0 ? roleDelta : Number(right.weight ?? 0) - Number(left.weight ?? 0);
    })[0];
    const raw = strongest ? rawMap.get(String(strongest.raw_item_id)) : undefined;
    const identity = raw ? identityMap.get(String(raw.source_identity_id)) : undefined;
    const source = identity ? sourceMap.get(String(identity.source_id)) : undefined;
    const radarEntry = radarMap.get(event.id);
    const summaryEntry = summaryMap.get(event.id);

    return {
      id: event.id,
      entityId: event.primary_entity_id,
      entityName: entity?.canonical_name ?? null,
      entityType: entity?.entity_type ?? null,
      primaryLanguage: entity?.primary_language ?? null,
      countryCode: entity?.country_code ?? null,
      followed: followed.has(event.primary_entity_id),
      eventType: event.event_type,
      verificationState: event.verification_state,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: summaryEntry?.summary_status === 'READY' ? summaryEntry.summary_text : event.summary,
      summaryStatus: summaryEntry?.summary_status ?? null,
      evidenceCount: summaryEntry?.evidence_count ?? eventEvidence.length,
      conflictingEvidenceCount: summaryEntry?.conflicting_evidence_count ?? eventEvidence.filter((row) => row.evidence_role === 'CONFLICTING').length,
      status: event.status,
      detectedAt: event.detected_at,
      announcedAt: event.announced_at,
      occurredAt: event.occurred_at,
      structuredData: event.structured_data ?? {},
      radar: radarEntry ? {
        score: radarEntry.creator_score,
        label: radarEntry.opportunity_label,
        reasons: radarEntry.reason_codes ?? [],
        generatedAt: radarEntry.generated_at,
      } : null,
      evidence: raw ? {
        role: strongest?.evidence_role ?? null,
        sourceName: source?.display_name ?? null,
        authorityTier: source?.authority_tier ?? null,
        sourceRole: source?.source_role ?? null,
        platform: identity?.platform ?? null,
        handle: identity?.handle ?? null,
        title: raw.raw_title ?? null,
        canonicalUrl: raw.canonical_url ?? null,
        publishedAt: raw.published_at ?? null,
      } : null,
    };
  });
}

async function live(userId: string | null, limit: number) {
  const { data, error } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
    .in('status', ACTIVE_EVENT_STATUSES)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { generatedAt: new Date().toISOString(), guest: userId === null, items: await eventCards((data ?? []) as EventRow[], userId) };
}

async function following(userId: string, limit: number) {
  const { data: follows, error: followError } = await admin.from('user_entity_follows')
    .select('entity_id')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(500);
  if (followError) throw followError;
  const entityIds = (follows ?? []).map((row) => row.entity_id);
  if (!entityIds.length) return { generatedAt: new Date().toISOString(), items: [] };

  const { data, error } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
    .in('primary_entity_id', entityIds)
    .in('status', ACTIVE_EVENT_STATUSES)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { generatedAt: new Date().toISOString(), items: await eventCards((data ?? []) as EventRow[], userId) };
}

async function radar(userId: string | null, limit: number) {
  const { data: radarRows, error: radarError } = await admin.from('creator_radar_entries')
    .select('event_id,creator_score')
    .order('creator_score', { ascending: false })
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (radarError) throw radarError;
  const eventIds = (radarRows ?? []).map((row) => row.event_id);
  if (!eventIds.length) return { generatedAt: new Date().toISOString(), guest: userId === null, items: [] };

  const { data, error } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
    .in('id', eventIds)
    .in('status', ACTIVE_EVENT_STATUSES);
  if (error) throw error;

  const cards = await eventCards((data ?? []) as EventRow[], userId);
  const rank = new Map((radarRows ?? []).map((row, index) => [row.event_id, index]));
  cards.sort((left, right) => (rank.get(String(left.id)) ?? 9999) - (rank.get(String(right.id)) ?? 9999));
  return { generatedAt: new Date().toISOString(), guest: userId === null, items: cards };
}

async function alerts(userId: string, limit: number) {
  const { data: deliveries, error } = await admin.from('alert_deliveries')
    .select('id,event_id,delivery_kind,status,scheduled_for,attempt_count,sent_at,failure_code,failure_message,payload,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const eventIds = [...new Set((deliveries ?? []).map((row) => row.event_id).filter(Boolean))];
  let cards: Record<string, unknown>[] = [];
  if (eventIds.length) {
    const { data: events, error: eventError } = await admin.from('events')
      .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
      .in('id', eventIds);
    if (eventError) throw eventError;
    cards = await eventCards((events ?? []) as EventRow[], userId);
  }

  const cardMap = new Map(cards.map((row) => [String(row.id), row]));
  return {
    generatedAt: new Date().toISOString(),
    items: (deliveries ?? []).map((delivery) => ({
      id: delivery.id,
      deliveryKind: delivery.delivery_kind,
      status: delivery.status,
      scheduledFor: delivery.scheduled_for,
      attemptCount: delivery.attempt_count,
      sentAt: delivery.sent_at,
      failureCode: delivery.failure_code,
      failureMessage: delivery.failure_message,
      payload: delivery.payload ?? {},
      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at,
      event: cardMap.get(String(delivery.event_id)) ?? null,
    })),
  };
}

async function setFollow(userId: string, entityId: string, active: boolean) {
  if (!UUID_PATTERN.test(entityId)) return { ok: false, error: 'invalid_entity_id' };
  const { data: entity, error: entityError } = await admin.from('entities').select('id,status').eq('id', entityId).maybeSingle();
  if (entityError) throw entityError;
  if (!entity || entity.status !== 'ACTIVE') return { ok: false, error: 'entity_not_available' };

  const { error } = await admin.from('user_entity_follows').upsert({
    user_id: userId,
    entity_id: entityId,
    active,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,entity_id' });
  if (error) throw error;
  return { ok: true, entityId, active };
}

async function bootstrap(user: AuthenticatedUser) {
  const [followResult, alertResult] = await Promise.all([
    admin.from('user_entity_follows').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('active', true),
    admin.from('alert_deliveries').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  if (followResult.error) throw followResult.error;
  if (alertResult.error) throw alertResult.error;
  return {
    generatedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    counts: { follows: followResult.count ?? 0, alerts: alertResult.count ?? 0 },
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const body = await request.json().catch(() => ({})) as MobileRequest;
    const action = actionOf(body.action);
    if (!action) return json(400, { error: 'unsupported_action' });

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;

    if (action === 'live') return json(200, await live(maybeUser?.id ?? null, limitOf(body.limit)));
    if (action === 'radar') return json(200, await radar(maybeUser?.id ?? null, limitOf(body.limit)));

    const user = requireAuthenticated(maybeUser);
    if (user instanceof Response) return user;

    if (action === 'bootstrap') return json(200, await bootstrap(user));
    if (action === 'following') return json(200, await following(user.id, limitOf(body.limit)));
    if (action === 'alerts') return json(200, await alerts(user.id, limitOf(body.limit)));

    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
    const active = body.active === true;
    const result = await setFollow(user.id, entityId, active);
    return result.ok ? json(200, result) : json(400, result);
  } catch (error) {
    console.error('cinerelay-mobile-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
