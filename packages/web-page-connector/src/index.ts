import { parse, type HTMLElement } from 'node-html-parser';

export const WEB_PAGE_PARSER_VERSION = 'first-party-html-v1';
export const SELF_SELECTOR = '@self';

export type PagePollClass = 'HOT_5M' | 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

export type WebPageParserProfile = {
  profileVersion: string;
  itemSelector: string;
  linkSelector: string;
  titleSelector?: string;
  summarySelector?: string;
  dateSelector?: string;
  dateAttribute?: string;
  authorSelector?: string;
  itemIdAttribute?: string;
  linkAttribute?: string;
  includeUrlPattern?: string;
  excludeUrlPattern?: string;
  maxItems?: number;
  minItems?: number;
  order?: 'NEWEST_FIRST' | 'OLDEST_FIRST';
};

export type WebPageItem = {
  stableId: string;
  canonicalUrl: string;
  title: string;
  text: string;
  publishedAt: string | null;
  author: string | null;
};

export type ParsedWebPage = {
  items: WebPageItem[];
  rawMatchCount: number;
  structureFingerprint: string;
};

export type PageDeltaPlan<T extends { stableId: string }> = {
  baseline: boolean;
  gapExceededWindow: boolean;
  newestItemId: string | null;
  newItems: T[];
};

export type PageDriftAssessment = {
  state: 'HEALTHY' | 'DEGRADED' | 'PARSER_BROKEN';
  code: string | null;
  message: string | null;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function safeRegex(pattern: string | undefined, label: string): RegExp | null {
  if (!pattern) return null;
  if (pattern.length > 300) throw new Error(`${label}_pattern_too_long`);
  try {
    return new RegExp(pattern, 'i');
  } catch {
    throw new Error(`${label}_pattern_invalid`);
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function selectedNode(item: HTMLElement, selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  if (selector === SELF_SELECTOR) return item;
  return item.querySelector(selector);
}

function selectedText(item: HTMLElement, selector: string | undefined): string {
  return cleanText(selectedNode(item, selector)?.innerText);
}

function selectedAttribute(item: HTMLElement, selector: string, attribute: string): string {
  return cleanText(selectedNode(item, selector)?.getAttribute(attribute));
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function canonicalizePageUrl(value: string, baseUrl: string): string {
  const url = new URL(value, baseUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('unsupported_item_url_protocol');
  url.hash = '';
  const trackingKeys = [...url.searchParams.keys()].filter((key) =>
    key.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase()),
  );
  for (const key of trackingKeys) url.searchParams.delete(key);
  return url.toString();
}

function structureShape(item: HTMLElement, profile: WebPageParserProfile): string {
  const link = selectedNode(item, profile.linkSelector);
  const title = selectedNode(item, profile.titleSelector);
  const summary = selectedNode(item, profile.summarySelector);
  const date = selectedNode(item, profile.dateSelector);
  return [
    item.tagName,
    cleanText(item.getAttribute('class')),
    link?.tagName ?? '',
    cleanText(link?.getAttribute('class')),
    title?.tagName ?? '',
    summary?.tagName ?? '',
    date?.tagName ?? '',
  ].join('|');
}

export function parseWebPage(html: string, pageUrl: string, profile: WebPageParserProfile): ParsedWebPage {
  if (!html.trim()) throw new Error('empty_page');
  if (!profile.itemSelector?.trim() || !profile.linkSelector?.trim()) throw new Error('page_profile_missing_required_selector');
  if (!profile.profileVersion?.trim()) throw new Error('page_profile_version_required');

  const include = safeRegex(profile.includeUrlPattern, 'include_url');
  const exclude = safeRegex(profile.excludeUrlPattern, 'exclude_url');
  const maxItems = Math.max(1, Math.min(100, Number(profile.maxItems ?? 50)));
  const root = parse(html, { lowerCaseTagName: false, comment: false });

  let matched: HTMLElement[];
  try {
    matched = root.querySelectorAll(profile.itemSelector) as HTMLElement[];
  } catch {
    throw new Error('page_profile_invalid_item_selector');
  }

  const shapes: string[] = [];
  const seen = new Set<string>();
  const items: WebPageItem[] = [];

  for (const item of matched) {
    if (items.length >= maxItems) break;
    let rawLink = '';
    try {
      rawLink = selectedAttribute(item, profile.linkSelector, profile.linkAttribute ?? 'href');
    } catch {
      throw new Error('page_profile_invalid_link_selector');
    }
    if (!rawLink) continue;

    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizePageUrl(rawLink, pageUrl);
    } catch {
      continue;
    }
    if (include && !include.test(canonicalUrl)) continue;
    if (exclude && exclude.test(canonicalUrl)) continue;

    const stableId = cleanText(profile.itemIdAttribute ? item.getAttribute(profile.itemIdAttribute) : '') || canonicalUrl;
    if (!stableId || seen.has(stableId)) continue;

    const linkNode = selectedNode(item, profile.linkSelector);
    const title = selectedText(item, profile.titleSelector) || cleanText(linkNode?.innerText);
    if (!title) continue;
    seen.add(stableId);

    const text = selectedText(item, profile.summarySelector);
    const dateNode = selectedNode(item, profile.dateSelector);
    const dateRaw = dateNode
      ? cleanText(profile.dateAttribute ? dateNode.getAttribute(profile.dateAttribute) : dateNode.getAttribute('datetime') ?? dateNode.innerText)
      : '';
    const author = selectedText(item, profile.authorSelector) || null;

    shapes.push(structureShape(item, profile));
    items.push({
      stableId,
      canonicalUrl,
      title,
      text,
      publishedAt: parseDate(dateRaw),
      author,
    });
  }

  if (profile.order === 'OLDEST_FIRST') items.reverse();
  const shapeSample = shapes.slice(0, 12).join('\n');
  return {
    items,
    rawMatchCount: matched.length,
    structureFingerprint: stableHash(`${profile.profileVersion}\n${shapeSample}`),
  };
}

export function planPageDelta<T extends { stableId: string }>(items: T[], lastItemId?: string | null): PageDeltaPlan<T> {
  const newestItemId = items[0]?.stableId ?? null;
  if (items.length === 0) return { baseline: !lastItemId, gapExceededWindow: false, newestItemId: null, newItems: [] };
  if (!lastItemId) return { baseline: true, gapExceededWindow: false, newestItemId, newItems: [] };
  const previousIndex = items.findIndex((item) => item.stableId === lastItemId);
  if (previousIndex === 0) return { baseline: false, gapExceededWindow: false, newestItemId, newItems: [] };
  if (previousIndex > 0) return { baseline: false, gapExceededWindow: false, newestItemId, newItems: items.slice(0, previousIndex) };
  return { baseline: false, gapExceededWindow: true, newestItemId, newItems: items };
}

export function assessPageDrift(input: {
  previousItemCount?: number | null;
  currentItemCount: number;
  minItems?: number;
  previousFingerprint?: string | null;
  currentFingerprint: string;
}): PageDriftAssessment {
  const minItems = Math.max(1, Number(input.minItems ?? 1));
  if (input.currentItemCount < minItems) {
    return {
      state: 'PARSER_BROKEN',
      code: 'PAGE_SELECTOR_UNDER_MINIMUM',
      message: `Parser produced ${input.currentItemCount} items; minimum is ${minItems}`,
    };
  }

  const previous = Math.max(0, Number(input.previousItemCount ?? 0));
  if (previous >= 5 && input.currentItemCount < Math.max(minItems, Math.ceil(previous * 0.3))) {
    return {
      state: 'DEGRADED',
      code: 'PAGE_ITEM_COUNT_DROP',
      message: `Parser item count dropped from ${previous} to ${input.currentItemCount}`,
    };
  }

  if (previous >= 3 && input.previousFingerprint && input.previousFingerprint !== input.currentFingerprint && input.currentItemCount < previous) {
    return {
      state: 'DEGRADED',
      code: 'PAGE_STRUCTURE_DRIFT',
      message: 'Page structure fingerprint changed while the extracted item count decreased',
    };
  }

  return { state: 'HEALTHY', code: null, message: null };
}

export function pagePollIntervalMs(pollClass: PagePollClass): number {
  switch (pollClass) {
    case 'HOT_5M': return 5 * 60_000;
    case 'ACTIVE_15M': return 15 * 60_000;
    case 'NORMAL_60M': return 60 * 60_000;
    case 'COLD_6H': return 6 * 60 * 60_000;
    case 'DAILY': return 24 * 60 * 60_000;
  }
}

export function nextPageCheckAt(input: {
  now: Date;
  pollClass: PagePollClass;
  consecutiveFailures?: number;
  retryAfterSeconds?: number | null;
}): string {
  if (input.retryAfterSeconds && input.retryAfterSeconds > 0) {
    return new Date(input.now.getTime() + Math.min(input.retryAfterSeconds, 24 * 60 * 60) * 1000).toISOString();
  }
  const failures = Math.max(0, Math.min(6, input.consecutiveFailures ?? 0));
  const interval = Math.min(pagePollIntervalMs(input.pollClass) * (failures > 0 ? 2 ** failures : 1), 24 * 60 * 60_000);
  return new Date(input.now.getTime() + interval).toISOString();
}

export function buildPageConditionalHeaders(input: { etag?: string | null; lastModified?: string | null }): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  };
  if (input.etag) headers['if-none-match'] = input.etag;
  if (input.lastModified) headers['if-modified-since'] = input.lastModified;
  return headers;
}

export function parsePageRetryAfterSeconds(value: string | null, now = new Date()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Math.max(0, Number(value.trim()));
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}
