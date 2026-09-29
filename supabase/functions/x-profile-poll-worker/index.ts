import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/x-connector/dist/index.d.ts"
import {
  X_CONNECTOR_VERSION,
  buildXUserLookupUrl,
  buildXUserPostsUrl,
  nextXCheckAt,
  normalizeXUsername,
  originalXPosts,
  parseRateLimitResetSeconds,
  parseRetryAfterSeconds,
  parseXUserLookup,
  parseXUserPosts,
  type PollClass,
  type XPost,
} from '../../../packages/x-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const xBearerToken = Deno.env.get('X_API_BEARER_TOKEN');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing x-profile-poll-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const encoder = new TextEncoder();

type XState = {
  source_identity_id: string;
  username: string;
  x_user_id: string | null;
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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function patchState(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('x_profile_source_state')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('source_identity_id', sourceIdentityId);
  if (error) throw error;
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
      parser_version: X_CONNECTOR_VERSION,
      ...timestamped,
    });
    if (insertError) throw insertError;
  }
}

async function updateRun(runId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('connector_runs').update(values).eq('id', runId);
  if (error) throw error;
}

async function readApiError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { title?: unknown; detail?: unknown; type?: unknown; errors?: unknown };
    const title = typeof parsed.title === 'string' ? parsed.title : `HTTP ${response.status}`;
    const detail = typeof parsed.detail === 'string' ? `: ${parsed.detail}` : '';
    return `${title}${detail}`.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

function rateLimitDelay(response: Response, now: Date): { retryAfterSeconds: number | null; rateLimitResetSeconds: number | null } {
  return {
    retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('retry-after'), now),
    rateLimitResetSeconds: parseRateLimitResetSeconds(response.headers.get('x-rate-limit-reset'), now),
  };
}

async function upsertXPost(sourceIdentityId: string, username: string, post: XPost): Promise<'NEW' | 'CHANGED' | 'UNCHANGED'> {
  const fingerprint = await sha256(JSON.stringify({
    text: post.text,
    createdAt: post.createdAt,
    lang: post.lang,
    canonicalUrl: post.canonicalUrl,
    possiblySensitive: post.possiblySensitive,
    mediaKeys: post.mediaKeys,
  }));
  const metadata = {
    connectorVersion: X_CONNECTOR_VERSION,
    username,
    authorId: post.authorId,
    possiblySensitive: post.possiblySensitive,
    mediaKeys: post.mediaKeys,
    isReply: post.isReply,
    isRepost: post.isRepost,
  };
  const { data, error } = await supabase.rpc('upsert_raw_item_revision', {
    p_source_identity_id: sourceIdentityId,
    p_platform_item_id: post.id,
    p_canonical_url: post.canonicalUrl,
    p_published_at: post.createdAt,
    p_item_type: 'SOCIAL_POST',
    p_raw_title: null,
    p_raw_text: post.text,
    p_normalized_text: post.text.trim(),
    p_media_type: post.mediaKeys.length > 0 ? 'SOCIAL_MEDIA' : 'TEXT',
    p_metadata: metadata,
    p_content_fingerprint: fingerprint,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('x_raw_upsert_missing_result');
  const result = row as Record<string, unknown>;
  const rawItemId = String(result.raw_item_id ?? '');
  const isNew = result.is_new === true;
  const isChanged = result.is_changed === true;
  if (!rawItemId) throw new Error('x_raw_upsert_missing_raw_item_id');
  if (isNew || isChanged) {
    const { error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_job_type: 'PROCESS_RAW_ITEM',
      p_idempotency_key: `process:x:${rawItemId}:${fingerprint.slice(0, 24)}`,
      p_payload: { rawItemId, sourceIdentityId },
      p_priority: 50,
    });
    if (enqueueError) throw enqueueError;
  }
  if (isNew) return 'NEW';
  if (isChanged) return 'CHANGED';
  return 'UNCHANGED';
}

async function handleProviderFailure(input: {
  state: XState;
  identity: SourceIdentity;
  response: Response;
  now: Date;
  nowIso: string;
  runId: string;
  requestsMade: number;
}): Promise<void> {
  const { state, identity, response, now, nowIso, runId, requestsMade } = input;
  const pollClass = asPollClass(identity.poll_class);
  const failures = state.consecutive_failures + 1;
  const provider = rateLimitDelay(response, now);
  const isRateLimited = response.status === 429;
  const nextCheck = nextXCheckAt({
    now,
    pollClass,
    consecutiveFailures: failures,
    retryAfterSeconds: isRateLimited ? (provider.retryAfterSeconds ?? 0) : null,
    rateLimitResetSeconds: isRateLimited ? (provider.rateLimitResetSeconds ?? 900) : null,
  });
  const message = await readApiError(response);
  await patchState(state.source_identity_id, {
    last_checked_at: nowIso,
    last_http_status: response.status,
    next_check_at: nextCheck,
    consecutive_failures: failures,
  });
  await updateHealth(state.source_identity_id, {
    health_state: isRateLimited ? 'RATE_LIMITED' : (response.status === 401 || response.status === 403 ? 'AUTH_REQUIRED' : 'DEGRADED'),
    last_attempt_at: nowIso,
    last_http_status: response.status,
    next_due_at: nextCheck,
    rate_limited_until: isRateLimited ? nextCheck : null,
    consecutive_failures: failures,
    last_error_code: isRateLimited ? 'X_RATE_LIMITED' : (response.status === 401 || response.status === 403 ? 'X_AUTH_REQUIRED' : 'X_HTTP_ERROR'),
    last_error_message: message,
    parser_version: X_CONNECTOR_VERSION,
  });
  await updateRun(runId, {
    status: 'FAILED',
    finished_at: new Date().toISOString(),
    requests_made: requestsMade,
    error_summary: isRateLimited ? 'x_rate_limited' : `x_http_${response.status}`,
  });
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    if (!xBearerToken) return json(503, { error: 'x_api_not_configured' });

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: dueRows, error: dueError } = await supabase.from('x_profile_source_state')
      .select('source_identity_id,username,x_user_id,next_check_at,last_post_id,consecutive_failures,gap_count')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true }).limit(limit);
    if (dueError) throw dueError;
    if (!dueRows?.length) return json(200, { due: 0, checked: 0, baselined: 0, itemsNew: 0, itemsChanged: 0, failed: 0 });

    const ids = (dueRows as XState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase.from('source_identities')
      .select('id,poll_class,active,handle').in('id', ids).eq('active', true)
      .eq('platform', 'X').eq('connector_type', 'X_API_V2').eq('access_mode', 'API');
    if (identityError) throw identityError;
    const identityById = new Map<string, SourceIdentity>((identities ?? []).map((row: SourceIdentity) => [row.id, row]));

    let checked = 0;
    let baselined = 0;
    let itemsNew = 0;
    let itemsChanged = 0;
    let failed = 0;
    let rateLimited = 0;
    let gaps = 0;

    for (const state of dueRows as XState[]) {
      const identity = identityById.get(state.source_identity_id);
      if (!identity) continue;
      const pollClass = asPollClass(identity.poll_class);
      let username: string;
      try {
        username = normalizeXUsername(state.username);
        if (identity.handle && normalizeXUsername(identity.handle) !== username) throw new Error('x_state_handle_mismatch');
      } catch (error) {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN', last_attempt_at: nowIso,
          last_error_code: 'X_INVALID_USERNAME',
          last_error_message: error instanceof Error ? error.message : 'Invalid X username',
          parser_version: X_CONNECTOR_VERSION,
        });
        continue;
      }

      const { data: run, error: runError } = await supabase.from('connector_runs').insert({
        source_identity_id: state.source_identity_id,
        connector_type: 'X_API_V2',
        status: 'RUNNING',
        requests_made: 0,
        estimated_cost_microunits: 0,
      }).select('id').single();
      if (runError) throw runError;
      const runId = String(run.id);
      let requestsMade = 0;
      let xUserId = state.x_user_id;

      if (!xUserId) {
        let lookupResponse: Response;
        try {
          lookupResponse = await fetch(buildXUserLookupUrl(username), {
            headers: { authorization: `Bearer ${xBearerToken}`, accept: 'application/json', 'user-agent': 'CineRelay/0.5' },
            signal: AbortSignal.timeout(20_000),
          });
          requestsMade += 1;
        } catch (error) {
          failed += 1;
          const failures = state.consecutive_failures + 1;
          const nextCheck = nextXCheckAt({ now, pollClass, consecutiveFailures: failures });
          await patchState(state.source_identity_id, { last_checked_at: nowIso, next_check_at: nextCheck, consecutive_failures: failures });
          await updateHealth(state.source_identity_id, {
            health_state: 'DEGRADED', last_attempt_at: nowIso, next_due_at: nextCheck,
            consecutive_failures: failures, last_error_code: 'X_LOOKUP_FETCH_FAILED',
            last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'X lookup request failed',
            parser_version: X_CONNECTOR_VERSION,
          });
          await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), requests_made: requestsMade, error_summary: 'x_lookup_fetch_failed' });
          continue;
        }
        if (!lookupResponse.ok) {
          if (lookupResponse.status === 429) rateLimited += 1;
          failed += 1;
          await handleProviderFailure({ state, identity, response: lookupResponse, now, nowIso, runId, requestsMade });
          continue;
        }
        const lookupPayload = await lookupResponse.json();
        const user = parseXUserLookup(lookupPayload, username);
        xUserId = user.id;
        await patchState(state.source_identity_id, { x_user_id: xUserId });
        const { error: identityUpdateError } = await supabase.from('source_identities')
          .update({ platform_identity_id: xUserId }).eq('id', state.source_identity_id);
        if (identityUpdateError) throw identityUpdateError;
      }

      let timelineResponse: Response;
      try {
        timelineResponse = await fetch(buildXUserPostsUrl({ userId: xUserId, sinceId: state.last_post_id, maxResults: 100 }), {
          headers: { authorization: `Bearer ${xBearerToken}`, accept: 'application/json', 'user-agent': 'CineRelay/0.5' },
          signal: AbortSignal.timeout(20_000),
        });
        requestsMade += 1;
      } catch (error) {
        failed += 1;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextXCheckAt({ now, pollClass, consecutiveFailures: failures });
        await patchState(state.source_identity_id, { last_checked_at: nowIso, next_check_at: nextCheck, consecutive_failures: failures });
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED', last_attempt_at: nowIso, next_due_at: nextCheck,
          consecutive_failures: failures, last_error_code: 'X_TIMELINE_FETCH_FAILED',
          last_error_message: error instanceof Error ? error.message.slice(0, 500) : 'X timeline request failed',
          parser_version: X_CONNECTOR_VERSION,
        });
        await updateRun(runId, { status: 'FAILED', finished_at: new Date().toISOString(), requests_made: requestsMade, error_summary: 'x_timeline_fetch_failed' });
        continue;
      }

      checked += 1;
      if (!timelineResponse.ok) {
        if (timelineResponse.status === 429) rateLimited += 1;
        failed += 1;
        await handleProviderFailure({ state, identity, response: timelineResponse, now, nowIso, runId, requestsMade });
        continue;
      }

      const payload = await timelineResponse.json() as Record<string, unknown>;
      const posts = originalXPosts(parseXUserPosts(payload, username, xUserId));
      const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta as Record<string, unknown> : null;
      const paginationToken = typeof meta?.next_token === 'string' ? meta.next_token : null;
      if (paginationToken) {
        gaps += 1;
        state.gap_count += 1;
      }

      let runNew = 0;
      let runChanged = 0;
      let newestPostId = state.last_post_id;
      if (!state.last_post_id) {
        baselined += 1;
        newestPostId = posts[0]?.id ?? null;
      } else {
        for (const post of [...posts].reverse()) {
          const result = await upsertXPost(state.source_identity_id, username, post);
          if (result === 'NEW') { itemsNew += 1; runNew += 1; }
          if (result === 'CHANGED') { itemsChanged += 1; runChanged += 1; }
        }
        newestPostId = posts[0]?.id ?? state.last_post_id;
      }

      const nextCheck = nextXCheckAt({ now, pollClass, consecutiveFailures: 0 });
      await patchState(state.source_identity_id, {
        x_user_id: xUserId,
        last_checked_at: nowIso,
        last_successful_fetch_at: nowIso,
        last_http_status: 200,
        next_check_at: nextCheck,
        last_post_id: newestPostId,
        consecutive_failures: 0,
        gap_count: state.gap_count,
      });
      await updateHealth(state.source_identity_id, {
        health_state: paginationToken ? 'DEGRADED' : 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_http_status: 200,
        next_due_at: nextCheck,
        rate_limited_until: null,
        consecutive_failures: 0,
        last_error_code: paginationToken ? 'X_DELTA_EXCEEDED_PAGE' : null,
        last_error_message: paginationToken ? 'More than one X timeline page is pending; follow-up poll required.' : null,
        parser_version: X_CONNECTOR_VERSION,
      });
      await updateRun(runId, {
        status: 'SUCCEEDED',
        finished_at: new Date().toISOString(),
        requests_made: requestsMade,
        items_seen: posts.length,
        items_new: runNew,
        items_changed: runChanged,
        error_summary: paginationToken ? 'x_delta_exceeded_page' : null,
      });
    }

    return json(200, { due: dueRows.length, checked, baselined, itemsNew, itemsChanged, failed, rateLimited, gaps });
  } catch (error) {
    console.error('x-profile-poll-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
