# Creator Intelligence C4 — one-batch metrics collector (2026-10-28)

**STATUS: DRAFT CODE / DISABLED; NOT DEPLOYED; NO CRON OR ACTIVE CREATOR CHANNELS.**

Dependencies: C1 pure plans [PR #99](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/99), C2 identity gate [PR #100](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/100), C3 RLS metrics storage [PR #101](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/101). Research pool [PR #98](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/98).

## Implementation

- `packages/youtube-connector/src/creator-metric-collector.ts` processes **at most one batch of 50 unique public video IDs**. Uses C1's cadence plan (hourly first 72h, then 6-hourly to day 7, daily to day 30) without fake past observations. A channel cannot claim all slots in the fairness planner.
- **Atomic quota reservation BEFORE the call**: SQL `creator_intelligence_reserve_stats_quota` acquires a transaction advisory lock, inspects current `VIDEO_BATCH_STATS` usage in the existing ledger and charges one unit if below the verified limit minus reserve. Reserve remains spent across crashes/timeouts. No double-spend race among C4 invocations using the same RPC.
- Returns an auditable *one-call only* result. 401/403/429 and 500 responses count as attempts; **no retries**. Malformed/missing/unexpected video IDs cause a rejected batch and no misleading partial writes. Explicitly failed video IDs reported separately. Hidden likes/comments stored as NULL; all-null video measurements omitted. Successful public counters are stored as strings/numeric with one actual response-observation timestamp and maximum 30-day expiry, never as a reconstructed YouTube Analytics hourly series.
- `creator_intelligence_metric_candidates` exposes only operator-reviewed **enabled** creator videos, excluding accounts whose operator approval has since been revoked or whose channel/video metadata is stale. Authenticated clients cannot call either new RPC.
- `supabase/functions/creator-metric-collector/index.ts`: internal authenticated POST only, strict constant-time secret comparison, `CINERELAY_CREATOR_STATS_ENABLED=true` **plus** an explicitly configured **verified** video-stats daily quota and reserve, or it refuses to run. No scheduling trigger, no queued work, no discovery or registrations. API key is appended only immediately before a public Google request and never logged or returned.
- No writes to existing `sources`, `raw_items`, `events`, `alert_deliveries`, push notifications, cinema scheduler or existing `GENERAL_READ` quota bucket. C4 uses its separate stats quota bucket only.

## Tests and release gates

- C4 pure runner tests cover one reserved request, mock provider, 429 failures, transport failures, invalid IDs, all-NULL/partially unavailable counts, persistence rejection, audit finalization and 50-video upper bound.
- 20 additional database assertions cover RLS/service-only access, approved candidate eligibility, revoked operator, stale metadata, quota ceiling, reserve and ledger separation. C3's 27 DB tests still run.
- Strict Deno typecheck for collector is wired into existing main CI.
- **Not yet launched:** C2 official `channels.list` verification still blocked by absent GitHub `YOUTUBE_API_KEY`; all candidates remain disabled. C3/C4 migrations are in PRs only. Real project's `videos.batchGetStats` grant and quota have NOT been verified. Do not turn on the feature flag or enable the Edge Function without approved deployment and security review.
- After verification: use one authorized public-video API request with manually reviewed 1–2 IDs; check counter schema, quota ledger, RLS, retention cron and audit; then enable a very small creator cohort gradually. Never allow cinema quota/alerts to be silently affected.

## Reference

Google official: https://developers.google.com/youtube/v3/docs/videos/batchGetStats (public stats, 1 quota unit; response includes `items[].statistics` and `summary.failedVideoIds`). Current limits should be checked in Google Cloud; default per-day statistics bucket is **not confirmation of this project's allocation**.

All research and code remain in isolated GitHub branches. No new user-facing creator activity or hourly statistics can be claimed before real collection.
