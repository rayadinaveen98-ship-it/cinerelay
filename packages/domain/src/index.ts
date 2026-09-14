export type ResolutionState = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';
export type VerificationState = 'OFFICIAL' | 'CONFIRMED' | 'RELIABLE_REPORT' | 'DEVELOPING' | 'RUMOR';
export type PriorityBand = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'SUPPRESSED';
export type ReleaseWindow = { kind: 'FESTIVAL' | 'SEASON'; label: string; year: number };

export type SourceDescriptor = {
  authorityTier: number;
  role?: string;
  platform?: string;
  name?: string;
};

export type EntityDescriptor = {
  canonicalName: string;
  aliases?: string[];
  year?: number;
  id?: string;
};

export type FixtureItem = {
  title?: string;
  text?: string;
  url: string;
  source?: SourceDescriptor;
};

export type PipelineContext = {
  entity?: EntityDescriptor;
  knownEntities?: string[];
  candidateEntities?: EntityDescriptor[];
  precondition?: {
    currentTheatricalDate?: string;
  };
};

export type NormalizedItem = {
  id: string;
  url: string;
  title: string;
  text: string;
  normalizedText: string;
  source: SourceDescriptor;
  fingerprint: string;
};

export type ResolutionResult = {
  state: ResolutionState;
  entity?: EntityDescriptor;
  score: number;
  matchedAlias?: string;
};

export type ClassifiedEvent = {
  eventType: string;
  structuredData: Record<string, unknown>;
  headline: string;
};

export type Evidence = {
  rawItemId: string;
  role: 'PRIMARY' | 'CORROBORATING' | 'CONFLICTING' | 'REPEAT';
  sourceUrl: string;
};

export type CanonicalEvent = {
  id: string;
  primaryEntityId: string;
  eventType: string;
  eventSchemaVersion: 1;
  verificationState: VerificationState;
  priorityBand: PriorityBand;
  headline: string;
  structuredData: Record<string, unknown>;
  status: 'ACTIVE' | 'NEEDS_REVIEW';
  evidence: Evidence[];
  dedupeKey: string;
};

export type PipelineItemResult = {
  normalized: NormalizedItem;
  resolution: ResolutionResult;
  classified?: ClassifiedEvent;
};

export type PipelineBatchResult = {
  items: PipelineItemResult[];
  events: CanonicalEvent[];
  notifications: CanonicalEvent[];
};

const EVENT_PRIORITY: Record<string, PriorityBand> = {
  PROJECT_ANNOUNCED: 'HIGH', TITLE_ANNOUNCED: 'HIGH', TITLE_CHANGED: 'HIGH', SEQUEL_OR_SPINOFF_ANNOUNCED: 'HIGH', SEASON_RENEWED: 'HIGH', PROJECT_ON_HOLD: 'HIGH', PROJECT_CANCELLED: 'CRITICAL', CAST_ANNOUNCED: 'NORMAL', CREW_ANNOUNCED: 'NORMAL', CAST_EXIT_REPORTED: 'HIGH', CREW_EXIT_REPORTED: 'HIGH', PRODUCTION_LAUNCHED: 'HIGH', SHOOT_STARTED: 'HIGH', SHOOT_SCHEDULE_UPDATE: 'NORMAL', SHOOT_WRAPPED: 'HIGH', BTS_RELEASED: 'NORMAL', MAKING_VIDEO_RELEASED: 'NORMAL', FIRST_LOOK_RELEASED: 'HIGH', POSTER_RELEASED: 'NORMAL', GLIMPSE_RELEASED: 'HIGH', TEASER_ANNOUNCED: 'HIGH', TEASER_RELEASED: 'HIGH', TRAILER_ANNOUNCED: 'HIGH', TRAILER_RELEASED: 'CRITICAL', PROMO_RELEASED: 'NORMAL', SONG_ANNOUNCED: 'NORMAL', SONG_RELEASED: 'HIGH', ALBUM_UPDATE: 'NORMAL', INTERVIEW_RELEASED: 'NORMAL', PRESS_MEET_ANNOUNCED: 'NORMAL', PRESS_MEET_STARTED_OR_RELEASED: 'NORMAL', PRE_RELEASE_EVENT_ANNOUNCED: 'HIGH', PRE_RELEASE_EVENT_STARTED_OR_RELEASED: 'HIGH', PREMIERE_OR_SCREENING_ANNOUNCED: 'NORMAL', THEATRICAL_DATE_ANNOUNCED: 'CRITICAL', THEATRICAL_DATE_CHANGED: 'CRITICAL', THEATRICAL_RELEASED: 'HIGH', OTT_PLATFORM_ANNOUNCED: 'HIGH', OTT_DATE_ANNOUNCED: 'CRITICAL', OTT_DATE_CHANGED: 'CRITICAL', OTT_RELEASED: 'HIGH', DELAY_OR_POSTPONEMENT: 'CRITICAL', CERTIFICATION_UPDATED: 'NORMAL', RUNTIME_UPDATED: 'NORMAL',
};

export const EVENT_PRIORITIES = Object.freeze({ ...EVENT_PRIORITY });

const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const RELEASE_WINDOW_PATTERNS: Array<{ label: string; kind: ReleaseWindow['kind']; patterns: string[] }> = [
  { label: 'Sankranthi', kind: 'FESTIVAL', patterns: ['sankranthi', 'sankranti'] },
  { label: 'Pongal', kind: 'FESTIVAL', patterns: ['pongal'] },
  { label: 'Summer', kind: 'SEASON', patterns: ['summer'] },
  { label: 'Christmas', kind: 'FESTIVAL', patterns: ['christmas'] },
  { label: 'Diwali', kind: 'FESTIVAL', patterns: ['diwali', 'deepavali'] },
  { label: 'Dussehra', kind: 'FESTIVAL', patterns: ['dussehra', 'dasara'] },
  { label: 'Ugadi', kind: 'FESTIVAL', patterns: ['ugadi'] },
];

export function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[#_\-–—|]+/g, ' ').replace(/[^\p{L}\p{N}:/\.\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function compact(value: string): string { return normalizeText(value).replace(/\s+/g, ''); }
function fnv1a(input: string, seed: number): number { let hash = (0x811c9dc5 ^ seed) >>> 0; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; } return hash >>> 0; }
function hex32(value: number): string { return value.toString(16).padStart(8, '0'); }

export function deterministicUuid(input: string): string {
  const hex = [hex32(fnv1a(input, 0x01)), hex32(fnv1a(input, 0x9e3779b9)), hex32(fnv1a(input, 0x85ebca6b)), hex32(fnv1a(input, 0xc2b2ae35))].join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function normalizeItem(item: FixtureItem, source: SourceDescriptor): NormalizedItem {
  const title = item.title?.trim() ?? ''; const text = item.text?.trim() ?? ''; const normalizedText = normalizeText(`${title} ${text}`); const fingerprint = [item.url.trim(), normalizedText, String(source.authorityTier), source.role ?? ''].join('|');
  return { id: deterministicUuid(`raw:${fingerprint}`), url: item.url.trim(), title, text, normalizedText, source, fingerprint };
}

function aliasesFor(entity: EntityDescriptor): string[] { return [...new Set([entity.canonicalName, ...(entity.aliases ?? [])].map((alias) => normalizeText(alias)).filter(Boolean))]; }
function aliasMatchScore(text: string, alias: string): number { if (!alias) return 0; if (text.includes(alias)) return alias.length >= 8 ? 0.98 : 0.92; if (compact(text).includes(compact(alias))) return 0.9; return 0; }

export function resolveEntity(item: NormalizedItem, context: PipelineContext): ResolutionResult {
  const candidates: EntityDescriptor[] = []; if (context.entity) candidates.push(context.entity); if (context.candidateEntities) candidates.push(...context.candidateEntities); if (context.knownEntities) candidates.push(...context.knownEntities.map((canonicalName) => ({ canonicalName, aliases: [canonicalName] })));
  const scored = candidates.map((entity) => { let bestScore = 0; let matchedAlias: string | undefined; for (const alias of aliasesFor(entity)) { const score = aliasMatchScore(item.normalizedText, alias); if (score > bestScore) { bestScore = score; matchedAlias = alias; } } return { entity, score: bestScore, matchedAlias }; }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { state: 'UNRESOLVED', score: 0 };
  const best = scored[0]!; const tied = scored.filter((entry) => Math.abs(entry.score - best.score) < 0.02);
  if (tied.length > 1) return best.matchedAlias ? { state: 'AMBIGUOUS', score: best.score, matchedAlias: best.matchedAlias } : { state: 'AMBIGUOUS', score: best.score };
  return best.matchedAlias ? { state: 'RESOLVED', entity: best.entity, score: best.score, matchedAlias: best.matchedAlias } : { state: 'RESOLVED', entity: best.entity, score: best.score };
}

export function extractEnglishDate(text: string): string | undefined {
  const normalized = normalizeText(text); const monthFirst = normalized.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/); const dayFirst = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)[,]?\s+(20\d{2})\b/);
  let day: number; let month: number; let year: number;
  if (monthFirst) { month = MONTHS[monthFirst[1]!]!; day = Number(monthFirst[2]!); year = Number(monthFirst[3]!); }
  else if (dayFirst) { day = Number(dayFirst[1]); month = MONTHS[dayFirst[2]!]!; year = Number(dayFirst[3]); }
  else { const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/); if (!iso) return undefined; year = Number(iso[1]!); month = Number(iso[2]!); day = Number(iso[3]!); }
  const date = new Date(Date.UTC(year, month - 1, day)); if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function extractReleaseWindow(text: string): ReleaseWindow | undefined {
  const normalized = normalizeText(text);
  const years = [...normalized.matchAll(/\b(20\d{2})\b/g)].map((match) => ({ year: Number(match[1]), index: match.index ?? -1 }));
  if (years.length === 0) return undefined;
  for (const window of RELEASE_WINDOW_PATTERNS) {
    for (const pattern of window.patterns) {
      let patternIndex = normalized.indexOf(pattern);
      while (patternIndex >= 0) {
        const patternEnd = patternIndex + pattern.length;
        const nearest = years
          .map((year) => ({ ...year, distance: Math.abs(year.index - patternEnd) }))
          .filter((year) => year.index >= 0 && year.distance <= 40)
          .sort((left, right) => left.distance - right.distance)[0];
        if (nearest) return { kind: window.kind, label: window.label, year: nearest.year };
        patternIndex = normalized.indexOf(pattern, patternIndex + pattern.length);
      }
    }
  }
  return undefined;
}

function containsAny(text: string, phrases: string[]): boolean { return phrases.some((phrase) => text.includes(phrase)); }
function announcedRatherThanReleased(text: string): boolean { return containsAny(text, ['tomorrow', 'coming soon', 'on ', 'at ']) && !containsAny(text, ['out now', 'now out', 'is here', 'watch now', 'released', 'premieres now']); }
function projectAnnouncementLanguage(item: NormalizedItem, context: PipelineContext): boolean {
  if (!context.entity) return false;
  const text = item.normalizedText;
  if (containsAny(text, ['officially announce', 'proud to announce', 'thrilled to announce', 'happy to announce', 'announcing our next', 'announcing the next', 'new project', 'new film', 'next film', 'next venture', 'joins forces for', 'join forces for', 'teams up for', 'team up for'])) return true;
  return item.source.authorityTier <= 1 && containsAny(text, ['combo is back', 'combination is back']);
}

export function classifyEvent(item: NormalizedItem, context: PipelineContext): ClassifiedEvent | undefined {
  const text = item.normalizedText; const date = extractEnglishDate(`${item.title} ${item.text}`); const theatricalLanguage = containsAny(text, ['cinema', 'cinemas', 'theatre', 'theater', 'theatrical', 'worldwide release', 'releases worldwide', 'release worldwide']);
  if (date && theatricalLanguage) { const current = context.precondition?.currentTheatricalDate; if (current && current !== date) return { eventType: 'THEATRICAL_DATE_CHANGED', structuredData: { oldDate: current, newDate: date }, headline: `Theatrical release date changed to ${date}` }; return { eventType: 'THEATRICAL_DATE_ANNOUNCED', structuredData: { date }, headline: `Theatrical release date announced for ${date}` }; }
  if (containsAny(text, ['first single', 'second single', 'third single', 'lyrical video', 'lyric video', 'official song', 'full song'])) return { eventType: 'SONG_RELEASED', structuredData: {}, headline: 'Song released' };
  if (text.includes('trailer')) { const announced = announcedRatherThanReleased(text) && !containsAny(text, ['official trailer', 'trailer released']); return { eventType: announced ? 'TRAILER_ANNOUNCED' : 'TRAILER_RELEASED', structuredData: {}, headline: announced ? 'Trailer announced' : 'Trailer released' }; }
  if (text.includes('teaser')) { const announced = announcedRatherThanReleased(text) && !containsAny(text, ['official teaser', 'teaser released']); return { eventType: announced ? 'TEASER_ANNOUNCED' : 'TEASER_RELEASED', structuredData: {}, headline: announced ? 'Teaser announced' : 'Teaser released' }; }
  if (containsAny(text, ['glimpse', 'sneak peek'])) return { eventType: 'GLIMPSE_RELEASED', structuredData: {}, headline: 'Glimpse released' };
  if (containsAny(text, ['first look', 'firstlook'])) return { eventType: 'FIRST_LOOK_RELEASED', structuredData: {}, headline: 'First look released' };
  if (containsAny(text, ['new poster', 'official poster', 'poster out', 'poster released'])) return { eventType: 'POSTER_RELEASED', structuredData: {}, headline: 'Poster released' };
  if (containsAny(text, ['shoot begins', 'shoot starts', 'shoot started', 'filming begins', 'principal photography begins'])) return { eventType: 'SHOOT_STARTED', structuredData: {}, headline: 'Shoot started' };
  if (containsAny(text, ['shoot wrapped', 'wraps shoot', 'filming wrapped', 'it is a wrap', "it's a wrap"])) return { eventType: 'SHOOT_WRAPPED', structuredData: {}, headline: 'Shoot wrapped' };
  if (containsAny(text, ['shooting update', 'new schedule', 'next schedule', 'schedule underway', 'shoot schedule'])) return { eventType: 'SHOOT_SCHEDULE_UPDATE', structuredData: {}, headline: 'Shooting schedule updated' };
  if (containsAny(text, ['behind the scenes', 'bts video', 'bts from'])) return { eventType: 'BTS_RELEASED', structuredData: {}, headline: 'Behind-the-scenes update released' };
  if (containsAny(text, ['making video', 'making of'])) return { eventType: 'MAKING_VIDEO_RELEASED', structuredData: {}, headline: 'Making video released' };
  if (containsAny(text, ['pre release event', 'pre-release event'])) return { eventType: announcedRatherThanReleased(text) ? 'PRE_RELEASE_EVENT_ANNOUNCED' : 'PRE_RELEASE_EVENT_STARTED_OR_RELEASED', structuredData: {}, headline: 'Pre-release event update' };
  if (containsAny(text, ['press meet', 'press conference'])) return { eventType: announcedRatherThanReleased(text) ? 'PRESS_MEET_ANNOUNCED' : 'PRESS_MEET_STARTED_OR_RELEASED', structuredData: {}, headline: 'Press meet update' };
  if (containsAny(text, ['interview with', 'exclusive interview', 'full interview'])) return { eventType: 'INTERVIEW_RELEASED', structuredData: {}, headline: 'Interview released' };
  if (containsAny(text, ['promo', 'promotional video'])) return { eventType: 'PROMO_RELEASED', structuredData: {}, headline: 'Promo released' };
  if (projectAnnouncementLanguage(item, context)) {
    const releaseWindow = extractReleaseWindow(`${item.title} ${item.text}`);
    return {
      eventType: 'PROJECT_ANNOUNCED',
      structuredData: releaseWindow ? { releaseWindowKind: releaseWindow.kind, releaseWindowLabel: releaseWindow.label, releaseWindowYear: releaseWindow.year } : {},
      headline: `${context.entity!.canonicalName} project announced`,
    };
  }
  return undefined;
}

export function verificationForSource(source: SourceDescriptor): VerificationState { if (source.authorityTier <= 1) return 'OFFICIAL'; if (source.authorityTier === 2) return 'CONFIRMED'; if (source.authorityTier === 3) return 'RELIABLE_REPORT'; if (source.authorityTier === 4) return 'DEVELOPING'; return 'RUMOR'; }
export function priorityForEvent(eventType: string): PriorityBand { return EVENT_PRIORITY[eventType] ?? 'LOW'; }
function canonicalEntityId(entity: EntityDescriptor): string { return entity.id ?? deterministicUuid(`entity:${normalizeText(entity.canonicalName)}:${entity.year ?? ''}`); }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function dedupeKey(entity: EntityDescriptor, classified: ClassifiedEvent): string { return `${canonicalEntityId(entity)}|${classified.eventType}|${stableJson(classified.structuredData)}`; }
function shouldNotify(event: CanonicalEvent): boolean { return event.status === 'ACTIVE' && event.priorityBand !== 'LOW' && event.priorityBand !== 'SUPPRESSED'; }

export function processBatch(items: Array<{ item: FixtureItem; source: SourceDescriptor }>, context: PipelineContext): PipelineBatchResult {
  const itemResults: PipelineItemResult[] = []; const eventMap = new Map<string, CanonicalEvent>();
  for (const entry of items) {
    const normalized = normalizeItem(entry.item, entry.source); const resolution = resolveEntity(normalized, context); const result: PipelineItemResult = { normalized, resolution };
    if (resolution.state === 'RESOLVED' && resolution.entity) { const classified = classifyEvent(normalized, context); if (classified) { result.classified = classified; const key = dedupeKey(resolution.entity, classified); const existing = eventMap.get(key); if (existing) { existing.evidence.push({ rawItemId: normalized.id, role: 'REPEAT', sourceUrl: normalized.url }); const candidateVerification = verificationForSource(entry.source); if (verificationRank(candidateVerification) < verificationRank(existing.verificationState)) existing.verificationState = candidateVerification; } else { const entityId = canonicalEntityId(resolution.entity); eventMap.set(key, { id: deterministicUuid(`event:${key}`), primaryEntityId: entityId, eventType: classified.eventType, eventSchemaVersion: 1, verificationState: verificationForSource(entry.source), priorityBand: priorityForEvent(classified.eventType), headline: classified.headline, structuredData: classified.structuredData, status: 'ACTIVE', evidence: [{ rawItemId: normalized.id, role: 'PRIMARY', sourceUrl: normalized.url }], dedupeKey: key }); } } }
    itemResults.push(result);
  }
  const events = [...eventMap.values()]; return { items: itemResults, events, notifications: events.filter(shouldNotify) };
}

function verificationRank(state: VerificationState): number { return ['OFFICIAL', 'CONFIRMED', 'RELIABLE_REPORT', 'DEVELOPING', 'RUMOR'].indexOf(state); }
export function processSingle(item: FixtureItem, source: SourceDescriptor, context: PipelineContext): PipelineBatchResult { return processBatch([{ item, source }], context); }
