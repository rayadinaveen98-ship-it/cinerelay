/**
 * Offline admission/budget arithmetic for CineRelay YouTube fallback.
 * This does NOT run pollers, query private accounts or change source priorities.
 *
 * Limitations: assumes all cron ticks run and each attempted playlist read consumes
 * one YouTube quota unit. It predicts an upper bound on checks, NOT actual
 * publication-to-feed latency, API timing, completed work or source coverage.
 */
export function estimateYouTubeFallbackCapacity(input) {
  const {
    activeSources, missedWebsubSources, highPrioritySources, batchLimit, cronMinutes,
    dailyQuotaUnits, reserveUnits, nonPlaylistDailyUnits,
    highMinutes = 5, normalMinutes = 15,
  } = input;
  for (const [name, value] of Object.entries({
    activeSources, missedWebsubSources, highPrioritySources, batchLimit, cronMinutes,
    dailyQuotaUnits, reserveUnits, nonPlaylistDailyUnits, highMinutes, normalMinutes,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + ' must be a non-negative integer');
  }
  if (activeSources === 0 || cronMinutes === 0 || batchLimit === 0 || highMinutes === 0 || normalMinutes === 0) {
    throw new RangeError('sources, batch and periods must be positive');
  }
  if (missedWebsubSources > activeSources || highPrioritySources > activeSources) throw new RangeError('source subsets exceed active universe');
  if (batchLimit > 50) throw new RangeError('worker accepts at most 50 sources per run');
  if (1440 % cronMinutes !== 0 || 1440 % highMinutes !== 0 || 1440 % normalMinutes !== 0) {
    throw new RangeError('periods must divide 1440 minutes exactly');
  }
  if (reserveUnits > dailyQuotaUnits) throw new RangeError('reserve exceeds daily quota');
  const cronRunsPerDay = 1440 / cronMinutes;
  const maximumPlaylistChecksPerDay = batchLimit * cronRunsPerDay;
  const playlistQuotaCapacityPerDay = Math.max(0, dailyQuotaUnits - reserveUnits - nonPlaylistDailyUnits);
  const quotaSafe = maximumPlaylistChecksPerDay <= playlistQuotaCapacityPerDay;
  const maximumQuotaSafeBatchSize = Math.min(50, Math.floor(playlistQuotaCapacityPerDay / cronRunsPerDay));
  const desiredChecksPerDay =
    missedWebsubSources * (1440 / highMinutes) +
    (activeSources - missedWebsubSources) * (1440 / normalMinutes);
  // For this estimate, an accelerator warning opts the source into hot polling.
  const minimumMeanIntervalAtNominalCapacityMinutes =
    activeSources * 1440 / Math.min(maximumPlaylistChecksPerDay, playlistQuotaCapacityPerDay || 1);
  return {
    cronRunsPerDay, maximumPlaylistChecksPerDay, playlistQuotaCapacityPerDay,
    maximumQuotaSafeBatchSize, quotaSafe, projectedOtherApiUnitsPerDay: nonPlaylistDailyUnits,
    budgetHeadroomUnits: playlistQuotaCapacityPerDay - maximumPlaylistChecksPerDay,
    desiredChecksPerDay,
    maximumDemandCoverageFraction: Math.min(1, maximumPlaylistChecksPerDay / desiredChecksPerDay),
    minimumMeanIntervalAtNominalCapacityMinutes,
    highPrioritySources,
    note: 'Capacity-only estimate: no delivery SLA, wall-clock proof, or completeness guarantee.',
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  // Audit snapshot from 2026-10-27. Pass real values to the exported function
  // rather than treating these defaults as automatically updating live counts.
  const old = estimateYouTubeFallbackCapacity({
    activeSources: 185, missedWebsubSources: 149, highPrioritySources: 10,
    batchLimit: 20, cronMinutes: 5, dailyQuotaUnits: 10_000,
    reserveUnits: 500, nonPlaylistDailyUnits: 365,
  });
  const proposed = estimateYouTubeFallbackCapacity({
    activeSources: 185, missedWebsubSources: 149, highPrioritySources: 10,
    batchLimit: 28, cronMinutes: 5, dailyQuotaUnits: 10_000,
    reserveUnits: 500, nonPlaylistDailyUnits: 365,
  });
  console.log(JSON.stringify({asOf: '2026-10-27', baseline: old, candidate: proposed}, null, 2));
}
