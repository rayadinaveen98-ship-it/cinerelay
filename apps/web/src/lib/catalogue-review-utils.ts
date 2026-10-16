/**
 * Conservative visual triage for the PRIVATE operator queue.
 * This is not a canonical-title verifier and does not change catalogue data.
 * Auto-promotion is independently blocked by the database quality gate.
 */
export type PendingCatalogueMinimum = {
  proposed_name: string;
  proposed_entity_type: 'MOVIE' | 'SERIES';
  confidence: number;
};

const MARKETING_COPY = /\b(?:ott\s+release\s+date|when\s+and\s+where\s+to\s+watch|(?:latest\s+)?(?:telugu|tamil|malayalam|kannada|hindi|english)\s+full(?:\s+(?:movie|film))?|latest\s+(?:telugu|tamil|malayalam|kannada|hindi|english)\s+(?:movie|film)|full\s+(?:movie|film)|byte\s+about|this\s+(?:top\s+)?studio)\b/i;
const EMBEDDED_HASHTAG = /.[#][\p{L}\p{N}_]+/u;

export function titleNeedsManualCleanup(candidate: Pick<PendingCatalogueMinimum,'proposed_name'|'proposed_entity_type'>): boolean {
  if (candidate.proposed_entity_type !== 'MOVIE') return false;
  const name = candidate.proposed_name.trim();
  return !name || name.length > 100 ||
    MARKETING_COPY.test(name) || EMBEDDED_HASHTAG.test(name);
}

export function orderPendingCatalogue<T extends PendingCatalogueMinimum>(candidates: T[]): T[] {
  // Suspect extracted titles first; then confidence only for review ordering.
  // High confidence never constitutes a verified identity or approval.
  return [...candidates].sort((a,b)=>{
    const flagA = Number(titleNeedsManualCleanup(a));
    const flagB = Number(titleNeedsManualCleanup(b));
    if (flagA !== flagB) return flagB - flagA;
    return b.confidence - a.confidence || a.proposed_name.localeCompare(b.proposed_name);
  });
}
