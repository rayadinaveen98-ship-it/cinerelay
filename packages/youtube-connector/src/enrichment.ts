import { sha256Hex, youtubeWatchUrl } from './index.js';

// Self-contained structural type for the emitted declaration graph used by Deno.
// Keep this aligned with the public YouTubeVideoSnapshot contract in index.ts.
type VideoSnapshotShape = {
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

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableValue(record[key])]));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function videoSnapshotFingerprint(snapshot: VideoSnapshotShape): Promise<string> {
  return sha256Hex(stableJson(snapshot));
}

export async function projectVideoSnapshotToRawItem(snapshot: VideoSnapshotShape): Promise<{
  platformItemId: string;
  canonicalUrl: string;
  publishedAt: string | null;
  itemType: 'YOUTUBE_VIDEO';
  rawTitle: string;
  rawText: string;
  mediaType: 'VIDEO';
  metadata: Record<string, unknown>;
  contentFingerprint: string;
}> {
  return {
    platformItemId: snapshot.videoId,
    canonicalUrl: youtubeWatchUrl(snapshot.videoId),
    publishedAt: snapshot.publishedAt ?? null,
    itemType: 'YOUTUBE_VIDEO',
    rawTitle: snapshot.title,
    rawText: snapshot.description,
    mediaType: 'VIDEO',
    metadata: { youtube: snapshot },
    contentFingerprint: await videoSnapshotFingerprint(snapshot),
  };
}
