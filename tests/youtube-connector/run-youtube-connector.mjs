import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  YOUTUBE_QUOTA_POLICY_V1,
  buildChannelsListUrl,
  buildVerificationResponse,
  buildVideosListUrl,
  buildWebSubRequest,
  calculateSubscriptionTimes,
  decideQuota,
  deriveWebSubCredential,
  notificationExternalKey,
  normalizeChannelsListResponse,
  normalizeVideosListResponse,
  parseWebSubVerification,
  parseYouTubeAtomFeed,
  sha256Hex,
  verifyHubSignature,
  youtubeTopicUrl,
} from '../../packages/youtube-connector/dist/index.js';

const channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const videoId = 'vidAAA12345';
const uploadXml = await readFile(new URL('../../packages/source-fixtures/youtube/websub-upload.xml', import.meta.url), 'utf8');
const multiXml = await readFile(new URL('../../packages/source-fixtures/youtube/websub-multi-update.xml', import.meta.url), 'utf8');
const videoList = JSON.parse(await readFile(new URL('../../packages/source-fixtures/youtube/video-list-upcoming.json', import.meta.url), 'utf8'));
const channelList = JSON.parse(await readFile(new URL('../../packages/source-fixtures/youtube/channel-list.json', import.meta.url), 'utf8'));

let passed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; console.log(`PASS ${name}`); });
}

await test('canonical YouTube topic URL', () => {
  assert.equal(youtubeTopicUrl(channelId), `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
});

await test('WebSub subscription request contract', () => {
  const request = buildWebSubRequest({ mode: 'subscribe', channelId, callbackUrl: 'https://relay.example/websub?token=abc', secret: 'secret', leaseSeconds: 864000 });
  const form = new URLSearchParams(request.body);
  assert.equal(form.get('hub.mode'), 'subscribe');
  assert.equal(form.get('hub.topic'), youtubeTopicUrl(channelId));
  assert.equal(form.get('hub.secret'), 'secret');
  assert.equal(form.get('hub.lease_seconds'), '864000');
});

await test('WebSub verification challenge parsing', () => {
  const params = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.topic': youtubeTopicUrl(channelId), 'hub.challenge': 'AbC-123_=/+', 'hub.lease_seconds': '864000' });
  const verification = parseWebSubVerification(params);
  assert.equal(verification.mode, 'subscribe');
  assert.equal(verification.leaseSeconds, 864000);
  const response = buildVerificationResponse(verification.challenge);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

await test('unsafe WebSub challenge is rejected', () => {
  assert.throws(() => parseWebSubVerification(new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.topic': youtubeTopicUrl(channelId), 'hub.challenge': '<script>', 'hub.lease_seconds': '10' })));
});

await test('YouTube Atom upload parser', () => {
  const notifications = parseYouTubeAtomFeed(uploadXml);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].videoId, videoId);
  assert.equal(notifications[0].channelId, channelId);
  assert.equal(notifications[0].title, 'Example & Film Official Trailer');
  assert.equal(notifications[0].authorName, 'Example Studio');
  assert.equal(notifications[0].updatedAt, '2026-09-14T05:10:00.000Z');
});

await test('multiple/update notification parsing and fallback watch URL', () => {
  const notifications = parseYouTubeAtomFeed(multiXml);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].title, 'Example Film Trailer — Updated Title');
  assert.equal(notifications[1].watchUrl, 'https://www.youtube.com/watch?v=vidBBB12345');
  assert.equal(notificationExternalKey(notifications[0]), 'vidAAA12345:2026-09-14T05:20:00.000Z');
});

await test('WebSub HMAC signature verification', async () => {
  const body = new TextEncoder().encode(uploadXml);
  const secret = 'websub-secret';
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(await verifyHubSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(await verifyHubSignature(body, `sha256=${signature.slice(0, -2)}00`, secret), false);
});

await test('derived callback/hub credentials are deterministic and separated', async () => {
  const callback = await deriveWebSubCredential('master', 'source-1', 1, 'callback-token');
  const callbackAgain = await deriveWebSubCredential('master', 'source-1', 1, 'callback-token');
  const hubSecret = await deriveWebSubCredential('master', 'source-1', 1, 'hub-secret');
  assert.equal(callback, callbackAgain);
  assert.notEqual(callback, hubSecret);
  assert.equal(callback.length, 64);
  assert.equal((await sha256Hex(callback)).length, 64);
});

await test('subscription renewal clock uses an early renewal window', () => {
  const times = calculateSubscriptionTimes(new Date('2026-09-14T00:00:00Z'), 1000);
  assert.equal(times.expiresAt, '2026-09-14T00:16:40.000Z');
  assert.equal(times.renewAfter, '2026-09-14T00:13:20.000Z');
});

await test('targeted videos.list request stays within one-unit read path', () => {
  const url = new URL(buildVideosListUrl([videoId, videoId], 'api-key'));
  assert.equal(url.pathname, '/youtube/v3/videos');
  assert.equal(url.searchParams.get('id'), videoId);
  assert.equal(url.searchParams.get('part'), 'snippet,contentDetails,status,liveStreamingDetails');
  assert.equal(YOUTUBE_QUOTA_POLICY_V1.videosList.unitsPerRequest, 1);
});

await test('videos.list enrichment normalizes upcoming live metadata', () => {
  const snapshots = normalizeVideosListResponse(videoList);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].liveBroadcastContent, 'upcoming');
  assert.equal(snapshots[0].scheduledStartTime, '2026-09-14T13:30:00.000Z');
  assert.equal(snapshots[0].privacyStatus, 'public');
  assert.equal(snapshots[0].embeddable, true);
});

await test('channels.list registration snapshot captures uploads playlist', () => {
  const url = new URL(buildChannelsListUrl([channelId], 'api-key'));
  assert.equal(url.pathname, '/youtube/v3/channels');
  const snapshots = normalizeChannelsListResponse(channelList);
  assert.equal(snapshots[0].uploadsPlaylistId, 'UUaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(snapshots[0].customUrl, '@examplestudio');
});

await test('quota reserve guard prevents consuming emergency capacity', () => {
  assert.deepEqual(decideQuota({ usedUnits: 9700, requestedUnits: 1, hardLimit: 10000, reserveUnits: 500 }), { allowed: false, remainingBefore: 300, remainingAfter: 299, reason: 'RESERVE_GUARD' });
  assert.equal(decideQuota({ usedUnits: 100, requestedUnits: 1, hardLimit: 10000, reserveUnits: 500 }).allowed, true);
});

console.log(`\nYouTube connector canaries: ${passed}/13 passed.`);
