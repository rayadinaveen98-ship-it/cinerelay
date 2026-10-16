# Prevent stale first-party article promotion to breaking news

## Confirmed root causes
1. `process-raw-item-worker` queried `raw_items` **without `item_type`**. Although `isOfficialArticleSource` checked `WEB_ARTICLE`, the worker always passed an empty string, silently skipping new typed official-article review suggestions.
2. The operator's `resolveRawItem` action creates a canonical identity and requeues `PROCESS_RAW_ITEM`. Without guardrails, an article ingested weeks ago (or with no known publication timestamp) could be processed into a **brand-new canonical event with `detected_at=now()`** and `plan_event_alerts` could enqueue follower notifications.

## Fix
- Use a typed and regression-tested raw-item select that includes `item_type`, `published_at`, `first_seen_at`. The existing conservative title extraction now has the item-type evidence it requires.
- On **operator-overridden WEB_ARTICLE only**, after resolution has been safely persisted and before any OTT release upsert or event classification:
  - If first discovery is more than 48 hours old or invalid, hold event publication;
  - If publication timestamp is missing, invalid or more than 48 hours old, hold;
  - If either timestamp is implausibly in the future, hold.
- Log only `REVIEWED_WEB_ARTICLE_EVENT_HELD` with reason and item ID, complete worker job with `RESOLVED_REVIEW_ONLY`. The operator's canonical entity and resolution evidence remain; **no event, release upsert or alert is emitted** from stale/unknown-dated reviewed articles.
- Unreviewed normal source ingestion, YouTube, RSS and fresh timestamped reviewed website articles keep existing behavior.
- Update operator-console copy to explain the identity-only result for old/undated article approvals.
- All new titles remain pending until real operator action. Do not automatically approve the three `Aspirants`, `Storm`, `The Diplomat` candidates.
- CI tests: raw columns, stale Oct 1 backfill, null publication timestamp, old publication newly ingested, fresh exception, other-source exceptions, future and invalid timestamps.

## Acceptance
GitHub Deno/Edge regression, web console, consumer, mobile and database checks required; deploy the raw worker pinned to immutable merged commit. Verify no direct unauthenticated execution and source-health stable. No new Android APK.
