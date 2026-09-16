import type { FeedEntry } from './index.js';

export type FeedDeltaPlan = {
  baseline: boolean;
  gapExceededWindow: boolean;
  newestEntryId: string | null;
  newEntries: FeedEntry[];
};

/**
 * Feed entries are expected in publisher order (normally newest first).
 * A new source is baselined without replaying historical entries. Later polls
 * ingest only entries newer than the last observed stable id. If that id falls
 * outside the fetched window, the whole window is recovered and the caller can
 * surface a visible gap health state.
 */
export function planFeedDelta(entries: FeedEntry[], lastEntryId?: string | null): FeedDeltaPlan {
  const newestEntryId = entries[0]?.stableId ?? null;
  if (entries.length === 0) {
    return { baseline: !lastEntryId, gapExceededWindow: false, newestEntryId: null, newEntries: [] };
  }
  if (!lastEntryId) {
    return { baseline: true, gapExceededWindow: false, newestEntryId, newEntries: [] };
  }
  const previousIndex = entries.findIndex((entry) => entry.stableId === lastEntryId);
  if (previousIndex === 0) {
    return { baseline: false, gapExceededWindow: false, newestEntryId, newEntries: [] };
  }
  if (previousIndex > 0) {
    return { baseline: false, gapExceededWindow: false, newestEntryId, newEntries: entries.slice(0, previousIndex) };
  }
  return { baseline: false, gapExceededWindow: true, newestEntryId, newEntries: entries };
}
