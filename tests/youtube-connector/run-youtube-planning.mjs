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
  YOUTUBE_DISCOVERY_INTERVAL_MS,
  buildUploadsPlaylistItemsUrl,
  decideDiscoveryIntervalMs,
  decideFallbackHealth,
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

await test('authoritative discovery URL targets uploads playlist with bounded latest window', async () => {
  const url = new URL(buildUploadsPlaylistItemsUrl(uploadsPlaylistId, 'api-key', 50));
  assert.equal(url.pathname.endsWith('/playlistItems'), true);
  assert.equal(url.searchParams.get('playlistId'), uploadsPlaylistId);
  assert.equal(url.searchParams.get('part'), 'snippet,contentDetails');
  assert.equal(url.searchParams.get('maxResults'), '50');
  assert.equal(url.searchParams.get('key'), 'api-key');
});

await test('uploads response normalizes upload video ids and publication times', async () => {
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

await test('uploads helper rejects non-uploads playlist ids', async () => {
  assert.throws(() => buildUploadsPlaylistItemsUrl('PL-not-an-uploads-playlist', 'api-key', 10));
});

await test('quiet source is not marked stale merely because no WebSub delivery has occurred', async () => {
  assert.deepEqual(decideFallbackHealth({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: null }), { degraded: false });
});

await test('authoritative polling proves a missed WebSub accelerator delivery', async () => {
  assert.deepEqual(decideFallbackHealth({ gapExceededWindow: false, recoveredUploadCount: 1, existingErrorCode: null }), {
    degraded: true,
    errorCode: 'WEBSUB_MISSED_DELIVERY',
    errorMessage: 'Authoritative uploads polling found 1 upload(s) that were not observed via WebSub',
  });
});

await test('missed WebSub delivery stays degraded while authoritative polling remains healthy', async () => {
  assert.deepEqual(decideFallbackHealth({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: 'WEBSUB_MISSED_DELIVERY' }), {
    degraded: true,
    errorCode: 'WEBSUB_MISSED_DELIVERY',
    errorMessage: 'Authoritative uploads polling is healthy; awaiting a successful WebSub delivery to restore accelerator health',
  });
});

await test('bounded-window gap takes precedence over WebSub miss health', async () => {
  assert.deepEqual(decideFallbackHealth({ gapExceededWindow: true, recoveredUploadCount: 2, existingErrorCode: 'WEBSUB_MISSED_DELIVERY' }), {
    degraded: true,
    errorCode: 'FALLBACK_WINDOW_GAP',
    errorMessage: 'Previous upload was outside the bounded uploads-playlist window',
  });
});

await test('normal authoritative discovery cadence stays fifteen minutes', async () => {
  assert.equal(decideDiscoveryIntervalMs({ existingErrorCode: null, priority: 'NORMAL' }), YOUTUBE_DISCOVERY_INTERVAL_MS.normal);
  assert.equal(YOUTUBE_DISCOVERY_INTERVAL_MS.normal, 15 * 60 * 1000);
});

await test('high-priority authoritative discovery cadence is five minutes even while healthy', async () => {
  assert.equal(decideDiscoveryIntervalMs({ existingErrorCode: null, priority: 'HIGH' }), YOUTUBE_DISCOVERY_INTERVAL_MS.hot);
  assert.equal(YOUTUBE_DISCOVERY_INTERVAL_MS.hot, 5 * 60 * 1000);
});

await test('unspecified priority remains backward-compatible with normal fifteen-minute discovery', async () => {
  assert.equal(decideDiscoveryIntervalMs({ existingErrorCode: null }), YOUTUBE_DISCOVERY_INTERVAL_MS.normal);
});

await test('WebSub delivery degradation accelerates authoritative discovery to five minutes', async () => {
  assert.equal(decideDiscoveryIntervalMs({ existingErrorCode: 'WEBSUB_MISSED_DELIVERY', priority: 'NORMAL' }), YOUTUBE_DISCOVERY_INTERVAL_MS.hot);
  assert.equal(YOUTUBE_DISCOVERY_INTERVAL_MS.hot, 5 * 60 * 1000);
});

await test('provider failures override high priority and back off discovery to protect quota and upstreams', async () => {
  assert.equal(decideDiscoveryIntervalMs({ existingErrorCode: 'WEBSUB_MISSED_DELIVERY', providerFailure: true, priority: 'HIGH' }), YOUTUBE_DISCOVERY_INTERVAL_MS.backoff);
  assert.equal(YOUTUBE_DISCOVERY_INTERVAL_MS.backoff, 30 * 60 * 1000);
});

console.log(`\nYouTube planning/enrichment/discovery canaries: ${passed}/17 passed.`);
