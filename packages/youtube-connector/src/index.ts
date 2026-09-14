export const YOUTUBE_WEBSUB_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
export const YOUTUBE_FEED_BASE_URL = 'https://www.youtube.com/feeds/videos.xml';
export const YOUTUBE_DATA_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_WEBSUB_PROVIDER = 'YOUTUBE_WEBSUB';

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CHALLENGE_PATTERN = /^[+\-./0-9=A-Z_a-z]+$/;
const MAX_CHALLENGE_LENGTH = 4096;
const MAX_NOTIFICATION_BYTES = 1_048_576;

export type WebSubMode = 'subscribe' | 'unsubscribe';

export type WebSubVerification = {
  mode: WebSubMode;
  topic: string;
  challenge: string;
  leaseSeconds?: number;
};

export type YouTubeNotification = {
  videoId: string;
  channelId: string;
  title: string;
  watchUrl: string;
  authorName?: string;
  publishedAt?: string;
  updatedAt?: string;
};

export type YouTubeVideoSnapshot = {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt?: string;
  liveBroadcastContent?: string;
  duration?: string;
  privacyStatus?: string;
  embeddable?: boolean;
  license?: string;
  thumbnailUrl?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  concurrentViewers?: string;
};

export type YouTubeChannelSnapshot = {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  uploadsPlaylistId?: string;
  thumbnailUrl?: string;
};

export type QuotaDecision = {
  allowed: boolean;
  remainingBefore: number;
  remainingAfter: number;
  reason: 'OK' | 'HARD_LIMIT' | 'RESERVE_GUARD';
};

export const YOUTUBE_QUOTA_POLICY_V1 = Object.freeze({
  asOf: '2026-09-14',
  videosList: { bucket: 'GENERAL_READ', unitsPerRequest: 1 },
  channelsList: { bucket: 'GENERAL_READ', unitsPerRequest: 1 },
  playlistItemsList: { bucket: 'GENERAL_READ', unitsPerRequest: 1 },
  generalReadDefaultDailyUnits: 10_000,
  searchList: { bucket: 'SEARCH', unitsPerRequest: 1, defaultDailyRequests: 100 },
});

export function assertYouTubeChannelId(channelId: string): void {
  if (!CHANNEL_ID_PATTERN.test(channelId)) throw new Error(`Invalid YouTube channel id: ${channelId}`);
}

export function assertYouTubeVideoId(videoId: string): void {
  if (!VIDEO_ID_PATTERN.test(videoId)) throw new Error(`Invalid YouTube video id: ${videoId}`);
}

export function youtubeTopicUrl(channelId: string): string {
  assertYouTubeChannelId(channelId);
  const url = new URL(YOUTUBE_FEED_BASE_URL);
  url.searchParams.set('channel_id', channelId);
  return url.toString();
}

export function youtubeWatchUrl(videoId: string): string {
  assertYouTubeVideoId(videoId);
  const url = new URL('https://www.youtube.com/watch');
  url.searchParams.set('v', videoId);
  return url.toString();
}

export function buildWebSubRequest(input: {
  mode: WebSubMode;
  channelId: string;
  callbackUrl: string;
  secret?: string;
  leaseSeconds?: number;
}): { url: string; headers: Record<string, string>; body: string; topic: string } {
  const callback = new URL(input.callbackUrl);
  const localDevelopment = callback.hostname === 'localhost' || callback.hostname === '127.0.0.1';
  if (callback.protocol !== 'https:' && !localDevelopment) throw new Error('WebSub callback must use HTTPS outside local development');
  if (input.secret && new TextEncoder().encode(input.secret).byteLength >= 200) throw new Error('WebSub secret must be under 200 bytes');
  if (input.leaseSeconds !== undefined && (!Number.isInteger(input.leaseSeconds) || input.leaseSeconds <= 0)) throw new Error('leaseSeconds must be a positive integer');
  const topic = youtubeTopicUrl(input.channelId);
  const form = new URLSearchParams();
  form.set('hub.mode', input.mode);
  form.set('hub.callback', callback.toString());
  form.set('hub.topic', topic);
  if (input.secret) form.set('hub.secret', input.secret);
  if (input.leaseSeconds !== undefined) form.set('hub.lease_seconds', String(input.leaseSeconds));
  return {
    url: YOUTUBE_WEBSUB_HUB_URL,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    topic,
  };
}

export function parseWebSubVerification(params: URLSearchParams): WebSubVerification {
  const mode = params.get('hub.mode');
  const topic = params.get('hub.topic');
  const challenge = params.get('hub.challenge');
  if (mode !== 'subscribe' && mode !== 'unsubscribe') throw new Error('Invalid or missing hub.mode');
  if (!topic) throw new Error('Missing hub.topic');
  if (!challenge || challenge.length > MAX_CHALLENGE_LENGTH || !CHALLENGE_PATTERN.test(challenge)) throw new Error('Invalid hub.challenge');
  const leaseRaw = params.get('hub.lease_seconds');
  if (mode === 'subscribe') {
    if (!leaseRaw) throw new Error('Missing hub.lease_seconds for subscription verification');
    const leaseSeconds = Number(leaseRaw);
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('Invalid hub.lease_seconds');
    return { mode, topic, challenge, leaseSeconds };
  }
  return { mode, topic, challenge };
}

export function buildVerificationResponse(challenge: string): Response {
  if (!challenge || challenge.length > MAX_CHALLENGE_LENGTH || !CHALLENGE_PATTERN.test(challenge)) throw new Error('Invalid hub.challenge');
  return new Response(challenge, {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  });
}

function decodeXml(value: string): string {
  const stripped = value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1');
  return stripped.replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi, (match, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    const namedEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    return named ? namedEntities[named.toLowerCase()] ?? match : match;
  });
}

function tagValue(xml: string, qualifiedName: string): string | undefined {
  const escaped = qualifiedName.replace(':', '\\:');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match?.[1] === undefined ? undefined : decodeXml(match[1]);
}

function normalizedTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function parseAttributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3];
    if (name && value !== undefined) result[name.toLowerCase()] = decodeXml(value);
  }
  return result;
}

function alternateLink(entry: string, videoId: string): string {
  const tags = entry.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = parseAttributes(tag);
    if (attributes.rel === 'alternate' && attributes.href) {
      try {
        const url = new URL(attributes.href);
        if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
      } catch {
        // Fall through to canonical watch URL.
      }
    }
  }
  return youtubeWatchUrl(videoId);
}

export function parseYouTubeAtomFeed(xml: string): YouTubeNotification[] {
  if (!/<feed\b/i.test(xml)) throw new Error('Not an Atom feed');
  const entries = xml.match(/<(?:[A-Za-z0-9_-]+:)?entry\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?entry>/gi) ?? [];
  const notifications: YouTubeNotification[] = [];
  for (const entry of entries) {
    const videoId = tagValue(entry, 'yt:videoId');
    const channelId = tagValue(entry, 'yt:channelId');
    if (!videoId || !channelId) throw new Error('YouTube Atom entry is missing videoId or channelId');
    assertYouTubeVideoId(videoId);
    assertYouTubeChannelId(channelId);
    const authorBlock = entry.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i)?.[1] ?? '';
    const title = tagValue(entry, 'title') ?? '';
    const authorName = tagValue(authorBlock, 'name');
    const publishedAt = normalizedTimestamp(tagValue(entry, 'published'));
    const updatedAt = normalizedTimestamp(tagValue(entry, 'updated'));
    const notification: YouTubeNotification = {
      videoId,
      channelId,
      title,
      watchUrl: alternateLink(entry, videoId),
      ...(authorName ? { authorName } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
    notifications.push(notification);
  }
  return notifications;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | undefined {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return undefined;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export async function deriveWebSubCredential(masterSecret: string, sourceIdentityId: string, generation: number, purpose: 'callback-token' | 'hub-secret'): Promise<string> {
  if (!masterSecret) throw new Error('Missing WebSub master secret');
  if (!sourceIdentityId) throw new Error('Missing source identity id');
  if (!Number.isSafeInteger(generation) || generation < 1) throw new Error('Invalid subscription generation');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(masterSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const input = new TextEncoder().encode(`cinerelay:${purpose}:${sourceIdentityId}:${generation}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, input)));
}

export async function verifyHubSignature(payload: Uint8Array, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const match = signatureHeader.trim().match(/^(sha1|sha256|sha384|sha512)=([0-9a-f]+)$/i);
  if (!match) return false;
  const algorithmName = match[1]?.toLowerCase();
  const expectedBytes = match[2] ? hexToBytes(match[2]) : undefined;
  if (!algorithmName || !expectedBytes) return false;
  const webCryptoAlgorithms: Record<string, string> = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const hash = webCryptoAlgorithms[algorithmName];
  if (!hash) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign']);
  const actualBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return constantTimeEqual(actualBytes, expectedBytes);
}

export function notificationExternalKey(notification: YouTubeNotification): string {
  return `${notification.videoId}:${notification.updatedAt ?? notification.publishedAt ?? 'unknown'}`;
}

export function assertNotificationBodySize(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error('Invalid notification body size');
  if (byteLength > MAX_NOTIFICATION_BYTES) throw new Error('WebSub notification body exceeds 1 MiB safety limit');
}

export function calculateSubscriptionTimes(verifiedAt: Date, leaseSeconds: number): { expiresAt: string; renewAfter: string } {
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('leaseSeconds must be a positive integer');
  const start = verifiedAt.getTime();
  if (!Number.isFinite(start)) throw new Error('Invalid verifiedAt');
  const expiresAt = new Date(start + leaseSeconds * 1000);
  const renewalSeconds = Math.max(60, Math.floor(leaseSeconds * 0.8));
  const renewAt = new Date(Math.min(start + renewalSeconds * 1000, expiresAt.getTime() - 30_000));
  return { expiresAt: expiresAt.toISOString(), renewAfter: renewAt.toISOString() };
}

function uniqueIds(ids: string[], validator: (id: string) => void, max: number): string[] {
  const result = [...new Set(ids)];
  if (result.length === 0 || result.length > max) throw new Error(`Expected between 1 and ${max} ids`);
  for (const id of result) validator(id);
  return result;
}

export function buildVideosListUrl(videoIds: string[], apiKey?: string): string {
  const ids = uniqueIds(videoIds, assertYouTubeVideoId, 50);
  const url = new URL(`${YOUTUBE_DATA_API_BASE_URL}/videos`);
  url.searchParams.set('part', 'snippet,contentDetails,status,liveStreamingDetails');
  url.searchParams.set('id', ids.join(','));
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

export function buildChannelsListUrl(channelIds: string[], apiKey?: string): string {
  const ids = uniqueIds(channelIds, assertYouTubeChannelId, 50);
  const url = new URL(`${YOUTUBE_DATA_API_BASE_URL}/channels`);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', ids.join(','));
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function bestThumbnail(snippet: Record<string, unknown>): string | undefined {
  const thumbnails = recordValue(snippet.thumbnails);
  if (!thumbnails) return undefined;
  for (const key of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const candidate = recordValue(thumbnails[key]);
    const url = stringValue(candidate?.url);
    if (url) return url;
  }
  return undefined;
}

function itemsFromResponse(response: unknown): Record<string, unknown>[] {
  const root = recordValue(response);
  if (!root || !Array.isArray(root.items)) throw new Error('Invalid YouTube API response');
  return root.items.map(recordValue).filter((item): item is Record<string, unknown> => item !== undefined);
}

export function normalizeVideosListResponse(response: unknown): YouTubeVideoSnapshot[] {
  return itemsFromResponse(response).map((item) => {
    const videoId = stringValue(item.id);
    const snippet = recordValue(item.snippet);
    if (!videoId || !snippet) throw new Error('Video response item is missing id or snippet');
    assertYouTubeVideoId(videoId);
    const channelId = stringValue(snippet.channelId);
    const title = stringValue(snippet.title);
    if (!channelId || !title) throw new Error('Video response item is missing channelId or title');
    assertYouTubeChannelId(channelId);
    const contentDetails = recordValue(item.contentDetails) ?? {};
    const status = recordValue(item.status) ?? {};
    const live = recordValue(item.liveStreamingDetails) ?? {};
    const publishedAt = normalizedTimestamp(stringValue(snippet.publishedAt));
    const snapshot: YouTubeVideoSnapshot = {
      videoId,
      channelId,
      title,
      description: stringValue(snippet.description) ?? '',
      ...(publishedAt ? { publishedAt } : {}),
      ...(stringValue(snippet.liveBroadcastContent) ? { liveBroadcastContent: stringValue(snippet.liveBroadcastContent)! } : {}),
      ...(stringValue(contentDetails.duration) ? { duration: stringValue(contentDetails.duration)! } : {}),
      ...(stringValue(status.privacyStatus) ? { privacyStatus: stringValue(status.privacyStatus)! } : {}),
      ...(booleanValue(status.embeddable) !== undefined ? { embeddable: booleanValue(status.embeddable)! } : {}),
      ...(stringValue(status.license) ? { license: stringValue(status.license)! } : {}),
      ...(bestThumbnail(snippet) ? { thumbnailUrl: bestThumbnail(snippet)! } : {}),
      ...(normalizedTimestamp(stringValue(live.scheduledStartTime)) ? { scheduledStartTime: normalizedTimestamp(stringValue(live.scheduledStartTime))! } : {}),
      ...(normalizedTimestamp(stringValue(live.actualStartTime)) ? { actualStartTime: normalizedTimestamp(stringValue(live.actualStartTime))! } : {}),
      ...(normalizedTimestamp(stringValue(live.actualEndTime)) ? { actualEndTime: normalizedTimestamp(stringValue(live.actualEndTime))! } : {}),
      ...(stringValue(live.concurrentViewers) ? { concurrentViewers: stringValue(live.concurrentViewers)! } : {}),
    };
    return snapshot;
  });
}

export function normalizeChannelsListResponse(response: unknown): YouTubeChannelSnapshot[] {
  return itemsFromResponse(response).map((item) => {
    const channelId = stringValue(item.id);
    const snippet = recordValue(item.snippet);
    if (!channelId || !snippet) throw new Error('Channel response item is missing id or snippet');
    assertYouTubeChannelId(channelId);
    const relatedPlaylists = recordValue(recordValue(item.contentDetails)?.relatedPlaylists);
    const uploadsPlaylistId = stringValue(relatedPlaylists?.uploads);
    const snapshot: YouTubeChannelSnapshot = {
      channelId,
      title: stringValue(snippet.title) ?? channelId,
      description: stringValue(snippet.description) ?? '',
      ...(stringValue(snippet.customUrl) ? { customUrl: stringValue(snippet.customUrl)! } : {}),
      ...(uploadsPlaylistId ? { uploadsPlaylistId } : {}),
      ...(bestThumbnail(snippet) ? { thumbnailUrl: bestThumbnail(snippet)! } : {}),
    };
    return snapshot;
  });
}

export function decideQuota(input: { usedUnits: number; requestedUnits: number; hardLimit: number; reserveUnits?: number }): QuotaDecision {
  const reserveUnits = input.reserveUnits ?? 0;
  for (const value of [input.usedUnits, input.requestedUnits, input.hardLimit, reserveUnits]) if (!Number.isFinite(value) || value < 0) throw new Error('Quota values must be non-negative finite numbers');
  const remainingBefore = Math.max(0, input.hardLimit - input.usedUnits);
  const remainingAfter = Math.max(0, input.hardLimit - input.usedUnits - input.requestedUnits);
  if (input.usedUnits + input.requestedUnits > input.hardLimit) return { allowed: false, remainingBefore, remainingAfter, reason: 'HARD_LIMIT' };
  if (input.usedUnits + input.requestedUnits > input.hardLimit - reserveUnits) return { allowed: false, remainingBefore, remainingAfter, reason: 'RESERVE_GUARD' };
  return { allowed: true, remainingBefore, remainingAfter, reason: 'OK' };
}
