import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/domain/dist/ott-series-release-signal.d.ts"
import {
  extractOttSeriesReleaseSignal,
  type OttSeriesReleaseSignal,
} from '../../../packages/domain/dist/ott-series-release-signal.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing OTT series intelligence environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PARSER_VERSION = 'ott-series-v1';
const LOOKBACK_DAYS = 30;
const RAW_SCAN_PAGE_SIZE = 250;
const MAX_SCAN_PAGES = 8;

type SourceDescriptor = {
  authorityTier: number;
  role?: string;
  name?: string;
};

type RawRow = {
  id: string;
  source_identity_id: string;
  published_at: string | null;
  raw_title: string | null;
  raw_text: string | null;
  canonical_url: string | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function sourceRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return undefined;
}

async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get('x-cinerelay-scheduler-key') ?? '';
  if (token.length < 32 || token.length > 256) return false;
  const { data, error } = await supabase.rpc('verify_scheduler_token', { p_token: token });
  return !error && data === true;
}

async function loadOttSources(): Promise<Map<string, SourceDescriptor>> {
  const { data, error } = await supabase
    .from('source_identities')
    .select('id,sources(display_name,authority_tier,source_role)')
    .eq('active', true)
    .limit(500);
  if (error) throw error;

  const result = new Map<string, SourceDescriptor>();
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const source = sourceRow(record.sources);
    if (!source) continue;
    const role = typeof source.source_role === 'string' ? source.source_role.toUpperCase() : '';
    const authorityTier = Number(source.authority_tier ?? 5);
    if (role !== 'OTT_PLATFORM' || authorityTier > 2) continue;
    result.set(String(record.id), {
      authorityTier,
      role,
      name: typeof source.display_name === 'string' ? source.display_name : undefined,
    });
  }
  return result;
}

async function loadDueRawItems(sourceIds: string[], limit: number): Promise<RawRow[]> {
  if (sourceIds.length === 0) return [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const due: RawRow[] = [];

  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const from = page * RAW_SCAN_PAGE_SIZE;
    const to = from + RAW_SCAN_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('raw_items')
      .select('id,source_identity_id,published_at,raw_title,raw_text,canonical_url')
      .in('source_identity_id', sourceIds)
      .gte('published_at', since)
      .is('deleted_or_unavailable_at', null)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const rows = (data ?? []) as RawRow[];
    if (rows.length === 0) break;

    const ids = rows.map((row) => row.id);
    const { data: states, error: stateError } = await supabase
      .from('ott_series_processing_state')
      .select('raw_item_id,parser_version,outcome')
      .in('raw_item_id', ids);
    if (stateError) throw stateError;

    const completed = new Set(
      (states ?? [])
        .filter((row: Record<string, unknown>) => row.parser_version === PARSER_VERSION && ['NO_SIGNAL', 'PROMOTED'].includes(String(row.outcome)))
        .map((row: Record<string, unknown>) => String(row.raw_item_id)),
    );
    for (const row of rows) {
      if (!completed.has(row.id)) due.push(row);
      if (due.length >= limit) return due.slice(0, limit);
    }
    if (rows.length < RAW_SCAN_PAGE_SIZE) break;
  }

  return due.slice(0, limit);
}

async function recordState(input: {
  rawItemId: string;
  outcome: 'NO_SIGNAL' | 'PROMOTED' | 'ERROR';
  candidateId?: string | null;
  entityId?: string | null;
  signal?: OttSeriesReleaseSignal | null;
  lastError?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('ott_series_processing_state').upsert({
    raw_item_id: input.rawItemId,
    parser_version: PARSER_VERSION,
    outcome: input.outcome,
    candidate_id: input.candidateId ?? null,
    entity_id: input.entityId ?? null,
    signal: input.signal ?? {},
    last_error: input.lastError?.slice(0, 500) ?? null,
    processed_at: now,
    updated_at: now,
  }, { onConflict: 'raw_item_id' });
  if (error) throw error;
}

async function submitCandidate(rawItemId: string, signal: OttSeriesReleaseSignal): Promise<string> {
  const { data, error } = await supabase.rpc('submit_entity_discovery_candidate', {
    p_proposed_name: signal.title,
    p_proposed_entity_type: signal.contentType,
    p_raw_item_id: rawItemId,
    p_confidence: signal.confidence,
    p_primary_language: signal.primaryLanguage ?? null,
    p_country_code: 'IN',
    p_match_method: 'DETERMINISTIC_TITLE',
    p_weight: signal.weight,
    p_metadata: {
      signalType: signal.signalType,
      contentType: signal.contentType,
      providerCode: signal.providerCode,
      releaseDate: signal.releaseDate ?? null,
      datePrecision: signal.datePrecision,
      state: signal.state,
      evidenceStatus: signal.evidenceStatus,
      releaseType: signal.releaseType,
      parserVersion: PARSER_VERSION,
    },
  });
  if (error) throw error;
  if (!data) throw new Error('series_candidate_submission_returned_no_id');
  return String(data);
}

async function promoteCandidate(candidateId: string): Promise<{ entityId: string; promoted: boolean }> {
  const { data, error } = await supabase.rpc('system_promote_first_party_ott_candidate', {
    p_candidate_id: candidateId,
  });
  if (error) throw error;
  const result = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const entityId = typeof result.entityId === 'string' ? result.entityId : '';
  const promoted = result.promoted === true;
  if (!promoted || !entityId) throw new Error(`series_candidate_not_promoted:${String(result.reason ?? 'unknown')}`);
  return { entityId, promoted };
}

async function persistRelease(entityId: string, rawItemId: string, signal: OttSeriesReleaseSignal): Promise<void> {
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
      ? 'Deterministic first-party OTT series release signal from retained source evidence'
      : 'First-party OTT series availability signal; exact premiere day not asserted',
  });
  if (error) throw error;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 25)));

    const sources = await loadOttSources();
    const rows = await loadDueRawItems([...sources.keys()], limit);
    let detected = 0;
    let promoted = 0;
    let skipped = 0;
    let failed = 0;

    for (const raw of rows) {
      const source = sources.get(raw.source_identity_id);
      if (!source) continue;
      const signal = extractOttSeriesReleaseSignal({
        title: raw.raw_title ?? '',
        text: raw.raw_text ?? '',
        publishedAt: raw.published_at ?? undefined,
        source,
      });
      if (!signal) {
        await recordState({ rawItemId: raw.id, outcome: 'NO_SIGNAL' });
        skipped += 1;
        continue;
      }

      detected += 1;
      try {
        const candidateId = await submitCandidate(raw.id, signal);
        const promotion = await promoteCandidate(candidateId);
        await persistRelease(promotion.entityId, raw.id, signal);
        await recordState({
          rawItemId: raw.id,
          outcome: 'PROMOTED',
          candidateId,
          entityId: promotion.entityId,
          signal,
        });
        promoted += 1;
      } catch (error) {
        failed += 1;
        await recordState({
          rawItemId: raw.id,
          outcome: 'ERROR',
          signal,
          lastError: String(error),
        });
      }
    }

    return json(200, {
      parserVersion: PARSER_VERSION,
      sources: sources.size,
      due: rows.length,
      detected,
      promoted,
      skipped,
      failed,
    });
  } catch (error) {
    console.error('ott-series-intelligence-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
