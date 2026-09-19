# P6.0.8 — Newsroom Filter Hardening

Date: 2026-09-16
Status: HOSTED-PROVEN

## Goal

Reduce archive/catalog noise in the fast newsroom without hiding useful current cinema signals.

The rule remains evidence-driven: raw ingestion is preserved, canonical processing is preserved, and only the newsroom projection suppresses hosted-proven noise patterns.

## Implemented filter contract

Shared implementation: `packages/domain/src/newsroom-filter.ts`

The newsroom now:

- filters explicit `Movie Scene(s)`, comedy/fight/action/emotional scene and full-movie title patterns when no current-news intent is present;
- filters leading descriptions that explicitly identify a pre-2020 catalog film/movie when the title has no current-news intent;
- preserves current intent such as release/releasing, trailer, teaser, glimpse, first look, poster, announcement, launch, pre-release, press meet, premiere, streaming/OTT, shoot/wrap, muhurtham/pooja and release/launch date;
- normalizes Unicode/whitespace for exact-title deduplication;
- collapses repeated non-current pipe-title clip families per source while preserving the newest member;
- never clip-family-collapses a title containing current-news intent.

## Regression proof

`tests/newsroom/run-newsroom-filter.mjs` contains seven regression fixtures based on hosted CineRelay data patterns:

1. explicit Movie Scenes archive upload is filtered;
2. current trailer wins over archive-looking words;
3. pre-2020 legacy catalog description is filtered when title has no current intent;
4. current launch survives old-library boilerplate later in the description;
5. Unicode/whitespace normalization is deterministic;
6. non-current pipe-title variants collapse into one clip family;
7. current-news pipe title is never grouped as an archive family.

`npm run ci` includes `test:newsroom` and passed on the proven implementation head.

## CI proof

Proven implementation head before this documentation commit:

`de5e46aba04f5647ed4fef54263293a6020ce4de`

### CineRelay CI

- workflow: CineRelay CI #402
- run: `35131005459`
- database migrations + pgTAP: SUCCESS
- intelligence/connectors including all seven newsroom regressions: SUCCESS
- strict Edge type-check/build/bundle: SUCCESS
- web console: SUCCESS

### Android Canary CI

- workflow: CineRelay Android Canary CI #68
- run: `35131005461`
- mobile API domain build: SUCCESS
- newsroom Deno type-check: SUCCESS
- deployment-native mobile API bundle: SUCCESS
- Android V0.2 APK build: SUCCESS
- APK/package verification: SUCCESS

Mobile API deploy artifact:

- artifact id: `10461202073`
- artifact digest: `sha256:365f1d49b8b1425a632c6b676fb694075f9d33540f7c31294bb0685bc3f16c86`
- CI-built newsroom `index.js` SHA-256: `445da96a51e954a35e5c28e36c2386ac7d7832a651a37af27c4d87ef84059aec`

Android APK artifact:

- artifact id: `10461627136`
- artifact archive digest: `sha256:9fc58b03ac7be290bd82d4368570f087e6634c9cedf5cc0403fa53df35e5fe7c`
- extracted APK SHA-256: `7cfdbcc193b4feb6a492cb351864479ea833007c45f8c6e99ae2d4cb547a8993`

## Hosted deployment proof

Function: `cinerelay-newsroom-api`

- function id: `9fecda75-b7e4-4cef-bb68-b81f3b4a69ec`
- hosted version: `4`
- status: `ACTIVE`
- `verify_jwt`: `false` intentionally; guest-readability remains part of the newsroom contract and supplied bearer tokens are still validated in the function body
- hosted runtime SHA: `6d83cc31e6981df5b0b73eb4110962e39d942748a70968fe032c4fbf0cd8be9c`

Deployment used the exact CI-built mobile API artifact rather than rebuilding production code by hand.

## Hosted before/after sample

Same 20-item production sample shape:

### Before — newsroom v3

- scanned: 20
- filtered: 14
- archive/library filtered: 14
- duplicate-title/family filtered: 0
- surfaced: 6

Legacy leakage included:

- two `Mechanic Alludu` pipe-title variants;
- `Master Telugu Movie | It's All God's Will ...` catalog clip.

Useful signals included:

- M.S. Legacy on Screen launch event;
- Aadarsha Kutumbam Oct 2, 2026 release-date item;
- Family Pack canonical event.

### After — newsroom v4 / P6.0.8

- scanned: 20
- filtered: 16
- archive/library filtered: 15
- duplicate-title/family filtered: 1
- surfaced: 4

Surfaced titles:

1. `M.S. Legacy on Screen Launch Event ...`
2. newest `Mechanic Alludu | She Never Changes ...` clip-family member
3. `#AadarshaKutumbam - Releasing on Oct 2nd, 2026 ...`
4. `Sankranthi is for FAMILY ...` / Family Pack canonical event

Validated improvements:

- legacy `Master` catalog item is suppressed;
- older repeated `Mechanic Alludu` clip-family variant is collapsed;
- M.S. launch remains visible;
- Aadarsha Kutumbam release-date signal remains visible;
- Family Pack canonicalized signal remains visible.

## Product rule preserved

For FrameByNavin, speed + provenance still beats hidden perfection.

P6.0.8 does not require entity/canonical resolution before surfacing. It only removes patterns proven to be newsroom noise while preserving the raw evidence in storage and all downstream enrichment paths.

## Next

1. observe the expanded twelve-source YouTube set plus HOT_5M Disney/Amazon sources under real publishing activity;
2. add future relevance rules only from hosted evidence and regression fixtures;
3. continue first-party source expansion carefully;
4. keep Instagram/Threads inactive until real Meta credentials and source enrollment exist;
5. keep Netflix Newsroom unpromoted until a stable chronological parser profile is proven;
6. evaluate trusted trade/public-page sources separately from first-party verified signals.
