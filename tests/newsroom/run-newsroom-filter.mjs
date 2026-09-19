import assert from 'node:assert/strict';
import {
  hasCurrentNewsroomIntent,
  normalizedNewsroomTitleKey,
  newsroomClipFamilyKey,
  newsroomNoiseReason,
} from '../../packages/domain/dist/newsroom-filter.js';

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await test('movie-scenes archive upload is filtered', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: '#PasivadiPranam Movie Scenes | Chiranjeevi | shorts',
    raw_text: 'Pasivadi Pranam is a 1987 Indian Telugu-language thriller film.',
  }), 'archive_or_library_clip');
});

await test('current trailer wins over archive-looking words', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Classic Movie Scenes Trailer Launch | Official Trailer',
    raw_text: 'Official launch update.',
  }), null);
  assert.equal(hasCurrentNewsroomIntent('Official Trailer Launch'), true);
});

await test('legacy pre-2020 catalog description is filtered when title has no current intent', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: "Master Telugu Movie | It's All God's Will | Chiranjeevi",
    raw_text: 'Master is a 1997 Telugu action film directed by Suresh Krissna and produced by Allu Aravind.',
  }), 'archive_or_library_clip');
});

await test('current launch survives old-library boilerplate later in description', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'M.S. Legacy on Screen Launch Event | Rashmika | Gowtam | Anirudh',
    raw_text: 'Witness the grand launch of M.S. A Legacy On Screen. Butta Bomma Making Video. Telugu Full Movies | Geetha Arts.',
  }), null);
});

await test('unicode and whitespace title normalization stays deterministic', async () => {
  assert.equal(
    normalizedNewsroomTitleKey('  Aadarsha   Kutumbam  '),
    normalizedNewsroomTitleKey('Aadarsha Kutumbam'),
  );
});

await test('non-current pipe-title variants collapse into one clip family', async () => {
  const first = newsroomClipFamilyKey('Mechanic Alludu | She Never Changes | ANR, Chiranjeevi');
  const second = newsroomClipFamilyKey('Mechanic Alludu | One Warning Is Enough | ANR, Chiranjeevi');
  assert.equal(first, 'mechanic alludu');
  assert.equal(second, first);
});

await test('current-news pipe title is never grouped as archive clip family', async () => {
  assert.equal(newsroomClipFamilyKey('#AadarshaKutumbam - Releasing on Oct 2nd, 2026 | Venkatesh | Trivikram'), null);
});

await test('tier-3 pregnancy and food-craving lifestyle editorial is filtered', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Samantha reveals her pregnancy food cravings',
    raw_text: 'The actress discussed her food cravings during pregnancy on a television show.',
  }, { sourceRole: 'TRADE_MEDIA' }), 'celebrity_lifestyle');
});

await test('tier-3 wedding-vow lifestyle editorial is filtered', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Suriya and Jyotika renew wedding vows after 20 years',
    raw_text: 'The couple celebrated their anniversary with family.',
  }, { sourceRole: 'TRADE_MEDIA' }), 'celebrity_lifestyle');
});

await test('tier-3 public-appearance relationship advice is filtered', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Ambika advises Trisha to be cautious about public appearances with Vijay',
    raw_text: 'The story discusses renewed attention and relationship speculation.',
  }, { sourceRole: 'TRADE_MEDIA' }), 'celebrity_lifestyle');
});

await test('lifestyle gate does not apply to first-party source roles', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Suriya and Jyotika renew wedding vows after 20 years',
    raw_text: 'Official source post.',
  }, { sourceRole: 'PRODUCTION_HOUSE' }), null);
});

await test('current-news intent still overrides media lifestyle words', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'Relationship Rumours Trailer Launch | Official Trailer',
    raw_text: 'A film titled Relationship Rumours launches its trailer.',
  }, { sourceRole: 'TRADE_MEDIA' }), null);
});

await test('hosted-proven film intelligence from the same trade feed survives', async () => {
  assert.equal(newsroomNoiseReason({
    raw_title: 'M.S. Subbulakshmi Biopic: Kamal Haasan claps on Rashmika Mandanna’s first shot',
    raw_text: 'The biopic has been officially launched and the first shot was filmed.',
  }, { sourceRole: 'TRADE_MEDIA' }), null);
  assert.equal(newsroomNoiseReason({
    raw_title: 'The Paradise plans South India promotional tour from tomorrow',
    raw_text: 'The promotional campaign begins with events and press meets.',
  }, { sourceRole: 'TRADE_MEDIA' }), null);
  assert.equal(newsroomNoiseReason({
    raw_title: 'Aasmaan teaser: Meghamsh Srihari promises an intriguing ride',
    raw_text: 'The teaser of the film was unveiled today.',
  }, { sourceRole: 'TRADE_MEDIA' }), null);
});

console.log(`\nNewsroom filter regressions: ${passed}/13 passed.`);
