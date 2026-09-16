import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay public-page onboarding environment');

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
const POLL_CLASSES = new Set(['NORMAL_60M', 'COLD_6H', 'DAILY']);
const ORDERS = new Set(['NEWEST_FIRST', 'OLDEST_FIRST']);

type OperatorAuth =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function requireOperator(request: Request): Promise<OperatorAuth> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };

  const { data: operator, error } = await admin.from('operator_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, userId: user.id };
}

function boundedString(value: unknown, max: number, errorCode: string, required = false): string | undefined {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(errorCode);
    return undefined;
  }
  if (typeof value !== 'string') throw new Error(errorCode);
  const text = value.trim();
  if (!text || text.length > max) throw new Error(errorCode);
  return text;
}

function boundedInteger(value: unknown, min: number, max: number, errorCode: string, fallback?: number): number | undefined {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(errorCode);
  return number;
}

function parserProfileOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('public_page_parser_profile_must_be_object');
  const input = value as Record<string, unknown>;
  const maxItems = boundedInteger(input.maxItems, 1, 100, 'public_page_max_items_invalid', 50)!;
  const minItems = boundedInteger(input.minItems, 1, maxItems, 'public_page_min_items_invalid', 1)!;
  const order = input.order === undefined ? 'NEWEST_FIRST' : boundedString(input.order, 20, 'public_page_order_invalid', true)!;
  if (!ORDERS.has(order)) throw new Error('public_page_order_invalid');

  const profile: Record<string, unknown> = {
    profileVersion: boundedString(input.profileVersion, 100, 'public_page_profile_version_invalid', true),
    itemSelector: boundedString(input.itemSelector, 500, 'public_page_item_selector_invalid', true),
    linkSelector: boundedString(input.linkSelector, 500, 'public_page_link_selector_invalid', true),
    maxItems,
    minItems,
    order,
  };

  const optionalSelectors = ['titleSelector', 'summarySelector', 'dateSelector', 'authorSelector'] as const;
  for (const key of optionalSelectors) {
    const text = boundedString(input[key], 500, 'public_page_optional_selector_invalid');
    if (text !== undefined) profile[key] = text;
  }
  const optionalAttributes = ['dateAttribute', 'itemIdAttribute', 'linkAttribute'] as const;
  for (const key of optionalAttributes) {
    const text = boundedString(input[key], 120, 'public_page_attribute_invalid');
    if (text !== undefined) profile[key] = text;
  }
  const include = boundedString(input.includeUrlPattern, 300, 'public_page_include_pattern_invalid');
  const exclude = boundedString(input.excludeUrlPattern, 300, 'public_page_exclude_pattern_invalid');
  if (include !== undefined) profile.includeUrlPattern = include;
  if (exclude !== undefined) profile.excludeUrlPattern = exclude;

  return profile;
}

function reasonOf(value: unknown): string {
  const reason = boundedString(value, 500, 'valid_reason_required', true)!;
  if (reason.length < 3) throw new Error('valid_reason_required');
  return reason;
}

async function promote(actorId: string, body: Record<string, unknown>) {
  if (typeof body.candidateId !== 'string' || !UUID_PATTERN.test(body.candidateId)) throw new Error('invalid_candidate_id');
  const authorityTier = Number(body.authorityTier);
  if (![3, 4, 5].includes(authorityTier)) throw new Error('public_page_authority_tier_must_be_3_4_or_5');
  const pollClass = typeof body.pollClass === 'string' ? body.pollClass.trim().toUpperCase() : 'NORMAL_60M';
  if (!POLL_CLASSES.has(pollClass)) throw new Error('invalid_public_page_poll_class');
  const parserProfile = parserProfileOf(body.parserProfile);
  const reason = reasonOf(body.reason);

  const { data, error } = await admin.rpc('operator_promote_selected_public_page_candidate', {
    p_actor_id: actorId,
    p_candidate_id: body.candidateId,
    p_authority_tier: authorityTier,
    p_poll_class: pollClass,
    p_parser_profile: parserProfile,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action !== 'promote') return json(400, { error: 'unsupported_action' });
    return json(200, { ok: true, result: await promote(auth.userId, body) });
  } catch (error) {
    console.error('cinerelay-public-page-onboarding-api failure', error);
    const message = error instanceof Error ? error.message : 'public_page_onboarding_failed';
    return json(400, { error: 'public_page_onboarding_failed', message });
  }
});
