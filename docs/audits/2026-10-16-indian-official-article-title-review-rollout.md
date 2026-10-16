# CineRelay — India-first official article title and release-date review rollout

Date: 2026-10-16 IST. Production project `dnqaejljfzwhsainpdxb`.

## Deployment
- GitHub PR #48: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/48
- Merged SHA: `8e29d37ef640d33915e49e7d977d7891315f8173`.
- Live production `process-raw-item-worker` version **26**, ACTIVE, pinned to that exact merge commit.
- All required Edge/Deno article extraction tests, database migration tests, intelligence and connector checks, mobile APIs, notification preferences, consumer APIs, web-console checks and **Android canary CI** succeeded (Android run `38844904507`). Source code changes backend-only; no APK release required.
- The new function's unauthenticated invocation returned HTTP **401 unauthorized**, consistent with retained internal-key authentication.

## Extractor rules
- Source gate: `WEB_ARTICLE` from active trusted first-party `WEB` identities: production house, official OTT platform, project or film first-party, Tier 1–2.
- Existing numbered season headline `The Diplomat Season 4: ...` -> pending `SERIES: The Diplomat`.
- Explicit trailer headline `Watch the trailer of Aspirants Season 3 streaming now on Prime Video` -> pending `SERIES: Aspirants`, seasonNumber 3.
- `new thriller series Storm` at the end of an official studio/OTT article -> pending `SERIES: Storm`.
- Explicit `film 'Quoted Title'` / `movie 'Quoted Title'` -> pending `MOVIE` only. Roundups, bare titles and ambiguous biographies/documentaries remain manual operator resolution.
- Release-date evidence **only** when headline has a release/premiere/streaming verb followed by full `Month DD, YYYY` and valid calendar date. No inference from article posting timestamp, missing year, or invalid leap date. `proposedReleaseDate` and `releaseDateIsUnverified=true` are review *metadata only*, never asserted as actual releases in `events` / `ott_releases`.
- The first CI test detected overbroad rejection of legitimate movie titles containing `New`; this was corrected and the subsequent full checks passed.

## Exact first-party Prime Video India backfill

Approved guarded one-time backfill of only two known `UNRESOLVED` first-party `WEB_ARTICLE` raw items (existing Tier-A `About Amazon India — Prime Video` source).

| Raw item | Candidate | Status | Evidence | Release date | Canonical events |
|---|---|---|---|---|---|
| `23e454e9-1aad-4cde-b0db-63fc7ed1b390` | `Aspirants` `SERIES`, season 3 | `PENDING` | 1 first-party article; `OFFICIAL_TRAILER_NAMED_SEASON` | NULL | 0 |
| `1042d386-eb87-4dc9-87dc-d322284117e9` | `Storm` `SERIES` | `PENDING` | 1 first-party article; `EXPLICIT_NEW_NAMED_SERIES_HEADLINE` | NULL | 0 |

Candidate ids: `51476ba7-6a59-4baa-9134-ff1bf27b3f43` (Aspirants); `5007d5cc-2a6a-4cc4-9e23-fcf6228f8052` (Storm). Both are `reviewRequired=true`, country/language unknown, no entity promotion, no notification. `OFFICIAL_ARTICLE_TYPED_REVIEW_BACKFILL` action entries recorded.

A Netflix documentary article **about Natalee Holloway** remains manual review (not automatically inferred as a film title). Prior `The Diplomat` candidate remains PENDING.

## Final production verification
- 184 active YouTube, 8 WEB, 38 RSS, total **230/230 effectively HEALTHY**.
- In the last 30 minutes: page-poll cron **6 succeeded / 0 failed**, process-raw-item cron **30 succeeded / 0 failed**, source-discovery **2 succeeded / 0 failed**.
- Entity discovery queue after update: **15 PENDING MOVIE**, **3 PENDING SERIES**. PENDING is not published or approved.

## Remaining acceptance checks
- Authenticated operator review of `Aspirants` and `Storm` and source context before catalogue creation or event publishing.
- Exercise operator review UI with actual signed-in operator; only its backend auth boundary has been tested here.
- Observe an actual future new official article matching the new extractor to validate the complete automated queueing path (the current two are tightly guarded backfill fixtures).
- Expand rules incrementally only with real official headlines and adversarial tests; preserve no-guess-date policy.
