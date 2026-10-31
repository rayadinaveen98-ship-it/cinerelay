# CineRelay C31 — zero-cost Creator Intelligence quota capacity forecast

**31 October 2026 · draft source-only · no external calls or production changes**

## Practical finding
Hourly upload **discovery** for 1,000 creators means 1,000 separate playlist lookups every hour, or **24,000 `playlistItems.list` calls/day**. With the API's documented 1 unit per lookup this alone exceeds the published default **10,000 general-read units/day**, before other existing CineRelay cinema feeds consume their allotment. Never claim the actual Google Cloud project's limit or traffic from the default. The project-specific allocation, real usage, other clients, and existing 185 source IDs' workload still require independent verification.

YouTube introduced `videos.batchGetStats` on 3 June 2026 in a **separate** bucket, with a documented **default** allocation of 10,000 units/day and a cost of one unit per request. This is useful for periodically sampling **known public video IDs**, but it cannot discover new uploads by itself. The existing C1 builder uses a deliberately conservative **50-video cap** per request, which is an *application safety assumption*, not a claim about the provider's official maximum.

References:
- [Official method quota calculator](https://developers.google.com/youtube/data/determine_quota_cost)
- [Official June 2026 API revision history](https://developers.google.com/youtube/data/revision_history)
- [Official videos.batchGetStats method](https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats)
- [Google Cloud project's actual quotas — must be checked manually](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)

## What C31 implements
- Read-only `scripts/creator-intelligence/c31-offline-quota-capacity.mjs` reuses the existing C1 general-read budget function. It never accesses a live API, account, repository history, service credential or database.
- Independently estimates general-read channel/playlist discovery and dedicated video-statistics request loads with conservative 50-video batches, per-bucket reserves and separately entered past consumption.
- Refuses negative, fractional, unexpectedly shaped and overflowing numbers, unsafe video batch sizes and impossible reserves. It never grants API access even if an example budget fits.
- Ten regression tests integrated into the default `test:youtube` / GitHub CI.
- Three explicit **hypothetical** scenarios, based on a placeholder 1,200 general-read units/day for prior cinema activity; **this number is not measured**:
  - 20 creator channels, one playlist check/day, 60 known videos each checked 4 times/day: 20 extra general requests, 8 video-stats requests.
  - 1,000 creators, 24 playlist checks/day, 3,000 known videos each checked hourly: **24,000 extra general requests** plus **1,440 video-stats requests**. Under hypothetical 10,000 / 2,000 reserve, general bucket is exhausted.
  - 1,000 creators, one playlist check/day, same 3,000 videos with hourly public statistics: **1,000 extra general requests** and **1,440 video-stats requests**. Under the *same assumptions*, both buckets fit; the forecast is **not** an operational clearance or provider policy approval.
- Any output `fitsBothAssumedBuckets: true` is limited to request arithmetic. Real approval also needs data retention, audit, monitoring policy, quota and owner gates.

## Run your own capacity estimate
```bash
npm run creators:quota-plan -- \
  --channels=1000 \
  --playlistChecksPerChannelPerDay=1 \
  --activelyObservedVideos=3000 \
  --statsChecksPerVideoPerDay=24 \
  --existingCinemaGeneralReadUnits=1200 \
  --generalDailyLimit=10000 \
  --generalReserveUnits=2000 \
  --statsDailyLimit=10000 \
  --statsReserveUnits=1000
```
The 1,200 legacy traffic and both daily limits above are **examples only**; replace them after reviewing actual provider usage. The 185 existing cinema identities **cannot** be equated to 185 daily API units. Legacy operational reserves must be measured rather than guessed.

## Before any real data collection
1. Owner confirms actual quota allocation and traffic on the precise Cloud project and keeps cinema-news operations protected.
2. Historical C2/C10/C11 API data and remaining Git refs are reviewed and remediated under an approved process; do not rewrite history without permission.
3. Hosted backup/PITR/log/export retention and the 27/28-day TTL are verified in authorized staging with synthetic data; no paid resource without owner consent.
4. First creator is editorially reviewed, one-shot provider audit approved, and monitoring/derived comparison permissions assessed separately.
5. Only after those approvals can a staged collector be considered. No auto-enrollment, video snapshots or public ranking is implemented in C31.

**This PR changes only local planning code, tests, package scripts and documentation.** C22 remains the installable APK; C30 simulated identity checks do not verify the live backend.
