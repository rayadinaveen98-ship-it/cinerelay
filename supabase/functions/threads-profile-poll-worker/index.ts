import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/threads-connector/dist/index.d.ts"
import {
  THREADS_CONNECTOR_VERSION,
  buildThreadsProfilePostsUrl,
  nextThreadsCheckAt,
  normalizeThreadsUsername,
  parseRetryAfterSeconds,
  parseThreadsProfilePosts,
  planThreadsDelta,
  type PollClass,
  type ThreadsPost,
} from '../../../packages/threads-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const threadsToken = Deno.env.get('THREADS_PROFILE_DISCOVERY_ACCESS_TOKEN');
const threadsTokenExpiresAt = Deno.env.get('THREADS_PROFILE_DISCOVERY_TOKEN_EXPIRES_AT');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing threads-profile-poll-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();

type ThreadsState = {
  source_identity_id: string;
  username: string;
  next_check_at: string | null;
  last_post_id: string | null;
  consecutive_failures: number;
  gap_count: number;
};

type SourceIdentity = {
  id: string;
  poll_class: string;
  active: boolean;
  handle: string | null;
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

function asPollClass(value: string): PollClass {
  if (value === 'HOT_5M' || value === 'ACTIVE_15M' || value === 'NORMAL_60M' || value === 'COLD_6H' || value === 'DAILY') return value;
  return 'NORMAL_60M';
}

function safeTokenExpiry(): string | null {
  if (!threadsTokenExpiresAt) return null;
  const date = new Date(threadsTokenExpiresAt);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: String(values.health_state ?? 'HEALTHY'),
      parser_version: THREADS_CONNECTOR_VERSION,
      ...timestamped,
    });
    if (insertError) throw insertError;
  }
}

async function updateRun(runId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_runs').update(values).eq('id', runId);
  if (error) throw error;
}

async function patchState(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('threads_profile_source_state')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('source_identity_id', sourceIdentityId);
  if (error) throw error;
}

function mediaTypeForRaw(post: ThreadsPost): string {
  const value = (post.mediaType ?? '').toUpperCase();
  if (value.includes('VIDEO')) return 'VIDEO';
  if (value.includes('IMAGE')) return 'IMAGE';
  if (value.includes('CAROUSEL')) return 'CAROUSEL';
  if (value.includes('TEXT')) return 'TEXT';
  return 'SOCIAL';
}

async function upsertThreadsPost(input: {
  sourceIdentityId: string;
  post: ThreadsPost;
  nowIso: string;
}): Promise<'NEW' | 'CHANGED' | 'UNCHANGED'> {
  const { sourceIdentityId, post, nowIso } = input;
  const normalizedText = [post.text, post.altText].filter(Boolean).join('\n').trim();
  const fingerprint = await sha256(JSON.stringify({
    text: post.text,
    altText: post.altText,
    permalink: post.permalink,
    timestamp: post.timestamp,
    mediaType: post.mediaType,
    isQuotePost: post.isQuotePost,
    linkAttachmentUrl: post.linkAttachmentUrl,
    topicTag: post.topicTag,
  }));
  const metadata = {
    connectorVersion: THREADS_CONNECTOR_VERSION,
    username: post.username,
    shortcode: post.shortcode,
    apiMediaType: post.mediaType,
    isQuotePost: post.isQuotePost,
    hasReplies: post.hasReplies,
    altText: post.altText,
    linkAttachmentUrl: post.linkAttachmentUrl,
    topicTag: post.topicTag,
  };

  const { data: existing, error: lookupError } = await supabase.from('raw_items')
    .select('id,content_fingerprint').eq('source_identity_id', sourceIdentityId)
    .eq('platform_item_id', post.id).maybeSingle();
  if (lookupError) throw lookupError;

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase.from('raw_items').insert({
      source_identity_id: sourceIdentityId,
      platform_item_id: post.id,
      canonical_url: post.permalink,
      published_at: post.timestamp,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      item_type: 'SOCIAL_POST',
      raw_title: null,
      raw_text: post.text ?? post.altText,
      normalized_text: normalizedText || null,
      media_type: mediaTypeForRaw(post),
      metadata,
      content_fingerprint: fingerprint,
    }).select('id').single();
    if (insertError) throw insertError;
    const rawItemId = String(inserted.id);
    const { data: revision, error: revisionError } = await supabase.from('raw_item_revisions').insert({
      raw_item_id: rawItemId,
      observed_at: nowIso,
      title: null,
      text: post.text ?? post.altText,
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
      p_idempotency_key: `process:threads:${rawItemId}:${fingerprint.slice(0, 24)}`,
      p_payload: { rawItemId, sourceIdentityId },
      p_priority: 45,
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
    title: null,
    text: post.text ?? post.altText,
    metadata,
    content_fingerprint: fingerprint,
    change_kind: 'CONTENT_CHANGED',
  }).select('id').single();
  if (revisionError) throw revisionError;
  const { error: updateError } = await supabase.from('raw_items').update({
    canonical_url: post.permalink,
    published_at: post.timestamp,
    last_seen_at: nowIso,
    raw_text: post.text ?? post.altText,
    normalized_text: normalizedText || null,
    media_type: mediaTypeForRaw(post),
    metadata,
    content_fingerprint: fingerprint,
    current_revision_id: revision.id,
  }).eq('id', rawItemId);
  if (updateError) throw updateError;
  const { error: enqueueError } = await supabase.rpc('enqueue_job', {
    p_job_type: 'PROCESS_RAW_ITEM',
    p_idempotency_key: `process:threads:${rawItemId}:${fingerprint.slice(0, 24)}`,
    p_payload: { rawItemId, sourceIdentityId },
    p_priority: 45,
  });
  if (enqueueError) throw enqueueError;
  return 'CHANGED';
}

async function readApiError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown; code?: unknown; type?: unknown } };
    const message = typeof parsed.error?.message === 'string' ? parsed.error.message : `HTTP ${response.status}`;
    const code = parsed.error?.code === undefined ? '' : ` code=${String(parsed.error.code)}`;
    const type = typeof parsed.error?.type === 'string' ? ` type=${parsed.error.type}` : '';
    return `${message}${code}${type}`.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    if (!threadsToken) return json(503, { error: 'threads_profile_discovery_not_configured' });

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();
    const tokenExpiry = safeTokenExpiry();

    const { data: dueRows, error: dueError } = await supabase.from('threads_profile_source_state')
      .select('source_identity_id,username,next_check_at,last_post_id,consecutive_failures,gap_count')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true }).limit(limit);
    if (dueError) throw dueError;
    if (!dueRows?.length) return json(200, { due: 0, checked: 0, baselined: 0, itemsNew: 0, itemsChanged: 0 });

    const ids = (dueRows as ThreadsState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase.from('source_identities')
      .select('id,poll_class,active,handle').in('id', ids).eq('active', true)
      .eq('platform', 'THREADS').eq('connector_type', 'THREADS_PROFILE_API').eq('access_mode', 'OFFICIAL_API');
    if (identityError) throw identityError;
    const identityById = new Map<string, SourceIdentity>((identities ?? []).map((row: SourceIdentity) => [row.id, row]));

    let checked = 0;
    let baselined = 0;
    let itemsNew = 0;
    let itemsChanged = 0;
    let failed = 0;
    let rateLimited = 0;
    let gaps = 0;

    for (const state of dueRows as ThreadsState[]) {
      const identity = identityById.get(state.source_identity_id);
      if (!identity) continue;
      const pollClass = asPollClass(identity.poll_class);
      let username: string;
      try {
        username = normalizeThreadsUsername(state.username);
        if (identity.handle && normalizeThreadsUsername(identity.handle) !== username) throw new Error('threads_state_handle_mismatch');
      } catch (error) {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN', last_attempt_at: nowIso,
          last_error_code: 'THREADS_INVALID_USERNAME',
          last_error_message: error instanceof Error ? error.message : 'Invalid Threads username',
          parser_version: THREADS_CONNECTOR_VERSION, auth_expires_at: tokenExpiry,
        });
        continue;
      }

      const { data: run, error: runError } = await supabase.from('connector_runs').insert({
        source_identity_id: state.source_identity_id,
        connector_type: 'THREADS_PROFILE_API',
        status: 'RUNNING',
        requests_made: 1,
        estimated_cost_microunits: 0,
      }).select('id').single();
      if (runError) throw runError;
      const runId = String(run.id);

      let response: Response;
      try {
        response = await fetch(buildThreadsProfilePostsUrl(username, 50), {
          headers: {
            authorization: `Bearer ${threadsToken}`,
            accept: 'application/json',
            'user-agent': 'CineRelay/0.4 (+https://cinerelay-console.pages.dev)',
          },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        failed += 1;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextThreadsCheckAt({ now, pollClass, consecutiveFailures: failures });
        await patchState(state.source_identity_id, { last_checked_at: nowIso, next_check_at: nextCheck, consecutive_failures: failures });
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED', last_attempt_at: nowIso, next_due_at: nextCheck,
          consecutive_failures: failures, last_error_code: 'THREADS_FETCH_FAILED',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Threads request failed',
          parser_version: THREADS_CONNECTOR_VERSION, auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'threads_fetch_failed' });
        continue;
      }

      checked += 1;
      const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'), now);
      if (response.status === 429) {
        rateLimited += 1;
        const seconds = retryAfterSeconds ?? 900;
        const until = new Date(now.getTime() + seconds * 1000).toISOString();
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso, last_http_status: 429, next_check_at: until,
          consecutive_failures: state.consecutive_failures + 1,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'RATE_LIMITED', last_attempt_at: nowIso, last_http_status: 429,
          rate_limited_until: until, next_due_at: until, consecutive_failures: state.consecutive_failures + 1,
          last_error_code: 'THREADS_RATE_LIMITED',
          last_error_message: `Threads API returned HTTP 429; retry after ${seconds}s`,
          parser_version: THREADS_CONNECTOR_VERSION, auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, { status: 'RATE_LIMITED', finished_at: new Date().toISOString(), error_summary: 'http_429' });
        continue;
      }

      if (!response.ok) {
        failed += 1;
        const message = await readApiError(response);
        const authFailure = response.status === 401 || response.status === 403;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextThreadsCheckAt({ now, pollClass, consecutiveFailures: failures, retryAfterSeconds });
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck,
          consecutive_failures: failures,
        });
        await updateHealth(state.source_identity_id, {
          health_state: authFailure ? 'AUTH_REQUIRED' : 'DEGRADED',
          last_attempt_at: nowIso, last_http_status: response.status, next_due_at: nextCheck,
          consecutive_failures: failures, last_error_code: authFailure ? 'THREADS_AUTH_ERROR' : 'THREADS_HTTP_ERROR',
          last_error_message: message, parser_version: THREADS_CONNECTOR_VERSION, auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: `http_${response.status}` });
        continue;
      }

      let posts: ThreadsPost[];
      try {
        const payload = await response.json();
        posts = parseThreadsProfilePosts(payload, username).slice(0, 50);
      } catch (error) {
        failed += 1;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextThreadsCheckAt({ now, pollClass, consecutiveFailures: failures });
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso, last_http_status: response.status, next_check_at: nextCheck,
          consecutive_failures: failures,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN', last_attempt_at: nowIso, last_http_status: response.status,
          next_due_at: nextCheck, consecutive_failures: failures, last_error_code: 'THREADS_PARSE_ERROR',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Threads response parser failed',
          parser_version: THREADS_CONNECTOR_VERSION, auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), error_summary: 'threads_parse_error' });
        continue;
      }

      const delta = planThreadsDelta(posts, state.last_post_id);
      let runNew = 0;
      let runChanged = 0;
      if (delta.baseline) {
        baselined += 1;
      } else {
        for (const post of [...delta.newPosts].reverse()) {
          const result = await upsertThreadsPost({ sourceIdentityId: state.source_identity_id, post, nowIso });
          if (result === 'NEW') runNew += 1;
          if (result === 'CHANGED') runChanged += 1;
        }
      }
      itemsNew += runNew;
      itemsChanged += runChanged;
      if (delta.gapExceededWindow) gaps += 1;

      const nextCheck = nextThreadsCheckAt({ now, pollClass });
      await patchState(state.source_identity_id, {
        last_checked_at: nowIso,
        last_successful_fetch_at: nowIso,
        next_check_at: nextCheck,
        last_http_status: response.status,
        connector_version: THREADS_CONNECTOR_VERSION,
        last_post_id: delta.newestPostId ?? state.last_post_id,
        consecutive_failures: 0,
        gap_count: state.gap_count + (delta.gapExceededWindow ? 1 : 0),
      });
      await updateHealth(state.source_identity_id, {
        health_state: delta.gapExceededWindow ? 'DEGRADED' : 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_item_at: posts[0]?.timestamp ?? undefined,
        next_due_at: nextCheck,
        consecutive_failures: 0,
        last_http_status: response.status,
        rate_limited_until: null,
        last_error_code: delta.gapExceededWindow ? 'THREADS_WINDOW_GAP' : null,
        last_error_message: delta.gapExceededWindow ? 'Previous Threads post fell outside the fetched 50-post window; current window recovered' : null,
        parser_version: THREADS_CONNECTOR_VERSION,
        auth_expires_at: tokenExpiry,
      });
      await updateRun(runId, {
        status: 'SUCCEEDED', finished_at: new Date().toISOString(), items_seen: posts.length,
        items_new: runNew, items_changed: runChanged,
      });
    }

    return json(200, {
      due: dueRows.length, checked, baselined, itemsNew, itemsChanged, failed, rateLimited, gaps,
      connectorVersion: THREADS_CONNECTOR_VERSION,
    });
  } catch (error) {
    console.error('threads-profile-poll-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
