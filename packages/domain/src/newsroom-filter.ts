export type NewsroomFilterReason = 'empty_content' | 'archive_or_library_clip' | 'celebrity_lifestyle';

const ARCHIVE_TITLE_PATTERNS = [
  /\bmovie\s+scenes?\b/i,
  /\b(?:comedy|fight|action|emotional)\s+scenes?\b/i,
  /\bfull\s+movie\b/i,
];

const CURRENT_SIGNAL_PATTERNS = [
  /\breleas(?:e|ed|es|ing)\b/i,
  /\btrailer\b/i,
  /\bteaser\b/i,
  /\bglimpse\b/i,
  /\bfirst\s+look\b/i,
  /\bposter\b/i,
  /\bannounc(?:e|ed|ement)\b/i,
  /\blaunch\b/i,
  /\bpre[-\s]?release\b/i,
  /\bpress\s+meet\b/i,
  /\bpremiere\b/i,
  /\bstream(?:ing|s)?\b/i,
  /\bott\b/i,
  /\bshoot(?:ing)?\b/i,
  /\bwrapped?\b/i,
  /\bmuhur(?:tham|at)\b/i,
  /\bpooja\b/i,
  /\btitle\s+(?:reveal|announcement|launch)\b/i,
  /\b(?:release|launch)\s+date\b/i,
];

// These patterns are intentionally narrow and are applied only to lower-trust
// editorial media sources. They come from hosted trade-feed evidence where the
// same News feed mixes film intelligence with celebrity lifestyle/gossip items.
// First-party/official sources are never subjected to this gate.
const MEDIA_LIFESTYLE_TITLE_PATTERNS = [
  /\b(?:pregnan(?:cy|t)|food\s+cravings?)\b/i,
  /\b(?:renew(?:s|ed)?\s+(?:their\s+)?wedding\s+vows?|wedding\s+anniversary)\b/i,
  /\badvis(?:e|es|ed)\b.*\bpublic\s+appearances?\b/i,
  /\b(?:relationship|dating)\s+(?:rumou?rs?|speculation)\b/i,
];

// This intentionally stops at 2019. The hosted evidence that justified this rule
// consists of legacy catalog clips, and the newsroom must not infer that a recent
// film description is archival merely because it contains a production year.
const LEGACY_CATALOG_BODY_PATTERNS = [
  /\bis\s+(?:an?\s+)?(?:19\d{2}|200\d|201\d)\b[^.\n]{0,120}\b(?:film|movie)\b/i,
];

export function hasCurrentNewsroomIntent(value: string | null | undefined): boolean {
  const text = (value ?? '').trim();
  return CURRENT_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function isEditorialMediaRole(value: string | null | undefined): boolean {
  return value === 'TRADE_MEDIA' || value === 'GENERAL_MEDIA';
}

export function newsroomNoiseReason(
  row: {
    raw_title?: string | null;
    raw_text?: string | null;
  },
  context: { sourceRole?: string | null } = {},
): NewsroomFilterReason | null {
  const title = (row.raw_title ?? '').trim();
  const body = (row.raw_text ?? '').trim();
  if (!title && !body) return 'empty_content';

  const titleHasCurrentIntent = hasCurrentNewsroomIntent(title);
  if (titleHasCurrentIntent) return null;

  const looksArchivedByTitle = ARCHIVE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
  // Inspect only the leading description so channel boilerplate/link farms do not
  // turn current launch/trailer uploads into false archive matches.
  const leadingBody = body.slice(0, 700);
  const looksLikeLegacyCatalogDescription = LEGACY_CATALOG_BODY_PATTERNS.some((pattern) => pattern.test(leadingBody));

  if (looksArchivedByTitle || looksLikeLegacyCatalogDescription) {
    return 'archive_or_library_clip';
  }

  if (isEditorialMediaRole(context.sourceRole)) {
    const looksLikeLifestyleEditorial = MEDIA_LIFESTYLE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
    if (looksLikeLifestyleEditorial) return 'celebrity_lifestyle';
  }

  return null;
}

export function normalizedNewsroomTitleKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

// Archive-heavy channels often publish several dialogue/scene clips whose title
// differs only after the first pipe. Preserve the newest member of that family,
// but collapse later repetitions. Current-news titles are never clustered here.
export function newsroomClipFamilyKey(value: string | null | undefined): string | null {
  const title = (value ?? '').trim();
  if (!title || hasCurrentNewsroomIntent(title)) return null;
  const pipeIndex = title.indexOf('|');
  if (pipeIndex <= 0) return null;
  const prefix = normalizedNewsroomTitleKey(title.slice(0, pipeIndex));
  return prefix.length >= 4 ? prefix : null;
}
