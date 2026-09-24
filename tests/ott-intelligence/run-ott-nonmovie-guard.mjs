import assert from 'node:assert/strict';
import { extractOttMovieReleaseSignal } from '../../packages/domain/dist/ott-release-signal.js';

const jio = { authorityTier: 1, role: 'OTT_PLATFORM', name: 'JioHotstar Tamil' };
const sony = { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Sony LIV' };

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Hotstar Specials | HeartBeat Season 3 | Now Streaming | JioHotstar',
    text: 'Hotstar Specials #HeartBeatSeason3 now streaming only on #JioHotstar #HBS3 #HeartBeatS3OnJioHotstar',
    publishedAt: '2026-09-24T06:00:00Z',
    source: jio,
  }),
  undefined,
  'a season promo must never enter movie discovery',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Hotstar Specials | The Court | Streaming Now on JioHotstar',
    text: '#HotstarSpecials #TheCourt now streaming on #JioHotstar #TheCourtNowStreaming',
    publishedAt: '2026-09-24T06:00:00Z',
    source: jio,
  }),
  undefined,
  'Hotstar Specials series activity must not become a movie release',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Family Full House With Rohit Sharma | Streaming Now | Sign up for Sony LIV on YouTube',
    text: 'Sign up for Sony LIV on YouTube Primetime Channels and YouTube TV. Family Full House With Rohit Sharma | Streaming Now | Sign up for Sony LIV on YouTube #SonyTV',
    publishedAt: '2026-09-24T06:00:00Z',
    source: sony,
  }),
  undefined,
  'TV-show subscription promos must not become movie releases',
);

const cleanMovie = extractOttMovieReleaseSignal({
  title: 'Paranthu Po | Streaming Now on JioHotstar',
  text: '#ParanthuPoOnJioHotstar #ParanthuPo #ParanthuPoNowStreaming #JioHotStarTamil',
  publishedAt: '2026-09-20T11:15:31Z',
  source: jio,
});
assert.ok(cleanMovie, 'a clean first-party movie availability headline should remain supported');
assert.equal(cleanMovie.title, 'Paranthu Po');
assert.equal(cleanMovie.state, 'RELEASED');

const explicitMovie = extractOttMovieReleaseSignal({
  title: 'Month Of Madhu Telugu Movie | Watch Now On Aha | Naveen Chandra | Swathi',
  text: 'Month Of Madhu Telugu Movie ft. Naveen Chandra and Swathi Reddy. Stay tuned & Subscribe to Aha YouTube channel.',
  publishedAt: '2026-09-22T02:27:27Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'aha videoIN' },
});
assert.ok(explicitMovie, 'explicit movie wording should survive multi-part provider title packaging');
assert.equal(explicitMovie.state, 'RELEASED');

console.log('OTT non-movie guard contract passed');
