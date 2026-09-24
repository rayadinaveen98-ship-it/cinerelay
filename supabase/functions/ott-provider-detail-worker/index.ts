import { createClient } from '@supabase/supabase-js';
import { parse } from 'node-html-parser';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing OTT provider detail worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const MAX_PAGE_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;
const encoder = new TextEncoder();

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

type DetailConfig = {
  providerCode: string;
  canonicalTitle: string;
  primaryLanguage?: string;
  releaseType?: 'ORIGINAL' | 'POST_THEATRICAL';
  parserProfile?: 'ZEE5_PREMIERE_TEXT_V1';
};

type Identity = {
  id: string;
  poll_class: string;
  canonical_url: string;
  connector_config: Record<string, unknown> | null;
};

type DetailState = {
  source_identity_id: string;
  page_url: string;
  etag: string | null;
  last_modified: string | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  return difference === 0;
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function configOf(value: Record<string, unknown> | null): DetailConfig {
  const providerCode = typeof value?.providerCode === 'string' ? value.providerCode.trim().toUpperCase() : '';
  const canonicalTitle = typeof value?.canonicalTitle === 'string' ? value.canonicalTitle.trim() : '';
  const primaryLanguage = typeof value?.primaryLanguage === 'string' ? value.primaryLanguage.trim().toLowerCase() : undefined;
  const releaseType = value?.releaseType === 'ORIGINAL' ? 'ORIGINAL' : 'POST_THEATRICAL';
  const parserProfile = value?.parserProfile === 'ZEE5_PREMIERE_TEXT_V1' ? value.parserProfile : undefined;
  if (!providerCode || !canonicalTitle || !parserProfile) throw new Error('ott_provider_detail_config_invalid');
  return { providerCode, canonicalTitle, primaryLanguage, releaseType, parserProfile };
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
}

function assertSafeUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:') throw new Error('ott_provider_url_must_be_https');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('ott_provider_private_host');
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) throw new Error('ott_provider_private_host');
  if (isPrivateIpv4(hostname)) throw new Error('ott_provider_private_host');
  return url;
}

async function fetchPage(urlValue: string, headers: Record<string, string>): Promise<Response> {
  let url = assertSafeUrl(urlValue);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === MAX_REDIRECTS) throw new Error('ott_provider_redirect_limit');
    const location = response.headers.get('location');
    if (!location) throw new Error('ott_provider_redirect_without_location');
    url = assertSafeUrl(new URL(location, url).toString());
  }
  throw new Error('ott_provider_redirect_limit');
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function premiereDateFromText(text: string): string | undefined {
  const normalized = clean(text).toLowerCase();
  const monthPattern = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const dayFirst = normalized.match(new RegExp(`\\bpremier(?:e|es|ing)\\s+(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthPattern},?\\s+(20\\d{2})\\b`, 'i'));
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = MONTHS[dayFirst[2].toLowerCase()];
    const year = Number(dayFirst[3]);
    if (month) return validIsoDate(year, month, day);
  }
  const monthFirst = normalized.match(new RegExp(`\\bpremier(?:e|es|ing)\\s+(?:on\\s+)?${monthPattern}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'i'));
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    const day = Number(monthFirst[2]);
    const year = Number(monthFirst[3]);
    if (month) return validIsoDate(year, month, day);
  }
  return undefined;
}

function indiaTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function nextCheckIso(pollClass: string): string {
  const hours = pollClass === 'DAILY' ? 24 : pollClass === 'COLD_6H' ? 6 : pollClass === 'NORMAL_60M' ? 1 : 6;
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function updateHealth(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const payload = { ...values, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('source_health').update(payload).eq('source_identity_id', sourceIdentityId).select('source_identity_id');
  if (error) throw error;
  if (!data?.length) {
    const { error: insertError } = await supabase.from('source_health').insert({ source_identity_id: sourceIdentityId, health_state: 'HEALTHY', ...payload });
    if (insertError) throw insertError;
  }
}

async function patchState(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('page_source_state').update({ ...values, updated_at: new Date().toISOString() }).eq('source_identity_id', sourceIdentityId);
  if (error) throw error;
}

async function persistOfficialRelease(input: {
  identity: Identity;
  config: DetailConfig;
  pageUrl: string;
  title: string;
  text: string;
  releaseDate: string;
  etag: string | null;
  lastModified: string | null;
}): Promise<{ releaseId?: string; eventId?: string; entityId?: string }> {
  const { identity, config, pageUrl, title, text, releaseDate } = input;
  const state = releaseDate > indiaTodayIso() ? 'UPCOMING' : 'RELEASED';
  const fingerprint = await sha256(JSON.stringify({ title, text, releaseDate, pageUrl }));
  const metadata = {
    connectorType: 'OTT_PROVIDER_DETAIL',
    parserProfile: config.parserProfile,
    providerCode: config.providerCode,
    canonicalTitle: config.canonicalTitle,
    releaseDate,
    evidenceStatus: 'CONFIRMED',
    contentType: 'MOVIE',
  };
  const { data: rawRows, error: rawError } = await supabase.rpc('upsert_raw_item_revision', {
    p_source_identity_id: identity.id,
    p_platform_item_id: pageUrl,
    p_canonical_url: pageUrl,
    p_published_at: null,
    p_item_type: 'WEB_ARTICLE',
    p_raw_title: title,
    p_raw_text: text.slice(0, 50_000),
    p_normalized_text: `${title}\n${text}`.slice(0, 50_000),
    p_media_type: 'TEXT',
    p_metadata: metadata,
    p_content_fingerprint: fingerprint,
  });
  if (rawError) throw rawError;
  const rawRow = Array.isArray(rawRows) ? rawRows[0] : rawRows;
  const rawItemId = rawRow?.raw_item_id ? String(rawRow.raw_item_id) : '';
  if (!rawItemId) throw new Error('ott_provider_raw_item_missing');

  const discoveryMetadata = {
    signalType: 'OTT_RELEASE',
    providerCode: config.providerCode,
    releaseDate,
    datePrecision: 'DAY',
    state,
    evidenceStatus: 'CONFIRMED',
    releaseType: config.releaseType ?? 'POST_THEATRICAL',
    contentType: 'MOVIE',
  };
  const { data: candidateId, error: candidateError } = await supabase.rpc('submit_entity_discovery_candidate', {
    p_proposed_name: config.canonicalTitle,
    p_proposed_entity_type: 'MOVIE',
    p_raw_item_id: rawItemId,
    p_confidence: 0.99,
    p_primary_language: config.primaryLanguage ?? null,
    p_country_code: 'IN',
    p_match_method: 'DETERMINISTIC_TITLE',
    p_weight: 0.99,
    p_metadata: discoveryMetadata,
  });
  if (candidateError) throw candidateError;
  if (!candidateId) throw new Error('ott_provider_candidate_missing');

  const { error: promotionError } = await supabase.rpc('system_promote_verified_ott_candidate', { p_candidate_id: String(candidateId) });
  if (promotionError) throw promotionError;

  const { data: candidate, error: lookupError } = await supabase.from('entity_discovery_candidates')
    .select('promoted_entity_id,duplicate_entity_id,status')
    .eq('id', String(candidateId)).single();
  if (lookupError) throw lookupError;
  const entityId = candidate.promoted_entity_id ?? candidate.duplicate_entity_id;
  if (!entityId) throw new Error(`ott_provider_candidate_not_promoted:${candidate.status}`);

  const { data: releaseResult, error: releaseError } = await supabase.rpc('upsert_ott_release_with_evidence', {
    p_entity_id: String(entityId),
    p_provider_code: config.providerCode,
    p_raw_item_id: rawItemId,
    p_territory: 'IN',
    p_languages: config.primaryLanguage ? [config.primaryLanguage] : [],
    p_release_type: config.releaseType ?? 'POST_THEATRICAL',
    p_release_date: releaseDate,
    p_date_precision: 'DAY',
    p_state: state,
    p_evidence_status: 'CONFIRMED',
    p_reason: 'Explicit premiere date extracted from official OTT provider detail page',
  });
  if (releaseError) throw releaseError;
  const result = (releaseResult ?? {}) as Record<string, unknown>;
  return {
    entityId: String(entityId),
    ...(typeof result.releaseId === 'string' ? { releaseId: result.releaseId } : {}),
    ...(typeof result.eventId === 'string' ? { eventId: result.eventId } : {}),
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(30, Number(body.limit ?? 10)));
    const nowIso = new Date().toISOString();

    const { data: dueStates, error: stateError } = await supabase.from('page_source_state')
      .select('source_identity_id,page_url,etag,last_modified')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit * 4);
    if (stateError) throw stateError;
    if (!dueStates?.length) return json(200, { due: 0, checked: 0, confirmed: 0, failed: 0 });

    const ids = (dueStates as DetailState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase.from('source_identities')
      .select('id,poll_class,canonical_url,connector_config')
      .in('id', ids)
      .eq('active', true)
      .eq('platform', 'WEB')
      .eq('access_mode', 'PUBLIC_WEB')
      .eq('connector_type', 'OTT_PROVIDER_DETAIL')
      .limit(limit);
    if (identityError) throw identityError;
    const identityMap = new Map((identities ?? []).map((row: Identity) => [row.id, row]));

    let checked = 0;
    let confirmed = 0;
    let failed = 0;
    const results: Record<string, unknown>[] = [];

    for (const state of dueStates as DetailState[]) {
      const identity = identityMap.get(state.source_identity_id);
      if (!identity || checked >= limit) continue;
      checked += 1;
      try {
        const config = configOf(identity.connector_config);
        const headers: Record<string, string> = { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' };
        if (state.etag) headers['if-none-match'] = state.etag;
        if (state.last_modified) headers['if-modified-since'] = state.last_modified;
        const response = await fetchPage(state.page_url, headers);
        if (response.status === 304) {
          await patchState(identity.id, { last_checked_at: nowIso, last_http_status: 304, next_check_at: nextCheckIso(identity.poll_class), consecutive_not_modified: 1 });
          await updateHealth(identity.id, { health_state: 'HEALTHY', last_attempt_at: nowIso, last_success_at: nowIso, last_http_status: 304, last_error_code: null, last_error_message: null, next_due_at: nextCheckIso(identity.poll_class) });
          continue;
        }
        if (!response.ok) throw new Error(`ott_provider_http_${response.status}`);
        const length = Number(response.headers.get('content-length') ?? 0);
        if (length > MAX_PAGE_BYTES) throw new Error('ott_provider_page_too_large');
        const html = await response.text();
        if (encoder.encode(html).byteLength > MAX_PAGE_BYTES) throw new Error('ott_provider_page_too_large');

        const root = parse(html, { lowerCaseTagName: false, comment: false });
        const pageTitle = clean(root.querySelector('h1')?.innerText) || clean(root.querySelector('title')?.innerText) || config.canonicalTitle;
        const pageText = clean(root.innerText).slice(0, 100_000);
        if (!pageText.toLowerCase().includes(config.canonicalTitle.toLowerCase())) throw new Error('ott_provider_title_not_present');
        const releaseDate = premiereDateFromText(pageText);
        if (!releaseDate) throw new Error('ott_provider_explicit_premiere_date_missing');

        const persisted = await persistOfficialRelease({
          identity,
          config,
          pageUrl: state.page_url,
          title: pageTitle,
          text: pageText,
          releaseDate,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
        });
        confirmed += 1;
        const nextDue = nextCheckIso(identity.poll_class);
        await patchState(identity.id, {
          etag: response.headers.get('etag'),
          last_modified: response.headers.get('last-modified'),
          last_checked_at: nowIso,
          last_successful_fetch_at: nowIso,
          next_check_at: nextDue,
          last_http_status: response.status,
          last_item_id: state.page_url,
          last_item_count: 1,
          consecutive_not_modified: 0,
        });
        await updateHealth(identity.id, { health_state: 'HEALTHY', last_attempt_at: nowIso, last_success_at: nowIso, last_item_at: nowIso, next_due_at: nextDue, consecutive_failures: 0, last_http_status: response.status, last_error_code: null, last_error_message: null, parser_version: config.parserProfile });
        results.push({ sourceIdentityId: identity.id, title: config.canonicalTitle, releaseDate, ...persisted });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        const nextDue = nextCheckIso(identity.poll_class);
        await patchState(identity.id, { last_checked_at: nowIso, next_check_at: nextDue });
        await updateHealth(identity.id, { health_state: 'DEGRADED', last_attempt_at: nowIso, next_due_at: nextDue, consecutive_failures: 1, last_error_code: 'OTT_PROVIDER_DETAIL_FAILED', last_error_message: message.slice(0, 500) });
        results.push({ sourceIdentityId: identity.id, error: message });
      }
    }

    return json(200, { due: identities?.length ?? 0, checked, confirmed, failed, results });
  } catch (error) {
    console.error('ott-provider-detail-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
