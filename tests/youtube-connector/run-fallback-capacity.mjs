import assert from 'node:assert/strict';
import { estimateYouTubeFallbackCapacity } from '../../scripts/diagnostics/youtube_fallback_capacity.mjs';

const common = {
  activeSources: 185,
  missedWebsubSources: 149,
  highPrioritySources: 10,
  cronMinutes: 5,
  dailyQuotaUnits: 10_000,
  reserveUnits: 500,
  nonPlaylistDailyUnits: 365,
};
const baseline = estimateYouTubeFallbackCapacity({...common, batchLimit: 20});
assert.equal(baseline.cronRunsPerDay, 288);
assert.equal(baseline.maximumPlaylistChecksPerDay, 5760);
assert.equal(baseline.playlistQuotaCapacityPerDay, 9135);
assert.equal(baseline.desiredChecksPerDay, 46368);
assert.equal(baseline.quotaSafe, true);
assert.equal(baseline.maximumQuotaSafeBatchSize, 31);

const candidate = estimateYouTubeFallbackCapacity({...common, batchLimit: 28});
assert.equal(candidate.maximumPlaylistChecksPerDay, 8064);
assert.equal(candidate.budgetHeadroomUnits, 1071);
assert.equal(candidate.quotaSafe, true);
assert.ok(candidate.minimumMeanIntervalAtNominalCapacityMinutes < baseline.minimumMeanIntervalAtNominalCapacityMinutes);
assert.ok(candidate.maximumDemandCoverageFraction < 0.2, 'More capacity does not mean five-minute coverage is solved');

const unsafe = estimateYouTubeFallbackCapacity({...common, batchLimit: 32});
assert.equal(unsafe.quotaSafe, false);
assert.equal(unsafe.budgetHeadroomUnits < 0, true);

const fail = (patch) => assert.throws(
  () => estimateYouTubeFallbackCapacity({...common, batchLimit: 28, ...patch}),
  RangeError,
);
fail({missedWebsubSources:186});
fail({highPrioritySources:186});
fail({batchLimit:51});
fail({cronMinutes:0});
fail({reserveUnits:11000});
fail({nonPlaylistDailyUnits:-1});
fail({normalMinutes:7});
console.log('PASS CineRelay P7 YouTube fallback capacity: baseline, quota-safe 28, unsafe 32, and 7 invalid-input gates');
