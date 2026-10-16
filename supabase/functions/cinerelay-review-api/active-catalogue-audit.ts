/**
 * Conservative, read-only screening hints for ACTIVE canonical titles.
 * A match means "review this entry", NOT "the film/series is invalid".
 * Do not use this helper to suppress, rename, delete or auto-merge records.
 */
export function activeCatalogueTitleWarnings(name: string, type: string): string[] {
  if (type !== 'MOVIE' && type !== 'SERIES') return [];
  const title = name.normalize('NFKC').trim();
  const reasons: string[] = [];
  if (!title || title.length > 100) reasons.push('Unusual title length');
  if (/\b(?:movie|film)\s+scenes?\b/i.test(title)) reasons.push('Scene/clip heading');
  if (/\b(?:telugu|tamil|malayalam|kannada|hindi|english)\s+(?:full\s+)?movie\b/i.test(title))
    reasons.push('Language/video packaging');
  if (/^(?:catch|watch)\s+.{3,80}\s+in\s+/i.test(title)) reasons.push('Cast promotional caption');
  if (/^(?:hot\s+takes|the\s+entertainer\s+everyone|the\s+little\s+things\s+that\s+made|from\s+\d+\s+to\s+\d+)/i.test(title))
    reasons.push('Promotional sentence fragment');
  if (/\bsuper\s+show!?\s*$/i.test(title)) reasons.push('Promotional tagline');
  if (/\b(?:ott\s+release\s+date|byte\s+about|behind\s+the\s+scenes)\b/i.test(title))
    reasons.push('Article or interview heading');
  if (/[|]|\.\.\.|\s+streaming$/i.test(title)) reasons.push('Caption separators or trailing copy');
  if (/.[#][\p{L}\p{N}_]+/u.test(title)) reasons.push('Embedded social hashtag');
  if (/\p{Extended_Pictographic}/u.test(title)) reasons.push('Emoji in a title-like caption');
  return reasons;
}

export type ImpactAuditRow = {canonical_name:string;activeEventCount:number;warnings:string[]};
export function sortActiveCatalogueImpact<T extends ImpactAuditRow>(rows:T[]):T[] {
  return [...rows].sort((a,b)=>
    b.activeEventCount-a.activeEventCount ||
    b.warnings.length-a.warnings.length ||
    a.canonical_name.localeCompare(b.canonical_name)
  );
}
