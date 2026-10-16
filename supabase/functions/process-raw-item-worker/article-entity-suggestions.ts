/**
 * Deterministic *review suggestions*, never auto-published facts.
 * First-party article titles are not themselves proof of dates, language,
 * territory, or verified entity identity.
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
  proposedReleaseDate?: string;
  releaseDateEvidenceRule?: string;
};

export function isOfficialArticleSource(source: OfficialArticleSource, itemType: string): boolean {
  return itemType === 'WEB_ARTICLE' &&
    source.platform === 'WEB' &&
    Number.isFinite(source.authorityTier) &&
    source.authorityTier <= 2 &&
    ['PRODUCTION_HOUSE', 'OTT_PLATFORM', 'FILM_OFFICIAL', 'PROJECT_OFFICIAL'].includes(source.role ?? '');
}

function safeName(raw: string): string | null {
  const name = raw.trim().replace(/^[\u201c\u201d\u2018\u2019"' ]+|[\u201c\u201d\u2018\u2019"' ]+$/g, '')
    .replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 72 || !/^[\p{Lu}\p{N}]/u.test(name)) return null;
  if (/\b(documentary|trailer|announcement|everything|what|when|where|watch|release date|how to|movie|film|series|prime video|netflix)\b/i.test(name)) return null;
  if (/[!?<>]/.test(name)) return null;
  return name;
}

function exactHeadlineReleaseDate(headline: string): string | undefined {
  // Explicit release/premiere/streaming text, with a complete date and year.
  // Never infer the year from article publication date or current calendar.
  const match = headline.match(/\b(?:releases?|premieres?|streams?|streaming|arrives?)\s+(?:on|from)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+([12]?\d|3[01])(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);
  if (!match) return;
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month=months.indexOf(match[1].toLowerCase())+1;
  const day=Number(match[2]), year=Number(match[3]);
  if (year<2020 || year>2100 || month<1 || day<1) return;
  const date=new Date(Date.UTC(year,month-1,day));
  if (date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) return;
  return String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}

function withDate(base: ArticleEntitySuggestion, headline: string): ArticleEntitySuggestion {
  const proposedReleaseDate = exactHeadlineReleaseDate(headline);
  return proposedReleaseDate
    ? {...base, proposedReleaseDate, releaseDateEvidenceRule:'EXPLICIT_FULL_DATE_AND_RELEASE_VERB_HEADLINE'}
    : base;
}

export function suggestOfficialArticleEntity(headline: string): ArticleEntitySuggestion | null {
  if (!headline || headline.length > 300) return null;
  const title = headline.trim();

  // E.g. "The Diplomat Season 4: The Drama Is Back". Suggest SERIES, not SEASON.
  const seasonColon=title.match(/^(.{3,80}?)\s+Season\s+([1-9]\d?)\s*[:\u2014\u2013-]\s*.+$/iu);
  if (seasonColon) {
    const name=safeName(seasonColon[1]);
    if (!name) return null;
    return withDate({proposedName:name,proposedEntityType:'SERIES',confidence:0.87,
      evidenceRule:'EXPLICIT_SERIES_SEASON_HEADLINE',seasonNumber:Number(seasonColon[2])},title);
  }
  // E.g. "Watch the trailer of Aspirants Season 3 streaming now on Prime Video".
  const seasonalTrailer=title.match(/^(?:Watch (?:the )?trailer of|First look at|Teaser for)\s+(.{3,80}?)\s+Season\s+([1-9]\d?)\s+(?:streaming|premiering|premieres|releasing|releases|arriving|arrives)\b.+$/iu);
  if (seasonalTrailer) {
    const name=safeName(seasonalTrailer[1]);
    if (!name) return null;
    return withDate({proposedName:name,proposedEntityType:'SERIES',confidence:0.86,
      evidenceRule:'OFFICIAL_TRAILER_NAMED_SEASON',seasonNumber:Number(seasonalTrailer[2])},title);
  }
  // "New thriller series Storm" means a SERIES candidate named Storm, not a verified launch.
  // The title must be final, 1-4 capitalized words, following an explicit series marker.
  const namedSeries=title.match(/\b(?:new|upcoming)\s+(?:(?:thriller|drama|comedy|romantic|crime|historical|mystery)\s+)?series\s+([\p{Lu}][\p{L}\p{N}'’-]*(?:\s+[\p{Lu}][\p{L}\p{N}'’-]*){0,3})\s*$/u);
  if (namedSeries) {
    const name=safeName(namedSeries[1]);
    if (!name) return null;
    return withDate({proposedName:name,proposedEntityType:'SERIES',confidence:0.83,
      evidenceRule:'EXPLICIT_NEW_NAMED_SERIES_HEADLINE'},title);
  }
  // Quoted film titles only, directly adjacent to explicit film/movie type.
  // Neither person names in "documentary about X" nor general film roundups qualify.
  const quotedFilm=title.match(/\b(?:film|movie)\s+[“"'‘]([^”"'’]{3,72})[”"'’]/iu);
  if (quotedFilm) {
    const name=safeName(quotedFilm[1]);
    if (!name) return null;
    return withDate({proposedName:name,proposedEntityType:'MOVIE',confidence:0.84,
      evidenceRule:'EXPLICIT_QUOTED_FILM_TITLE'},title);
  }
  return null;
}
