import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/domain/dist/index.d.ts"
import { normalizeItem, processSingle, resolveEntity } from '../../../packages/domain/dist/index.js';
// @deno-types="../../../packages/domain/dist/ott-release-signal.d.ts"
import { extractOttMovieReleaseSignal, type OttMovieReleaseSignal } from '../../../packages/domain/dist/ott-release-signal.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing raw-item worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const RESOLVER_VERSION = 'source-scope-resolver-v1';
const TITLE_RESOLVER_VERSION = 'canonical-title-resolver-v1';
const OPERATOR_RESOLVER_VERSION = 'operator-override-v1';
const CLASSIFIER_VERSION = 'deterministic-domain-v1.1';

type EntityCandidate = { id: string; canonicalName: string; aliases: string[] };
type SourceDescriptor = { authorityTier: number; role?: string; platform?: string; name?: string };
type Resolution = { state: string; score: number; entity?: EntityCandidate; matchedAlias?: string };

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  return difference === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function failJob(job: Record<string, unknown>, workerId: string, error: string): Promise<void> {
  const attemptCount = Number(job.attempt_count ?? 1);
  const retrySeconds = Math.min(3600, 20 * 2 ** Math.max(0, attemptCount - 1));
  await supabase.rpc('fail_job', { p_job_id: String(job.id), p_worker_id: workerId, p_error: error, p_retry_after_seconds: retrySeconds });
}

async function completeJob(job: Record<string, unknown>, workerId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_job', { p_job_id: String(job.id), p_worker_id: workerId });
  if (error) throw error;
}

function sourceRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return undefined;
}

async function loadRawItem(rawItemId: string): Promise<Record<string, unknown> | undefined> {
  const { data, error } = await supabase.from('raw_items')
    .select('id,source_identity_id,platform_item_id,canonical_url,published_at,raw_title,raw_text,normalized_text,content_fingerprint,metadata')
    .eq('id', rawItemId).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | undefined;
}

async function loadSource(sourceIdentityId: string): Promise<SourceDescriptor> {
  const { data, error } = await supabase.from('source_identities')
    .select('id,platform,source_id,sources(display_name,authority_tier,source_role)')
    .eq('id', sourceIdentityId).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('source_identity_not_found');
  const source = sourceRow((data as Record<string, unknown>).sources);
  if (!source) throw new Error('source_descriptor_missing');
  return {
    authorityTier: Number(source.authority_tier ?? 5),
    role: typeof source.source_role === 'string' ? source.source_role : undefined,
    platform: typeof (data as Record<string, unknown>).platform === 'string' ? String((data as Record<string, unknown>).platform) : undefined,
    name: typeof source.display_name === 'string' ? source.display_name : undefined,
  };
}

async function loadEntity(entityId: string): Promise<EntityCandidate | undefined> {
  const entities = await loadEntities([entityId]);
  return entities[0];
}

async function loadEntities(ids: string[]): Promise<EntityCandidate[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const [{ data: entities, error: entityError }, { data: aliases, error: aliasError }] = await Promise.all([
    supabase.from('entities')
      .select('id,canonical_name,entity_type,status')
      .in('id', uniqueIds)
      .in('entity_type', ['MOVIE', 'SERIES', 'SEASON'])
      .eq('status', 'ACTIVE'),
    supabase.from('entity_aliases').select('entity_id,alias').in('entity_id', uniqueIds).is('valid_to', null),
  ]);
  if (entityError) throw entityError;
  if (aliasError) throw aliasError;

  const aliasMap = new Map<string, string[]>();
  for (const row of aliases ?? []) {
    const entityId = String((row as Record<string, unknown>).entity_id);
    const alias = String((row as Record<string, unknown>).alias ?? '').trim();
    if (!alias) continue;
    const current = aliasMap.get(entityId) ?? [];
    current.push(alias);
    aliasMap.set(entityId, current);
  }

  return (entities ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    canonicalName: String(row.canonical_name),
    aliases: aliasMap.get(String(row.id)) ?? [],
  }));
}

async function loadOperatorOverride(rawItemId: string): Promise<{ id: string; entity: EntityCandidate } | undefined> {
  const { data, error } = await supabase.from('operator_resolution_overrides')
    .select('id,entity_id,active').eq('raw_item_id', rawItemId).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const entity = await loadEntity(String(data.entity_id));
  if (!entity) throw new Error('operator_override_entity_invalid');
  return { id: String(data.id), entity };
}

async function loadCandidates(sourceIdentityId: string): Promise<EntityCandidate[]> {
  const now = new Date().toISOString();
  const { data: scopeRows, error: scopeError } = await supabase.from('source_entity_candidates')
    .select('entity_id,confidence,priority').eq('source_identity_id', sourceIdentityId).eq('active', true)
    .or(`valid_from.is.null,valid_from.lte.${now}`).or(`valid_to.is.null,valid_to.gt.${now}`)
    .order('priority', { ascending: true }).order('confidence', { ascending: false });
  if (scopeError) throw scopeError;
  const ids = [...new Set((scopeRows ?? []).map((row: Record<string, unknown>) => String(row.entity_id)).filter(Boolean))];
  return loadEntities(ids);
}

async function loadTitleCandidates(title: string): Promise<EntityCandidate[]> {
  const trimmed = title.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc('find_entity_candidates_for_title', {
    p_title: trimmed,
    p_limit: 12,
  });
  if (error) throw error;
  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    : [];
  const ids: string[] = [...new Set(rows.map((row) => String(row.entity_id ?? '')).filter(Boolean))];
  return loadEntities(ids);
}

async function currentTheatricalDate(entityId: string): Promise<string | undefined> {
  const { data, error } = await supabase.from('events').select('event_type,structured_data,detected_at')
    .eq('primary_entity_id', entityId).eq('status', 'ACTIVE')
    .in('event_type', ['THEATRICAL_DATE_ANNOUNCED', 'THEATRICAL_DATE_CHANGED'])
    .order('detected_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const structured = (data as Record<string, unknown>).structured_data;
  if (typeof structured !== 'object' || structured === null) return undefined;
  const record = structured as Record<string, unknown>;
  if (typeof record.newDate === 'string') return record.newDate;
  if (typeof record.date === 'string') return record.date;
  return undefined;
}

async function persistResolution(rawItemId: string, resolution: Resolution, methods: unknown[], engineVersion: string): Promise<void> {
  const { error } = await supabase.rpc('record_entity_resolution', {
    p_raw_item_id: rawItemId,
    p_entity_id: resolution.entity?.id ?? null,
    p_score: resolution.score,
    p_resolution_state: resolution.state,
    p_methods: methods,
    p_engine_version: engineVersion,
  });
  if (error) throw error;
}

async function persistEvent(rawItemId: string, event: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_canonical_event_with_evidence', {
    p_event_id: String(event.id),
    p_primary_entity_id: String(event.primaryEntityId),
    p_event_type: String(event.eventType),
    p_verification_state: String(event.verificationState),
    p_priority_band: String(event.priorityBand),
    p_headline: String(event.headline),
    p_structured_data: event.structuredData ?? {},
    p_dedupe_key: String(event.dedupeKey),
    p_classifier_version: CLASSIFIER_VERSION,
    p_raw_item_id: rawItemId,
  });
  if (error) throw error;
  return String(data);
}

async function submitOttDiscovery(rawItemId: string, signal: OttMovieReleaseSignal): Promise<void> {
  const metadata = {
    signalType: signal.signalType,
    contentType: signal.contentType,
    providerCode: signal.providerCode,
    releaseDate: signal.releaseDate ?? null,
    datePrecision: signal.datePrecision,
    state: signal.state,
    evidenceStatus: signal.evidenceStatus,
    releaseType: signal.releaseType,
  };
  const { data: candidateId, error } = await supabase.rpc('submit_entity_discovery_candidate', {
    p_proposed_name: signal.title,
    p_proposed_entity_type: 'MOVIE',
    p_raw_item_id: rawItemId,
    p_confidence: signal.confidence,
    p_primary_language: signal.primaryLanguage ?? null,
    p_country_code: 'IN',
    p_match_method: 'DETERMINISTIC_TITLE',
    p_weight: signal.weight,
    p_metadata: metadata,
  });
  if (error) throw error;
  if (!candidateId) throw new Error('ott_candidate_submission_returned_no_id');

  const { error: promotionError } = await supabase.rpc('system_promote_verified_ott_candidate', {
    p_candidate_id: String(candidateId),
  });
  if (promotionError) throw promotionError;
}

async function persistOttRelease(entityId: string, rawItemId: string, signal: OttMovieReleaseSignal): Promise<void> {
  const { error } = await supabase.rpc('upsert_ott_release_with_evidence', {
    p_entity_id: entityId,
    p_provider_code: signal.providerCode,
    p_raw_item_id: rawItemId,
    p_territory: 'IN',
    p_languages: signal.primaryLanguage ? [signal.primaryLanguage] : [],
    p_release_type: signal.releaseType,
    p_release_date: signal.releaseDate ?? null,
    p_date_precision: signal.datePrecision,
    p_state: signal.state,
    p_evidence_status: signal.evidenceStatus,
    p_reason: signal.releaseDate
      ? 'Deterministic OTT movie release signal from retained source evidence'
      : 'First-party OTT availability signal; exact historical premiere day not asserted',
  });
  if (error) throw error;
}

async function processJob(job: Record<string, unknown>, workerId: string): Promise<{ resolution: string; eventId?: string }> {
  const payload = job.payload as Record<string, unknown> | undefined;
  const rawItemId = typeof payload?.rawItemId === 'string' ? payload.rawItemId : '';
  const payloadSourceIdentityId = typeof payload?.sourceIdentityId === 'string' ? payload.sourceIdentityId : '';
  if (!rawItemId) throw new Error('invalid_job_payload');

  const raw = await loadRawItem(rawItemId);
  if (!raw) throw new Error('raw_item_not_found');
  const rawSourceIdentityId = typeof raw.source_identity_id === 'string' ? raw.source_identity_id : String(raw.source_identity_id ?? '');
  if (!rawSourceIdentityId) throw new Error('raw_source_identity_missing');
  if (payloadSourceIdentityId && payloadSourceIdentityId !== rawSourceIdentityId) throw new Error('source_identity_mismatch');
  const sourceIdentityId = payloadSourceIdentityId || rawSourceIdentityId;

  const source = await loadSource(sourceIdentityId);
  const fixtureItem = {
    title: typeof raw.raw_title === 'string' ? raw.raw_title : '',
    text: typeof raw.raw_text === 'string' ? raw.raw_text : '',
    url: String(raw.canonical_url),
  };
  const ottSignal = extractOttMovieReleaseSignal({
    title: fixtureItem.title,
    text: fixtureItem.text,
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : undefined,
    source,
  });
  const normalized = normalizeItem(fixtureItem, source);

  const operatorOverride = await loadOperatorOverride(rawItemId);
  let resolution: Resolution;
  if (operatorOverride) {
    resolution = { state: 'RESOLVED', score: 1, entity: operatorOverride.entity, matchedAlias: operatorOverride.entity.canonicalName };
    await persistResolution(rawItemId, resolution, [{ method: 'OPERATOR_OVERRIDE', overrideId: operatorOverride.id }], OPERATOR_RESOLVER_VERSION);
  } else {
    const scopedCandidates = await loadCandidates(sourceIdentityId);
    const scopedResolution = scopedCandidates.length > 0
      ? resolveEntity(normalized, { candidateEntities: scopedCandidates }) as Resolution
      : { state: 'UNRESOLVED', score: 0 } as Resolution;

    if (scopedResolution.state === 'RESOLVED' && scopedResolution.entity?.id) {
      resolution = scopedResolution;
      await persistResolution(rawItemId, resolution, [{
        method: 'SOURCE_ENTITY_SCOPE',
        candidateCount: scopedCandidates.length,
        matchedAlias: resolution.matchedAlias ?? null,
      }], RESOLVER_VERSION);
    } else {
      const titleCandidates = await loadTitleCandidates(fixtureItem.title);
      if (titleCandidates.length > 0) {
        resolution = resolveEntity(normalized, { candidateEntities: titleCandidates }) as Resolution;
        await persistResolution(rawItemId, resolution, [
          {
            method: 'SOURCE_ENTITY_SCOPE',
            candidateCount: scopedCandidates.length,
            state: scopedResolution.state,
            matchedAlias: scopedResolution.matchedAlias ?? null,
          },
          {
            method: 'CANONICAL_TITLE_ALIAS',
            candidateCount: titleCandidates.length,
            matchedAlias: resolution.matchedAlias ?? null,
            titleOnlyCandidateDiscovery: true,
          },
        ], TITLE_RESOLVER_VERSION);
      } else {
        resolution = scopedResolution;
        await persistResolution(rawItemId, resolution, [{
          method: 'SOURCE_ENTITY_SCOPE',
          candidateCount: scopedCandidates.length,
          matchedAlias: scopedResolution.matchedAlias ?? null,
        }, {
          method: 'CANONICAL_TITLE_ALIAS',
          candidateCount: 0,
          matchedAlias: null,
          titleOnlyCandidateDiscovery: true,
        }], scopedCandidates.length > 0 ? RESOLVER_VERSION : TITLE_RESOLVER_VERSION);
      }
    }
  }

  if (resolution.state !== 'RESOLVED' || !resolution.entity?.id) {
    if (ottSignal) await submitOttDiscovery(rawItemId, ottSignal);
    await completeJob(job, workerId);
    return { resolution: resolution.state };
  }

  if (ottSignal) await persistOttRelease(resolution.entity.id, rawItemId, ottSignal);

  const previousDate = await currentTheatricalDate(resolution.entity.id);
  const pipeline = processSingle(fixtureItem, source, {
    entity: resolution.entity,
    ...(previousDate ? { precondition: { currentTheatricalDate: previousDate } } : {}),
  });
  const event = pipeline.events[0] as unknown as Record<string, unknown> | undefined;
  if (!event) {
    await completeJob(job, workerId);
    return { resolution: 'RESOLVED' };
  }

  const eventId = await persistEvent(rawItemId, event);
  await completeJob(job, workerId);
  return { resolution: 'RESOLVED', eventId };
}

Deno.serve(async (request) => {
  const workerId = `raw-intelligence:${crypto.randomUUID()}`;
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 25)));
    const { data: jobs, error: leaseError } = await supabase.rpc('lease_jobs', {
      p_job_type: 'PROCESS_RAW_ITEM', p_worker_id: workerId, p_limit: limit, p_lease_seconds: 120,
    });
    if (leaseError) throw leaseError;
    if (!jobs || jobs.length === 0) return json(200, { leased: 0, processed: 0, events: 0 });

    let processed = 0;
    let events = 0;
    const resolutions: Record<string, number> = {};
    for (const job of jobs as Record<string, unknown>[]) {
      try {
        const result = await processJob(job, workerId);
        processed += 1;
        if (result.eventId) events += 1;
        resolutions[result.resolution] = (resolutions[result.resolution] ?? 0) + 1;
      } catch (error) {
        console.error('PROCESS_RAW_ITEM failed', { jobId: job.id, error });
        await failJob(job, workerId, String(error));
      }
    }

    return json(200, { leased: jobs.length, processed, events, resolutions });
  } catch (error) {
    console.error('process-raw-item-worker failure', error);
    return json(500, { error: 'internal_error', workerId });
  }
});
