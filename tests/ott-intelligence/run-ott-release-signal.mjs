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

const poojaMeriJaan = extractOttMovieReleaseSignal({
  title: "OTT: Mrunal Thakur-Huma Qureshi's Thriller &#8216;Pooja Meri Jaan&#8217; Gets Streaming Date",
  text: 'After being delayed for nearly four years, Bollywood thriller Pooja Meri Jaan is finally set to make its direct digital debut. The film, starring Mrunal Thakur and Huma Qureshi in the lead roles, will premiere directly on ZEE5 on October 2, 2026. Directed by Navjot Gulati and produced by Dinesh Vijan’s Maddock Films, the film completed production in 2022 but remained unreleased for a long time. The makers have now confirmed its OTT release, bringing the much-delayed project to audiences. Mrunal Thakur plays Pooja, whose life takes a disturbing turn following the death of her lover, Aniket. Huma Qureshi portrays Sana, a lawyer and Pooja’s close friend, who becomes involved in the complicated circumstances surrounding the case. The thriller deals with themes of obsession, suspicion, allegations and the consequences of prejudice. Vikram Singh Chauhan and veteran actor Vijay Raaz are also part of the key cast. The film is expected to be one of the notable Hindi thriller releases on the platform around the festival season. The post Pooja Meri Jaan first appeared on Latest Telugu cinema news | Movie reviews | OTT Updates.',
  publishedAt: '2026-09-20T05:30:25Z',
  source: { authorityTier: 3, role: 'TRADE_MEDIA', name: '123Telugu — Movie News' },
});
assert.ok(poojaMeriJaan, 'explicit trusted trade streaming-date headlines should become reported calendar evidence');
assert.equal(poojaMeriJaan.title, 'Pooja Meri Jaan');
assert.equal(poojaMeriJaan.providerCode, 'ZEE5');
assert.equal(poojaMeriJaan.releaseDate, '2026-10-02');
assert.equal(poojaMeriJaan.state, 'UPCOMING');
assert.equal(poojaMeriJaan.evidenceStatus, 'REPORTED');
assert.equal(poojaMeriJaan.releaseType, 'ORIGINAL');
assert.equal(poojaMeriJaan.primaryLanguage, 'hi');

const agadha = extractOttMovieReleaseSignal({
  title: "MS Raju's Agadha Locked for ZEE5 Premiere &#8211; Can It Find Redemption on OTT?",
  text: 'The Telugu horror thriller is heading to ZEE5, which has locked September 25, 2026, as its digital premiere date for the movie.',
  publishedAt: '2026-09-20T02:30:18Z',
  source: { authorityTier: 3, role: 'TRADE_MEDIA', name: '123Telugu — Movie News' },
});
assert.ok(agadha, 'provider-premiere trade headlines should be retained as reported evidence');
assert.equal(agadha.title, 'Agadha');
assert.equal(agadha.providerCode, 'ZEE5');
assert.equal(agadha.releaseDate, '2026-09-25');
assert.equal(agadha.state, 'UPCOMING');
assert.equal(agadha.evidenceStatus, 'REPORTED');
assert.equal(agadha.releaseType, 'POST_THEATRICAL');
assert.equal(agadha.primaryLanguage, 'te');

const nowStreaming = extractOttMovieReleaseSignal({
  title: 'Example Movie - Now Streaming on Netflix',
  publishedAt: '2026-09-20T10:00:00Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'Netflix India' },
});
assert.ok(nowStreaming);
assert.equal(nowStreaming.state, 'RELEASED');
assert.equal(nowStreaming.datePrecision, 'TBA');
assert.equal(nowStreaming.releaseDate, undefined);

const crossPromoDate = extractOttMovieReleaseSignal({
  title: 'Month Of Madhu Telugu Movie | Watch Now On Aha | Naveen Chandra | Swathi | Srikanth Nagothi',
  text: 'Month Of Madhu Telugu Movie ft. Naveen Chandra and Swathi Reddy. Stay tuned & Subscribe to Aha YouTube channel for more Latest Movies, Shows & Web Series. Click here to watch: Chiranjeeva Movie Teaser | Raj Tarun | Premieres 7th Nov | Aha',
  publishedAt: '2026-09-22T02:27:27Z',
  source: { authorityTier: 1, role: 'OTT_PLATFORM', name: 'aha videoIN' },
});
assert.ok(crossPromoDate, 'first-party Watch Now evidence should still become a released OTT signal');
assert.equal(crossPromoDate.providerCode, 'AHA');
assert.equal(crossPromoDate.state, 'RELEASED');
assert.equal(crossPromoDate.releaseDate, undefined, 'dates from unrelated description cross-promos must never attach to the current title');
assert.equal(crossPromoDate.datePrecision, 'TBA');

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
    title: 'Cult gets theatrical release date',
    text: 'The movie opens in theatres on October 30, 2026. ZEE5 is mentioned only as an unrelated catalog example.',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 3, role: 'TRADE_MEDIA', name: 'Reliable Trade' },
  }),
  undefined,
  'an incidental OTT provider mention must not turn a theatrical date story into OTT calendar evidence',
);

assert.equal(
  extractOttMovieReleaseSignal({
    title: 'Rumor Film Gets Streaming Date',
    text: 'Netflix is reportedly considering an October 2, 2026 release.',
    publishedAt: '2026-09-20T04:30:16Z',
    source: { authorityTier: 4, role: 'OTHER_MEDIA', name: 'Rumor Page' },
  }),
  undefined,
  'low-authority general media cannot enter reported OTT calendar discovery',
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
