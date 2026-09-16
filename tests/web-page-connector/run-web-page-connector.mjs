import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SELF_SELECTOR,
  WEB_PAGE_PARSER_VERSION,
  assessPageDrift,
  buildPageConditionalHeaders,
  canonicalizePageUrl,
  nextPageCheckAt,
  pagePollIntervalMs,
  parsePageRetryAfterSeconds,
  parseWebPage,
  planPageDelta,
} from '../../packages/web-page-connector/dist/index.js';

const html = await readFile(new URL('../../packages/source-fixtures/pages/first-party-newsroom.html', import.meta.url), 'utf8');
const profile = {
  profileVersion: 'example-newsroom-v1',
  itemSelector: 'article.news-card',
  linkSelector: 'a.story-link',
  titleSelector: '.story-title',
  summarySelector: '.story-summary',
  dateSelector: 'time.story-date',
  dateAttribute: 'datetime',
  authorSelector: '.story-author',
  itemIdAttribute: 'data-id',
  includeUrlPattern: '^https://studio\\.example\\.com/news/',
  maxItems: 20,
  minItems: 2,
};

const parsed = parseWebPage(html, 'https://studio.example.com/news/', profile);
assert.equal(parsed.rawMatchCount, 3);
assert.equal(parsed.items.length, 2);
assert.equal(parsed.items[0].stableId, 'press-103');
assert.equal(parsed.items[0].canonicalUrl, 'https://studio.example.com/news/project-orbit-trailer');
assert.equal(parsed.items[0].title, 'Project Orbit Official Trailer Released');
assert.equal(parsed.items[0].text, 'The studio has released the official trailer for Project Orbit.');
assert.equal(parsed.items[0].publishedAt, '2026-09-16T04:00:00.000Z');
assert.equal(parsed.items[0].author, 'Example Studio');
assert.equal(parsed.items[1].canonicalUrl, 'https://studio.example.com/news/orbit-first-look');
assert.match(parsed.structureFingerprint, /^[a-f0-9]{8}$/);

const anchorOnlyHtml = `
  <nav><a href="/about">About</a></nav>
  <main>
    <a href="/news/entertainment/orbit-trailer?utm_source=home">Orbit Trailer Released</a>
    <a href="/news/entertainment/orbit-first-look">Orbit First Look</a>
    <a href="https://other.example.com/news/nope">External</a>
  </main>`;
const anchorOnly = parseWebPage(anchorOnlyHtml, 'https://studio.example.com/', {
  profileVersion: 'anchor-discovery-v1',
  itemSelector: 'a[href]',
  linkSelector: SELF_SELECTOR,
  titleSelector: SELF_SELECTOR,
  includeUrlPattern: '^https://studio\\.example\\.com/news/entertainment/[^/?#]+$',
  minItems: 2,
});
assert.equal(anchorOnly.items.length, 2);
assert.equal(anchorOnly.items[0].canonicalUrl, 'https://studio.example.com/news/entertainment/orbit-trailer');
assert.equal(anchorOnly.items[0].title, 'Orbit Trailer Released');
assert.equal(anchorOnly.items[1].title, 'Orbit First Look');

assert.equal(canonicalizePageUrl('/news/test?utm_medium=social&x=1#section', 'https://studio.example.com/news/'), 'https://studio.example.com/news/test?x=1');

const baseline = planPageDelta(parsed.items, null);
assert.equal(baseline.baseline, true);
assert.equal(baseline.newItems.length, 0);
assert.equal(baseline.newestItemId, 'press-103');

const unchanged = planPageDelta(parsed.items, 'press-103');
assert.equal(unchanged.gapExceededWindow, false);
assert.equal(unchanged.newItems.length, 0);

const oneNew = planPageDelta(parsed.items, 'press-102');
assert.deepEqual(oneNew.newItems.map((item) => item.stableId), ['press-103']);

const gap = planPageDelta(parsed.items, 'press-001');
assert.equal(gap.gapExceededWindow, true);
assert.equal(gap.newItems.length, 2);

assert.deepEqual(assessPageDrift({ currentItemCount: 0, minItems: 1, currentFingerprint: 'a' }), {
  state: 'PARSER_BROKEN',
  code: 'PAGE_SELECTOR_UNDER_MINIMUM',
  message: 'Parser produced 0 items; minimum is 1',
});
assert.equal(assessPageDrift({ previousItemCount: 20, currentItemCount: 4, minItems: 2, previousFingerprint: 'a', currentFingerprint: 'b' }).state, 'DEGRADED');
assert.equal(assessPageDrift({ previousItemCount: 10, currentItemCount: 10, minItems: 2, previousFingerprint: parsed.structureFingerprint, currentFingerprint: parsed.structureFingerprint }).state, 'HEALTHY');

assert.deepEqual(buildPageConditionalHeaders({ etag: '"page"', lastModified: 'Wed, 16 Sep 2026 04:00:00 GMT' }), {
  accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  'if-none-match': '"page"',
  'if-modified-since': 'Wed, 16 Sep 2026 04:00:00 GMT',
});
assert.equal(pagePollIntervalMs('NORMAL_60M'), 3600000);
const now = new Date('2026-09-16T00:00:00Z');
assert.equal(nextPageCheckAt({ now, pollClass: 'ACTIVE_15M' }), '2026-09-16T00:15:00.000Z');
assert.equal(nextPageCheckAt({ now, pollClass: 'ACTIVE_15M', consecutiveFailures: 2 }), '2026-09-16T01:00:00.000Z');
assert.equal(parsePageRetryAfterSeconds('90', now), 90);
assert.equal(WEB_PAGE_PARSER_VERSION, 'first-party-html-v1');

assert.throws(() => parseWebPage('', 'https://studio.example.com/news/', profile), /empty_page/);
assert.throws(() => parseWebPage(html, 'https://studio.example.com/news/', { ...profile, itemSelector: '[' }), /page_profile_invalid_item_selector/);

console.log('web page connector canaries: PASS');
