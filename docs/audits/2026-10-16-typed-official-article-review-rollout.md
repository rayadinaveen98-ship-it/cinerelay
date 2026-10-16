# CineRelay — Typed first-party article review rollout

Date: 2026-10-16 IST. Project `dnqaejljfzwhsainpdxb`. PR #47 merged as `0e22cca860f01a0e9f77cc53f3015f49d61503f8`.

## Production change

- `process-raw-item-worker` version **25**, pinned to immutable merged GitHub commit; existing internal-secret authentication unchanged.
- `cinerelay-review-api` version **4**, operator-only `officialArticleReviewQueue` action; existing verified-user and operator-status gates unchanged.
- No database schema migration, new public access, Android APK change, event auto-promotion, or retroactive notification.
- Deno regression tests (explicit numbered season, ambiguous documentary, unsafe headlines, source restrictions) passed; Edge type-check, DB, web, consumer, mobile, notification-preference and Android-canary GitHub checks passed.
- Unauthenticated POST probes: review API HTTP **401 authentication_required**, processing worker HTTP **401 unauthorized**.
- Existing candidate-submission RPC privilege check: `anon=false`, `authenticated=false`, `service_role=true`.

## Evidence-backed production proof

First-party Netflix Tudum official article:

`The Diplomat Season 4: The Drama is Back With More Power Plays and Politics`

- Raw item `dec1d550-c531-45cc-9412-e6b65b46966d`, source Netflix India Tier 1 OTT_PLATFORM WEB_ARTICLE.
- One `SERIES` discovery candidate `6046c8e3-120f-42b6-bf0a-1550016d3807`, name `The Diplomat`, `status=PENDING`, `confidence=0.87`, `evidence_count=1`, `first_party_source_count=1`, `reviewRequired=true`. Country unknown/null (global Netflix article is not necessarily an Indian production).
- No canonical entity, linked event, or notification was created.

Ambiguous official documentary article:

`A New Documentary About Natalee Holloway Recounts Teen’s Infamous Disappearance`

- Raw item `1c993307-0a0f-4ad8-9b54-06f6e3e7739e` stays `UNRESOLVED`, with zero typed suggestions and zero canonical events. The subject of a documentary is **not** asserted as its actual title.
- Both articles remain eligible for operator review via review API; the new action also returns typed suggestions with review status when available.

## Stability check

- Active source identities: **184 YouTube, 8 WEB, 38 RSS = 230**, **230/230 HEALTHY** at verification.
- Last 30 minutes: source raw processing cron 30 succeeded / 0 failed; page polling 6 succeeded / 0 failed; discovery 2 succeeded / 0 failed.
- The new function's unauthenticated API boundary is tested. Authenticated operator UI interaction has not been physically exercised and is not claimed as verified.

## Next safe step

Manual operator verification of title, format (series versus documentary film), source article and supporting title evidence. Approve existing typed candidates only after confirming identity; no automatic catalogue publication. Extend typed extraction incrementally only when deterministic, backed by primary-source evidence. Keep ambiguous or unrelated global headlines in review; preserve India-first relevance policy.
