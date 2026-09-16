export const INSTAGRAM_CONNECTOR_VERSION = 'instagram-business-discovery-v1';
export const INSTAGRAM_GRAPH_BASE = 'https://graph.facebook.com';

export type PollClass = 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

export type InstagramMedia = {
  id: string;
  username: string;
  permalink: string;
  timestamp: string | null;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
};

export type InstagramBusinessProfile = {
  id: string | null;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  media: InstagramMedia[];
};

export type InstagramDeltaPlan = {
  baseline: boolean;
  newestMediaId: string | null;
  newMedia: InstagramMedia[];
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

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseTimestamp(value: unknown): string | null {
  const raw = stringOrNull(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeInstagramUsername(value: string): string {
  const normalized = value.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(normalized)) throw new Error('invalid_instagram_username');
  return normalized;
}

export function normalizeGraphApiVersion(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^v\d+\.\d+$/.test(normalized)) throw new Error('invalid_instagram_graph_api_version');
  return normalized;
}

export function buildInstagramBusinessDiscoveryUrl(input: {
  apiVersion: string;
  managedIgUserId: string;
  targetUsername: string;
  limit?: number;
}): string {
  const apiVersion = normalizeGraphApiVersion(input.apiVersion);
  const managedIgUserId = input.managedIgUserId.trim();
  if (!/^\d{5,32}$/.test(managedIgUserId)) throw new Error('invalid_instagram_managed_ig_user_id');
  const username = normalizeInstagramUsername(input.targetUsername);
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 50)));
  const mediaFields = [
    'id',
    'caption',
    'media_type',
    'permalink',
    'timestamp',
    'thumbnail_url',
  ].join(',');
  const profileFields = [
    'id',
    'username',
    'name',
    'biography',
    'website',
    'profile_picture_url',
    'followers_count',
    'follows_count',
    'media_count',
    `media.limit(${limit}){${mediaFields}}`,
  ].join(',');
  const url = new URL(`/${apiVersion}/${managedIgUserId}`, INSTAGRAM_GRAPH_BASE);
  url.searchParams.set('fields', `business_discovery.username(${username}){${profileFields}}`);
  return url.toString();
}

export function parseInstagramBusinessDiscovery(
  payload: unknown,
  expectedUsername: string,
): InstagramBusinessProfile {
  const root = asRecord(payload);
  const business = root ? asRecord(root.business_discovery) : null;
  if (!business) throw new Error('invalid_instagram_business_discovery_payload');
  const usernameRaw = stringOrNull(business.username);
  if (!usernameRaw) throw new Error('instagram_business_discovery_missing_username');
  const username = normalizeInstagramUsername(usernameRaw);
  if (username !== normalizeInstagramUsername(expectedUsername)) {
    throw new Error('instagram_business_discovery_username_mismatch');
  }

  const mediaRoot = asRecord(business.media);
  const candidates = mediaRoot && Array.isArray(mediaRoot.data) ? mediaRoot.data : [];
  const media: InstagramMedia[] = [];

  for (const candidate of candidates) {
    const row = asRecord(candidate);
    if (!row) continue;
    const id = stringOrNull(row.id);
    const permalink = stringOrNull(row.permalink);
    if (!id || !permalink) continue;
    if (!/^https:\/\/(www\.)?instagram\.com\//i.test(permalink)) {
      throw new Error('instagram_permalink_must_be_instagram_https');
    }
    media.push({
      id,
      username,
      permalink,
      timestamp: parseTimestamp(row.timestamp),
      caption: stringOrNull(row.caption),
      mediaType: stringOrNull(row.media_type),
      thumbnailUrl: stringOrNull(row.thumbnail_url),
    });
  }

  const deduped = new Map<string, InstagramMedia>();
  for (const item of media) if (!deduped.has(item.id)) deduped.set(item.id, item);
  const sorted = [...deduped.values()].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });

  return {
    id: stringOrNull(business.id),
    username,
    name: stringOrNull(business.name),
    biography: stringOrNull(business.biography),
    website: stringOrNull(business.website),
    profilePictureUrl: stringOrNull(business.profile_picture_url),
    followersCount: numberOrNull(business.followers_count),
    followsCount: numberOrNull(business.follows_count),
    mediaCount: numberOrNull(business.media_count),
    media: sorted,
  };
}

export function planInstagramDelta(
  media: InstagramMedia[],
  lastMediaId: string | null,
): InstagramDeltaPlan {
  const newestMediaId = media[0]?.id ?? null;
  if (!lastMediaId) {
    return { baseline: true, newestMediaId, newMedia: [], gapExceededWindow: false };
  }
  const previousIndex = media.findIndex((item) => item.id === lastMediaId);
  if (previousIndex >= 0) {
    return {
      baseline: false,
      newestMediaId,
      newMedia: media.slice(0, previousIndex),
      gapExceededWindow: false,
    };
  }
  return {
    baseline: false,
    newestMediaId,
    newMedia: media,
    gapExceededWindow: media.length > 0,
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

export function nextInstagramCheckAt(input: {
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
