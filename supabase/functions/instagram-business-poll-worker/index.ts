import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/instagram-connector/dist/index.d.ts"
import {
  INSTAGRAM_CONNECTOR_VERSION,
  buildInstagramBusinessDiscoveryUrl,
  nextInstagramCheckAt,
  normalizeGraphApiVersion,
  normalizeInstagramUsername,
  parseInstagramBusinessDiscovery,
  parseRetryAfterSeconds,
  planInstagramDelta,
  type InstagramMedia,
  type PollClass,
} from '../../../packages/instagram-connector/dist/index.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const instagramToken = Deno.env.get('INSTAGRAM_BUSINESS_DISCOVERY_ACCESS_TOKEN');
const managedIgUserId = Deno.env.get('INSTAGRAM_MANAGED_IG_USER_ID');
const graphApiVersion = Deno.env.get('INSTAGRAM_GRAPH_API_VERSION');
const tokenExpiresAt = Deno.env.get('INSTAGRAM_BUSINESS_DISCOVERY_TOKEN_EXPIRES_AT');

if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
  throw new Error('Missing instagram-business-poll-worker environment');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();

type InstagramState = {
  source_identity_id: string;
  username: string;
  next_check_at: string | null;
  last_media_id: string | null;
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
  for (let i = 0; i < supplied.length; i += 1) {
    difference |= supplied.charCodeAt(i) ^ internalSecret!.charCodeAt(i);
  }
  return difference === 0;
}

function asPollClass(value: string): PollClass {
  if (
    value === 'HOT_5M' ||
    value === 'ACTIVE_15M' ||
    value === 'NORMAL_60M' ||
    value === 'COLD_6H' ||
    value === 'DAILY'
  ) return value;
  return 'NORMAL_60M';
}

function safeTokenExpiry(): string | null {
  if (!tokenExpiresAt) return null;
  const date = new Date(tokenExpiresAt);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function configured(): boolean {
  if (!instagramToken || !managedIgUserId || !graphApiVersion) return false;
  try {
    normalizeGraphApiVersion(graphApiVersion);
    if (!/^\d{5,32}$/.test(managedIgUserId.trim())) return false;
    return true;
  } catch {
    return false;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function updateHealth(sourceIdentityId: string, values: Record<string, unknown>): Promise<void> {
  const timestamped = { ...values, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('source_health')
    .update(timestamped)
    .eq('source_identity_id', sourceIdentityId)
    .select('source_identity_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: String(values.health_state ?? 'HEALTHY'),
      parser_version: INSTAGRAM_CONNECTOR_VERSION,
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
  const { error } = await supabase
    .from('instagram_business_source_state')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('source_identity_id', sourceIdentityId);
  if (error) throw error;
}

function mediaTypeForRaw(media: InstagramMedia): string {
  const value = (media.mediaType ?? '').toUpperCase();
  if (value === 'VIDEO') return 'VIDEO';
  if (value === 'IMAGE') return 'IMAGE';
  if (value === 'CAROUSEL_ALBUM') return 'CAROUSEL';
  return 'SOCIAL';
}

async function upsertInstagramMedia(input: {
  sourceIdentityId: string;
  media: InstagramMedia;
  nowIso: string;
}): Promise<'NEW' | 'CHANGED' | 'UNCHANGED'> {
  const { sourceIdentityId, media, nowIso } = input;
  const fingerprint = await sha256(JSON.stringify({
    caption: media.caption,
    permalink: media.permalink,
    timestamp: media.timestamp,
    mediaType: media.mediaType,
    thumbnailUrl: media.thumbnailUrl,
  }));
  const metadata = {
    connectorVersion: INSTAGRAM_CONNECTOR_VERSION,
    username: media.username,
    apiMediaType: media.mediaType,
    thumbnailUrl: media.thumbnailUrl,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('raw_items')
    .select('id,content_fingerprint')
    .eq('source_identity_id', sourceIdentityId)
    .eq('platform_item_id', media.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase.from('raw_items').insert({
      source_identity_id: sourceIdentityId,
      platform_item_id: media.id,
      canonical_url: media.permalink,
      published_at: media.timestamp,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      item_type: 'SOCIAL_POST',
      raw_title: null,
      raw_text: media.caption,
      normalized_text: media.caption,
      media_type: mediaTypeForRaw(media),
      metadata,
      content_fingerprint: fingerprint,
    }).select('id').single();
    if (insertError) throw insertError;

    const rawItemId = String(inserted.id);
    const { data: revision, error: revisionError } = await supabase.from('raw_item_revisions').insert({
      raw_item_id: rawItemId,
      observed_at: nowIso,
      title: null,
      text: media.caption,
      metadata,
      content_fingerprint: fingerprint,
      change_kind: 'CREATED',
    }).select('id').single();
    if (revisionError) throw revisionError;

    const { error: currentError } = await supabase
      .from('raw_items')
      .update({ current_revision_id: revision.id })
      .eq('id', rawItemId);
    if (currentError) throw currentError;

    const { error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_job_type: 'PROCESS_RAW_ITEM',
      p_idempotency_key: `process:instagram:${rawItemId}:${fingerprint.slice(0, 24)}`,
      p_payload: { rawItemId, sourceIdentityId },
      p_priority: 45,
    });
    if (enqueueError) throw enqueueError;
    return 'NEW';
  }

  const rawItemId = String(existing.id);
  if (String(existing.content_fingerprint) === fingerprint) {
    const { error } = await supabase
      .from('raw_items')
      .update({ last_seen_at: nowIso })
      .eq('id', rawItemId);
    if (error) throw error;
    return 'UNCHANGED';
  }

  const { data: revision, error: revisionError } = await supabase.from('raw_item_revisions').insert({
    raw_item_id: rawItemId,
    observed_at: nowIso,
    title: null,
    text: media.caption,
    metadata,
    content_fingerprint: fingerprint,
    change_kind: 'CONTENT_CHANGED',
  }).select('id').single();
  if (revisionError) throw revisionError;

  const { error: updateError } = await supabase.from('raw_items').update({
    canonical_url: media.permalink,
    published_at: media.timestamp,
    last_seen_at: nowIso,
    raw_text: media.caption,
    normalized_text: media.caption,
    media_type: mediaTypeForRaw(media),
    metadata,
    content_fingerprint: fingerprint,
    current_revision_id: revision.id,
  }).eq('id', rawItemId);
  if (updateError) throw updateError;

  const { error: enqueueError } = await supabase.rpc('enqueue_job', {
    p_job_type: 'PROCESS_RAW_ITEM',
    p_idempotency_key: `process:instagram:${rawItemId}:${fingerprint.slice(0, 24)}`,
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
    const parsed = JSON.parse(raw) as {
      error?: { message?: unknown; code?: unknown; error_subcode?: unknown; type?: unknown };
    };
    const message = typeof parsed.error?.message === 'string'
      ? parsed.error.message
      : `HTTP ${response.status}`;
    const code = parsed.error?.code === undefined ? '' : ` code=${String(parsed.error.code)}`;
    const subcode = parsed.error?.error_subcode === undefined
      ? ''
      : ` subcode=${String(parsed.error.error_subcode)}`;
    const type = typeof parsed.error?.type === 'string' ? ` type=${parsed.error.type}` : '';
    return `${message}${code}${subcode}${type}`.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    if (!configured()) {
      return json(503, { error: 'instagram_business_discovery_not_configured' });
    }

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(50, Number(body.limit ?? 20)));
    const now = new Date();
    const nowIso = now.toISOString();
    const tokenExpiry = safeTokenExpiry();

    const { data: dueRows, error: dueError } = await supabase
      .from('instagram_business_source_state')
      .select('source_identity_id,username,next_check_at,last_media_id,consecutive_failures,gap_count')
      .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (dueError) throw dueError;
    if (!dueRows?.length) {
      return json(200, {
        due: 0,
        checked: 0,
        baselined: 0,
        itemsNew: 0,
        itemsChanged: 0,
      });
    }

    const ids = (dueRows as InstagramState[]).map((row) => row.source_identity_id);
    const { data: identities, error: identityError } = await supabase
      .from('source_identities')
      .select('id,poll_class,active,handle')
      .in('id', ids)
      .eq('active', true)
      .eq('platform', 'INSTAGRAM')
      .eq('connector_type', 'INSTAGRAM_BUSINESS_DISCOVERY')
      .eq('access_mode', 'API');
    if (identityError) throw identityError;
    const identityById = new Map<string, SourceIdentity>(
      (identities ?? []).map((row: SourceIdentity) => [row.id, row]),
    );

    let checked = 0;
    let baselined = 0;
    let itemsNew = 0;
    let itemsChanged = 0;
    let failed = 0;
    let rateLimited = 0;
    let gaps = 0;

    for (const state of dueRows as InstagramState[]) {
      const identity = identityById.get(state.source_identity_id);
      if (!identity) continue;
      const pollClass = asPollClass(identity.poll_class);

      let username: string;
      try {
        username = normalizeInstagramUsername(state.username);
        if (identity.handle && normalizeInstagramUsername(identity.handle) !== username) {
          throw new Error('instagram_state_handle_mismatch');
        }
      } catch (error) {
        failed += 1;
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_error_code: 'INSTAGRAM_INVALID_USERNAME',
          last_error_message: error instanceof Error ? error.message : 'Invalid Instagram username',
          parser_version: INSTAGRAM_CONNECTOR_VERSION,
          auth_expires_at: tokenExpiry,
        });
        continue;
      }

      const { data: run, error: runError } = await supabase.from('connector_runs').insert({
        source_identity_id: state.source_identity_id,
        connector_type: 'INSTAGRAM_BUSINESS_DISCOVERY',
        status: 'RUNNING',
        requests_made: 1,
        estimated_cost_microunits: 0,
      }).select('id').single();
      if (runError) throw runError;
      const runId = String(run.id);

      let response: Response;
      try {
        response = await fetch(buildInstagramBusinessDiscoveryUrl({
          apiVersion: graphApiVersion!,
          managedIgUserId: managedIgUserId!,
          targetUsername: username,
          limit: 50,
        }), {
          headers: {
            authorization: `Bearer ${instagramToken}`,
            accept: 'application/json',
            'user-agent': 'CineRelay/0.5 (+https://cinerelay-console.pages.dev)',
          },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        failed += 1;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextInstagramCheckAt({ now, pollClass, consecutiveFailures: failures });
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso,
          next_check_at: nextCheck,
          consecutive_failures: failures,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'DEGRADED',
          last_attempt_at: nowIso,
          next_due_at: nextCheck,
          consecutive_failures: failures,
          last_error_code: 'INSTAGRAM_FETCH_FAILED',
          last_error_message: error instanceof Error
            ? error.message.slice(0, 500)
            : 'Instagram request failed',
          parser_version: INSTAGRAM_CONNECTOR_VERSION,
          auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, {
          status: 'FAILED',
          finished_at: new Date().toISOString(),
          error_summary: 'instagram_fetch_failed',
        });
        continue;
      }

      checked += 1;
      const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'), now);

      if (response.status === 429) {
        rateLimited += 1;
        const seconds = retryAfterSeconds ?? 900;
        const until = new Date(now.getTime() + seconds * 1000).toISOString();
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso,
          last_http_status: 429,
          next_check_at: until,
          consecutive_failures: state.consecutive_failures + 1,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'RATE_LIMITED',
          last_attempt_at: nowIso,
          last_http_status: 429,
          rate_limited_until: until,
          next_due_at: until,
          consecutive_failures: state.consecutive_failures + 1,
          last_error_code: 'INSTAGRAM_RATE_LIMITED',
          last_error_message: `Instagram Graph API returned HTTP 429; retry after ${seconds}s`,
          parser_version: INSTAGRAM_CONNECTOR_VERSION,
          auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, {
          status: 'RATE_LIMITED',
          finished_at: new Date().toISOString(),
          error_summary: 'http_429',
        });
        continue;
      }

      if (!response.ok) {
        failed += 1;
        const message = await readApiError(response);
        const authFailure = response.status === 401 || response.status === 403;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextInstagramCheckAt({
          now,
          pollClass,
          consecutiveFailures: failures,
          retryAfterSeconds,
        });
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso,
          last_http_status: response.status,
          next_check_at: nextCheck,
          consecutive_failures: failures,
        });
        await updateHealth(state.source_identity_id, {
          health_state: authFailure ? 'AUTH_REQUIRED' : 'DEGRADED',
          last_attempt_at: nowIso,
          last_http_status: response.status,
          next_due_at: nextCheck,
          consecutive_failures: failures,
          last_error_code: authFailure
            ? 'INSTAGRAM_AUTH_ERROR'
            : 'INSTAGRAM_BUSINESS_DISCOVERY_HTTP_ERROR',
          last_error_message: message,
          parser_version: INSTAGRAM_CONNECTOR_VERSION,
          auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, {
          status: 'FAILED',
          finished_at: new Date().toISOString(),
          error_summary: `http_${response.status}`,
        });
        continue;
      }

      let profile;
      try {
        profile = parseInstagramBusinessDiscovery(await response.json(), username);
      } catch (error) {
        failed += 1;
        const failures = state.consecutive_failures + 1;
        const nextCheck = nextInstagramCheckAt({ now, pollClass, consecutiveFailures: failures });
        await patchState(state.source_identity_id, {
          last_checked_at: nowIso,
          last_http_status: response.status,
          next_check_at: nextCheck,
          consecutive_failures: failures,
        });
        await updateHealth(state.source_identity_id, {
          health_state: 'PARSER_BROKEN',
          last_attempt_at: nowIso,
          last_http_status: response.status,
          next_due_at: nextCheck,
          consecutive_failures: failures,
          last_error_code: 'INSTAGRAM_PARSE_ERROR',
          last_error_message: error instanceof Error
            ? error.message.slice(0, 500)
            : 'Instagram response parser failed',
          parser_version: INSTAGRAM_CONNECTOR_VERSION,
          auth_expires_at: tokenExpiry,
        });
        await updateRun(runId, {
          status: 'FAILED',
          finished_at: new Date().toISOString(),
          error_summary: 'instagram_parse_error',
        });
        continue;
      }

      const delta = planInstagramDelta(profile.media, state.last_media_id);
      let runNew = 0;
      let runChanged = 0;

      if (delta.baseline) {
        baselined += 1;
      } else {
        for (const media of [...delta.newMedia].reverse()) {
          const result = await upsertInstagramMedia({
            sourceIdentityId: state.source_identity_id,
            media,
            nowIso,
          });
          if (result === 'NEW') runNew += 1;
          if (result === 'CHANGED') runChanged += 1;
        }
      }

      itemsNew += runNew;
      itemsChanged += runChanged;
      if (delta.gapExceededWindow) gaps += 1;

      const nextCheck = nextInstagramCheckAt({ now, pollClass });
      await patchState(state.source_identity_id, {
        last_checked_at: nowIso,
        last_successful_fetch_at: nowIso,
        next_check_at: nextCheck,
        last_http_status: response.status,
        connector_version: INSTAGRAM_CONNECTOR_VERSION,
        last_media_id: delta.newestMediaId ?? state.last_media_id,
        consecutive_failures: 0,
        gap_count: state.gap_count + (delta.gapExceededWindow ? 1 : 0),
      });
      await updateHealth(state.source_identity_id, {
        health_state: delta.gapExceededWindow ? 'DEGRADED' : 'HEALTHY',
        last_attempt_at: nowIso,
        last_success_at: nowIso,
        last_item_at: profile.media[0]?.timestamp ?? undefined,
        next_due_at: nextCheck,
        consecutive_failures: 0,
        last_http_status: response.status,
        rate_limited_until: null,
        last_error_code: delta.gapExceededWindow ? 'INSTAGRAM_WINDOW_GAP' : null,
        last_error_message: delta.gapExceededWindow
          ? 'Previous Instagram media ID fell outside the fetched 50-item Business Discovery window; current window recovered'
          : null,
        parser_version: INSTAGRAM_CONNECTOR_VERSION,
        auth_expires_at: tokenExpiry,
      });
      await updateRun(runId, {
        status: 'SUCCEEDED',
        finished_at: new Date().toISOString(),
        items_seen: profile.media.length,
        items_new: runNew,
        items_changed: runChanged,
      });
    }

    return json(200, {
      due: dueRows.length,
      checked,
      baselined,
      itemsNew,
      itemsChanged,
      failed,
      rateLimited,
      gaps,
      connectorVersion: INSTAGRAM_CONNECTOR_VERSION,
    });
  } catch (error) {
    console.error('instagram-business-poll-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
