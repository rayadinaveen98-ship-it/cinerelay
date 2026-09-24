export type OttSignalSource = {
  authorityTier: number;
  role?: string;
  name?: string;
};

export type OttMovieReleaseSignal = {
  title: string;
  providerCode: string;
  releaseDate?: string;
  datePrecision: 'DAY' | 'TBA';
  state: 'UPCOMING' | 'RELEASED' | 'TBA';
  evidenceStatus: 'CONFIRMED' | 'REPORTED';
  releaseType: 'ORIGINAL' | 'POST_THEATRICAL';
  contentType: 'MOVIE';
  primaryLanguage?: string;
  confidence: number;
  weight: number;
  signalType: 'OTT_RELEASE';
};

export type OttMovieReleaseSignalInput = {
  title?: string;
  text?: string;
  publishedAt?: string;
  source: OttSignalSource;
};

const FIRST_PARTY_ROLES = new Set([
  'OTT_PLATFORM',
  'PRODUCTION_HOUSE',
  'DISTRIBUTOR',
  'PROJECT_OFFICIAL',
  'FILM_OFFICIAL',
  'CAST_CREW_OFFICIAL',
]);

const PROVIDERS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: 'NETFLIX', patterns: [/\bnetflix\b/i] },
  { code: 'PRIME_VIDEO', patterns: [/\bprime\s*video\b/i, /\bamazon\s*prime\b/i] },
  { code: 'JIOHOTSTAR', patterns: [/\bjio\s*hotstar\b/i, /\bjiohotstar\b/i, /\bhotstar\b/i] },
  { code: 'ZEE5', patterns: [/\bzee\s*5\b/i, /\bzee5\b/i] },
  { code: 'SONYLIV', patterns: [/\bsony\s*liv\b/i, /\bsonyliv\b/i] },
  { code: 'AHA', patterns: [/\baha\s*(?:video)?\b/i] },
  { code: 'SUN_NXT', patterns: [/\bsun\s*nxt\b/i, /\bsunnxt\b/i] },
  { code: 'ETV_WIN', patterns: [/\betv\s*win\b/i, /\betvwin\b/i] },
];

const PROVIDER_NAME_PATTERN = '(?:netflix|prime\\s*video|amazon\\s*prime|jio\\s*hotstar|jiohotstar|hotstar|zee\\s*5|zee5|sony\\s*liv|sonyliv|aha(?:\\s*video)?|sun\\s*nxt|sunnxt|etv\\s*win|etvwin)';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const BAD_TITLE_MARKERS = /\b(trailer|teaser|promo|glimpse|scene|clip|highlights?|song|interview|review|episodes?|ep\.?\s*\d+|recap|behind\s+the\s+scenes|sneak\s+peek|match|innings|wickets?|goals?|season\s+\d+)\b/i;
const RELEASE_LANGUAGE = /\b(stream(?:ing|s)?(?:\s+from|\s+on|\s+now)?|premier(?:e|es|ing)(?:\s+on)?|releas(?:e|es|ing)(?:\s+on)?|now\s+streaming|watch\s+now|available\s+now|digital\s+(?:debut|premiere|release))\b/i;
const NON_MOVIE_TITLE_MARKERS = /(?:\bhotstar\s+specials\b|\bseason\s*\d+\b|\bepisodes?\s*\d*\b|\bep\.?\s*\d+\b|\bweb\s*series\b|\bwebseries\b|\btv\s+show\b|\breality\s+show\b|\bgame\s+show\b|\bserial\b|\bweek\s*\d+\s*[-–—]\s*promo\b|\bsat\s*[-–—]\s*sun\b|\bmon\s*[-–—]\s*fri\b|\bsign\s+up\s+for\s+sony\s+liv\b)/i;
const NON_MOVIE_RELEASE_TAGS = /#(?:hotstarspecials|[^\s#]*season\d+|[^\s#]*s\d+on(?:jhs|jiohotstar)|webseries)\b/i;

function compactWhitespace(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function decodeHeadlineEntities(value: string): string {
  return value
    .replace(/&#8216;|&lsquo;/gi, '‘')
    .replace(/&#8217;|&rsquo;/gi, '’')
    .replace(/&#8220;|&ldquo;/gi, '“')
    .replace(/&#8221;|&rdquo;/gi, '”')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}

function providerCode(value: string): string | undefined {
  for (const provider of PROVIDERS) {
    if (provider.patterns.some((pattern) => pattern.test(value))) return provider.code;
  }
  return undefined;
}

function languageCode(value: string): string | undefined {
  const normalized = value.toLowerCase();
  const markers: Array<{ code: string; patterns: RegExp[] }> = [
    { code: 'te', patterns: [/\btelugu\b/i, /#telugumovie\b/i] },
    { code: 'ta', patterns: [/\btamil\b/i, /#tamilmovie\b/i] },
    { code: 'ml', patterns: [/\bmalayalam\b/i, /#malayalammovie\b/i, /\bmollywood\b/i] },
    { code: 'kn', patterns: [/\bkannada\b/i, /#kannadamovie\b/i, /\bsandalwood\b/i] },
    { code: 'hi', patterns: [/\bhindi\b/i, /#hindimovie\b/i, /\bbollywood\b/i] },
  ];
  const matches = markers.flatMap(({ code, patterns }) => patterns.map((pattern) => {
    const found = pattern.exec(normalized);
    return found ? { code, index: found.index } : null;
  }).filter((item): item is { code: string; index: number } => item !== null));
  return matches.sort((left, right) => left.index - right.index)[0]?.code;
}

function parsePublishedDate(value?: string): Date {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function inferYear(input: { month: number; day: number; publishedAt: Date }): number {
  const { month, day, publishedAt } = input;
  const baseYear = publishedAt.getUTCFullYear();
  const candidate = new Date(Date.UTC(baseYear, month - 1, day));
  const publishedDay = new Date(Date.UTC(baseYear, publishedAt.getUTCMonth(), publishedAt.getUTCDate()));
  const daysBehind = (publishedDay.getTime() - candidate.getTime()) / 86_400_000;
  return daysBehind > 45 ? baseYear + 1 : baseYear;
}

function extractDate(value: string, publishedAt: Date): string | undefined {
  const normalized = compactWhitespace(value).toLowerCase();
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const monthPattern = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const monthFirst = normalized.match(new RegExp(`\\b${monthPattern}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
  const dayFirst = normalized.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthPattern}(?:,?\\s+(20\\d{2}))?\\b`, 'i'));

  let monthName: string | undefined;
  let day: number | undefined;
  let explicitYear: number | undefined;
  if (monthFirst) {
    monthName = monthFirst[1]?.toLowerCase();
    day = Number(monthFirst[2]);
    explicitYear = monthFirst[3] ? Number(monthFirst[3]) : undefined;
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    monthName = dayFirst[2]?.toLowerCase();
    explicitYear = dayFirst[3] ? Number(dayFirst[3]) : undefined;
  }
  if (!monthName || !day) return undefined;
  const month = MONTHS[monthName];
  if (!month) return undefined;
  const year = explicitYear ?? inferYear({ month, day, publishedAt });
  return validIsoDate(year, month, day);
}

function cleanMovieTitleCandidate(value: string): string | undefined {
  const candidate = compactWhitespace(decodeHeadlineEntities(value))
    .replace(/^(?:official\s+)?/i, '')
    .replace(/[|,:;\-–—]+$/g, '')
    .trim();
  if (candidate.length < 2 || candidate.length > 100) return undefined;
  if (BAD_TITLE_MARKERS.test(candidate)) return undefined;
  return candidate;
}

function extractTradeHeadlineMovieTitle(title: string): string | undefined {
  const value = compactWhitespace(decodeHeadlineEntities(title));
  if (!value) return undefined;

  const quoted = value.match(/[‘“'\"]([^‘’“”'\"]{2,100})[’”'\"]\s+(?:gets?|bags?|lands?|scores?|locks?|set|slated|heading|arrives?|premieres?)/i);
  const quotedCandidate = cleanMovieTitleCandidate(quoted?.[1] ?? '');
  if (quotedCandidate) return quotedCandidate;

  const providerPremiere = value.match(new RegExp(
    `^(?:OTT\\s*:\\s*)?(?:.{2,45}[’']s\\s+)?(.{2,80}?)\\s+(?:locked|set|slated|confirmed)\\s+(?:for|to)\\s+(?:${PROVIDER_NAME_PATTERN}\\s+)?(?:digital\\s+)?(?:premiere|streaming|OTT|release)\\b`,
    'i',
  ));
  const providerCandidate = cleanMovieTitleCandidate(providerPremiere?.[1] ?? '');
  if (providerCandidate) return providerCandidate;

  const ottDate = value.match(/^OTT\s*:\s*(.{2,100}?)\s+(?:gets?|bags?|lands?|scores?)\s+(?:an?\s+|its\s+)?(?:OTT|streaming|digital)\s+(?:date|release|premiere)\b/i);
  return cleanMovieTitleCandidate(ottDate?.[1] ?? '');
}

function extractMovieTitle(
  title: string,
  text: string,
  allowDirectOttHeadline: boolean,
  allowTradeHeadline: boolean,
): string | undefined {
  const candidates = [title, text]
    .map((value) => compactWhitespace(decodeHeadlineEntities(value)))
    .filter(Boolean);

  for (const value of candidates) {
    const patterns = [
      /^(.{2,100}?)\s+(?:movie|film)\s*[,|:\-–—]\s*(?:now\s+)?(?:stream(?:ing|s)?|premier(?:e|es|ing)|releas(?:e|es|ing))/i,
      /^(.{2,100}?)\s+(?:movie|film)\s+(?:is\s+)?(?:now\s+)?(?:stream(?:ing|s)?|premier(?:e|es|ing)|releas(?:e|es|ing))/i,
      /(?:watch|catch)\s+(?:the\s+)?(?:movie|film)\s+(.{2,100}?)\s+(?:now\s+)?(?:stream(?:ing|s)?|premier(?:e|es|ing)|releas(?:e|es|ing))/i,
    ];
    if (allowDirectOttHeadline) {
      patterns.push(
        /^(.{2,100}?)\s*[|,:;\-–—]\s*(?:(?:now\s+)?streaming(?:\s+now)?|watch\s+now|available\s+now|streaming\s+from|premier(?:e|es|ing)\s+on|releas(?:e|es|ing)\s+on)\b/i,
        new RegExp(`\\bwatch\\s+(.{2,100}?)\\s+on\\s+${PROVIDER_NAME_PATTERN}\\s*,?\\s*out\\s+\\d{1,2}`, 'i'),
        /\bwatch\s+(.{2,100}?)\s*,?\s*out\s+\d{1,2}/i,
        new RegExp(`(?:^|[.!?]\\s+)(.{2,100}?)\\s+is\\s+(?:only\\s+)?on\\s+${PROVIDER_NAME_PATTERN}\\s+\\d{1,2}`, 'i'),
        /^(.{2,100}?)\s*\|\s*(?:(?:hindi|telugu|tamil|malayalam|kannada|english)\s+)?(?:official\s+)?(?:trailer|teaser)\b/i,
      );
    }
    for (const pattern of patterns) {
      const match = value.match(pattern);
      const candidate = cleanMovieTitleCandidate(match?.[1] ?? '');
      if (candidate) return candidate;
    }
  }

  if (allowTradeHeadline) return extractTradeHeadlineMovieTitle(title);
  return undefined;
}

function primaryReleaseText(text: string, sourceRole: string): string {
  if (sourceRole !== 'OTT_PLATFORM') return text;
  const cutoff = text.search(/\b(?:stay\s+tuned(?:\s*&\s*subscribe)?|click\s+here\s+to\s+watch|original\s+shows\s+on|enjoy\s+and\s+stay\s+connected|follow\s+us\s+on|download\s*:)/i);
  return cutoff >= 0 ? text.slice(0, cutoff).trim() : text.slice(0, 1_500).trim();
}

function isFirstParty(source: OttSignalSource): boolean {
  return source.authorityTier <= 2 && FIRST_PARTY_ROLES.has((source.role ?? '').toUpperCase());
}

function hasFirstPartyDatedAvailability(value: string, allowDirectOttHeadline: boolean): boolean {
  if (!allowDirectOttHeadline) return false;
  const watchOut = /\bwatch\s+.{2,100}?\s*(?:on\s+(?:netflix|prime\s*video|amazon\s*prime|jio\s*hotstar|jiohotstar|hotstar|zee\s*5|zee5|sony\s*liv|sonyliv|aha(?:\s*video)?|sun\s*nxt|sunnxt|etv\s*win|etvwin)\s*)?,?\s*out\s+\d{1,2}\b/i;
  const onlyOnDate = new RegExp(`\\b.{2,100}?\\s+is\\s+(?:only\\s+)?on\\s+${PROVIDER_NAME_PATTERN}\\s+\\d{1,2}\\b`, 'i');
  return watchOut.test(value) || onlyOnDate.test(value);
}

function hasStrongNonMovieContext(title: string, releaseText: string): boolean {
  if (NON_MOVIE_TITLE_MARKERS.test(title)) return true;
  const lead = releaseText.slice(0, 700);
  return NON_MOVIE_RELEASE_TAGS.test(lead);
}

function ambiguousUndatedStreamingPackaging(title: string): boolean {
  const pipeCount = (title.match(/\|/g) ?? []).length;
  return pipeCount > 1 && !/\b(movie|film)\b/i.test(title);
}

export function extractOttMovieReleaseSignal(input: OttMovieReleaseSignalInput): OttMovieReleaseSignal | undefined {
  const title = compactWhitespace(decodeHeadlineEntities(input.title ?? ''));
  const text = compactWhitespace(decodeHeadlineEntities(input.text ?? ''));
  const combined = compactWhitespace(`${title} ${text}`);
  if (!combined) return undefined;

  const provider = providerCode(`${input.source.name ?? ''} ${combined}`);
  if (!provider) return undefined;

  const firstParty = isFirstParty(input.source);
  if (!firstParty && input.source.authorityTier > 3) return undefined;
  const sourceRole = (input.source.role ?? '').toUpperCase();
  const allowDirectOttHeadline = firstParty && sourceRole === 'OTT_PLATFORM';
  const allowTradeHeadline = !firstParty && sourceRole === 'TRADE_MEDIA' && input.source.authorityTier <= 3;
  const releaseText = primaryReleaseText(text, sourceRole);
  const releaseContext = compactWhitespace(`${title} ${releaseText}`);
  const firstPartyDatedAvailability = hasFirstPartyDatedAvailability(releaseContext, allowDirectOttHeadline);
  if (!releaseContext || (!RELEASE_LANGUAGE.test(releaseContext) && !firstPartyDatedAvailability)) return undefined;
  if (allowDirectOttHeadline && hasStrongNonMovieContext(title, releaseText)) return undefined;

  const movieTitle = extractMovieTitle(title, releaseText, allowDirectOttHeadline, allowTradeHeadline);
  if (!movieTitle) return undefined;

  const publishedAt = parsePublishedDate(input.publishedAt);
  const releaseDate = extractDate(releaseContext, publishedAt);
  const nowStreaming = /\b(now\s+streaming|streaming\s+now|watch\s+now|available\s+now)\b/i.test(releaseContext);
  if (!releaseDate && !nowStreaming) return undefined;
  if (allowDirectOttHeadline && nowStreaming && !releaseDate && ambiguousUndatedStreamingPackaging(title)) return undefined;

  let state: OttMovieReleaseSignal['state'] = 'TBA';
  if (nowStreaming) state = 'RELEASED';
  else if (releaseDate) {
    const publishedDay = publishedAt.toISOString().slice(0, 10);
    state = releaseDate >= publishedDay ? 'UPCOMING' : 'RELEASED';
  }

  const originalLanguage = /\b(original\s+(?:movie|film)|(?:movie|film)\s+original|direct\s+digital\s+debut)\b/i.test(releaseContext);
  const sourceLanguage = firstParty
    ? (languageCode(releaseText) ?? languageCode(`${input.source.name ?? ''} ${title}`))
    : languageCode(releaseContext.slice(0, 900));

  return {
    title: movieTitle,
    providerCode: provider,
    ...(releaseDate ? { releaseDate } : {}),
    datePrecision: releaseDate ? 'DAY' : 'TBA',
    state,
    evidenceStatus: firstParty ? 'CONFIRMED' : 'REPORTED',
    releaseType: originalLanguage ? 'ORIGINAL' : 'POST_THEATRICAL',
    contentType: 'MOVIE',
    ...(sourceLanguage ? { primaryLanguage: sourceLanguage } : {}),
    confidence: firstParty ? 0.97 : 0.92,
    weight: firstParty ? 0.98 : 0.9,
    signalType: 'OTT_RELEASE',
  };
}
