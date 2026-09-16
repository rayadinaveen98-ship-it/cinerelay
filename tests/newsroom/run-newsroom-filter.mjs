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

console.log(`\nNewsroom filter regressions: ${passed}/7 passed.`);
