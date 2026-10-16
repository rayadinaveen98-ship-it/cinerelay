/**
 * Mirrors the production corporate-owner promotion boundary.
 * Count distinct corporate parents where registry ownership is known;
 * otherwise fall back to the source organization, never the feed/channel.
 */
export function candidateOwnerGroupKey(sourceId: string, corporateOwnerId: string | null | undefined): string {
  if (!sourceId.trim()) throw new Error('source_id_required');
  return corporateOwnerId ? 'corp:' + corporateOwnerId : 'source:' + sourceId;
}

export function distinctCandidateOwnerGroups(
  evidenceSources: Array<{ sourceId: string; corporateOwnerId?: string | null }>,
): number {
  return new Set(evidenceSources.map(s => candidateOwnerGroupKey(s.sourceId, s.corporateOwnerId))).size;
}
