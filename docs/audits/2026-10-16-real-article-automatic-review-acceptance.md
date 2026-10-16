# CineRelay — Real official-article replay acceptance and review usability

Date: 2026-10-16 IST. Supabase production project `dnqaejljfzwhsainpdxb`.

## 1. Safe production acceptance replay

Purpose: verify the v27 `process-raw-item-worker` **actually executes** the automatic `WEB_ARTICLE` typed-review path now that `item_type` is fetched. This is a **real, already ingested article replay**; it is NOT a newly published announcement and cannot certify future-arrival freshness end-to-end.

Input: first-party Tier A `Netflix India` / Netflix Tudum official WEB_ARTICLE, raw item `dec1d550-c531-45cc-9412-e6b65b46966d`, headline `The Diplomat Season 4: The Drama is Back With More Power Plays and Politics`.

Preflight checked:
- Identity `b837e137-e393-4da5-9529-25698f57f651` active, platform WEB, Tier 1 OTT_PLATFORM.
- `current_entity_resolution_results` state UNRESOLVED; no operator override and no event evidence.
- An existing PENDING typed series candidate `6046c8e3-120f-42b6-bf0a-1550016d3807` already had exactly one first-party evidence row. To avoid synthetic public data, the replay **reused** that exact raw item and candidate, relying on unique candidate/raw-item constraint.
- Enqueued only `PROCESS_RAW_ITEM` with idempotency key `official-article-autoqueue-replay:20261016:dec1d550`, job `db972e01-690b-4b6c-b65a-b1651a9bcdae`. Dispatcher `process-raw-item` invoked through the existing scheduler-key protected route, request `208512`.

Observed results:
- Scheduler HTTP 200, upstream 200, `{leased:1,processed:1,events:0,resolutions:{UNRESOLVED:1}}`.
- Job `SUCCEEDED` on first attempt, no error.
- Existing candidate remained `PENDING`, evidence count **1**, first-party source count **1**, evidence `observed_at` updated at `2026-10-16 04:10:49Z`, `DETERMINISTIC_TITLE`; proves worker called idempotent candidate-submission path.
- Zero linked canonical events and zero alert deliveries from that raw item. No new candidate, entity approval or push notification.

Acceptance conclusion: **automatic processing + typed pending candidate upsert for a known real official WEB_ARTICLE is verified**. A first-ever naturally arriving new title is still unobserved and remains a distinct external acceptance gate.

## 2. Private operator review UX improvement

PR #51: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/51

Merged SHA `cc87486af9528f6df83671a72adb098e48e0d91d`.

The private Sources & ops → Movie & series article review UI:
- Sorts `PENDING` typed title suggestions above manual-only/unpromoted items, then by recency within those groups.
- Labels missing, implausible or older-than-48-hour article discovery/publication timestamps as **Historical or undated · identity-only on approval · no new alert**, mirroring backend `reviewedArticleHoldReason`.
- Does not change the actual operator action, auth, entity promotion, notification planner, backend job semantics, or Android APK.
- Pure TypeScript regression tests exercise the correct ordering without mutating input, date safety and the 48h boundary.
- The initial PR build correctly failed because Deno-only tests were located inside `apps/web/src`, where browser `tsc` processes them. Moved to `supabase/tests/unit/article-review-utils.test.ts` and updated the Edge CI test step. Corrected web-console build, Edge tests, intelligence, consumer, notification, Cloudflare and database checks passed on the updated PR; Android canary still checked separately during PR verification.

## 3. Current review and ingestion state

- 14 official WEB_ARTICLE unresolved items, 3 typed PENDING suggestions (Aspirants, Storm, The Diplomat), 11 manual-only.
- All 14 have no verified source publication timestamp; 12 are older than 48 hours since first ingestion. Under the reviewed article safety guard, approvals for these existing articles are **identity-only**, not fresh news or alert triggers.
- 184 YOUTUBE + 8 WEB + 38 RSS = **230** active identities, all 230 effectively HEALTHY at final check.
- The verified replay did not change public event counts or send notifications.

## 4. Remaining honest limitations

- Operator read-only and write UI flows were not manually exercised with a real logged-in operator account; authentication protections must not be bypassed or faked.
- No **naturally arriving**, previously unseen new article matching the strict title rule has been seen after this deploy, so full new-source arrival-to-review acceptance remains future observation.
- This is a safe data-path proof plus CI-proven UI update, not an Android visual/device test.
