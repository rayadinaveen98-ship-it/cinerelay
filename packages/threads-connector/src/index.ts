export const THREADS_CONNECTOR_VERSION = 'threads-profile-v1';
export const THREADS_API_BASE = 'https://graph.threads.net';
export const THREADS_POST_FIELDS = [
  'id',
  'media_product_type',
  'media_type',
  'permalink',
  'username',
  'text',
  'timestamp',
  'shortcode',
  'is_quote_post',
  'has_replies',
  'alt_text',
  'link_attachment_url',
  'topic_tag',
].join(',');

export type PollClass = 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

export type ThreadsPost = {
  id: string;
  username: string;
  permalink: string;
  timestamp: string | null;
  text: string | null;
  mediaType: string | null;
  shortcode: string | null;
  isQuotePost: boolean;
  hasReplies: boolean;
  altText: string | null;
  linkAttachmentUrl: string | null;
  topicTag: string | null;
};

export type ThreadsDeltaPlan = {
  baseline: boolean;
  newestPostId: string | null;
  newPosts: ThreadsPost[];
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

export function normalizeThreadsUsername(value: string): string {
  const normalized = value.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,64}$/.test(normalized)) throw new Error('invalid_threads_username');
  return normalized;
}

export function buildThreadsProfilePostsUrl(username: string, limit = 50): string {
  const normalized = normalizeThreadsUsername(username);
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const url = new URL('/profile_posts', THREADS_API_BASE);
  url.searchParams.set('username', normalized);
  url.searchParams.set('fields', THREADS_POST_FIELDS);
  url.searchParams.set('limit', String(boundedLimit));
  return url.toString();
}

export function parseThreadsProfilePosts(payload: unknown, expectedUsername?: string): ThreadsPost[] {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.data)) throw new Error('invalid_threads_profile_posts_payload');
  const expected = expectedUsername ? normalizeThreadsUsername(expectedUsername) : null;
  const posts: ThreadsPost[] = [];

  for (const candidate of root.data) {
    const row = asRecord(candidate);
    if (!row) continue;
    const id = stringOrNull(row.id);
    const usernameRaw = stringOrNull(row.username);
    const permalink = stringOrNull(row.permalink);
    if (!id || !usernameRaw || !permalink) continue;
    const username = normalizeThreadsUsername(usernameRaw);
    if (expected && username !== expected) throw new Error('threads_profile_username_mismatch');
    if (!/^https:\/\//i.test(permalink)) throw new Error('threads_permalink_must_be_https');

    posts.push({
      id,
      username,
      permalink,
      timestamp: parseTimestamp(row.timestamp),
      text: stringOrNull(row.text),
      mediaType: stringOrNull(row.media_type),
      shortcode: stringOrNull(row.shortcode),
      isQuotePost: row.is_quote_post === true,
      hasReplies: row.has_replies === true,
      altText: stringOrNull(row.alt_text),
      linkAttachmentUrl: stringOrNull(row.link_attachment_url),
      topicTag: stringOrNull(row.topic_tag),
    });
  }

  const deduped = new Map<string, ThreadsPost>();
  for (const post of posts) if (!deduped.has(post.id)) deduped.set(post.id, post);
  return [...deduped.values()].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });
}

export function planThreadsDelta(posts: ThreadsPost[], lastPostId: string | null): ThreadsDeltaPlan {
  const newestPostId = posts[0]?.id ?? null;
  if (!lastPostId) {
    return { baseline: true, newestPostId, newPosts: [], gapExceededWindow: false };
  }
  const previousIndex = posts.findIndex((post) => post.id === lastPostId);
  if (previousIndex >= 0) {
    return {
      baseline: false,
      newestPostId,
      newPosts: posts.slice(0, previousIndex),
      gapExceededWindow: false,
    };
  }
  return {
    baseline: false,
    newestPostId,
    newPosts: posts,
    gapExceededWindow: posts.length > 0,
  };
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
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

export function nextThreadsCheckAt(input: {
  now: Date;
  pollClass: PollClass;
  consecutiveFailures?: number;
  retryAfterSeconds?: number | null;
}): string {
  const { now, pollClass } = input;
  if (input.retryAfterSeconds !== null && input.retryAfterSeconds !== undefined) {
    return new Date(now.getTime() + Math.max(0, input.retryAfterSeconds) * 1000).toISOString();
  }
  const failures = Math.max(0, Math.trunc(input.consecutiveFailures ?? 0));
  const base = pollIntervalMs(pollClass);
  const multiplier = Math.min(16, 2 ** failures);
  return new Date(now.getTime() + base * multiplier).toISOString();
}
