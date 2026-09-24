import { assertYouTubeVideoId, YOUTUBE_DATA_API_BASE_URL } from './index.js';

const UPLOADS_PLAYLIST_ID_PATTERN = /^UU[A-Za-z0-9_-]{22}$/;

export const YOUTUBE_DISCOVERY_INTERVAL_MS = Object.freeze({
  hot: 5 * 60 * 1000,
  normal: 15 * 60 * 1000,
  backoff: 30 * 60 * 1000,
});

export type YouTubeDiscoveryPriority = 'HIGH' | 'NORMAL';

export type UploadsPlaylistItem = {
  videoId: string;
  title?: string;
  publishedAt?: string;
};

export type FallbackHealthDecision = {
  degraded: boolean;
  errorCode?: 'FALLBACK_WINDOW_GAP' | 'WEBSUB_MISSED_DELIVERY';
  errorMessage?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function validTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function assertUploadsPlaylistId(playlistId: string): void {
  if (!UPLOADS_PLAYLIST_ID_PATTERN.test(playlistId)) throw new Error(`Invalid YouTube uploads playlist id: ${playlistId}`);
}

export function buildUploadsPlaylistItemsUrl(playlistId: string, apiKey?: string, maxResults = 10): string {
  assertUploadsPlaylistId(playlistId);
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 50) throw new Error('maxResults must be an integer between 1 and 50');
  const url = new URL(`${YOUTUBE_DATA_API_BASE_URL}/playlistItems`);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('maxResults', String(maxResults));
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

export function normalizeUploadsPlaylistItemsResponse(payload: unknown): UploadsPlaylistItem[] {
  const root = asRecord(payload);
  const items = Array.isArray(root?.items) ? root.items : [];
  const result: UploadsPlaylistItem[] = [];

  for (const raw of items) {
    const item = asRecord(raw);
    if (!item) continue;
    const snippet = asRecord(item.snippet);
    const contentDetails = asRecord(item.contentDetails);
    const resourceId = asRecord(snippet?.resourceId);
    const videoIdCandidate = contentDetails?.videoId ?? resourceId?.videoId;
    if (typeof videoIdCandidate !== 'string') continue;
    try {
      assertYouTubeVideoId(videoIdCandidate);
    } catch {
      continue;
    }

    const title = typeof snippet?.title === 'string' ? snippet.title.trim() : undefined;
    const publishedAt = validTimestamp(contentDetails?.videoPublishedAt) ?? validTimestamp(snippet?.publishedAt);
    result.push({
      videoId: videoIdCandidate,
      ...(title ? { title } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    });
  }

  return result;
}

export function decideDiscoveryIntervalMs(input: {
  existingErrorCode?: string | null;
  providerFailure?: boolean;
  priority?: YouTubeDiscoveryPriority;
}): number {
  if (input.providerFailure) return YOUTUBE_DISCOVERY_INTERVAL_MS.backoff;
  if (input.existingErrorCode === 'WEBSUB_MISSED_DELIVERY' || input.existingErrorCode === 'FALLBACK_WINDOW_GAP') {
    return YOUTUBE_DISCOVERY_INTERVAL_MS.hot;
  }
  if (input.priority === 'HIGH') return YOUTUBE_DISCOVERY_INTERVAL_MS.hot;
  return YOUTUBE_DISCOVERY_INTERVAL_MS.normal;
}

export function decideFallbackHealth(input: {
  gapExceededWindow: boolean;
  recoveredUploadCount: number;
  existingErrorCode?: string | null;
}): FallbackHealthDecision {
  if (!Number.isSafeInteger(input.recoveredUploadCount) || input.recoveredUploadCount < 0) {
    throw new Error('recoveredUploadCount must be a non-negative integer');
  }

  if (input.gapExceededWindow) {
    return {
      degraded: true,
      errorCode: 'FALLBACK_WINDOW_GAP',
      errorMessage: 'Previous upload was outside the bounded uploads-playlist window',
    };
  }

  if (input.recoveredUploadCount > 0) {
    return {
      degraded: false,
      errorCode: 'WEBSUB_MISSED_DELIVERY',
      errorMessage: `Authoritative uploads polling recovered ${input.recoveredUploadCount} upload(s) not observed via WebSub; ingestion remains healthy while the accelerator is monitored`,
    };
  }

  if (input.existingErrorCode === 'WEBSUB_MISSED_DELIVERY') {
    return {
      degraded: false,
      errorCode: 'WEBSUB_MISSED_DELIVERY',
      errorMessage: 'Authoritative uploads polling remains healthy; WebSub accelerator recovery is still being monitored',
    };
  }

  return { degraded: false };
}
