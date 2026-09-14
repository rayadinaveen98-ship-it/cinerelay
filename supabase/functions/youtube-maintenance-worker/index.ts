import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
if (!supabaseUrl || !serviceRoleKey || !internalSecret) throw new Error('Missing YouTube maintenance-worker environment');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const VERIFICATION_TIMEOUT_MS = 15 * 60 * 1000;

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

async function callSubscriptionAdmin(sourceIdentityId: string, action: 'renew'): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(`${supabaseUrl!.replace(/\/$/, '')}/functions/v1/youtube-subscription-admin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cinerelay-internal-key': internalSecret!,
    },
    body: JSON.stringify({ sourceIdentityId, action }),
  });
  return { ok: response.ok, status: response.status };
}

async function markHealth(sourceIdentityId: string, healthState: string, code: string | null, message: string | null): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('source_health').update({
    health_state: healthState,
    last_attempt_at: now,
    last_error_code: code,
    last_error_message: message,
    updated_at: now,
  }).eq('source_identity_id', sourceIdentityId).select('source_identity_id');
  if (error) throw error;
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('source_health').insert({
      source_identity_id: sourceIdentityId,
      health_state: healthState,
      last_attempt_at: now,
      last_error_code: code,
      last_error_message: message,
    });
    if (insertError) throw insertError;
  }
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (!authorized(request)) return json(401, { error: 'unauthorized' });
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 50)));
    const now = new Date();
    const nowIso = now.toISOString();
    const timeoutCutoff = new Date(now.getTime() - VERIFICATION_TIMEOUT_MS).toISOString();

    const { data: expiredRows, error: expiredError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .eq('state', 'ACTIVE')
      .lt('expires_at', nowIso)
      .limit(limit);
    if (expiredError) throw expiredError;

    for (const row of expiredRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      await supabase.from('connector_subscriptions').update({ state: 'EXPIRED', renew_after: null, last_error: 'lease expired before renewal activation' }).eq('id', (row as Record<string, unknown>).id);
      await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_LEASE_EXPIRED', 'WebSub lease expired before a replacement generation became active');
    }

    const { data: timedOutRows, error: timeoutError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation,state')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .in('state', ['PENDING', 'RENEWING'])
      .lt('requested_at', timeoutCutoff)
      .limit(limit);
    if (timeoutError) throw timeoutError;

    for (const row of timedOutRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      await supabase.from('connector_subscriptions').update({ state: 'ERROR', renew_after: null, last_error: 'hub verification timeout' }).eq('id', (row as Record<string, unknown>).id);
      await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_VERIFICATION_TIMEOUT', 'WebSub hub did not verify the requested generation within the timeout window');
    }

    const { data: inFlightRows, error: inFlightError } = await supabase
      .from('connector_subscriptions')
      .select('source_identity_id')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .in('state', ['PENDING', 'RENEWING'])
      .gte('requested_at', timeoutCutoff);
    if (inFlightError) throw inFlightError;
    const inFlightSources = new Set((inFlightRows ?? []).map((row: Record<string, unknown>) => String(row.source_identity_id)));

    const { data: dueRows, error: dueError } = await supabase
      .from('connector_subscriptions')
      .select('id,source_identity_id,generation,renew_after,expires_at')
      .eq('provider', 'YOUTUBE_WEBSUB')
      .eq('state', 'ACTIVE')
      .lte('renew_after', nowIso)
      .gt('expires_at', nowIso)
      .order('renew_after', { ascending: true })
      .limit(limit);
    if (dueError) throw dueError;

    let renewed = 0;
    let renewalFailures = 0;
    let skippedInFlight = 0;
    for (const row of dueRows ?? []) {
      const sourceIdentityId = String((row as Record<string, unknown>).source_identity_id);
      if (inFlightSources.has(sourceIdentityId)) {
        skippedInFlight += 1;
        continue;
      }
      const result = await callSubscriptionAdmin(sourceIdentityId, 'renew');
      if (result.ok) {
        renewed += 1;
      } else {
        renewalFailures += 1;
        await markHealth(sourceIdentityId, 'DEGRADED', 'WEBSUB_RENEW_REQUEST_FAILED', `Subscription admin returned ${result.status}`);
      }
    }

    return json(200, {
      expired: expiredRows?.length ?? 0,
      verificationTimeouts: timedOutRows?.length ?? 0,
      renewalDue: dueRows?.length ?? 0,
      renewed,
      renewalFailures,
      skippedInFlight,
    });
  } catch (error) {
    console.error('youtube-maintenance-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
