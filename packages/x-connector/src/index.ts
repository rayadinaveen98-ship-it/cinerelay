export const X_CONNECTOR_VERSION = 'x-api-v2-profile-v1';
export const X_API_BASE = 'https://api.x.com/2';
export const X_TWEET_FIELDS = [
  'id',
  'text',
  'author_id',
  'created_at',
  'lang',
  'possibly_sensitive',
  'referenced_tweets',
  'attachments',
  'entities',
].join(',');
export const X_MEDIA_FIELDS = ['media_key', 'type', 'url', 'preview_image_url', 'alt_text'].join(',');

export type PollClass = 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

export type XUser = {
  id: string;
  username: string;
  name: string | null;
  verified: boolean;
  verifiedType: string | null;
};

export type XPost = {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: string | null;
  lang: string | null;
  canonicalUrl: string;
  possiblySensitive: boolean;
  isReply: boolean;
  isRepost: boolean;
  mediaKeys: string[];
};

export type XDeltaPlan = {
  baseline: boolean;
  newestPostId: string | null;
  newPosts: XPost[];
  gapExceededWindow: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseTimestamp(value: unknown): string | null {
  const raw = stringOrNull(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeXUsername(value: string): string {
  const normalized = value.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) throw new Error('invalid_x_username');
  return normalized;
}

export function normalizeXUserId(value: string): string {
  const normalized = value.trim();
  if (!/^\d{1,32}$/.test(normalized)) throw new Error('invalid_x_user_id');
  return normalized;
}

export function buildXUserLookupUrl(username: string): string {
  const normalized = normalizeXUsername(username);
  const url = new URL(`/2/users/by/username/${encodeURIComponent(normalized)}`, 'https://api.x.com');
  url.searchParams.set('user.fields', 'id,name,username,verified,verified_type');
  return url.toString();
}

export function buildXUserPostsUrl(input: {
  userId: string;
  sinceId?: string | null;
  maxResults?: number;
  paginationToken?: string | null;
}): string {
  const userId = normalizeXUserId(input.userId);
  const url = new URL(`/2/users/${userId}/tweets`, 'https://api.x.com');
  url.searchParams.set('max_results', String(Math.max(5, Math.min(100, Math.trunc(input.maxResults ?? 100)))));
  url.searchParams.set('exclude', 'replies,retweets');
  url.searchParams.set('tweet.fields', X_TWEET_FIELDS);
  url.searchParams.set('expansions', 'attachments.media_keys');
  url.searchParams.set('media.fields', X_MEDIA_FIELDS);
  if (input.sinceId) url.searchParams.set('since_id', input.sinceId.trim());
  if (input.paginationToken) url.searchParams.set('pagination_token', input.paginationToken.trim());
  return url.toString();
}

export function parseXUserLookup(payload: unknown, expectedUsername?: string): XUser {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  if (!data) throw new Error('invalid_x_user_lookup_payload');
  const id = stringOrNull(data.id);
  const usernameRaw = stringOrNull(data.username);
  if (!id || !usernameRaw) throw new Error('invalid_x_user_lookup_payload');
  normalizeXUserId(id);
  const username = normalizeXUsername(usernameRaw);
  if (expectedUsername && username !== normalizeXUsername(expectedUsername)) {
    throw new Error('x_username_mismatch');
  }
  return {
    id,
    username,
    name: stringOrNull(data.name),
    verified: data.verified === true,
    verifiedType: stringOrNull(data.verified_type),
  };
}

function referencedKinds(value: unknown): Set<string> {
  const kinds = new Set<string>();
  if (!Array.isArray(value)) return kinds;
  for (const candidate of value) {
    const row = asRecord(candidate);
    const type = stringOrNull(row?.type);
    if (type) kinds.add(type.toLowerCase());
  }
  return kinds;
}

export function parseXUserPosts(payload: unknown, username: string, expectedUserId?: string): XPost[] {
  const root = asRecord(payload);
  if (!root || (!Array.isArray(root.data) && root.data !== undefined)) throw new Error('invalid_x_user_posts_payload');
  const normalizedUsername = normalizeXUsername(username);
  const authorId = expectedUserId ? normalizeXUserId(expectedUserId) : null;
  const posts: XPost[] = [];

  for (const candidate of Array.isArray(root.data) ? root.data : []) {
    const row = asRecord(candidate);
    if (!row) continue;
    const id = stringOrNull(row.id);
    const text = stringOrNull(row.text);
    if (!id || text === null) continue;
    normalizeXUserId(id);
    const rowAuthorId = stringOrNull(row.author_id);
    if (rowAuthorId) normalizeXUserId(rowAuthorId);
    if (authorId && rowAuthorId && rowAuthorId !== authorId) throw new Error('x_author_id_mismatch');

    const kinds = referencedKinds(row.referenced_tweets);
    const attachments = asRecord(row.attachments);
    const mediaKeys = Array.isArray(attachments?.media_keys)
      ? attachments!.media_keys.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];

    posts.push({
      id,
      authorId: rowAuthorId,
      text,
      createdAt: parseTimestamp(row.created_at),
      lang: stringOrNull(row.lang),
      canonicalUrl: `https://x.com/${normalizedUsername}/status/${id}`,
      possiblySensitive: row.possibly_sensitive === true,
      isReply: kinds.has('replied_to'),
      isRepost: kinds.has('retweeted'),
      mediaKeys,
    });
  }

  const deduped = new Map<string, XPost>();
  for (const post of posts) if (!deduped.has(post.id)) deduped.set(post.id, post);
  return [...deduped.values()].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    try {
      const delta = BigInt(b.id) - BigInt(a.id);
      return delta > 0n ? 1 : delta < 0n ? -1 : 0;
    } catch {
      return b.id.localeCompare(a.id);
    }
  });
}

export function originalXPosts(posts: XPost[]): XPost[] {
  return posts.filter((post) => !post.isReply && !post.isRepost);
}

export function planXDelta(posts: XPost[], lastPostId: string | null): XDeltaPlan {
  const original = originalXPosts(posts);
  const newestPostId = original[0]?.id ?? null;
  if (!lastPostId) return { baseline: true, newestPostId, newPosts: [], gapExceededWindow: false };
  const previousIndex = original.findIndex((post) => post.id === lastPostId);
  if (previousIndex >= 0) {
    return { baseline: false, newestPostId, newPosts: original.slice(0, previousIndex), gapExceededWindow: false };
  }
  return { baseline: false, newestPostId, newPosts: original, gapExceededWindow: original.length > 0 };
}

export function pollIntervalMs(pollClass: PollClass): number {
  switch (pollClass) {
    case 'HOT_5M': return 5 * 60_000;
    case 'ACTIVE_15M': return 15 * 60_000;
    case 'NORMAL_60M': return 60 * 60_000;
    case 'COLD_6H': return 6 * 60 * 60_000;
    case 'DAILY': return 24 * 60 * 60_000;
  }
}

export function parseRetryAfterSeconds(value: string | null, now = new Date()): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - now.getTime()) / 1000));
}

export function parseRateLimitResetSeconds(value: string | null, now = new Date()): number | null {
  if (!value) return null;
  const epochSeconds = Number(value);
  if (!Number.isFinite(epochSeconds) || epochSeconds < 0) return null;
  return Math.max(0, Math.ceil(epochSeconds - now.getTime() / 1000));
}

export function nextXCheckAt(input: {
  now: Date;
  pollClass: PollClass;
  consecutiveFailures?: number;
  retryAfterSeconds?: number | null;
  rateLimitResetSeconds?: number | null;
}): string {
  const providerDelay = Math.max(input.retryAfterSeconds ?? 0, input.rateLimitResetSeconds ?? 0);
  if (providerDelay > 0) return new Date(input.now.getTime() + providerDelay * 1000).toISOString();
  const failures = Math.max(0, Math.trunc(input.consecutiveFailures ?? 0));
  const multiplier = Math.min(16, 2 ** failures);
  return new Date(input.now.getTime() + pollIntervalMs(input.pollClass) * multiplier).toISOString();
}
