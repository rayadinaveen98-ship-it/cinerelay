import assert from 'node:assert/strict';
import { extractOttMovieReleaseSignal } from '../../packages/domain/dist/ott-release-signal.js';

const signal = extractOttMovieReleaseSignal({
  title: 'Habeebi Movie, Streaming from Sept 25th.',
  text: 'Habeebi Movie, Streaming from Sept 25th.',
  publishedAt: '2026-09-20T07:16:17.000Z',
  source: {
    authorityTier: 1,
    role: 'OTT_PLATFORM',
    name: 'Sony LIV',
  },
});

assert.ok(signal, 'deployment bundle should detect a year-less dated OTT movie signal');
assert.equal(signal.title, 'Habeebi');
assert.equal(signal.providerCode, 'SONYLIV');
assert.equal(signal.releaseDate, '2026-09-25');
assert.equal(signal.state, 'UPCOMING');
assert.equal(signal.evidenceStatus, 'CONFIRMED');

console.log('OTT deployment bundle smoke test passed');
