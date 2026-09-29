export type FeedDeltaItem = { stableId: string };

export type FeedDeltaPlan<T extends FeedDeltaItem> = {
  baseline: boolean;
  gapExceededWindow: boolean;
  newestEntryId: string | null;
  newEntries: T[];
};

/**
 * Feed entries are expected in publisher order (normally newest first).
 * A new source is baselined without replaying historical entries. Later polls
 * ingest only entries newer than the last observed stable id. If that id falls
 * outside the fetched window, the whole window is recovered and the caller can
 * surface a visible gap health state.
 */
export function planFeedDelta<T extends FeedDeltaItem>(entries: T[], lastEntryId?: string | null): FeedDeltaPlan<T> {
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
