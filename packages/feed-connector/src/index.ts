import { XMLParser } from 'fast-xml-parser';

export const FEED_PARSER_VERSION = 'feed-parser-v2';

export type FeedFormat = 'RSS' | 'ATOM';
export type FeedPollClass = 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

export type FeedEntry = {
  stableId: string;
  canonicalUrl: string;
  title: string;
  text: string;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string | null;
  categories: string[];
};

export type ParsedFeed = {
  format: FeedFormat;
  title: string | null;
  homeUrl: string | null;
  entries: FeedEntry[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  updateTag: (tagName: string) => tagName,
});

const FEED_SCHEDULER_GRID_MS = 5 * 60_000;
const HEALTHY_SCHEDULER_ALIGNMENT_WINDOW_MS = 90_000;

function arrayify<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(scalarText).filter(Boolean).join(' ').trim();
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record['#cdata'] !== undefined) return scalarText(record['#cdata']);
    if (record['#text'] !== undefined) return scalarText(record['#text']);
  }
  return '';
}

function stripMarkup(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(value: unknown): string | null {
  const raw = scalarText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function rssGuid(value: unknown): string {
  return scalarText(value);
}

function rssLink(item: Record<string, unknown>): string {
  const link = scalarText(item.link);
  if (link) return link;
  const guid = item.guid;
  if (guid && typeof guid === 'object' && !Array.isArray(guid)) {
    const record = guid as Record<string, unknown>;
    if (String(record['@_isPermaLink'] ?? '').toLowerCase() !== 'false') {
      const candidate = scalarText(record);
      if (/^https?:\/\//i.test(candidate)) return candidate;
    }
  }
  return '';
}

function atomLink(entry: Record<string, unknown>): string {
  const links = arrayify(entry.link as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const alternate = links.find((link) => {
    const rel = scalarText(link['@_rel']);
    return !rel || rel === 'alternate';
  });
  return scalarText((alternate ?? links[0] ?? {})['@_href']);
}

function categories(value: unknown): string[] {
  return arrayify(value as unknown | unknown[])
    .map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return scalarText(record['@_term'] ?? record['#text'] ?? record['#cdata']);
      }
      return scalarText(item);
    })
    .filter(Boolean);
}

function parseRss(root: Record<string, unknown>): ParsedFeed {
  const channel = (root.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  if (!channel) throw new Error('invalid_rss_channel');
  const entries = arrayify(channel.item as Record<string, unknown> | Record<string, unknown>[] | undefined).map((item) => {
    const canonicalUrl = rssLink(item);
    const title = stripMarkup(scalarText(item.title));
    const text = stripMarkup(scalarText(item['content:encoded'] ?? item.description ?? item.summary));
    const publishedAt = isoDate(item.pubDate ?? item['dc:date'] ?? item.date);
    const stableId = rssGuid(item.guid) || canonicalUrl || `${publishedAt ?? 'undated'}:${title}`;
    return {
      stableId,
      canonicalUrl: canonicalUrl || stableId,
      title,
      text,
      publishedAt,
      updatedAt: isoDate(item.updated),
      author: scalarText(item.author ?? item['dc:creator']) || null,
      categories: categories(item.category),
    } satisfies FeedEntry;
  }).filter((entry) => Boolean(entry.stableId && entry.canonicalUrl));

  return {
    format: 'RSS',
    title: scalarText(channel.title) || null,
    homeUrl: scalarText(channel.link) || null,
    entries,
  };
}

function parseAtom(root: Record<string, unknown>): ParsedFeed {
  const feed = root.feed as Record<string, unknown> | undefined;
  if (!feed) throw new Error('invalid_atom_feed');
  const entries = arrayify(feed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined).map((entry) => {
    const canonicalUrl = atomLink(entry);
    const title = stripMarkup(scalarText(entry.title));
    const text = stripMarkup(scalarText(entry.content ?? entry.summary));
    const publishedAt = isoDate(entry.published ?? entry.updated);
    const stableId = scalarText(entry.id) || canonicalUrl || `${publishedAt ?? 'undated'}:${title}`;
    const authorObject = entry.author && typeof entry.author === 'object' && !Array.isArray(entry.author)
      ? entry.author as Record<string, unknown>
      : null;
    return {
      stableId,
      canonicalUrl: canonicalUrl || stableId,
      title,
      text,
      publishedAt,
      updatedAt: isoDate(entry.updated),
      author: scalarText(authorObject?.name ?? entry.author) || null,
      categories: categories(entry.category),
    } satisfies FeedEntry;
  }).filter((entry) => Boolean(entry.stableId && entry.canonicalUrl));

  const homeLinks = arrayify(feed.link as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const home = homeLinks.find((link) => {
    const rel = scalarText(link['@_rel']);
    return !rel || rel === 'alternate';
  });

  return {
    format: 'ATOM',
    title: scalarText(feed.title) || null,
    homeUrl: scalarText((home ?? homeLinks[0] ?? {})['@_href']) || null,
    entries,
  };
}

export function parseFeedXml(xml: string): ParsedFeed {
  if (!xml.trim()) throw new Error('empty_feed');
  const parsed = parser.parse(xml) as Record<string, unknown>;
  if (parsed.rss) return parseRss(parsed);
  if (parsed.feed) return parseAtom(parsed);
  throw new Error('unsupported_feed_format');
}

export function buildConditionalHeaders(input: { etag?: string | null; lastModified?: string | null }): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
  };
  if (input.etag) headers['if-none-match'] = input.etag;
  if (input.lastModified) headers['if-modified-since'] = input.lastModified;
  return headers;
}

export function pollIntervalMs(pollClass: FeedPollClass): number {
  switch (pollClass) {
    case 'HOT_5M': return 5 * 60_000;
    case 'ACTIVE_15M': return 15 * 60_000;
    case 'NORMAL_60M': return 60 * 60_000;
    case 'COLD_6H': return 6 * 60 * 60_000;
    case 'DAILY': return 24 * 60 * 60_000;
  }
}

function healthySchedulerBase(now: Date): Date {
  const timestamp = now.getTime();
  const remainder = ((timestamp % FEED_SCHEDULER_GRID_MS) + FEED_SCHEDULER_GRID_MS) % FEED_SCHEDULER_GRID_MS;
  if (remainder <= HEALTHY_SCHEDULER_ALIGNMENT_WINDOW_MS) {
    return new Date(timestamp - remainder);
  }
  return now;
}

export function nextFeedCheckAt(input: {
  now: Date;
  pollClass: FeedPollClass;
  consecutiveFailures?: number;
  retryAfterSeconds?: number | null;
}): string {
  const { now, pollClass } = input;
  if (input.retryAfterSeconds && input.retryAfterSeconds > 0) {
    return new Date(now.getTime() + Math.min(input.retryAfterSeconds, 24 * 60 * 60) * 1000).toISOString();
  }
  const failures = Math.max(0, Math.min(6, input.consecutiveFailures ?? 0));
  const multiplier = failures > 0 ? 2 ** failures : 1;
  const interval = Math.min(pollIntervalMs(pollClass) * multiplier, 24 * 60 * 60_000);
  const base = failures === 0 ? healthySchedulerBase(now) : now;
  return new Date(base.getTime() + interval).toISOString();
}

export function parseRetryAfterSeconds(value: string | null, now = new Date()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Math.max(0, Number(value.trim()));
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}
