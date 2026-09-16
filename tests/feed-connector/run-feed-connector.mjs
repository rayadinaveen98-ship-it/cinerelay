import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FEED_PARSER_VERSION,
  buildConditionalHeaders,
  nextFeedCheckAt,
  parseFeedXml,
  parseRetryAfterSeconds,
  pollIntervalMs,
} from '../../packages/feed-connector/dist/index.js';

const rss = await readFile(new URL('../../packages/source-fixtures/feeds/rss-official-sample.xml', import.meta.url), 'utf8');
const atom = await readFile(new URL('../../packages/source-fixtures/feeds/atom-official-sample.xml', import.meta.url), 'utf8');

const parsedRss = parseFeedXml(rss);
assert.equal(parsedRss.format, 'RSS');
assert.equal(parsedRss.title, 'Example Studio News');
assert.equal(parsedRss.entries.length, 2);
assert.equal(parsedRss.entries[0].stableId, 'studio-news-001');
assert.equal(parsedRss.entries[0].canonicalUrl, 'https://studio.example.com/news/astra-trailer');
assert.equal(parsedRss.entries[0].text, 'The official trailer for Project Astra arrives tomorrow at 6 PM.');
assert.equal(parsedRss.entries[0].author, 'Example Studio');
assert.deepEqual(parsedRss.entries[0].categories, ['Trailers']);

const parsedAtom = parseFeedXml(atom);
assert.equal(parsedAtom.format, 'ATOM');
assert.equal(parsedAtom.title, 'Example Platform Press');
assert.equal(parsedAtom.entries.length, 1);
assert.equal(parsedAtom.entries[0].stableId, 'tag:platform.example.com,2026:press-101');
assert.equal(parsedAtom.entries[0].canonicalUrl, 'https://platform.example.com/press/festival-release');
assert.equal(parsedAtom.entries[0].publishedAt, '2026-09-15T10:00:00.000Z');
assert.equal(parsedAtom.entries[0].updatedAt, '2026-09-15T10:15:00.000Z');
assert.equal(parsedAtom.entries[0].text, 'The film will stream from October 2.');

assert.deepEqual(buildConditionalHeaders({ etag: '"abc"', lastModified: 'Tue, 15 Sep 2026 10:00:00 GMT' }), {
  accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
  'if-none-match': '"abc"',
  'if-modified-since': 'Tue, 15 Sep 2026 10:00:00 GMT',
});

assert.equal(pollIntervalMs('HOT_5M'), 300000);
assert.equal(pollIntervalMs('ACTIVE_15M'), 900000);
assert.equal(pollIntervalMs('NORMAL_60M'), 3600000);
assert.equal(pollIntervalMs('COLD_6H'), 21600000);
assert.equal(pollIntervalMs('DAILY'), 86400000);

const now = new Date('2026-09-16T00:00:00Z');
assert.equal(nextFeedCheckAt({ now, pollClass: 'ACTIVE_15M' }), '2026-09-16T00:15:00.000Z');
assert.equal(nextFeedCheckAt({ now, pollClass: 'ACTIVE_15M', consecutiveFailures: 2 }), '2026-09-16T01:00:00.000Z');
assert.equal(nextFeedCheckAt({ now, pollClass: 'HOT_5M', retryAfterSeconds: 120 }), '2026-09-16T00:02:00.000Z');
assert.equal(parseRetryAfterSeconds('120', now), 120);
assert.equal(parseRetryAfterSeconds('Wed, 16 Sep 2026 00:05:00 GMT', now), 300);
assert.equal(FEED_PARSER_VERSION, 'feed-parser-v1');

assert.throws(() => parseFeedXml('<html></html>'), /unsupported_feed_format/);
assert.throws(() => parseFeedXml('  '), /empty_feed/);

console.log('feed connector canaries: PASS');
