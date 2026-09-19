import assert from 'node:assert/strict';
import {
  X_CONNECTOR_VERSION,
  buildXUserLookupUrl,
  buildXUserPostsUrl,
  nextXCheckAt,
  normalizeXUserId,
  normalizeXUsername,
  originalXPosts,
  parseRateLimitResetSeconds,
  parseRetryAfterSeconds,
  parseXUserLookup,
  parseXUserPosts,
  planXDelta,
  pollIntervalMs,
} from '../../packages/x-connector/dist/index.js';

assert.equal(normalizeXUsername('@MythriOfficial'), 'mythriofficial');
assert.throws(() => normalizeXUsername('bad/name'), /invalid_x_username/);
assert.equal(normalizeXUserId('1234567890'), '1234567890');
assert.throws(() => normalizeXUserId('abc'), /invalid_x_user_id/);

const lookupUrl = new URL(buildXUserLookupUrl('@MythriOfficial'));
assert.equal(lookupUrl.origin, 'https://api.x.com');
assert.equal(lookupUrl.pathname, '/2/users/by/username/mythriofficial');
assert.ok(lookupUrl.searchParams.get('user.fields')?.includes('verified_type'));

const user = parseXUserLookup({
  data: {
    id: '10001',
    username: 'MythriOfficial',
    name: 'Mythri Movie Makers',
    verified: true,
    verified_type: 'business',
  },
}, '@MythriOfficial');
assert.equal(user.id, '10001');
assert.equal(user.username, 'mythriofficial');
assert.equal(user.verified, true);
assert.throws(() => parseXUserLookup({ data: { id: '10001', username: 'other' } }, 'MythriOfficial'), /x_username_mismatch/);

const postsUrl = new URL(buildXUserPostsUrl({
  userId: '10001',
  sinceId: '9000',
  maxResults: 500,
  paginationToken: 'next-token',
}));
assert.equal(postsUrl.pathname, '/2/users/10001/tweets');
assert.equal(postsUrl.searchParams.get('max_results'), '100');
assert.equal(postsUrl.searchParams.get('exclude'), 'replies,retweets');
assert.equal(postsUrl.searchParams.get('since_id'), '9000');
assert.equal(postsUrl.searchParams.get('pagination_token'), 'next-token');

const payload = {
  data: [
    {
      id: '10004',
      author_id: '10001',
      text: 'Official teaser tomorrow.',
      created_at: '2026-09-18T08:05:00Z',
      lang: 'en',
      attachments: { media_keys: ['3_1'] },
    },
    {
      id: '10003',
      author_id: '10001',
      text: 'Reply noise',
      created_at: '2026-09-18T08:04:00Z',
      referenced_tweets: [{ type: 'replied_to', id: '8000' }],
    },
    {
      id: '10002',
      author_id: '10001',
      text: 'Repost noise',
      created_at: '2026-09-18T08:03:00Z',
      referenced_tweets: [{ type: 'retweeted', id: '7000' }],
    },
    {
      id: '10001',
      author_id: '10001',
      text: 'First look poster.',
      created_at: '2026-09-18T08:00:00Z',
      lang: 'en',
    },
  ],
};

const posts = parseXUserPosts(payload, '@MythriOfficial', '10001');
assert.equal(posts.length, 4);
assert.equal(posts[0].canonicalUrl, 'https://x.com/mythriofficial/status/10004');
assert.deepEqual(posts[0].mediaKeys, ['3_1']);
assert.equal(posts[1].isReply, true);
assert.equal(posts[2].isRepost, true);
assert.deepEqual(originalXPosts(posts).map((post) => post.id), ['10004', '10001']);
assert.throws(() => parseXUserPosts({ data: [{ id: '1', author_id: '2', text: 'wrong author' }] }, 'MythriOfficial', '10001'), /x_author_id_mismatch/);

const baseline = planXDelta(posts, null);
assert.equal(baseline.baseline, true);
assert.equal(baseline.newPosts.length, 0);
assert.equal(baseline.newestPostId, '10004');

const delta = planXDelta(posts, '10001');
assert.equal(delta.baseline, false);
assert.equal(delta.gapExceededWindow, false);
assert.deepEqual(delta.newPosts.map((post) => post.id), ['10004']);

const gap = planXDelta(posts, '9999');
assert.equal(gap.gapExceededWindow, true);
assert.deepEqual(gap.newPosts.map((post) => post.id), ['10004', '10001']);

assert.equal(pollIntervalMs('HOT_5M'), 300000);
assert.equal(pollIntervalMs('ACTIVE_15M'), 900000);
const now = new Date('2026-09-18T08:00:00Z');
assert.equal(nextXCheckAt({ now, pollClass: 'HOT_5M' }), '2026-09-18T08:05:00.000Z');
assert.equal(nextXCheckAt({ now, pollClass: 'HOT_5M', consecutiveFailures: 2 }), '2026-09-18T08:20:00.000Z');
assert.equal(nextXCheckAt({ now, pollClass: 'HOT_5M', retryAfterSeconds: 120 }), '2026-09-18T08:02:00.000Z');
assert.equal(parseRetryAfterSeconds('120', now), 120);
assert.equal(parseRateLimitResetSeconds(String(now.getTime() / 1000 + 180), now), 180);
assert.equal(X_CONNECTOR_VERSION, 'x-api-v2-profile-v1');

console.log('X connector canaries: PASS');
