import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay console API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type AuthorizedOperator = { ok: true; user: { id: string; email?: string | null }; operator: { display_name: string | null } };
type RejectedOperator = { ok: false; response: Response };
type OperatorAuthResult = AuthorizedOperator | RejectedOperator;

async function requireOperator(request: Request): Promise<OperatorAuthResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };
  const { data: operator, error: operatorError } = await admin.from('operator_users').select('user_id,display_name,active').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (operatorError) throw operatorError;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null }, operator: { display_name: operator.display_name ?? null } };
}

async function exactCount(table: string, filter?: (query: any) => any): Promise<number> {
  let query = admin.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function overview(user: { id: string; email?: string | null }, operator: { display_name?: string | null }) {
  const [rawItems, events, sources, unresolved, healthResult, channelResult] = await Promise.all([
    exactCount('raw_items'), exactCount('events'), exactCount('source_identities', (q) => q.eq('active', true)),
    exactCount('entity_resolution_results', (q) => q.eq('resolution_state', 'UNRESOLVED')),
    admin.from('source_health').select('health_state'), admin.from('youtube_channel_state').select('fallback_gap_count'),
  ]);
  if (healthResult.error) throw healthResult.error;
  if (channelResult.error) throw channelResult.error;
  const healthRows = healthResult.data ?? [];
  return {
    generatedAt: new Date().toISOString(),
    operator: { userId: user.id, email: user.email ?? null, displayName: operator.display_name ?? null },
    counts: { rawItems, events, sources, unresolved },
    health: {
      healthy: healthRows.filter((row) => row.health_state === 'HEALTHY').length,
      degraded: healthRows.filter((row) => row.health_state === 'DEGRADED').length,
      rateLimited: healthRows.filter((row) => row.health_state === 'RATE_LIMITED').length,
      budgetExhausted: healthRows.filter((row) => row.health_state === 'BUDGET_EXHAUSTED').length,
      gapSources: (channelResult.data ?? []).filter((row) => Number(row.fallback_gap_count ?? 0) > 0).length,
    },
  };
}

async function feed(limit: number) {
  const bounded = Math.max(1, Math.min(100, limit));
  const { data: events, error: eventsError } = await admin.from('events')
    .select('id,primary_entity_id,event_type,verification_state,priority_band,headline,summary,structured_data,status,detected_at,announced_at,occurred_at')
    .order('detected_at', { ascending: false }).limit(bounded);
  if (eventsError) throw eventsError;
  if (!events?.length) return { generatedAt: new Date().toISOString(), items: [] };

  const eventIds = events.map((row) => row.id);
  const entityIds = [...new Set(events.map((row) => row.primary_entity_id).filter(Boolean))];
  const [{ data: entities, error: entityError }, { data: evidence, error: evidenceError }] = await Promise.all([
    admin.from('entities').select('id,canonical_name').in('id', entityIds),
    admin.from('event_evidence').select('event_id,raw_item_id,evidence_role,weight').in('event_id', eventIds),
  ]);
  if (entityError) throw entityError;
  if (evidenceError) throw evidenceError;

  const rawIds = [...new Set((evidence ?? []).map((row) => row.raw_item_id).filter(Boolean))];
  const { data: raws, error: rawError } = rawIds.length
    ? await admin.from('raw_items').select('id,source_identity_id,platform_item_id,canonical_url,raw_title,published_at').in('id', rawIds)
    : { data: [], error: null };
  if (rawError) throw rawError;

  const sourceIdentityIds = [...new Set((raws ?? []).map((row) => row.source_identity_id).filter(Boolean))];
  const { data: identities, error: identityError } = sourceIdentityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform').in('id', sourceIdentityIds)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const sourceIds = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources').select('id,display_name').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;

  const entityMap = new Map((entities ?? []).map((row) => [row.id, row.canonical_name]));
  const rawMap = new Map((raws ?? []).map((row) => [row.id, row]));
  const identityMap = new Map((identities ?? []).map((row) => [row.id, row]));
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row.display_name]));
  const evidenceByEvent = new Map<string, Record<string, unknown>[]>();
  for (const row of evidence ?? []) {
    const list = evidenceByEvent.get(row.event_id) ?? [];
    list.push(row);
    evidenceByEvent.set(row.event_id, list);
  }

  const items = events.map((event) => {
    const primaryEvidence = (evidenceByEvent.get(event.id) ?? [])[0];
    const raw = primaryEvidence ? rawMap.get(String(primaryEvidence.raw_item_id)) : undefined;
    const identity = raw ? identityMap.get(String(raw.source_identity_id)) : undefined;
    return {
      id: event.id,
      entityName: entityMap.get(event.primary_entity_id) ?? null,
      eventType: event.event_type,
      verificationState: event.verification_state,
      priorityBand: event.priority_band,
      headline: event.headline,
      summary: event.summary,
      status: event.status,
      detectedAt: event.detected_at,
      announcedAt: event.announced_at,
      occurredAt: event.occurred_at,
      structuredData: event.structured_data ?? {},
      evidence: raw ? {
        role: primaryEvidence?.evidence_role ?? null,
        weight: primaryEvidence?.weight ?? null,
        sourceName: identity ? sourceMap.get(identity.source_id) ?? null : null,
        platform: identity?.platform ?? null,
        rawTitle: raw.raw_title ?? null,
        platformItemId: raw.platform_item_id ?? null,
        canonicalUrl: raw.canonical_url ?? null,
        publishedAt: raw.published_at ?? null,
      } : null,
    };
  });
  return { generatedAt: new Date().toISOString(), items };
}

async function eventDetail(eventId: string) {
  const { data: event, error: eventError } = await admin.from('events')
    .select('id,primary_entity_id,event_type,event_schema_version,occurred_at,announced_at,detected_at,verification_state,verification_confidence,priority_score,priority_band,headline,summary,structured_data,dedupe_key,status,supersedes_event_id,classifier_version,created_at,updated_at')
    .eq('id', eventId).maybeSingle();
  if (eventError) throw eventError;
  if (!event) return null;

  const [{ data: entity, error: entityError }, { data: evidenceRows, error: evidenceError }, { data: timeline, error: timelineError }] = await Promise.all([
    admin.from('entities').select('id,entity_type,canonical_name,slug,primary_language,country_code,status,created_at,updated_at').eq('id', event.primary_entity_id).maybeSingle(),
    admin.from('event_evidence').select('event_id,raw_item_id,claim_id,evidence_role,weight,added_at').eq('event_id', eventId),
    admin.from('events').select('id,event_type,verification_state,priority_band,headline,summary,status,detected_at,announced_at,occurred_at').eq('primary_entity_id', event.primary_entity_id).order('detected_at', { ascending: false }).limit(100),
  ]);
  if (entityError) throw entityError;
  if (evidenceError) throw evidenceError;
  if (timelineError) throw timelineError;

  const rawIds = [...new Set((evidenceRows ?? []).map((row) => row.raw_item_id).filter(Boolean))];
  const claimIds = [...new Set((evidenceRows ?? []).map((row) => row.claim_id).filter(Boolean))];
  const [{ data: raws, error: rawError }, { data: revisions, error: revisionError }, { data: claims, error: claimsError }, { data: claimEvidence, error: claimEvidenceError }] = await Promise.all([
    rawIds.length ? admin.from('raw_items').select('id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,language_code,media_type,metadata,content_fingerprint,deleted_or_unavailable_at,current_revision_id,created_at,updated_at').in('id', rawIds) : Promise.resolve({ data: [], error: null }),
    rawIds.length ? admin.from('raw_item_revisions').select('id,raw_item_id,observed_at,title,text,metadata,content_fingerprint,change_kind').in('raw_item_id', rawIds).order('observed_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    claimIds.length ? admin.from('claims').select('id,subject_entity_id,predicate,value_json,qualifiers_json,claim_time,extraction_confidence,engine_version,created_at').in('id', claimIds) : Promise.resolve({ data: [], error: null }),
    claimIds.length ? admin.from('claim_evidence').select('claim_id,raw_item_id,raw_item_revision_id,evidence_role,text_span_or_pointer').in('claim_id', claimIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (rawError) throw rawError;
  if (revisionError) throw revisionError;
  if (claimsError) throw claimsError;
  if (claimEvidenceError) throw claimEvidenceError;

  const sourceIdentityIds = [...new Set((raws ?? []).map((row) => row.source_identity_id).filter(Boolean))];
  const { data: identities, error: identityError } = sourceIdentityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,active').in('id', sourceIdentityIds)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const sourceIds = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role,territory,languages,active').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;

  const rawMap = new Map((raws ?? []).map((row) => [row.id, row]));
  const identityMap = new Map((identities ?? []).map((row) => [row.id, row]));
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const claimMap = new Map((claims ?? []).map((row) => [row.id, row]));
  const revisionsByRaw = new Map<string, Record<string, unknown>[]>();
  for (const revision of revisions ?? []) {
    const list = revisionsByRaw.get(revision.raw_item_id) ?? [];
    list.push(revision);
    revisionsByRaw.set(revision.raw_item_id, list);
  }
  const claimEvidenceByClaim = new Map<string, Record<string, unknown>[]>();
  for (const row of claimEvidence ?? []) {
    const list = claimEvidenceByClaim.get(row.claim_id) ?? [];
    list.push(row);
    claimEvidenceByClaim.set(row.claim_id, list);
  }

  const evidence = (evidenceRows ?? []).map((row) => {
    const raw = rawMap.get(row.raw_item_id);
    const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    const claim = row.claim_id ? claimMap.get(row.claim_id) : undefined;
    return {
      role: row.evidence_role,
      weight: row.weight,
      addedAt: row.added_at,
      rawItem: raw ? {
        id: raw.id,
        platformItemId: raw.platform_item_id,
        canonicalUrl: raw.canonical_url,
        publishedAt: raw.published_at,
        firstSeenAt: raw.first_seen_at,
        lastSeenAt: raw.last_seen_at,
        itemType: raw.item_type,
        rawTitle: raw.raw_title,
        rawText: raw.raw_text,
        languageCode: raw.language_code,
        mediaType: raw.media_type,
        metadata: raw.metadata ?? {},
        contentFingerprint: raw.content_fingerprint,
        unavailableAt: raw.deleted_or_unavailable_at,
        currentRevisionId: raw.current_revision_id,
        revisions: revisionsByRaw.get(raw.id) ?? [],
      } : null,
      source: identity && source ? {
        name: source.display_name,
        authorityTier: source.authority_tier,
        sourceRole: source.source_role,
        territory: source.territory,
        languages: source.languages ?? [],
        platform: identity.platform,
        platformIdentityId: identity.platform_identity_id,
        handle: identity.handle,
        canonicalUrl: identity.canonical_url,
        connectorType: identity.connector_type,
        pollClass: identity.poll_class,
        accessMode: identity.access_mode,
        active: identity.active && source.active,
      } : null,
      claim: claim ? {
        ...claim,
        evidencePointers: claimEvidenceByClaim.get(claim.id) ?? [],
      } : null,
    };
  });

  return { generatedAt: new Date().toISOString(), event, entity, evidence, timeline: timeline ?? [] };
}

async function operations() {
  const [sourcesResult, identitiesResult, healthResult, channelResult, subscriptionsResult, quotaResult, receiptsResult, jobsResult, schedulerResult] = await Promise.all([
    admin.from('sources').select('id,display_name,authority_tier,source_role,territory,languages,active,created_at,updated_at').order('display_name'),
    admin.from('source_identities').select('id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,active,created_at,updated_at').order('created_at'),
    admin.from('source_health').select('source_identity_id,health_state,last_attempt_at,last_success_at,last_item_at,next_due_at,consecutive_failures,last_http_status,last_error_code,last_error_message,rate_limited_until,subscription_expires_at,parser_version,updated_at'),
    admin.from('youtube_channel_state').select('source_identity_id,channel_id,uploads_playlist_id,latest_known_video_id,last_websub_at,last_enriched_at,last_fallback_check_at,next_fallback_check_at,fallback_gap_count,consecutive_websub_events,updated_at'),
    admin.from('connector_subscriptions').select('id,source_identity_id,provider,generation,signature_required,state,lease_seconds,requested_at,verified_at,expires_at,renew_after,denied_at,last_error,updated_at').order('generation', { ascending: false }),
    admin.from('connector_quota_usage').select('provider,quota_bucket,method,units,request_count,response_status,usage_day,occurred_at').order('occurred_at', { ascending: false }).limit(1000),
    admin.from('connector_receipts').select('provider,source_identity_id,external_key,received_at,processed_at,status,error_message,metadata').in('provider', ['YOUTUBE_WEBSUB', 'YOUTUBE_WEBSUB_INGRESS']).order('received_at', { ascending: false }).limit(50),
    admin.from('jobs').select('job_type,state,attempt_count,max_attempts,run_after,last_error,created_at,completed_at').order('created_at', { ascending: false }).limit(100),
    admin.rpc('console_scheduler_health'),
  ]);

  for (const result of [sourcesResult, identitiesResult, healthResult, channelResult, subscriptionsResult, quotaResult, receiptsResult, jobsResult, schedulerResult]) {
    if (result.error) throw result.error;
  }

  const sourceMap = new Map((sourcesResult.data ?? []).map((row) => [row.id, row]));
  const healthMap = new Map((healthResult.data ?? []).map((row) => [row.source_identity_id, row]));
  const channelMap = new Map((channelResult.data ?? []).map((row) => [row.source_identity_id, row]));
  const latestSubscription = new Map<string, Record<string, unknown>>();
  for (const row of subscriptionsResult.data ?? []) {
    if (!latestSubscription.has(row.source_identity_id)) latestSubscription.set(row.source_identity_id, row);
  }

  const registry = (identitiesResult.data ?? []).map((identity) => ({
    source: sourceMap.get(identity.source_id) ?? null,
    identity,
    health: healthMap.get(identity.id) ?? null,
    youtube: channelMap.get(identity.id) ?? null,
    subscription: latestSubscription.get(identity.id) ?? null,
  }));

  const quotaRows = quotaResult.data ?? [];
  const latestQuotaDay = quotaRows[0]?.usage_day ?? null;
  const quotaMap = new Map<string, { provider: string; quotaBucket: string; method: string; units: number; requests: number }>();
  for (const row of quotaRows) {
    if (latestQuotaDay && row.usage_day !== latestQuotaDay) continue;
    const key = `${row.provider}:${row.quota_bucket}:${row.method}`;
    const current = quotaMap.get(key) ?? { provider: row.provider, quotaBucket: row.quota_bucket, method: row.method, units: 0, requests: 0 };
    current.units += Number(row.units ?? 0);
    current.requests += Number(row.request_count ?? 0);
    quotaMap.set(key, current);
  }

  const jobStateCounts = new Map<string, number>();
  for (const row of jobsResult.data ?? []) {
    const key = `${row.job_type}:${row.state}`;
    jobStateCounts.set(key, (jobStateCounts.get(key) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    registry,
    scheduler: schedulerResult.data ?? [],
    quota: { usageDay: latestQuotaDay, methods: [...quotaMap.values()] },
    receipts: receiptsResult.data ?? [],
    jobs: {
      recent: jobsResult.data ?? [],
      stateCounts: [...jobStateCounts.entries()].map(([key, count]) => {
        const [jobType, state] = key.split(':');
        return { jobType, state, count };
      }),
    },
  };
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({})) as { action?: string; limit?: number; eventId?: string };
    if (body.action === 'overview') return json(200, await overview(auth.user, auth.operator));
    if (body.action === 'feed') return json(200, await feed(Number(body.limit ?? 25)));
    if (body.action === 'eventDetail') {
      if (typeof body.eventId !== 'string' || !UUID_PATTERN.test(body.eventId)) return json(400, { error: 'invalid_event_id' });
      const detail = await eventDetail(body.eventId);
      return detail ? json(200, detail) : json(404, { error: 'event_not_found' });
    }
    if (body.action === 'operations') return json(200, await operations());
    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-console-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
