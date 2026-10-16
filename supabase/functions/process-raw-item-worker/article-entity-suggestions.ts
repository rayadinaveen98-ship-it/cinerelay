/**
 * Conservative title extraction for official first-party WEB_ARTICLE headlines.
 * Suggestions are for operator review only; they NEVER publish an entity/event.
 * A documentary ABOUT someone is not evidence of the documentary's actual title.
 */
export type OfficialArticleSource = {
  authorityTier: number;
  role?: string;
  platform?: string;
};
export type ArticleEntitySuggestion = {
  proposedName: string;
  proposedEntityType: 'SERIES' | 'MOVIE';
  confidence: number;
  evidenceRule: string;
  seasonNumber?: number;
};

export function isOfficialArticleSource(source: OfficialArticleSource, itemType: string): boolean {
  return itemType === 'WEB_ARTICLE' &&
    source.platform === 'WEB' &&
    Number.isFinite(source.authorityTier) &&
    source.authorityTier <= 2 &&
    ['PRODUCTION_HOUSE', 'OTT_PLATFORM', 'FILM_OFFICIAL', 'PROJECT_OFFICIAL'].includes(source.role ?? '');
}

function safeSeriesName(raw: string): string | null {
  const name = raw.trim().replace(/[\u201c\u201d"']/g, '').replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 72 || !/^[\p{Lu}\p{N}]/u.test(name)) return null;
  if (/\b(documentary|trailer|announcement|everything|what|when|where|watch|new|latest|release date)\b/i.test(name)) return null;
  if (/[!?]/.test(name)) return null;
  return name;
}

export function suggestOfficialArticleEntity(headline: string): ArticleEntitySuggestion | null {
  if (!headline || headline.length > 300) return null;
  const title = headline.trim();
  // Directly stated serial title and numbered season, followed by a headline separator.
  const m = title.match(/^(.{3,80}?)\s+Season\s+([1-9]\d?)\s*[:\u2014\u2013-]\s*.+$/iu);
  if (m) {
    const name = safeSeriesName(m[1]);
    if (!name) return null;
    return { proposedName: name, proposedEntityType: 'SERIES', confidence: 0.87,
      evidenceRule: 'EXPLICIT_SERIES_SEASON_HEADLINE', seasonNumber: Number(m[2]) };
  }
  return null;
}
