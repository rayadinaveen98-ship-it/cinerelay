import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  INSTAGRAM_CONNECTOR_VERSION,
  buildInstagramBusinessDiscoveryUrl,
  nextInstagramCheckAt,
  normalizeGraphApiVersion,
  normalizeInstagramUsername,
  parseInstagramBusinessDiscovery,
  parseRetryAfterSeconds,
  planInstagramDelta,
  pollIntervalMs,
} from '../../packages/instagram-connector/dist/index.js';

const v1 = JSON.parse(await readFile(
  new URL('../../packages/source-fixtures/instagram/business-discovery-v1.json', import.meta.url),
  'utf8',
));
const v2 = JSON.parse(await readFile(
  new URL('../../packages/source-fixtures/instagram/business-discovery-v2.json', import.meta.url),
  'utf8',
));

assert.equal(INSTAGRAM_CONNECTOR_VERSION, 'instagram-business-discovery-v1');
assert.equal(normalizeInstagramUsername('@Example.Studio'), 'example.studio');
assert.equal(normalizeGraphApiVersion('V25.0'), 'v25.0');
assert.throws(() => normalizeInstagramUsername('bad/name'), /invalid_instagram_username/);
assert.throws(() => normalizeGraphApiVersion('latest'), /invalid_instagram_graph_api_version/);

const url = new URL(buildInstagramBusinessDiscoveryUrl({
  apiVersion: 'v25.0',
  managedIgUserId: '17841400000000999',
  targetUsername: '@Example.Studio',
  limit: 500,
}));
assert.equal(url.origin, 'https://graph.facebook.com');
assert.equal(url.pathname, '/v25.0/17841400000000999');
const fields = url.searchParams.get('fields') ?? '';
assert.match(fields, /^business_discovery\.username\(example\.studio\)\{/);
assert.match(fields, /media\.limit\(50\)\{/);
assert.ok(!url.searchParams.has('access_token'));

const profile1 = parseInstagramBusinessDiscovery(v1, 'example.studio');
assert.equal(profile1.username, 'example.studio');
assert.equal(profile1.followersCount, 125000);
assert.equal(profile1.media.length, 2);
assert.equal(profile1.media[0]?.id, '18000000000000003');
assert.equal(profile1.media[1]?.mediaType, 'VIDEO');

const baseline = planInstagramDelta(profile1.media, null);
assert.equal(baseline.baseline, true);
assert.equal(baseline.newMedia.length, 0);
assert.equal(baseline.newestMediaId, '18000000000000003');

const profile2 = parseInstagramBusinessDiscovery(v2, 'example.studio');
const oneNew = planInstagramDelta(profile2.media, baseline.newestMediaId);
assert.equal(oneNew.baseline, false);
assert.equal(oneNew.gapExceededWindow, false);
assert.deepEqual(oneNew.newMedia.map((item) => item.id), ['18000000000000004']);

const unchanged = planInstagramDelta(profile2.media, '18000000000000004');
assert.equal(unchanged.newMedia.length, 0);
assert.equal(unchanged.gapExceededWindow, false);

const gap = planInstagramDelta(profile2.media, 'missing-old-media');
assert.equal(gap.gapExceededWindow, true);
assert.equal(gap.newMedia.length, 3);

assert.throws(
  () => parseInstagramBusinessDiscovery({
    business_discovery: { username: 'other.studio', media: { data: [] } },
  }, 'example.studio'),
  /instagram_business_discovery_username_mismatch/,
);

assert.equal(pollIntervalMs('ACTIVE_15M'), 900000);
const now = new Date('2026-09-16T00:00:00Z');
assert.equal(nextInstagramCheckAt({ now, pollClass: 'ACTIVE_15M' }), '2026-09-16T00:15:00.000Z');
assert.equal(nextInstagramCheckAt({ now, pollClass: 'ACTIVE_15M', consecutiveFailures: 2 }), '2026-09-16T01:00:00.000Z');
assert.equal(parseRetryAfterSeconds('120', now), 120);

console.log('instagram business discovery canaries: PASS');
