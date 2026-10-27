# CineRelay P7 — YouTube fallback capacity gate and quota-safe dispatch candidate

Date: 2026-10-27  
State: **PROPOSED ENGINEERING CHANGE — NO PRODUCTION DEPLOYMENT / NO LATENCY SLA**  
Scope: CineRelay only, Supabase project `dnqaejljfzwhsainpdxb`.  
Related: PMV1 #92, WebSub reliability #93, compiled health guard #94.

## Problem verified against production

- Active YouTube source identities: **185**; `HIGH` priority **10**.
- Stored `WEBSUB_MISSED_DELIVERY` warnings: **149**, while all active identities are effectively healthy via recent fallback.
- Five-minute active cron schedule: `cinerelay-youtube-fallback` = `*/5 * * * *`.
- Live scheduler: `'youtube-fallback': { slug: 'youtube-fallback-worker', body: { limit: 20 } }`.
- Observed stable quota pattern: **240 playlistItems.list requests/hour** on recent full hours, agreeing with `12 runs/hour × 20`.
- Source scheduling snapshot: **154 / 185** already past `next_fallback_check_at`, **121** overdue by ten minutes, **39** overdue by thirty minutes. HIGH: **8 / 10** overdue; normal: **146 / 175** overdue. These point-in-time counts vary as workers execute.
- 48-hour observable raw-source lag was previously ~26m median. This is an observed selected-item proxy, not complete raw-to-device latency.

## Capacity arithmetic, no provider calls

Based on one completed recent quota day (2026-10-26): **5,740** playlist reads, **187** `videos.list`, **178** `channels.list`; `365` other read units. The resource policy allows 10,000 general-read units/day with **500 reserved**, equivalent to a 9,500 spending ceiling before dynamically varying demand. Treat 365 as a *sample baseline*, **not** a daily maximum. Provider quota uses its own quota-day boundary; the `usage_day` field differs from UTC hour grouping.

| Mode | Checks / five-minute tick | Theoretical playlist checks/day | Projected combined read units/day, using 365 other | Headroom to 9,500 | Nominal average inter-check lower bound (185 sources) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Existing | 20 | **5,760** | **6,125** | **3,375** | **46.3 min** |
| Proposed | **28** | **8,064** | **8,429** | **1,071** | **33.0 min** |
| Rejected | 32 | **9,216** | **9,581** | **-81** | **28.9 min** |

**Important:** This is math for attempts if all ticks run and each read costs one unit. It is not a measured throughput or freshness improvement. Any increase in enrichment/other API work, upstream retries, rate limits or Edge response time reduces available budget. The worker's existing hard-quota + reserve guard must remain active, and the rollout must stop if it hits the reserve guard or experiences slow/failed requests.

Given 149 WebSub-missed identities requesting fast five-minute fallback and 36 others at 15 minutes, nominal demand is **46,368 reads/day**, versus the candidate's **8,064 attempt capacity**. Hence the suggested configuration would still cover only about **17.4%** of theoretical requested check frequency. Achieving 5m for every channel is **not technically/quota feasible** with the current free-first architecture.

## Narrow implementation in this PR

1. `cinerelay-scheduler-dispatch` passes **28** instead of 20 to `youtube-fallback-worker`. **All other dispatch targets unchanged.**
2. `scripts/diagnostics/youtube_fallback_capacity.mjs` supplies a pure input-validated, no-network budget model.
3. `tests/youtube-connector/run-fallback-capacity.mjs` covers current 20, suggested 28, rejected 32, and unsafe inputs; included in `npm run test:youtube`.
4. No changes to database, existing YouTube identities, WebSub subscriptions, source priority flags, notifications, credentials, mobile APK or paid integrations.

## Remaining go/no-go BEFORE deployment

- [ ] All CI + Android safety checks green.
- [ ] Live scheduler Edge worker exact pre-deploy backup captured with version/hash and documented rollback procedure.
- [ ] Measure current scheduler invocation duration p50/p95 and any timeout/5xx behavior from recent successful ticks. 28 sequential HTTP reads may increase execution time.
- [ ] Confirm read-unit daily budget has headroom for other `videos.list`, `channels.list`, migrations, onboarding, and provider bursts; consider maximum daily ceiling 9,500 inclusive of all classes.
- [ ] Controlled dispatch-only deployment from pinned, CI-tested artifact, without merging unreviewed application changes or automatically changing Android.
- [ ] Verify next live natural tick handles at most 28, records valid quota usage, returns success, does not duplicate jobs or increase push notifications.
- [ ] Observe one full quota day; compare polling p50/p95, overdue counts, failed requests, guard triggers, and end-to-end upload-to-feed latency. Roll back to 20 if quota or runtime regression appears.
- [ ] Follow separate issue #93 for true WebSub missed deliveries and independent external publication-ID coverage.

## Product decision and next design step

This is a limited queue-capacity candidate, **not** a solution to full consumer MVP freshness. Next requires a tiered source SLA driven by actual follows and observed publisher activity; ensure high-priority official channels do not starve normal consumer sources. No further count-driven source expansion while performance targets exceed capacity. Experimental users must not be promised real-time or universal complete coverage.

## Expected rollback

Restore the exact previously hosted `cinerelay-scheduler-dispatch` bundle and `body: { limit: 20 }`. Do not modify cron frequencies, provider keys, source-health flags, WebSub leases or existing push queue. Keep Android v0.2.9 unchanged.
