import assert from 'node:assert/strict';
import { pushNotificationTitle, pushTrustLabel } from '../../packages/domain/dist/push-presentation.js';

assert.equal(pushTrustLabel('OFFICIAL'), 'Verified');
assert.equal(pushTrustLabel('CONFIRMED'), 'Verified');
assert.equal(pushTrustLabel('DEVELOPING'), 'Developing');
assert.equal(pushTrustLabel('RELIABLE_REPORT'), 'Developing');
assert.equal(pushTrustLabel('RUMOR'), 'Rumor');
assert.equal(pushTrustLabel(null), 'Unconfirmed');

assert.equal(pushNotificationTitle('OFFICIAL'), 'CineRelay');
assert.equal(pushNotificationTitle('CONFIRMED'), 'CineRelay');
assert.equal(pushNotificationTitle('DEVELOPING'), 'CineRelay • Developing');
assert.equal(pushNotificationTitle('RELIABLE_REPORT'), 'CineRelay • Developing');
assert.equal(pushNotificationTitle('RUMOR'), 'CineRelay • Rumor');
assert.equal(pushNotificationTitle('UNKNOWN'), 'CineRelay • Unconfirmed');

console.log('push presentation contract: ok');
