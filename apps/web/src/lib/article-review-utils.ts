/** Pure operator UI projection. The actual event safety gate lives in the Edge worker. */
export type OfficialReviewItemMinimum = {
  rawItem: { first_seen_at: string; published_at: string | null };
  typedSuggestion: { status: string } | null;
};
export function isIdentityOnlyWebArticle(raw: {
  first_seen_at: string;
  published_at: string | null;
}, now = new Date()): boolean {
  const first = Date.parse(raw.first_seen_at);
  const published = raw.published_at ? Date.parse(raw.published_at) : NaN;
  const nowMs = now.getTime(), maxAge = 48 * 60 * 60 * 1000;
  // Mirrors conservative operator WEB_ARTICLE worker guard.
  if (!Number.isFinite(first) || !Number.isFinite(published) || !Number.isFinite(nowMs)) return true;
  return first > nowMs + 300000 || published > nowMs + 300000 ||
    nowMs - first > maxAge || nowMs - published > maxAge;
}
export function prioritizePendingSuggestions<T extends OfficialReviewItemMinimum>(items: T[]): T[] {
  return [...items].sort((a,b)=>{
    const pendingA = a.typedSuggestion?.status === 'PENDING' ? 1 : 0;
    const pendingB = b.typedSuggestion?.status === 'PENDING' ? 1 : 0;
    if (pendingA !== pendingB) return pendingB - pendingA;
    return Date.parse(b.rawItem.first_seen_at) - Date.parse(a.rawItem.first_seen_at);
  });
}
