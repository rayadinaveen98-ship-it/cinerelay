import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalSecret = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');

if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
  throw new Error('Missing source-discovery-worker environment');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const WEB_DISCOVERY_PATHS = new Set(['news', 'newsroom', 'press', 'media', 'about', 'blog', 'updates']);
const BLOCKED_WEB_HOSTS = new Set([
  'bit.ly', 'bitly.ws', 'goo.gl', 'shorturl.at', 'tinyurl.com', 'lnk.to', 'smi.lnk.to',
  'youtu.be', 'play.google.com', 'apps.apple.com', 'itunes.apple.com', 'apple.co',
  'whatsapp.com', 'www.whatsapp.com', 'ig.me', 'schema.org', 'mojapp.in',
  'snapchat.com', 'www.snapchat.com', 'facebook.com', 'www.facebook.com',
  'fb.com', 'www.fb.com',
]);
const RESERVED_INSTAGRAM = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'direct']);
const RESERVED_X = new Set(['home', 'intent', 'share', 'search', 'explore', 'i', 'hashtag', 'settings', 'compose']);

type SourceRow = {
  id: string;
  display_name: string;
  authority_tier: number;
  source_role: string | null;
  territory: string | null;
  languages: string[];
};

type IdentityRow = {
  id: string;
  source_id: string;
  platform: string;
  canonical_url: string;
  handle: string | null;
  active: boolean;
};

type RawItemRow = {
  id: string;
  source_identity_id: string;
  canonical_url: string;
  raw_title: string | null;
  raw_text: string | null;
  first_seen_at: string;
};

type Candidate = {
  url: string;
  normalizedKey: string;
  kind: 'YOUTUBE_CHANNEL' | 'PUBLIC_WEB' | 'INSTAGRAM_PROFILE' | 'THREADS_PROFILE' | 'X_PROFILE';
  platform: string;
  identityKey: string;
  confidence: number;
  displayName: string;
};

type Proposal = {
  candidate: Candidate;
  rawItem: RawItemRow;
  originIdentity: IdentityRow;
  originSource: SourceRow;
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

function cleanRawUrl(value: string): string {
  return value.replace(/[\])}>.,;:!?]+$/g, '');
}

function genericUrlKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.protocol = 'https:';
    url.hash = '';
    url.username = '';
    url.password = '';
    url.hostname = url.hostname.toLowerCase();
    url.search = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

function classifyCandidate(rawValue: string): Candidate | null {
  try {
    const url = new URL(cleanRawUrl(rawValue));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;

    url.protocol = 'https:';
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    const host = url.hostname.replace(/^www\./, '');
    const segments = url.pathname.split('/').filter(Boolean);

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      let path: string | null = null;
      let identityKey: string | null = null;
      if (segments.length === 1 && /^@[A-Za-z0-9._-]{2,100}$/.test(segments[0])) {
        path = `/${segments[0]}`;
        identityKey = segments[0].toLowerCase();
      } else if (segments.length === 2 && segments[0] === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(segments[1])) {
        path = `/channel/${segments[1]}`;
        identityKey = segments[1];
      } else if (segments.length === 2 && ['user', 'c'].includes(segments[0]) && /^[A-Za-z0-9._-]{2,100}$/.test(segments[1])) {
        path = `/${segments[0]}/${segments[1]}`;
        identityKey = `${segments[0]}:${segments[1].toLowerCase()}`;
      }
      if (!path || !identityKey) return null;
      const normalized = `https://www.youtube.com${path}`;
      return {
        url: normalized,
        normalizedKey: genericUrlKey(normalized)!,
        kind: 'YOUTUBE_CHANNEL',
        platform: 'YOUTUBE',
        identityKey,
        confidence: 0.92,
        displayName: segments.at(-1) ?? 'YouTube channel',
      };
    }

    if (host === 'instagram.com') {
      if (segments.length !== 1) return null;
      const handle = segments[0].replace(/^@/, '');
      if (RESERVED_INSTAGRAM.has(handle.toLowerCase()) || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
      const normalized = `https://www.instagram.com/${handle}`;
      return {
        url: normalized,
        normalizedKey: genericUrlKey(normalized)!,
        kind: 'INSTAGRAM_PROFILE',
        platform: 'INSTAGRAM',
        identityKey: handle.toLowerCase(),
        confidence: 0.92,
        displayName: `@${handle}`,
      };
    }

    if (host === 'x.com' || host === 'twitter.com') {
      if (segments.length !== 1) return null;
      const handle = segments[0].replace(/^@/, '');
      if (RESERVED_X.has(handle.toLowerCase()) || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
      const normalized = `https://x.com/${handle}`;
      return {
        url: normalized,
        normalizedKey: genericUrlKey(normalized)!,
        kind: 'X_PROFILE',
        platform: 'X',
        identityKey: handle.toLowerCase(),
        confidence: 0.92,
        displayName: `@${handle}`,
      };
    }

    if (host === 'threads.net') {
      if (segments.length !== 1 || !segments[0].startsWith('@')) return null;
      const handle = segments[0].slice(1);
      if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
      const normalized = `https://www.threads.net/@${handle}`;
      return {
        url: normalized,
        normalizedKey: genericUrlKey(normalized)!,
        kind: 'THREADS_PROFILE',
        platform: 'THREADS',
        identityKey: handle.toLowerCase(),
        confidence: 0.92,
        displayName: `@${handle}`,
      };
    }

    if (BLOCKED_WEB_HOSTS.has(url.hostname) || BLOCKED_WEB_HOSTS.has(host)) return null;
    if (host === 'youtube.com' || host === 'instagram.com' || host === 'x.com' || host === 'twitter.com' || host === 'threads.net') return null;
    if (host === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;

    let normalizedPath = '';
    if (segments.length === 0) {
      normalizedPath = '';
    } else if (segments.length <= 2 && WEB_DISCOVERY_PATHS.has(segments.at(-1)!.toLowerCase())) {
      normalizedPath = `/${segments.join('/')}`;
    } else {
      return null;
    }
    const normalized = `https://${url.hostname}${normalizedPath}`;
    return {
      url: normalized,
      normalizedKey: genericUrlKey(normalized)!,
      kind: 'PUBLIC_WEB',
      platform: 'WEB',
      identityKey: `${host}${normalizedPath}`.toLowerCase(),
      confidence: normalizedPath ? 0.84 : 0.86,
      displayName: host,
    };
  } catch {
    return null;
  }
}

async function submitProposal(item: Proposal): Promise<boolean> {
  const { candidate, rawItem, originIdentity, originSource } = item;
  const note = `P7.2 officiality proposal: ${originSource.display_name} (Tier A) linked this destination from an official ${originIdentity.platform} item. Suggested owner: ${originSource.display_name}. Proposal only; operator approval is required.`;
  const { error } = await supabase.rpc('submit_source_discovery_candidate', {
    p_candidate_url: candidate.url,
    p_normalized_url: candidate.url,
    p_candidate_kind: candidate.kind,
    p_discovery_method: 'OFFICIAL_LINK',
    p_display_name: `${originSource.display_name} · ${candidate.displayName}`.slice(0, 200),
    p_discovered_from_source_identity_id: originIdentity.id,
    p_proposed_source_role: originSource.source_role,
    p_territory: originSource.territory,
    p_languages: originSource.languages ?? [],
    p_confidence: candidate.confidence,
    p_metadata: {
      discoveryVersion: 'p7.2-direct-link-v1',
      platform: candidate.platform,
      platformIdentityKey: candidate.identityKey,
      suggestedOwnerSourceId: originSource.id,
      suggestedOwnerSourceName: originSource.display_name,
      trustMutation: 'PROPOSAL_ONLY',
    },
    p_evidence_type: 'OFFICIAL_LINK',
    p_evidence_url: rawItem.canonical_url,
    p_evidence_note: note,
    p_evidence_metadata: {
      rawItemId: rawItem.id,
      rawItemFirstSeenAt: rawItem.first_seen_at,
      originSourceId: originSource.id,
      originSourceIdentityId: originIdentity.id,
      originSourceName: originSource.display_name,
      originAuthorityTier: originSource.authority_tier,
      originPlatform: originIdentity.platform,
      discoveredUrl: candidate.url,
      proposalVersion: 'p7.2-official-link-v1',
    },
  });
  if (error) throw error;
  return true;
}

async function runDiscovery(limit: number, lookbackMinutes: number) {
  const { data: sourceRows, error: sourceError } = await supabase.from('sources')
    .select('id,display_name,authority_tier,source_role,territory,languages')
    .eq('authority_tier', 1)
    .eq('active', true);
  if (sourceError) throw sourceError;
  const sources = (sourceRows ?? []) as SourceRow[];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const sourceIds = sources.map((source) => source.id);
  if (sourceIds.length === 0) return { scanned: 0, eligible: 0, submitted: 0, knownMatches: 0, proposalRefresh: null };

  const { data: allIdentityRows, error: allIdentityError } = await supabase.from('source_identities')
    .select('id,source_id,platform,canonical_url,handle,active')
    .eq('active', true);
  if (allIdentityError) throw allIdentityError;
  const allIdentities = (allIdentityRows ?? []) as IdentityRow[];
  const originIdentities = allIdentities.filter((identity) => sourceMap.has(identity.source_id));
  const originIdentityMap = new Map(originIdentities.map((identity) => [identity.id, identity]));
  const originIdentityIds = originIdentities.map((identity) => identity.id);

  const knownKeys = new Set<string>();
  for (const identity of allIdentities) {
    const generic = genericUrlKey(identity.canonical_url);
    if (generic) knownKeys.add(generic);
    const classified = classifyCandidate(identity.canonical_url);
    if (classified) knownKeys.add(classified.normalizedKey);
  }

  const since = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
  const { data: rawRows, error: rawError } = await supabase.from('raw_items')
    .select('id,source_identity_id,canonical_url,raw_title,raw_text,first_seen_at')
    .in('source_identity_id', originIdentityIds)
    .gte('first_seen_at', since)
    .order('first_seen_at', { ascending: false })
    .limit(limit);
  if (rawError) throw rawError;
  const rawItems = (rawRows ?? []) as RawItemRow[];

  const seenCandidates = new Set<string>();
  const proposals: Proposal[] = [];
  let knownMatches = 0;
  const maxCandidates = Math.min(80, Math.max(10, Math.ceil(limit / 3)));

  outer:
  for (const rawItem of rawItems) {
    const originIdentity = originIdentityMap.get(rawItem.source_identity_id);
    if (!originIdentity) continue;
    const originSource = sourceMap.get(originIdentity.source_id);
    if (!originSource) continue;
    const text = `${rawItem.raw_title ?? ''}\n${rawItem.raw_text ?? ''}`;
    const urls = text.match(URL_PATTERN)?.slice(0, 40) ?? [];
    for (const rawUrl of urls) {
      const candidate = classifyCandidate(rawUrl);
      if (!candidate) continue;
      if (knownKeys.has(candidate.normalizedKey)) {
        knownMatches += 1;
        continue;
      }
      if (seenCandidates.has(candidate.normalizedKey)) continue;
      seenCandidates.add(candidate.normalizedKey);
      proposals.push({ candidate, rawItem, originIdentity, originSource });
      if (proposals.length >= maxCandidates) break outer;
    }
  }

  let submitted = 0;
  for (let index = 0; index < proposals.length; index += 8) {
    const batch = proposals.slice(index, index + 8);
    const results = await Promise.all(batch.map((proposal) => submitProposal(proposal)));
    submitted += results.filter(Boolean).length;
  }

  const { data: proposalRefresh, error: refreshError } = await supabase.rpc('refresh_source_officiality_proposals', {
    p_now: new Date().toISOString(),
  });
  if (refreshError) throw refreshError;

  return {
    scanned: rawItems.length,
    eligible: proposals.length,
    submitted,
    knownMatches,
    proposalRefresh,
  };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    if (!authorized(request)) return json(401, { error: 'unauthorized' });

    const body = await request.json().catch(() => ({})) as { limit?: unknown; lookbackMinutes?: unknown };
    const parsedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : 250;
    const parsedLookback = typeof body.lookbackMinutes === 'number' && Number.isFinite(body.lookbackMinutes)
      ? Math.floor(body.lookbackMinutes)
      : 360;
    const limit = Math.max(25, Math.min(parsedLimit, 1000));
    const lookbackMinutes = Math.max(30, Math.min(parsedLookback, 20_160));

    const result = await runDiscovery(limit, lookbackMinutes);
    return json(200, { ok: true, limit, lookbackMinutes, ...result });
  } catch (error) {
    console.error('source-discovery-worker failure', error);
    return json(500, { error: 'internal_error' });
  }
});
