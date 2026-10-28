# CineRelay Creator Intelligence C5 — operator dashboard (28 October 2026)

**Status: draft in GitHub; not deployed. No fabricated creator analytics.**

Stacked on [C4 PR #102](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/102). Previous C1–C3 drafts still contain the collector prerequisites. C2 official YouTube ID verification remains blocked by unavailable GitHub Actions `YOUTUBE_API_KEY`; no creator metrics are live.

## Delivered

- New **`/creators`** route inside existing protected CineRelay operator web console. This is the **internal operator experience**, not yet a public-facing consumer feature.
- Responsive dark cinematic UI with searchable creator directory, All / Monitored / Needs review segments, metadata freshness, correct operator-review status, timezone-aware actual publication-hour histogram for up to ten recorded videos, and a link to the official YouTube channel. Language and niche are searchable; small channels aren't excluded.
- Individual video picker, publication timestamp, content format, cumulative **views, likes, comments**, time-anchored line chart and **observed** interval growth. India/UTC timezone switch. All data must come from the API.
- Trend charts display only after at least two real view readings. Rates use the elapsed interval between actual snapshots, never assume 1-hour exact source Analytics. Counter reductions are shown as reported adjustments, not negative growth. Unknown/hidden counts remain **Unavailable**, not zero. Exact BigInt calculations avoid unsafe rounding.
- Explicit 3-state truthfulness: **not deployed** returns a visible service message; **deployed but empty** displays verified-creator waiting message; **creator/video with no snapshots** displays no measurements and no fake graph. At most first 100 verified directory entries and 800 real samples in detail, with truncation warnings.
- New `cinerelay-creator-intelligence-api` Edge endpoint (not deployed) authenticates actual Supabase JWT and active `operator_users` allowlist on every request. Read-only methods `overview` and `channel`; no edits, triggers, new jobs, YouTube API calls or user notifications. If C3 storage is absent returns a specific `CREATOR_STORAGE_NOT_DEPLOYED` error.
- C5 migration `creator_intelligence_counter_text` projects `numeric(20,0)` observations to **exact decimal strings** for lossless JSON and keeps them service-only with `security_invoker=true` plus revoked public/anon/authenticated access. This view never exposes expired/older-than-30-day samples.
- Tests: 9 pgTAP counter-view assertions and 10 Deno tests for truthful chart math, BigInt, missing values and timing. New operator API strict Deno check, native Edge build and existing Vite/TSC web compile added to CI.

## Product/legal scope

The data is public YouTube **cumulative** video counter readings captured prospectively. **Do not claim private YouTube Analytics (watch time, audience demographics, revenue, exact hourly views).** Comparison leaderboards, scores or extrapolated rankings are not displayed pending developer policy review. A rate between readings is only an observed interval average.

C5 does not alter movie/series event processing, cinema source fallback polling, WebSub, alerts or push queues. It has no new scheduled collection.

## Activation gates

1. C2 official channel IDs verified with a securely provisioned API key and current stable-ID dedupe.
2. Channel approval and compliance with YouTube data retention requirements.
3. Real project-specific `videos.batchGetStats` quota and one-request canary validated.
4. C3/C4 schema + collector deployment after operator review. **Production remains unchanged in draft.**
5. Deploy C5 view + operator endpoint + console and validate a no-data state before feeding real stats.
6. Validate actual-data chart, stale-sample handling and minimum diverse creator cohort.
7. Build consumer-facing creator discovery only after the operator dashboard has genuine data.

## Checks

- [x] UI, API and view code committed.
- [x] C5 explicit no-data UI; no synthetic creator cards or sample metrics.
- [x] Exact bigint and non-hourly interval test suite authored.
- [ ] C5 head all GitHub CI green.
- [ ] Browser visual QA across small Android/web/tablet widths (not possible solely from source compile).
- [ ] Operator API deployed and measured against real DB (deliberately blocked until preceding stages).
