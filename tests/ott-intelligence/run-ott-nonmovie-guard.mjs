import assert from 'node:assert/strict';
import { extractOttMovieReleaseSignal } from '../../packages/domain/dist/ott-release-signal.js';
import { extractOttSeriesReleaseSignal } from '../../packages/domain/dist/ott-series-release-signal.js';

const jio = { authorityTier: 1, role: 'OTT_PLATFORM', name: 'JioHotstar Tamil' };
const sony = { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Sony LIV' };
const prime = { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Amazon Prime Video India' };

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

const dupahiya = extractOttSeriesReleaseSignal({
  title: 'Dupahiya Season 2 - Official Trailer | Gajraj Rao, Renuka Shahane, Sparsh Shrivastava | Prime Video India',
  text: 'Dupahiya Season 2 Official Trailer. Official Release Date - October 1, 2026 on Prime Video India.',
  publishedAt: '2026-09-22T09:48:58Z',
  source: prime,
});
assert.ok(dupahiya, 'a first-party season trailer with an explicit dated launch should become a series release signal');
assert.equal(dupahiya.title, 'Dupahiya Season 2');
assert.equal(dupahiya.providerCode, 'PRIME_VIDEO');
assert.equal(dupahiya.releaseDate, '2026-10-01');
assert.equal(dupahiya.state, 'UPCOMING');
assert.equal(dupahiya.contentType, 'SERIES');
assert.equal(dupahiya.evidenceStatus, 'CONFIRMED');

const heartbeat = extractOttSeriesReleaseSignal({
  title: 'Hotstar Specials | HeartBeat Season 3 | Now Streaming | JioHotstar',
  text: 'Hotstar Specials | HeartBeat Season 3 | Now Streaming | JioHotstar',
  publishedAt: '2026-09-24T06:00:00Z',
  source: jio,
});
assert.ok(heartbeat, 'a clean Hotstar season availability headline should become a series release signal');
assert.equal(heartbeat.title, 'HeartBeat Season 3');
assert.equal(heartbeat.providerCode, 'JIOHOTSTAR');
assert.equal(heartbeat.state, 'RELEASED');
assert.equal(heartbeat.datePrecision, 'TBA');

const pavithram = extractOttSeriesReleaseSignal({
  title: 'Pavithram: Season 2 | Now Streaming | Exclusively on JioHotstar',
  text: 'Pavithram Season 2 | Now Streaming | Exclusively on JioHotstar',
  publishedAt: '2026-09-23T06:00:00Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'JioHotstar Malayalam' },
});
assert.ok(pavithram, 'a clean localized season availability headline should become a series release signal');
assert.equal(pavithram.title, 'Pavithram Season 2');
assert.equal(pavithram.state, 'RELEASED');

const masterChef = extractOttSeriesReleaseSignal({
  title: 'Celebrity MasterChef From Oct 19th 8pm | Cook Off From Oct 24 | Sony LIV | OTT News',
  text: 'Celebrity MasterChef Tamil - Grand Launch | October 19 | Watch on Sony LIV.',
  publishedAt: '2026-09-23T10:00:00Z',
  source: sony,
});
assert.ok(masterChef, 'an official show grand launch with an explicit first date should become a series release signal');
assert.equal(masterChef.title, 'Celebrity MasterChef');
assert.equal(masterChef.providerCode, 'SONYLIV');
assert.equal(masterChef.releaseDate, '2026-10-19');
assert.equal(masterChef.state, 'UPCOMING');

assert.equal(
  extractOttSeriesReleaseSignal({
    title: 'SONY VIZHA GRAND LAUNCH ON OCT 19th at 8PM | IDHU NAMMA VIBE!',
    text: 'Sony Vizha - Idhu Namma Vibe! Grand launch on October 19th | 8 PM #SonyVizha #IdhuNammaVibe',
    publishedAt: '2026-09-24T05:00:00Z',
    source: sony,
  }),
  undefined,
  'generic platform event or banner launch labels must never become canonical series titles',
);

for (const noisy of [
  {
    title: 'HeartBeat: Season 3 | Week 9 - Promo 1 | JioHotstar',
    text: 'HeartBeat Season 3 Week 9 Promo 1. Now streaming on JioHotstar.',
    source: jio,
  },
  {
    title: 'HeartBeat Season 3 | Episode 55 | JioHotstar',
    text: 'HeartBeat Season 3 Episode 55 now streaming on JioHotstar.',
    source: jio,
  },
  {
    title: 'Part-Timers | Week 5 | Promo 5 | JioHotstar',
    text: 'Hotstar Specials Part-Timers Week 5 Promo 5 now streaming on JioHotstar.',
    source: jio,
  },
  {
    title: 'Dupahiya Season 2 Exclusive Scene | Prime Video India',
    text: 'Watch this exclusive scene before Dupahiya Season 2 releases October 1 on Prime Video India.',
    source: prime,
  },
]) {
  assert.equal(
    extractOttSeriesReleaseSignal({ ...noisy, publishedAt: '2026-09-24T06:00:00Z' }),
    undefined,
    `series episode/promo/scene noise must stay out of canonical OTT releases: ${noisy.title}`,
  );
}

assert.equal(
  extractOttSeriesReleaseSignal({
    title: 'Dupahiya Season 2 - Official Trailer | Prime Video India',
    text: 'The new season is coming soon on Prime Video India.',
    publishedAt: '2026-09-22T09:48:58Z',
    source: prime,
  }),
  undefined,
  'a trailer without an explicit date or live-availability statement must not create a series release',
);

assert.equal(
  extractOttSeriesReleaseSignal({
    title: 'Hotstar Specials | HeartBeat Season 3 | Now Streaming | JioHotstar',
    text: 'Now streaming on JioHotstar.',
    publishedAt: '2026-09-24T06:00:00Z',
    source: { authorityTier: 3, role: 'TRADE_MEDIA', name: 'Some Trade Site' },
  }),
  undefined,
  'series auto-discovery is first-party OTT only in this release',
);

console.log('OTT non-movie guard and first-party series contract passed');