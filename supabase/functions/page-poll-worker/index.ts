import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/web-page-connector/dist/index.d.ts"
import {
  WEB_PAGE_PARSER_VERSION,
  assessPageDrift,
  buildPageConditionalHeaders,
  nextPageCheckAt,
  parsePageRetryAfterSeconds,
  parseWebPage,
  planPageDelta,
  type PagePollClass,
  type WebPageItem,
  type WebPageParserProfile,
} from '../../../packages/web-page-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing page-poll-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();
const MAX_PAGE_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;

type PageState = {
  source_identity_id: string;
  page_url: string;
  etag: string | null;
  last_modified: string | null;
  next_check_at: string | null;
  last_item_id: string | null;
  last_item_count: number;
  structure_fingerprint: string | null;
  consecutive_not_modified: number;
  gap_count: number;
  drift_count: number;
};

type SourceIdentity = {
  id: string;
  poll_class: string;
  connector_config: Record<string, unknown> | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function authorized(request: Request): boolean {
  const supplied = request.headers.get('x-cinerelay-internal-key') ?? '';
  if (supplied.length !== internalSecret!.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied.charCodeAt(index) ^ internalSecret!.charCodeAt(index);
  }
  return difference === 0;
}

function asPollClass(value: string): PagePollClass {
  if (value === 'HOT_5M' || value === 'ACTIVE_15M' || value === 'NORMAL_60M' || value === 'COLD_6H' || value === 'DAILY') return value;
  return 'NORMAL_60M';
}

function parserProfile(config: Record<string, unknown> | null): WebPageParserProfile {
  const candidate = config?.parserProfile;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('page_parser_profile_missing');
  const profile = candidate as Record<string, unknown>;
  if (typeof profile.profileVersion !== 'string' || typeof profile.itemSelector !== 'string' || typeof profile.linkSelector !== 'string') {
    throw new Error('page_parser_profile_invalid');
  }
  return profile as unknown as WebPageParserProfile;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0;
}

function assertSafePageUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:') throw new Error('page_url_must_be_https');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('page_url_private_host');
  }
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
    throw new Error('page_url_private_host');
  }
  if (isPrivateIpv4(hostname)) throw new Error('page_url_private_host');
  return url;
}

async function fetchPage(urlValue: string, headers: Record<string, string>): Promise<Response> {
  let url = assertSafePageUrl(urlValue);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === MAX_REDIRECTS) throw new Error('page_redirect_limit');
    const location = response.headers.get('location');
    if (!location) throw new Error('page_redirect_without_location');
    url = assertSafePageUrl(new URL(location, url).toString());
  }
  throw new Error('page_redirect_limit');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function updateHealth(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const timestamped = { ...values, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('source_health').update(timestamped)
    .eq('source_identity_id', sourceIdentityId).select('source_identity_id');
  if (error) throw error;
  if (!data?.length) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: String(values.health_state ?? 'HEALTHY'),
      parser_version: WEB_PAGE_PARSER_VERSION,
      ...timestamped,
    });
    if (insertError) throw insertError;
  }
}

async function updateRun(runId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_runs').update(values).eq('id', runId);
  if (error) throw error;
}

async function patchPageState(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('page_source_state')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('source_identity_id', sourceIdentityId);
  if (error) throw error;
}

async function loadDomainState(domain: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from('connector_domain_state')
    .select('domain,min_interval_seconds,next_allowed_at,rate_limited_until,consecutive_failures,last_http_status')
    .eq('domain', domain).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function recordDomain(domain: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_domain_state').upsert({
    domain,
    min_interval_seconds: 30,
    ...values,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'domain' });
  if (error) throw error;
}

async function upsertPageItem(input: {
  sourceIdentityId: string;
  pageUrl: string;
  profile: WebPageParserProfile;
  item: WebPageItem;
  nowIso: string;
}): Promise<'NEW' | 'CHANGED' | 'UNCHANGED'> {
  const { sourceIdentityId, pageUrl, profile, item, nowIso } = input;
  const normalizedText = [item.title, item.text].filter(Boolean).join('\n').trim();
  const fingerprint = await sha256(JSON.stringify({
    title: item.title,
    text: item.text,
    canonicalUrl: item.canonicalUrl,
    publishedAt: item.publishedAt,
    author: item.author,
  }));
  const metadata = {
    pageUrl,
    connectorType: 'FIRST_PARTY_HTML',
    parserVersion: WEB_PAGE_PARSER_VERSION,
    parserProfileVersion: profile.profileVersion,
    author: item.author,
    externalId: item.stableId,
  };

  const { data: existing, error: lookupError } = await supabase.from('raw_items')
    .select('id,content_fingerprint')
    .eq('source_identity_id', sourceIdentityId)
    .eq('platform_item_id', item.stableId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase.from('raw_items').insert({
      source_identity_id: sourceIdentityId,
      platform_item_id: item.stableId,
      canonical_url: item.canonicalUrl,
      published_at: item.publishedAt,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      item_type: 'WEB_ARTICLE',
      raw_title: item.title || null,
      raw_text: item.text || null,
      normalized_text: normalizedText || null,
      media_type: 'TEXT',
      metadata,
      content_fingerprint: fingerprint,
    }).select('id').single();
    if (insertError) throw insertError;
    const rawItemId = String(inserted.id);

    const { data: revision, error: revisionError } = await supabase.from('raw_item_revisions').insert({
      raw_item_id: rawItemId,
      observed_at: nowIso,
      title: item.title || null,
      text: item.text || null,
      metadata,
      content_fingerprint: fingerprint,
      change_kind: 'CREATED',
    }).select('id').single();
    if (revisionError) throw revisionError;

    const { error: currentError } = await supabase.from('raw_items')
      .update({ current_revision_id: revision.id }).eq('id', rawItemId);
    if (currentError) throw currentError;

    const { error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_job_type: 'PROCESS_RAW_ITEM',
      p_idempotency_key: `process:page:${rawItemId}:${fingerprint.slice(0, 24)}`,
      p_payload: { rawItemId, sourceIdentityId },
      p_priority: 40,
    });
    if (enqueueError) throw enqueueError;
    return 'NEW';
  }

  const rawItemId = String(existing.id);
  if (String(existing.content_fingerprint) === fingerprint) {
    const { error } = await supabase.from('raw_items').update({ last_seen_at: nowIso }).eq('id', rawItemId);
    if (error) throw error;
    return 'UNCHANGED';
  }

  const { data: revision, error: revisionError } = await supabase.from('raw_item_revisions').insert({
    raw_item_id: rawItemId,
    observed_at: nowIso,
    title: item.title || null,
    text: item.text || null,
    metadata,
    content_fingerprint: fingerprint,
    change_kind: 'CONTENT_CHANGED',
  }).select('id').single();
  if (revisionError) throw revisionError;

  const { error: updateError } = await supabase.from('raw_items').update({
    canonical_url: item.canonicalUrl,
    published_at: item.publishedAt,
    last_seen_at: nowIso,
    raw_title: item.title || null,
    raw_text: item.text || null,
    normalized_text: normalizedText || null,
    metadata,
    content_fingerprint: fingerprint,
    current_revision_id: revision.id,
  }).eq('id', rawItemId);
  if (updateError) throw updateError;

  const { error: enqueueError } = await supabase.rpc('enqueue_job', {
    p_job_type: 'PROCESS_RAW_ITEM',
    p_idempotency_key: `process:page:${rawItemId}:${fingerprint.slice(0, 24)}`,
    p_payload: { rawItemId, sourceIdentityId },
    p_priority: 40,
  });
  if (enqueueError) throw enqueueError;
  return 'CHANGED';
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });

    const requested = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(requested.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: dueRows, error: dueError } = await supabase.from('page_source_state')
      .select('source_identity_id,page_url,etag,last_modified,next_check_at,last_item_id,last_item_count,structure_fingerprint,consecutive_not_modified,gap_count,drift_count')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (dueError) throw dueError;
    if (!dueRows?.length) return json(200, { due: 0, checked: 0, baselined: 0, itemsNew: 0, itemsChanged: 0, drifted: 0 });

    const ids = (dueRows as PageState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase.from('source_identities')
      .select('id,poll_class,connector_config')
      .in('id', ids)
      .eq('active', true)
      .eq('access_mode', 'PUBLIC_WEB')
      .eq('connector_type', 'FIRST_PARTY_HTML');
    if (identityError) throw identityError;
    const identityById = new Map((identities ?? []).map((row: SourceIdentity) => [row.id, row]));

    let checked = 0;
    let baselined = 0;
    let notModified = 0;
    let itemsNew = 0;
    let itemsChanged = 0;
    let failed = 0;
    let rateLimited = 0;
    let gaps = 0;
    let drifted = 0;
    const domainsSeen = new Set<string>();

    for (const state of dueRows as PageState[]) {
      const identity = identityById.get(state.source_identity_id);
      if (!identity) continue;
      const pollClass = asPollClass(identity.poll_class);
      let profile: WebPageParserProfile;
      try {
        profile = parserProfile(identity.connector_config);
      } catch (error) {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_error_code: 'PAGE_PROFILE_INVALID',
          last_error_message: error instanceof Error ? error.message : 'Page parser profile is invalid',
          parser_version: WEB_PAGE_PARSER_VERSION,
        });
        continue;
      }

      let domain: string;
      try {
        domain = assertSafePageUrl(state.page_url).hostname.toLowerCase();
      } catch (error) {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_error_code: 'INVALID_PAGE_URL',
          last_error_message: error instanceof Error ? error.message : 'Invalid page URL',
          parser_version: WEB_PAGE_PARSER_VERSION,
        });
        continue;
      }

      const domainState = await loadDomainState(domain);
      const blockedUntil = [domainState?.next_allowed_at, domainState?.rate_limited_until]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => new Date(value))
        .filter((value) => Number.isFinite(value.getTime()) && value.getTime() > now.getTime())
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (domainsSeen.has(domain) || blockedUntil) {
        const nextCheck = blockedUntil?.toISOString() ?? new Date(now.getTime() + 30_000).toISOString();
        await patchPageState(state.source_identity_id, { next_check_at: nextCheck });
        await updateHealth(state.source_identity_id, { next_due_at: nextCheck });
        continue;
      }
      domainsSeen.add(domain);

      const { data: run, error: runError } = await supabase.from('connector_runs').insert({
        source_identity_id: state.source_identity_id,
        connector_type: 'FIRST_PARTY_HTML',
        status: 'RUNNING',
        requests_made: 1,
      }).select('id').single();
      if (runError) throw runError;
      const runId = String(run.id);
      const minIntervalSeconds = Math.max(1, Number(domainState?.min_interval_seconds ?? 30));
      const nextAllowedAt = new Date(now.getTime() + minIntervalSeconds * 1000).toISOString();
      await recordDomain(domain, { last_request_at: nowIso, next_allowed_at: nextAllowedAt });

      let response: Response;
      try {
        response = await fetchPage(state.page_url, {
          ...buildPageConditionalHeaders({ etag: state.etag, lastModified: state.last_modified }),
          'user-agent': 'CineRelay/0.3 (+https://cinerelay-console.pages.dev)',
        });
      } catch (error) {
        failed += 1;
        const failures = Number(domainState?.consecutive_failures ?? 0) + 1;
        const nextCheck = nextPageCheckAt({ now, pollClass, consecutiveFailures: failures });
        await recordDomain(domain, { consecutive_failures: failures, last_http_status: null });
        await patchPageState(state.source_identity_id, { last_checked_at: nowIso, next_check_at: nextCheck });
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED', last_attempt_at: nowIso, next_due_at: nextCheck,
          consecutive_failures: failures, last_error_code: 'PAGE_FETCH_FAILED',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Page request failed',
          parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'page_fetch_failed' });
        continue;
      }

      checked += 1;
      const retryAfterSeconds = parsePageRetryAfterSeconds(response.headers.get('retry-after'), now);
      if (response.status === 429) {
        rateLimited += 1;
        const seconds = retryAfterSeconds ?? 900;
        const until = new Date(now.getTime() + seconds * 1000).toISOString();
        await recordDomain(domain, {
          rate_limited_until: until,
          next_allowed_at: until,
          consecutive_failures: Number(domainState?.consecutive_failures ?? 0) + 1,
          last_http_status: 429,
        });
        await patchPageState(state.source_identity_id, { last_checked_at: nowIso, last_http_status: 429, next_check_at: until });
        await updateHealth(state.source_identity_id, {
          health_state: 'RATE_LIMITED', last_attempt_at: nowIso, last_http_status: 429,
          rate_limited_until: until, next_due_at: until, last_error_code: 'PAGE_RATE_LIMITED',
          last_error_message: `Page returned HTTP 429; retry after ${seconds}s`, parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'RATE_LIMITED', finished_at: new Date().toISOString(), error_summary: 'http_429' });
        continue;
      }

      if (response.status === 304) {
        notModified += 1;
        const nextCheck = nextPageCheckAt({ now, pollClass });
        await recordDomain(domain, { rate_limited_until: null, consecutive_failures: 0, last_http_status: 304 });
        await patchPageState(state.source_identity_id, {
          last_checked_at: nowIso,
          last_successful_fetch_at: nowIso,
          next_check_at: nextCheck,
          last_http_status: 304,
          consecutive_not_modified: state.consecutive_not_modified + 1,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'HEALTHY', last_attempt_at: nowIso, last_success_at: nowIso, next_due_at: nextCheck,
          consecutive_failures: 0, last_http_status: 304, rate_limited_until: null,
          last_error_code: null, last_error_message: null, parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'SUCCEEDED', finished_at: new Date().toISOString(), items_seen: 0 });
        continue;
      }

      if (!response.ok) {
        failed += 1;
        const failures = Number(domainState?.consecutive_failures ?? 0) + 1;
        const nextCheck = nextPageCheckAt({ now, pollClass, consecutiveFailures: failures, retryAfterSeconds });
        await recordDomain(domain, { consecutive_failures: failures, last_http_status: response.status });
        await patchPageState(state.source_identity_id, { last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck });
        await updateHealth(state.source_identity_id, {
          health_state: response.status === 401 || response.status === 403 ? 'AUTH_REQUIRED' : 'DEGRADED',
          last_attempt_at: nowIso, last_http_status: response.status, next_due_at: nextCheck,
          consecutive_failures: failures, last_error_code: 'PAGE_HTTP_ERROR',
          last_error_message: `Page returned HTTP ${response.status}`, parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: `http_${response.status}` });
        continue;
      }

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PAGE_BYTES) throw new Error('page_too_large');
      const html = await response.text();
      if (encoder.encode(html).byteLength > MAX_PAGE_BYTES) throw new Error('page_too_large');

      let parsed;
      try {
        parsed = parseWebPage(html, state.page_url, profile);
      } catch (error) {
        failed += 1;
        const nextCheck = nextPageCheckAt({ now, pollClass, consecutiveFailures: 1 });
        await patchPageState(state.source_identity_id, { last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck });
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN', last_attempt_at: nowIso, last_http_status: response.status,
          next_due_at: nextCheck, consecutive_failures: 1, last_error_code: 'PAGE_PARSE_ERROR',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Page parser failed',
          parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'page_parse_error' });
        continue;
      }

      const drift = assessPageDrift({
        previousItemCount: state.last_item_count,
        currentItemCount: parsed.items.length,
        minItems: profile.minItems,
        previousFingerprint: state.structure_fingerprint,
        currentFingerprint: parsed.structureFingerprint,
      });
      if (drift.state === 'PARSER_BROKEN') {
        drifted += 1;
        const nextCheck = nextPageCheckAt({ now, pollClass, consecutiveFailures: 1 });
        await patchPageState(state.source_identity_id, {
          etag: response.headers.get('etag') ?? state.etag,
          last_modified: response.headers.get('last-modified') ?? state.last_modified,
          last_checked_at: nowIso,
          last_http_status: response.status,
          next_check_at: nextCheck,
          drift_count: state.drift_count + 1,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN', last_attempt_at: nowIso, last_http_status: response.status,
          next_due_at: nextCheck, consecutive_failures: 1,
          last_error_code: drift.code, last_error_message: drift.message, parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), items_seen: parsed.items.length, error_summary: drift.code });
        continue;
      }

      const delta = planPageDelta(parsed.items, state.last_item_id);
      if (drift.state === 'DEGRADED' && delta.gapExceededWindow) {
        drifted += 1;
        const nextCheck = nextPageCheckAt({ now, pollClass, consecutiveFailures: 1 });
        await patchPageState(state.source_identity_id, {
          etag: response.headers.get('etag') ?? state.etag,
          last_modified: response.headers.get('last-modified') ?? state.last_modified,
          last_checked_at: nowIso,
          last_http_status: response.status,
          next_check_at: nextCheck,
          last_item_count: parsed.items.length,
          structure_fingerprint: parsed.structureFingerprint,
          drift_count: state.drift_count + 1,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED', last_attempt_at: nowIso, last_http_status: response.status,
          next_due_at: nextCheck, consecutive_failures: 1,
          last_error_code: drift.code ?? 'PAGE_STRUCTURE_DRIFT',
          last_error_message: drift.message ?? 'Parser drift combined with missing previous item; ingestion paused',
          parser_version: WEB_PAGE_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'PARTIAL', finished_at: new Date().toISOString(), items_seen: parsed.items.length, error_summary: 'page_drift_ingestion_paused' });
        continue;
      }

      let runNew = 0;
      let runChanged = 0;
      if (delta.baseline) {
        baselined += 1;
      } else {
        for (const item of [...delta.newItems].reverse()) {
          const result = await upsertPageItem({
            sourceIdentityId: state.source_identity_id,
            pageUrl: state.page_url,
            profile,
            item,
            nowIso,
          });
          if (result === 'NEW') runNew += 1;
          if (result === 'CHANGED') runChanged += 1;
        }
      }
      itemsNew += runNew;
      itemsChanged += runChanged;
      if (delta.gapExceededWindow) gaps += 1;
      if (drift.state === 'DEGRADED') drifted += 1;

      const nextCheck = nextPageCheckAt({ now, pollClass });
      await recordDomain(domain, { rate_limited_until: null, consecutive_failures: 0, last_http_status: response.status });
      await patchPageState(state.source_identity_id, {
        etag: response.headers.get('etag') ?? state.etag,
        last_modified: response.headers.get('last-modified') ?? state.last_modified,
        last_checked_at: nowIso,
        last_successful_fetch_at: nowIso,
        next_check_at: nextCheck,
        last_http_status: response.status,
        parser_version: WEB_PAGE_PARSER_VERSION,
        parser_profile_version: profile.profileVersion,
        last_item_id: delta.newestItemId ?? state.last_item_id,
        last_item_count: parsed.items.length,
        structure_fingerprint: parsed.structureFingerprint,
        consecutive_not_modified: 0,
        gap_count: state.gap_count + (delta.gapExceededWindow ? 1 : 0),
        drift_count: state.drift_count + (drift.state === 'DEGRADED' ? 1 : 0),
      });
      await updateHealth(state.source_identity_id, {
        health_state: drift.state === 'DEGRADED' || delta.gapExceededWindow ? 'DEGRADED' : 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_item_at: parsed.items[0]?.publishedAt ?? undefined,
        next_due_at: nextCheck,
        consecutive_failures: 0,
        last_http_status: response.status,
        rate_limited_until: null,
        last_error_code: drift.code ?? (delta.gapExceededWindow ? 'PAGE_WINDOW_GAP' : null),
        last_error_message: drift.message ?? (delta.gapExceededWindow ? 'Previous page item fell outside the parsed item window; current window recovered' : null),
        parser_version: WEB_PAGE_PARSER_VERSION,
      });
      await updateRun(runId, {
        status: drift.state === 'DEGRADED' ? 'PARTIAL' : 'SUCCEEDED',
        finished_at: new Date().toISOString(),
        items_seen: parsed.items.length,
        items_new: runNew,
        items_changed: runChanged,
        error_summary: drift.code,
      });
    }

    return json(200, {
      due: dueRows.length,
      checked,
      baselined,
      notModified,
      itemsNew,
      itemsChanged,
      failed,
      rateLimited,
      gaps,
      drifted,
      parserVersion: WEB_PAGE_PARSER_VERSION,
    });
  } catch (error) {
    console.error('page-poll-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
