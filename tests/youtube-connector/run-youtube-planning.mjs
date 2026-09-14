import assert from 'node:assert/strict';
import {
  planSubscription,
  planUnsubscription,
} from '../../packages/youtube-connector/dist/subscription.js';
import {
  projectVideoSnapshotToRawItem,
  videoSnapshotFingerprint,
} from '../../packages/youtube-connector/dist/enrichment.js';
import {
  buildUploadsPlaylistItemsUrl,
  normalizeUploadsPlaylistItemsResponse,
} from '../../packages/youtube-connector/dist/fallback.js';

const channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const uploadsPlaylistId = 'UUaaaaaaaaaaaaaaaaaaaaaa';
const sourceIdentityId = '11111111-1111-4111-8111-111111111111';
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`PASS ${name}`); }

await test('initial subscription plan creates generation one', async () => {
  const plan = await planSubscription({ sourceIdentityId, channelId, currentGeneration: 0, callbackBaseUrl: 'https://relay.example/functions/v1/youtube-websub', masterSecret: 'master-secret', requestedLeaseSeconds: 864000 });
  assert.equal(plan.generation, 1);
  assert.equal(plan.state, 'PENDING');
  assert.equal(new URL(plan.callbackUrl).searchParams.has('token'), true);
  assert.equal(new URLSearchParams(plan.hubRequest.body).get('hub.secret'), plan.hubSecret);
});

await test('renewal plan advances generation without reusing credentials', async () => {
  const first = await planSubscription({ sourceIdentityId, channelId, currentGeneration: 0, callbackBaseUrl: 'https://relay.example/functions/v1/youtube-websub', masterSecret: 'master-secret' });
  const renewal = await planSubscription({ sourceIdentityId, channelId, currentGeneration: 1, callbackBaseUrl: 'https://relay.example/functions/v1/youtube-websub', masterSecret: 'master-secret' });
  assert.equal(renewal.generation, 2);
  assert.equal(renewal.state, 'RENEWING');
  assert.notEqual(renewal.callbackTokenHash, first.callbackTokenHash);
  assert.notEqual(renewal.hubSecret, first.hubSecret);
});

await test('unsubscription plan reconstructs the exact active generation callback', async () => {
  const active = await planSubscription({ sourceIdentityId, channelId, currentGeneration: 1, callbackBaseUrl: 'https://relay.example/functions/v1/youtube-websub', masterSecret: 'master-secret' });
  const unsubscribe = await planUnsubscription({ sourceIdentityId, channelId, generation: 2, callbackBaseUrl: 'https://relay.example/functions/v1/youtube-websub', masterSecret: 'master-secret' });
  assert.equal(unsubscribe.callbackTokenHash, active.callbackTokenHash);
  assert.equal(unsubscribe.hubSecret, active.hubSecret);
  assert.equal(unsubscribe.state, 'UNSUBSCRIBING');
});

await test('video snapshot fingerprint is stable and changes with meaningful metadata', async () => {
  const base = { videoId: 'vidAAA12345', channelId, title: 'Example Trailer', description: 'Official trailer', publishedAt: '2026-09-14T05:00:00.000Z', privacyStatus: 'public' };
  const reordered = { privacyStatus: 'public', description: 'Official trailer', title: 'Example Trailer', channelId, videoId: 'vidAAA12345', publishedAt: '2026-09-14T05:00:00.000Z' };
  assert.equal(await videoSnapshotFingerprint(base), await videoSnapshotFingerprint(reordered));
  assert.notEqual(await videoSnapshotFingerprint(base), await videoSnapshotFingerprint({ ...base, title: 'Example Trailer Updated' }));
});

await test('enriched video projects into revision-safe raw-item fields', async () => {
  const projection = await projectVideoSnapshotToRawItem({ videoId: 'vidAAA12345', channelId, title: 'Example Trailer', description: 'Official trailer', publishedAt: '2026-09-14T05:00:00.000Z', privacyStatus: 'public' });
  assert.equal(projection.platformItemId, 'vidAAA12345');
  assert.equal(projection.itemType, 'YOUTUBE_VIDEO');
  assert.equal(projection.mediaType, 'VIDEO');
  assert.equal(projection.contentFingerprint.length, 64);
});

await test('fallback URL targets uploads playlist with bounded latest window', async () => {
  const url = new URL(buildUploadsPlaylistItemsUrl(uploadsPlaylistId, 'api-key', 50));
  assert.equal(url.pathname.endsWith('/playlistItems'), true);
  assert.equal(url.searchParams.get('playlistId'), uploadsPlaylistId);
  assert.equal(url.searchParams.get('part'), 'snippet,contentDetails');
  assert.equal(url.searchParams.get('maxResults'), '50');
  assert.equal(url.searchParams.get('key'), 'api-key');
});

await test('fallback response normalizes upload video ids and publication times', async () => {
  const normalized = normalizeUploadsPlaylistItemsResponse({
    items: [
      {
        snippet: { title: 'Example Trailer', resourceId: { videoId: 'vidAAA12345' } },
        contentDetails: { videoId: 'vidAAA12345', videoPublishedAt: '2026-09-14T05:00:00Z' },
      },
    ],
  });
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].videoId, 'vidAAA12345');
  assert.equal(normalized[0].title, 'Example Trailer');
  assert.equal(normalized[0].publishedAt, '2026-09-14T05:00:00.000Z');
});

await test('fallback helper rejects non-uploads playlist ids', async () => {
  assert.throws(() => buildUploadsPlaylistItemsUrl('PL-not-an-uploads-playlist', 'api-key', 10));
});

console.log(`\nYouTube planning/enrichment/fallback canaries: ${passed}/8 passed.`);
