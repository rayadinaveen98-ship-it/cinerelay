import assert from 'node:assert/strict';
import { normalizeItem, classifyEvent } from '../../packages/domain/dist/index.js';

const source = { authorityTier: 1, role: 'MEDIA_LIBRARY', platform: 'YOUTUBE' };
const context = { entity: { id: '12345678-1234-5123-a456-123456789012', canonicalName: 'Jailer 2' } };
const classify = (title, text='') => classifyEvent(normalizeItem({
  title, text, url: 'https://www.youtube.com/watch?v=aaNq2NL6D4A',
}, source), context);

assert.equal(
  classify('Jailer 2 Super Show - Full Show | Part 3 | Sun TV',
    'Jailer 2 official trailer out now. In cinemas October 15.').eventType,
  'PRE_RELEASE_EVENT_STARTED_OR_RELEASED',
  'Full show recording must not turn into a film trailer or theatrical date from description',
);
assert.equal(
  classify('Jailer 2 Super Show - Full Show | Part 1 | Sun Pictures',
    'First glimpse, official teaser and release date of Jailer 2 in this interview').eventType,
  'PRE_RELEASE_EVENT_STARTED_OR_RELEASED',
  'Full show title takes precedence over generic description keywords',
);
assert.equal(
  classify('In conversation with Jailer 2 technicians | Sun TV',
    'Get a glimpse of the film and see the official trailer').eventType,
  'INTERVIEW_RELEASED',
  'A technician interview must not become a film glimpse or trailer',
);
assert.equal(
  classify('JAILER 2 - Official Trailer | Sun Pictures', 'Watch the official trailer.').eventType,
  'TRAILER_RELEASED',
  'Real film trailer remains classified correctly',
);
assert.equal(
  classify('JAILER 2 - Official Teaser | Sun Pictures', 'Watch the teaser.').eventType,
  'TEASER_RELEASED',
  'Real film teaser remains classified correctly',
);
assert.equal(
  classify('Jailer 2 Super Show - Promo | Sun TV', 'This Sunday 6 PM').eventType,
  'PROMO_RELEASED',
  'A short special programme promo is not a full-show recording',
);
assert.equal(
  classify('Some Film - Full Show | Behind the Scenes', 'Official trailer released').eventType,
  'TRAILER_RELEASED',
  'Only title-qualified promotional event recordings should be special-cased',
);
console.log('PASS CineRelay event precision: 7 full-show/interview vs trailer/teaser regressions');
