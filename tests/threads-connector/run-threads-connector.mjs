import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  THREADS_CONNECTOR_VERSION,
  THREADS_POST_FIELDS,
  buildThreadsProfilePostsUrl,
  nextThreadsCheckAt,
  normalizeThreadsUsername,
  parseRetryAfterSeconds,
  parseThreadsProfilePosts,
  planThreadsDelta,
  pollIntervalMs,
} from '../../packages/threads-connector/dist/index.js';

const v1 = JSON.parse(await readFile(new URL('../../packages/source-fixtures/threads/profile-posts-v1.json', import.meta.url), 'utf8'));
const v2 = JSON.parse(await readFile(new URL('../../packages/source-fixtures/threads/profile-posts-v2.json', import.meta.url), 'utf8'));

assert.equal(normalizeThreadsUsername('@Example'), 'example');
assert.throws(() => normalizeThreadsUsername('bad/name'), /invalid_threads_username/);
assert.ok(THREADS_POST_FIELDS.includes('link_attachment_url'));

const url = new URL(buildThreadsProfilePostsUrl('@Example', 500));
assert.equal(url.origin, 'https://graph.threads.net');
assert.equal(url.pathname, '/profile_posts');
assert.equal(url.searchParams.get('username'), 'example');
assert.equal(url.searchParams.get('limit'), '100');

const first = parseThreadsProfilePosts(v1, 'example');
assert.equal(first.length, 2);
assert.equal(first[0].id, '1002');
assert.equal(first[1].id, '1001');
assert.equal(first[1].username, 'example');
assert.equal(first[1].altText, 'Official first look poster');

const baseline = planThreadsDelta(first, null);
assert.equal(baseline.baseline, true);
assert.equal(baseline.newPosts.length, 0);
assert.equal(baseline.newestPostId, '1002');

const second = parseThreadsProfilePosts(v2, 'example');
const delta = planThreadsDelta(second, '1002');
assert.equal(delta.gapExceededWindow, false);
assert.deepEqual(delta.newPosts.map((post) => post.id), ['1003']);

const unchanged = planThreadsDelta(second, '1003');
assert.equal(unchanged.newPosts.length, 0);

const gap = planThreadsDelta(second, 'older-missing');
assert.equal(gap.gapExceededWindow, true);
assert.deepEqual(gap.newPosts.map((post) => post.id), ['1003', '1002', '1001']);

assert.throws(() => parseThreadsProfilePosts({ data: [{ id: 'x', username: 'other', permalink: 'https://threads.net/x' }] }, 'example'), /threads_profile_username_mismatch/);
assert.throws(() => parseThreadsProfilePosts({ nope: [] }), /invalid_threads_profile_posts_payload/);

assert.equal(pollIntervalMs('ACTIVE_15M'), 900000);
const now = new Date('2026-09-16T08:00:00Z');
assert.equal(nextThreadsCheckAt({ now, pollClass: 'ACTIVE_15M' }), '2026-09-16T08:15:00.000Z');
assert.equal(nextThreadsCheckAt({ now, pollClass: 'ACTIVE_15M', consecutiveFailures: 2 }), '2026-09-16T09:00:00.000Z');
assert.equal(nextThreadsCheckAt({ now, pollClass: 'HOT_5M', retryAfterSeconds: 120 }), '2026-09-16T08:02:00.000Z');
assert.equal(parseRetryAfterSeconds('120', now), 120);
assert.equal(THREADS_CONNECTOR_VERSION, 'threads-profile-v1');

console.log('threads connector canaries: PASS');
