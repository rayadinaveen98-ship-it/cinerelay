import assert from 'node:assert/strict';
import { extractOttMovieReleaseSignal } from '../../packages/domain/dist/ott-release-signal.js';

const sony = extractOttMovieReleaseSignal({
  title: 'Habeebi Movie, Streaming from Sept 25th.',
  text: '#KasthooriRaja #MalavikaManoj #HabeebiMovie #TamilMovie #SonyLIV',
  publishedAt: '2026-09-20T07:16:17Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Sony LIV' },
});
assert.ok(sony, 'official SonyLIV movie release should be detected');
assert.equal(sony.title, 'Habeebi');
assert.equal(sony.providerCode, 'SONYLIV');
assert.equal(sony.releaseDate, '2026-09-25');
assert.equal(sony.datePrecision, 'DAY');
assert.equal(sony.state, 'UPCOMING');
assert.equal(sony.evidenceStatus, 'CONFIRMED');
assert.equal(sony.primaryLanguage, 'ta');
assert.equal(sony.signalType, 'OTT_RELEASE');

const dayFirst = extractOttMovieReleaseSignal({
  title: 'Sample Film | Premieres on 24th Sep on aha',
  publishedAt: '2026-09-20T04:30:16Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'aha videoIN' },
});
assert.ok(dayFirst);
assert.equal(dayFirst.title, 'Sample');
assert.equal(dayFirst.providerCode, 'AHA');
assert.equal(dayFirst.releaseDate, '2026-09-24');
assert.equal(dayFirst.state, 'UPCOMING');
assert.equal(dayFirst.evidenceStatus, 'CONFIRMED');

const directStreaming = extractOttMovieReleaseSignal({
  title: 'Paranthu Po | Streaming Now on JioHotstar',
  text: '#ParanthuPoOnJioHotstar #ParanthuPo #ParanthuPoNowStreaming #JioHotStarTamil',
  publishedAt: '2026-09-20T11:15:31Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'JioHotstar Tamil' },
});
assert.ok(directStreaming, 'clean first-party provider headlines should not require the literal word movie');
assert.equal(directStreaming.title, 'Paranthu Po');
assert.equal(directStreaming.providerCode, 'JIOHOTSTAR');
assert.equal(directStreaming.state, 'RELEASED');
assert.equal(directStreaming.datePrecision, 'TBA');
assert.equal(directStreaming.evidenceStatus, 'CONFIRMED');
assert.equal(directStreaming.primaryLanguage, 'ta');

const reported = extractOttMovieReleaseSignal({
  title: 'Habeebi Movie streaming from September 25 on Sony LIV',
  publishedAt: '2026-09-20T10:00:00Z',
  source: { authorityTier: 3, role: 'TRADE_MEDIA', name: 'Reliable Trade' },
});
assert.ok(reported);
assert.equal(reported.providerCode, 'SONYLIV');
assert.equal(reported.evidenceStatus, 'REPORTED');
assert.equal(reported.confidence, 0.92);

const nowStreaming = extractOttMovieReleaseSignal({
  title: 'Example Movie - Now Streaming on Netflix',
  publishedAt: '2026-09-20T10:00:00Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Netflix India' },
});
assert.ok(nowStreaming);
assert.equal(nowStreaming.state, 'RELEASED');
assert.equal(nowStreaming.datePrecision, 'TBA');
assert.equal(nowStreaming.releaseDate, undefined);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Peak Action in Road House ft. Jake Gyllenhaal | Prime Video India',
    text: 'Watch the movie Road House starring Jake Gyllenhaal, available on Prime Video India.',
    publishedAt: '2026-09-20T12:30:06Z',
    source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Prime Video India' },
  }),
  undefined,
  'ordinary catalog clips must not become new OTT release signals',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Chef Mantra Project K S6 Ep 3 Promo | Premieres On 24th Sep On Aha',
    text: 'Premieres On 24th Sep On Aha.',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'aha videoIN' },
  }),
  undefined,
  'series/episode promos without an explicit movie marker must not be classified as movie releases',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Chef Mantra Project K S6 Ep 3 | Streaming Now on aha',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'aha videoIN' },
  }),
  undefined,
  'direct OTT headline parsing must still reject episode titles',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Best Comedy Scene | Streaming Now on JioHotstar',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'JioHotstar Tamil' },
  }),
  undefined,
  'direct OTT headline parsing must still reject scene and clip content',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Mystery Movie, Streaming from Sept 25th',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 3, role: 'TRADE_MEDIA', name: 'Reliable Trade' },
  }),
  undefined,
  'a provider must be explicit in the source identity or evidence text',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Rumor Movie, Streaming from Sept 25 on Netflix',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 4, role: 'OTHER_MEDIA', name: 'Rumor Page' },
  }),
  undefined,
  'low-authority sources must not enter canonical OTT discovery',
);

console.log('OTT release signal contract passed');
