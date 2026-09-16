import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/feed-connector/dist/index.d.ts"
import {
  FEED_PARSER_VERSION,
  buildConditionalHeaders,
  nextFeedCheckAt,
  parseFeedXml,
  parseRetryAfterSeconds,
} from '../../../packages/feed-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing feed-poll-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();

type FeedState = {
  source_identity_id: string;
  feed_url: string;
  etag: string | null;
  last_modified: string | null;
  last_checked_at: string | null;
  last_successful_fetch_at: string | null;
  next_check_at: string | null;
  last_http_status: number | null;
  parser_version: string;
  last_entry_id: string | null;
  consecutive_not_modified: number;
};

type SourceIdentity = {
  id: string;
  poll_class: string;
  active: boolean;
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
  for (let i = 0; i < supplied.length; i += 1) difference |= supplied.charCodeAt(i) ^ internalSecret!.charCodeAt(i);
  return difference === 0;
}

function asPollClass(value: string): 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY' {
  if (value === 'HOT_5M' || value === 'ACTIVE_15M' || value === 'NORMAL_60M' || value === 'COLD_6H' || value === 'DAILY') return value;
  return 'NORMAL_60M';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function updateHealth(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase
    .from('source_health')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('source_identity_id', sourceIdentityId)
    .select('source_identity_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: String(values.health_state ?? 'HEALTHY'),
      parser_version: FEED_PARSER_VERSION,
      ...values,
    });
    if (insertError) throw insertError;
  }
}

async function updateRun(runId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_runs').update(values).eq('id', runId);
  if (error) throw error;
}

async function loadDomainState(domain: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('connector_domain_state')
    .select('domain,min_interval_seconds,last_request_at,next_allowed_at,rate_limited_until,consecutive_failures,last_http_status')
    .eq('domain', domain)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function recordDomainRequest(domain: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_domain_state').upsert({
    domain,
    min_interval_seconds: 30,
    ...values,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'domain' });
  if (error) throw error;
}

async function upsertFeedEntry(input: {
  sourceIdentityId: string;
  feedUrl: string;
  format: string;
  item: {
    stableId: string;
    canonicalUrl: string;
    title: string;
    text: string;
    publishedAt: string | null;
    updatedAt: string | null;
    author: string | null;
    categories: string[];
  };
  nowIso: string;
}): Promise<'NEW' | 'CHANGED' | 'UNCHANGED'> {
  const { sourceIdentityId, feedUrl, format, item, nowIso } = input;
  const canonicalUrl = /^https?:\/\//i.test(item.canonicalUrl) ? item.canonicalUrl : feedUrl;
  const normalizedText = [item.title, item.text].filter(Boolean).join('\n').trim();
  const fingerprint = await sha256(JSON.stringify({
    title: item.title,
    text: item.text,
    canonicalUrl,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
  }));

  const { data: existing, error: existingError } = await supabase
    .from('raw_items')
    .select('id,content_fingerprint')
    .eq('source_identity_id', sourceIdentityId)
    .eq('platform_item_id', item.stableId)
    .maybeSingle();
  if (existingError) throw existingError;

  const metadata = {
    feedUrl,
    feedFormat: format,
    parserVersion: FEED_PARSER_VERSION,
    author: item.author,
    categories: item.categories,
    externalId: item.stableId,
    updatedAt: item.updatedAt,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase.from('raw_items').insert({
      source_identity_id: sourceIdentityId,
      platform_item_id: item.stableId,
      canonical_url: canonicalUrl,
      published_at: item.publishedAt,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      item_type: 'FEED_ENTRY',
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

    const { error: updateError } = await supabase.from('raw_items').update({ current_revision_id: revision.id }).eq('id', rawItemId);
    if (updateError) throw updateError;

    const { error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_job_type: 'PROCESS_RAW_ITEM',
      p_idempotency_key: `process:feed:${rawItemId}:${fingerprint.slice(0, 24)}`,
      p_payload: { rawItemId },
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
    canonical_url: canonicalUrl,
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
    p_idempotency_key: `process:feed:${rawItemId}:${fingerprint.slice(0, 24)}`,
    p_payload: { rawItemId },
    p_priority: 40,
  });
  if (enqueueError) throw enqueueError;
  return 'CHANGED';
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: dueRows, error: dueError } = await supabase
      .from('feed_source_state')
      .select('source_identity_id,feed_url,etag,last_modified,last_checked_at,last_successful_fetch_at,next_check_at,last_http_status,parser_version,last_entry_id,consecutive_not_modified')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (dueError) throw dueError;
    if (!dueRows || dueRows.length === 0) return json(200, { due: 0, checked: 0, itemsNew: 0, itemsChanged: 0 });

    const ids = (dueRows as FeedState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase
      .from('source_identities')
      .select('id,poll_class,active')
      .in('id', ids)
      .eq('active', true)
      .eq('access_mode', 'FEED');
    if (identityError) throw identityError;
    const identityById = new Map((identities ?? []).map((row: SourceIdentity) => [row.id, row]));

    let checked = 0;
    let notModified = 0;
    let itemsNew = 0;
    let itemsChanged = 0;
    let failed = 0;
    let rateLimited = 0;
    const domainsSeen = new Set<string>();

    for (const state of dueRows as FeedState[]) {
      const identity = identityById.get(state.source_identity_id);
      if (!identity) continue;
      const pollClass = asPollClass(identity.poll_class);
      let domain = '';
      try {
        domain = new URL(state.feed_url).hostname.toLowerCase();
      } catch {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_error_code: 'INVALID_FEED_URL',
          last_error_message: 'Registered feed URL is not a valid HTTP URL',
          parser_version: FEED_PARSER_VERSION,
        });
        continue;
      }

      const domainState = await loadDomainState(domain);
      const domainNext = typeof domainState?.next_allowed_at === 'string' ? new Date(domainState.next_allowed_at) : null;
      const domainRateLimited = typeof domainState?.rate_limited_until === 'string' ? new Date(domainState.rate_limited_until) : null;
      const blockedUntil = [domainNext, domainRateLimited]
        .filter((value): value is Date => Boolean(value && Number.isFinite(value.getTime()) && value.getTime() > now.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (domainsSeen.has(domain) || blockedUntil) {
        const nextCheck = blockedUntil?.toISOString() ?? new Date(now.getTime() + 30_000).toISOString();
        await supabase.from('feed_source_state').update({ next_check_at: nextCheck, updated_at: nowIso }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, { next_due_at: nextCheck });
        continue;
      }
      domainsSeen.add(domain);

      const { data: run, error: runError } = await supabase.from('connector_runs').insert({
        source_identity_id: state.source_identity_id,
        connector_type: 'RSS_ATOM',
        status: 'RUNNING',
        requests_made: 1,
      }).select('id').single();
      if (runError) throw runError;
      const runId = String(run.id);

      const minIntervalSeconds = Math.max(1, Number(domainState?.min_interval_seconds ?? 30));
      const nextAllowedAt = new Date(now.getTime() + minIntervalSeconds * 1000).toISOString();
      await recordDomainRequest(domain, { last_request_at: nowIso, next_allowed_at: nextAllowedAt });

      let response: Response;
      try {
        response = await fetch(state.feed_url, {
          headers: {
            ...buildConditionalHeaders({ etag: state.etag, lastModified: state.last_modified }),
            'user-agent': 'CineRelay/0.3 (+https://cinerelay-console.pages.dev)',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        failed += 1;
        const failures = Number(domainState?.consecutive_failures ?? 0) + 1;
        const nextCheck = nextFeedCheckAt({ now, pollClass, consecutiveFailures: failures });
        await recordDomainRequest(domain, {
          next_allowed_at: nextAllowedAt,
          consecutive_failures: failures,
          last_http_status: null,
        });
        await supabase.from('feed_source_state').update({ last_checked_at: nowIso, next_check_at: nextCheck, updated_at: nowIso }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED',
          last_attempt_at: nowIso,
          next_due_at: nextCheck,
          consecutive_failures: failures,
          last_error_code: 'FEED_FETCH_FAILED',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Feed request failed',
          parser_version: FEED_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'feed_fetch_failed' });
        continue;
      }

      checked += 1;
      const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'), now);
      if (response.status === 429) {
        rateLimited += 1;
        const seconds = retryAfterSeconds ?? 15 * 60;
        const until = new Date(now.getTime() + seconds * 1000).toISOString();
        await recordDomainRequest(domain, {
          rate_limited_until: until,
          next_allowed_at: until,
          consecutive_failures: Number(domainState?.consecutive_failures ?? 0) + 1,
          last_http_status: 429,
        });
        await supabase.from('feed_source_state').update({ last_checked_at: nowIso, last_http_status: 429, next_check_at: until, updated_at: nowIso }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, {
          health_state: 'RATE_LIMITED',
          last_attempt_at: nowIso,
          last_http_status: 429,
          rate_limited_until: until,
          next_due_at: until,
          last_error_code: 'FEED_RATE_LIMITED',
          last_error_message: `Feed returned HTTP 429; retry after ${seconds}s`,
          parser_version: FEED_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'RATE_LIMITED', finished_at: new Date().toISOString(), error_summary: 'http_429' });
        continue;
      }

      if (response.status === 304) {
        notModified += 1;
        const nextCheck = nextFeedCheckAt({ now, pollClass });
        await recordDomainRequest(domain, {
          rate_limited_until: null,
          consecutive_failures: 0,
          last_http_status: 304,
        });
        await supabase.from('feed_source_state').update({
          last_checked_at: nowIso,
          last_successful_fetch_at: nowIso,
          next_check_at: nextCheck,
          last_http_status: 304,
          consecutive_not_modified: Number(state.consecutive_not_modified ?? 0) + 1,
          updated_at: nowIso,
        }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, {
          health_state: 'HEALTHY',
          last_attempt_at: nowIso,
          last_success_at: nowIso,
          next_due_at: nextCheck,
          consecutive_failures: 0,
          last_http_status: 304,
          rate_limited_until: null,
          last_error_code: null,
          last_error_message: null,
          parser_version: FEED_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'SUCCEEDED', finished_at: new Date().toISOString(), items_seen: 0 });
        continue;
      }

      if (!response.ok) {
        failed += 1;
        const failures = Number(domainState?.consecutive_failures ?? 0) + 1;
        const nextCheck = nextFeedCheckAt({ now, pollClass, consecutiveFailures: failures, retryAfterSeconds });
        await recordDomainRequest(domain, {
          consecutive_failures: failures,
          last_http_status: response.status,
        });
        await supabase.from('feed_source_state').update({ last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck, updated_at: nowIso }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, {
          health_state: response.status === 401 || response.status === 403 ? 'AUTH_REQUIRED' : 'DEGRADED',
          last_attempt_at: nowIso,
          last_http_status: response.status,
          next_due_at: nextCheck,
          consecutive_failures: failures,
          last_error_code: 'FEED_HTTP_ERROR',
          last_error_message: `Feed returned HTTP ${response.status}`,
          parser_version: FEED_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: `http_${response.status}` });
        continue;
      }

      const rawXml = await response.text();
      let parsed;
      try {
        parsed = parseFeedXml(rawXml);
      } catch (error) {
        failed += 1;
        const nextCheck = nextFeedCheckAt({ now, pollClass, consecutiveFailures: 1 });
        await supabase.from('feed_source_state').update({ last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck, updated_at: nowIso }).eq('source_identity_id', state.source_identity_id);
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_http_status: response.status,
          next_due_at: nextCheck,
          consecutive_failures: 1,
          last_error_code: 'FEED_PARSE_ERROR',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Feed parser failed',
          parser_version: FEED_PARSER_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'feed_parse_error' });
        continue;
      }

      let runNew = 0;
      let runChanged = 0;
      const entries = parsed.entries.slice(0, 50);
      for (const item of [...entries].reverse()) {
        const result = await upsertFeedEntry({
          sourceIdentityId: state.source_identity_id,
          feedUrl: state.feed_url,
          format: parsed.format,
          item,
          nowIso,
        });
        if (result === 'NEW') runNew += 1;
        if (result === 'CHANGED') runChanged += 1;
      }
      itemsNew += runNew;
      itemsChanged += runChanged;

      const nextCheck = nextFeedCheckAt({ now, pollClass });
      const newestEntry = entries[0] ?? null;
      await recordDomainRequest(domain, {
        rate_limited_until: null,
        consecutive_failures: 0,
        last_http_status: response.status,
      });
      await supabase.from('feed_source_state').update({
        etag: response.headers.get('etag') ?? state.etag,
        last_modified: response.headers.get('last-modified') ?? state.last_modified,
        last_checked_at: nowIso,
        last_successful_fetch_at: nowIso,
        next_check_at: nextCheck,
        last_http_status: response.status,
        parser_version: FEED_PARSER_VERSION,
        last_entry_id: newestEntry?.stableId ?? state.last_entry_id,
        consecutive_not_modified: 0,
        updated_at: nowIso,
      }).eq('source_identity_id', state.source_identity_id);
      await updateHealth(state.source_identity_id, {
        health_state: 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_item_at: newestEntry?.publishedAt ?? undefined,
        next_due_at: nextCheck,
        consecutive_failures: 0,
        last_http_status: response.status,
        rate_limited_until: null,
        last_error_code: null,
        last_error_message: null,
        parser_version: FEED_PARSER_VERSION,
      });
      await updateRun(runId, {
        status: 'SUCCEEDED',
        finished_at: new Date().toISOString(),
        items_seen: entries.length,
        items_new: runNew,
        items_changed: runChanged,
      });
    }

    return json(200, {
      due: dueRows.length,
      checked,
      notModified,
      itemsNew,
      itemsChanged,
      failed,
      rateLimited,
      parserVersion: FEED_PARSER_VERSION,
    });
  } catch (error) {
    console.error('feed-poll-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
