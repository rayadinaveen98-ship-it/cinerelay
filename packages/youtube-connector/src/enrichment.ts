import { sha256Hex, youtubeWatchUrl, type YouTubeVideoSnapshot } from './index.js';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableValue(record[key])]));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function videoSnapshotFingerprint(snapshot: YouTubeVideoSnapshot): Promise<string> {
  return sha256Hex(stableJson(snapshot));
}

export async function projectVideoSnapshotToRawItem(snapshot: YouTubeVideoSnapshot): Promise<{
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
