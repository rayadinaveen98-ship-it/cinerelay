export type OttSeriesSignalSource = {
  authorityTier: number;
  role?: string;
  name?: string;
};

export type OttSeriesReleaseSignal = {
  title: string;
  providerCode: string;
  releaseDate?: string;
  datePrecision: 'DAY' | 'TBA';
  state: 'UPCOMING' | 'RELEASED' | 'TBA';
  evidenceStatus: 'CONFIRMED';
  releaseType: 'ORIGINAL';
  contentType: 'SERIES';
  primaryLanguage?: string;
  confidence: number;
  weight: number;
  signalType: 'OTT_RELEASE';
};

export type OttSeriesReleaseSignalInput = {
  title?: string;
  text?: string;
  publishedAt?: string;
  source: OttSeriesSignalSource;
};

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

const MONTH_PATTERN = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const SERIES_MARKER = /\bseason\s*\d+\b|\bhotstar\s+specials\b|\bweb\s*series\b|\bgrand\s+launch\b/i;
const AVAILABILITY_LANGUAGE = /\b(now\s+streaming|streaming\s+now|available\s+now|watch\s+now|premier(?:e|es|ing)|releas(?:e|es|ing)|official\s+release\s+date|grand\s+launch)\b/i;
const NOISE_MARKERS = /\b(episodes?|ep\.?\s*\d+|week\s*\d+|promo\s*\d*|scene|clip|highlights?|recap|sneak\s+peek|behind\s+the\s+scenes|24x7|world\s+(?:tv|television)\s+premiere|match|innings|wickets?|goals?)\b/i;
const TRAILER_OR_TEASER = /\b(?:official\s+)?(?:trailer|teaser)\b/i;
const GENERIC_LAUNCH_TITLE = /\bgrand\s+launch\b/i;
const EXPLICIT_DATED_LAUNCH = new RegExp(`\\b(?:official\\s+release\\s+date\\s*[-:–—]?|releas(?:e|es|ing)(?:\\s+on)?|premier(?:e|es|ing)(?:\\s+on)?|grand\\s+launch\\s*(?:on)?|from)\\s*(?:${MONTH_PATTERN}\\s+\\d{1,2}|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_PATTERN})`, 'i');

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
    { code: 'te', patterns: [/\btelugu\b/i] },
    { code: 'ta', patterns: [/\btamil\b/i] },
    { code: 'ml', patterns: [/\bmalayalam\b/i, /\bmollywood\b/i] },
    { code: 'kn', patterns: [/\bkannada\b/i] },
    { code: 'hi', patterns: [/\bhindi\b/i, /\bbollywood\b/i] },
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

function inferYear(month: number, day: number, publishedAt: Date): number {
  const baseYear = publishedAt.getUTCFullYear();
  const candidate = new Date(Date.UTC(baseYear, month - 1, day));
  const publishedDay = new Date(Date.UTC(baseYear, publishedAt.getUTCMonth(), publishedAt.getUTCDate()));
  return (publishedDay.getTime() - candidate.getTime()) / 86_400_000 > 45 ? baseYear + 1 : baseYear;
}

function extractDate(value: string, publishedAt: Date): string | undefined {
  const normalized = compactWhitespace(value).toLowerCase();
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const monthFirst = normalized.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
  const dayFirst = normalized.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
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
  return validIsoDate(explicitYear ?? inferYear(month, day, publishedAt), month, day);
}

function cleanSeriesTitle(value: string): string | undefined {
  const candidate = compactWhitespace(decodeHeadlineEntities(value))
    .replace(/^hotstar\s+specials\s*[|:\-–—]\s*/i, '')
    .replace(/\s*[:\-–—]\s*season\s*(\d+)\b/i, ' Season $1')
    .replace(/\s*[|,:;\-–—]+$/g, '')
    .trim();
  if (candidate.length < 2 || candidate.length > 100) return undefined;
  if (NOISE_MARKERS.test(candidate) || TRAILER_OR_TEASER.test(candidate) || GENERIC_LAUNCH_TITLE.test(candidate)) return undefined;
  return candidate;
}

function extractSeriesTitle(title: string, text: string): string | undefined {
  const candidates = [title, text].map((value) => compactWhitespace(decodeHeadlineEntities(value))).filter(Boolean);
  for (const value of candidates) {
    const season = value.match(/(?:^|[|.!?]\s*)(?:hotstar\s+specials\s*[|:\-–—]\s*)?([^|.!?]{2,90}?\s+Season\s*\d+)\s*(?:[|:\-–—]|$)/i);
    const seasonCandidate = cleanSeriesTitle(season?.[1] ?? '');
    if (seasonCandidate) return seasonCandidate;

    const hotstar = value.match(/^hotstar\s+specials\s*\|\s*([^|]{2,90}?)\s*\|\s*(?:now\s+streaming|streaming\s+now|premier|releas)/i);
    const hotstarCandidate = cleanSeriesTitle(hotstar?.[1] ?? '');
    if (hotstarCandidate) return hotstarCandidate;

    const grandLaunch = value.match(/^([^|]{2,90}?)\s+(?:from\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/i);
    const launchCandidate = cleanSeriesTitle(grandLaunch?.[1] ?? '');
    if (launchCandidate) return launchCandidate;
  }
  return undefined;
}

function primaryReleaseText(text: string): string {
  const cutoff = text.search(/\b(?:stay\s+tuned(?:\s*&\s*subscribe)?|click\s+here\s+to\s+watch|enjoy\s+and\s+stay\s+connected|follow\s+us\s+on|download\s*:)/i);
  return cutoff >= 0 ? text.slice(0, cutoff).trim() : text.slice(0, 1_500).trim();
}

export function extractOttSeriesReleaseSignal(input: OttSeriesReleaseSignalInput): OttSeriesReleaseSignal | undefined {
  const sourceRole = (input.source.role ?? '').toUpperCase();
  if (input.source.authorityTier > 2 || sourceRole !== 'OTT_PLATFORM') return undefined;

  const title = compactWhitespace(decodeHeadlineEntities(input.title ?? ''));
  const text = compactWhitespace(decodeHeadlineEntities(input.text ?? ''));
  const releaseText = primaryReleaseText(text);
  const releaseContext = compactWhitespace(`${title} ${releaseText}`);
  if (!releaseContext) return undefined;

  const provider = providerCode(`${input.source.name ?? ''} ${releaseContext}`);
  if (!provider) return undefined;
  if (!SERIES_MARKER.test(releaseContext)) return undefined;
  if (NOISE_MARKERS.test(title)) return undefined;

  const trailerOrTeaser = TRAILER_OR_TEASER.test(title);
  if (trailerOrTeaser && !EXPLICIT_DATED_LAUNCH.test(releaseContext)) return undefined;

  const nowStreaming = /\b(now\s+streaming|streaming\s+now|available\s+now|watch\s+now)\b/i.test(releaseContext);
  const datedLaunch = EXPLICIT_DATED_LAUNCH.test(releaseContext);
  if (!nowStreaming && !datedLaunch && !AVAILABILITY_LANGUAGE.test(releaseContext)) return undefined;

  const seriesTitle = extractSeriesTitle(title, releaseText);
  if (!seriesTitle) return undefined;

  const publishedAt = parsePublishedDate(input.publishedAt);
  const releaseDate = extractDate(releaseContext, publishedAt);
  if (!releaseDate && !nowStreaming) return undefined;

  let state: OttSeriesReleaseSignal['state'] = 'TBA';
  if (nowStreaming) state = 'RELEASED';
  else if (releaseDate) state = releaseDate >= publishedAt.toISOString().slice(0, 10) ? 'UPCOMING' : 'RELEASED';

  const sourceLanguage = languageCode(releaseText) ?? languageCode(`${input.source.name ?? ''} ${title}`);
  return {
    title: seriesTitle,
    providerCode: provider,
    ...(releaseDate ? { releaseDate } : {}),
    datePrecision: releaseDate ? 'DAY' : 'TBA',
    state,
    evidenceStatus: 'CONFIRMED',
    releaseType: 'ORIGINAL',
    contentType: 'SERIES',
    ...(sourceLanguage ? { primaryLanguage: sourceLanguage } : {}),
    confidence: 0.98,
    weight: 0.99,
    signalType: 'OTT_RELEASE',
  };
}
