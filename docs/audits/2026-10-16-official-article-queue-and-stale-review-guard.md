# CineRelay — Official article queue and stale reviewed-news guard

Date: 2026-10-16 IST. Production Supabase project `dnqaejljfzwhsainpdxb`.

## Root cause and impact

1. The `process-raw-item-worker` previously fetched `raw_items` **without `item_type`**, despite checking `isOfficialArticleSource(source, String(raw.item_type ?? ''))` before calling `queueTypedOfficialArticleReview`. This silently disabled **automatic** typed review for new official website articles, even though deliberate manual backfills created the three existing candidate examples.
2. `operator_resolve_raw_item` always re-enqueues `PROCESS_RAW_ITEM` and persists an ACTIVE canonical entity or override. If a historical or undated article were reprocessed, the normal classifier could create a newly timestamped event and call `plan_event_alerts`, making an old headline look like breaking news.

## Implementation

PR #50: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/50

Merged commit: `1ebf3f2f10ab0976ff4d4439ae80c30e2c4646ac`.

- New `RAW_ITEM_SELECT_COLUMNS` selects `item_type,published_at,first_seen_at` as well as existing content. The actual source-type gate receives `WEB_ARTICLE` for official first-party website articles, allowing the existing conservative `SERIES`/`MOVIE` suggestion workflow to enqueue pending human review on future suitable articles.
- New `reviewedArticleHoldReason` applies **only** to `operatorOverride=true` and `itemType='WEB_ARTICLE'` from `platform='WEB'`. It holds event generation if first discovery or original publication is over 48h old, if the original publication timestamp is missing/invalid, or if either timestamp is implausibly in the future.
- The worker persists the manual entity resolution, logs `REVIEWED_WEB_ARTICLE_EVENT_HELD` with the exact reason, completes the job as `RESOLVED_REVIEW_ONLY`, and **does not** upsert an OTT release, create a canonical event or enqueue an alert.
- Normal unreviewed website ingestion, RSS, YouTube and genuinely fresh timestamped manually reviewed website content follow existing logic.
- Console copy now clarifies the identity-only behavior for historical/unknown-date website articles. No approval automations added.

## Validation

- Deno CI regression tests cover raw SQL column selection; old `2026-10-01` articles; newly discovered-but-old publications; missing publication timestamp; recent valid timestamp; invalid/future timestamps; and unaffected non-review sources.
- GitHub full PR checks all **SUCCESS**, including Android canary, web console, source and consumer API, Edge, notification and database checks.
- `main` post-merge checks all **SUCCESS**, including stable-release build.
- Production `process-raw-item-worker` version **27** ACTIVE, wrapper pinned to immutable merged commit `1ebf3f2f10ab0976ff4d4439ae80c30e2c4646ac`.
- Unauthenticated POST smoke test returned **HTTP 401** with `{"error":"unauthorized"}`; protected internal-secret auth retained.
- Post-deployment inventory: **184 YOUTUBE + 8 WEB + 38 RSS = 230 active sources**, all 230 effectively healthy.
- Last 30 minutes at verification: process-raw-item cron 30 succeeded/0 failed, page-poll 6 succeeded/0 failed, source-discovery 2 succeeded/0 failed.
- `Aspirants`, `Storm` and `The Diplomat` remain `PENDING` typed `SERIES` review candidates with **zero canonical event links**. No replay/backfill job was performed and no user notifications were generated during this validation.
- No Android APK change required; Cloudflare Pages main deployment green.

## Acceptance still pending

- Observe the **first genuinely new official article** that matches the typed rule, confirm automatic pending candidate creation and safe source provenance. This cannot be claimed as end-to-end verified based solely on unit tests and manually inserted candidates.
- Exercise operator-only queue in a real signed-in browser session. Do not invent operator tokens or bypass the allowlist.
- If editorial policy later permits historical articles in the browse feed, model them as archival items with correct original timestamps and push eligibility explicitly disabled; do not reuse fresh event publishing.
