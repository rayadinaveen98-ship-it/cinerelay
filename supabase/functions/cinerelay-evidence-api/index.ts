import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay evidence API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_EVENT_STATUSES = ['ACTIVE', 'NEEDS_REVIEW'];

type AuthenticatedUser = { id: string; email: string | null };
type EvidenceRow = {
  raw_item_id: string;
  evidence_role: string;
  weight: number | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function optionalUser(request: Request): Promise<AuthenticatedUser | null | Response> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'invalid_session' });
  return { id: data.user.id, email: data.user.email ?? null };
}

function evidenceRank(role: string): number {
  if (role === 'PRIMARY') return 0;
  if (role === 'CORROBORATING') return 1;
  if (role === 'REPEAT') return 2;
  if (role === 'CONFLICTING') return 3;
  return 4;
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });

    const maybeUser = await optionalUser(request);
    if (maybeUser instanceof Response) return maybeUser;

    const body = await request.json().catch(() => ({})) as { eventId?: unknown };
    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
    if (!UUID_PATTERN.test(eventId)) return json(400, { error: 'invalid_event_id' });

    const { data: event, error: eventError } = await admin
      .from('events')
      .select('id,headline,verification_state,status,primary_entity_id,detected_at')
      .eq('id', eventId)
      .in('status', ACTIVE_EVENT_STATUSES)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json(404, { error: 'event_not_available' });

    const { data: evidenceRows, error: evidenceError } = await admin
      .from('event_evidence')
      .select('raw_item_id,evidence_role,weight')
      .eq('event_id', eventId);
    if (evidenceError) throw evidenceError;

    const evidence = (evidenceRows ?? []) as EvidenceRow[];
    if (!evidence.length) {
      return json(200, {
        generatedAt: new Date().toISOString(),
        guest: maybeUser === null,
        event: {
          id: event.id,
          headline: event.headline,
          verificationState: event.verification_state,
          detectedAt: event.detected_at,
        },
        evidenceCount: 0,
        conflictingEvidenceCount: 0,
        items: [],
      });
    }

    const rawIds = [...new Set(evidence.map((row) => row.raw_item_id).filter(Boolean))];
    const { data: raws, error: rawError } = await admin
      .from('raw_items')
      .select('id,source_identity_id,canonical_url,raw_title,published_at,received_at')
      .in('id', rawIds);
    if (rawError) throw rawError;

    const rawRows = raws ?? [];
    const identityIds = [...new Set(rawRows.map((row) => row.source_identity_id).filter(Boolean))];
    const identityResult = identityIds.length
      ? await admin.from('source_identities').select('id,source_id,platform,handle').in('id', identityIds)
      : { data: [], error: null };
    if (identityResult.error) throw identityResult.error;

    const identities = identityResult.data ?? [];
    const sourceIds = [...new Set(identities.map((row) => row.source_id).filter(Boolean))];
    const sourceResult = sourceIds.length
      ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
      : { data: [], error: null };
    if (sourceResult.error) throw sourceResult.error;

    const rawMap = new Map(rawRows.map((row) => [row.id, row]));
    const identityMap = new Map(identities.map((row) => [row.id, row]));
    const sourceMap = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));

    const items = evidence
      .map((row) => {
        const raw = rawMap.get(row.raw_item_id);
        const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
        const source = identity ? sourceMap.get(identity.source_id) : undefined;
        return {
          rawItemId: row.raw_item_id,
          role: row.evidence_role,
          weight: row.weight ?? 0,
          sourceName: source?.display_name ?? null,
          authorityTier: source?.authority_tier ?? null,
          sourceRole: source?.source_role ?? null,
          platform: identity?.platform ?? null,
          handle: identity?.handle ?? null,
          title: raw?.raw_title ?? null,
          canonicalUrl: raw?.canonical_url ?? null,
          publishedAt: raw?.published_at ?? null,
          receivedAt: raw?.received_at ?? null,
        };
      })
      .sort((left, right) => {
        const roleDelta = evidenceRank(String(left.role)) - evidenceRank(String(right.role));
        if (roleDelta !== 0) return roleDelta;
        const weightDelta = Number(right.weight ?? 0) - Number(left.weight ?? 0);
        if (weightDelta !== 0) return weightDelta;
        return String(right.publishedAt ?? right.receivedAt ?? '').localeCompare(String(left.publishedAt ?? left.receivedAt ?? ''));
      });

    return json(200, {
      generatedAt: new Date().toISOString(),
      guest: maybeUser === null,
      event: {
        id: event.id,
        headline: event.headline,
        verificationState: event.verification_state,
        detectedAt: event.detected_at,
      },
      evidenceCount: items.length,
      conflictingEvidenceCount: items.filter((item) => item.role === 'CONFLICTING').length,
      items,
    });
  } catch (error) {
    console.error('cinerelay-evidence-api failure', error);
    return json(500, { error: 'internal_error' });
  }
});
