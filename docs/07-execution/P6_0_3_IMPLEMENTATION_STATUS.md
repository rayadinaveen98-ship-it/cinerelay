# P6.0.3 — Fast Newsroom Implementation Status

Date: 2026-09-16

Status: **P6.0.3.1 ENGINEERING COMPLETE / HOSTED RUNTIME ACTIVE / ANDROID CI GREEN / APK PRODUCED**

## Product correction implemented

CineRelay Live no longer waits for canonical entity/event creation before it can show useful FrameByNavin source activity.

The existing canonical event + evidence layer remains the trusted knowledge model. P6.0.3.1 adds a separate fast newsroom projection over `raw_items`, so source activity can surface immediately after a basic relevance/noise gate and later acquire canonical enrichment on the same raw-item signal.

No database migration was required.

## Fast newsroom API

New function:

- slug: `cinerelay-newsroom-api`;
- hosted function id: `9fecda75-b7e4-4cef-bb68-b81f3b4a69ec`;
- hosted version: `2`;
- hosted status: `ACTIVE`;
- hosted runtime SHA-256: `fed327897719c1c7650f21170b5d37d523e3bdd0ab6de3f77978e4d00011904f`;
- JWT gateway verification: disabled intentionally because the body implements guest access plus optional bearer validation;
- supplied invalid bearer is rejected as `invalid_session`;
- service-role credentials remain server-side.

The canonical `cinerelay-mobile-api` and `cinerelay-evidence-api` remain unchanged as separate boundaries.

## Signal contract

The raw item ID is the stable newsroom signal ID.

Each signal exposes:

- newsroom state;
- source name;
- source authority tier and role;
- source platform and handle;
- item/media/language metadata;
- source title/text;
- original canonical URL;
- source-observed time;
- CineRelay-ingested time;
- enrichment state (`RAW` or `CANONICALIZED`);
- optional canonical event payload when evidence linkage exists.

Canonicalization does not replace the newsroom signal identity. It enriches the existing signal.

## User-facing state mapping

- `VERIFIED` — green;
- `DEVELOPING` — yellow/amber;
- `UNCONFIRMED` — orange;
- `CONFLICT_RUMOR` — red.

Conflict evidence overrides the normal state and produces `CONFLICT_RUMOR`.

For unresolved raw signals, source authority provides the initial state. Canonical verification supersedes that provisional interpretation when available.

## Relevance / noise gate v1

The first implementation deliberately uses a conservative filter rather than a destructive classifier.

Obvious archive/library titles are filtered when they contain patterns such as:

- `Movie Scene` / `Movie Scenes`;
- generic comedy/fight/action/emotional scene labels;
- `Full Movie`.

A title with explicit current-news intent is preserved, including release/releasing, trailer, teaser, glimpse, first look, poster, announcement, launch, pre-release, press meet, premiere, streaming/OTT, shoot/wrap, muhurtham/muhurat, pooja and title/release-date signals.

### Hosted-data correction

The first validation found a real bug: YouTube description boilerplate can contain generic words such as `release`, which could incorrectly rescue an obvious `Movie Scenes` upload.

The gate was corrected so archive-vs-current intent is evaluated from the title itself. Raw text is not allowed to rescue an archive-looking title.

### Hosted active-source validation

Recent active-source sample after the correction:

- scanned: `20` raw items;
- surfaced: `6`;
- filtered as obvious archive/library noise: `14`;
- surfaced items already carrying canonical evidence: `1`.

Examples preserved:

- `#AadarshaKutumbam - Releasing on Oct 2nd, 2026 ...`;
- `M.S. Legacy on Screen Launch Event ...`;
- the existing canonicalized Family Pack / Sankranthi signal.

Examples suppressed:

- repeated Pasivadi Pranam `Movie Scenes` uploads;
- repeated Parugu `Movie Scenes` uploads;
- Nalla Trachu `Movie Scenes` uploads;
- other explicit archive-scene titles.

The filter intentionally does not yet suppress every ambiguous old-film clip. Source-specific/repetition-aware refinement is the next noise slice.

## Android integration

New Android models:

- `NewsroomSource`;
- `NewsroomSignal`.

`AppTab.LIVE` now loads `backend.newsroom()` instead of forcing all Live content through canonical `EventCard`.

The Live UI now includes:

- four-state colored-dot newsroom labels;
- source name, platform and handle;
- raw signal title/body;
- source-observed vs CineRelay-ingested timing;
- `Open original source`;
- canonical-enrichment panel when available;
- Evidence and Follow controls only when a canonical event exists.

Important boundary: an unresolved raw-item ID is never sent to the Evidence API and cannot be followed as an entity. Existing Following, Radar, Alerts and Evidence surfaces continue to use canonical `EventCard` contracts.

## CI proof

Implementation head proven by the P6.0.3.1 engineering run:

- commit: `48faa3b07c8fc433dc2232015945e19730045689`;
- CineRelay CI #370 / run `35120103399`: **SUCCESS** — all four jobs green;
- Android Canary CI #36 / run `35120103407`: **SUCCESS**;
- mobile-apis job: **SUCCESS**;
- `cinerelay-newsroom-api` strict Deno type-check: **SUCCESS**;
- deployment-native mobile API bundle: **SUCCESS**;
- Android privileged-secret scan: **SUCCESS**;
- Android V0.2 Gradle assemble: **SUCCESS**;
- APK/package verification: **SUCCESS**;
- APK artifact upload: **SUCCESS**.

## Build artifacts

Android canary artifact:

- artifact name: `cinerelay-android-v0.2.0-canary-apk`;
- artifact id: `10456994377`;
- archive digest: `sha256:837ed6e2199d1624dc7016285c16713c6ea8c8fc25941cfc0abf6e69b7a46812`;
- extracted APK SHA-256: `45a577682023cd027554a0f24b9003262b983e4771570df9da9a58f4cc4e9ead`.

Mobile API deployment artifact:

- artifact name: `cinerelay-mobile-apis-v0.2-deploy-bundle`;
- artifact id: `10455943649`;
- archive digest: `sha256:c4bb5f602333e58874f7279d77c92cdeb52168490fcf9ec22596b856d1fb1c6d`.

## Verification limitation

The hosted Supabase function is confirmed ACTIVE at version 2 and its production database semantics were validated directly against current hosted data. A separate external HTTP POST canary was not used as the release proof for this slice; the CI type-check/build proof, hosted runtime metadata, Android integration build and hosted-data validation are the recorded P6.0.3.1 evidence.

## Next implementation slice

P6.0.3.2 should improve signal quality without reintroducing canonicalization latency:

1. repetition/fingerprint suppression for near-identical uploads;
2. source-specific archive behavior for channels that mix current news with catalogue clips;
3. conservative recency/context scoring rather than broad keyword blocking;
4. telemetry for filtered-vs-surfaced counts and reasons;
5. regression fixtures using the real patterns discovered in hosted data.

After the newsroom quality gate is stable, continue the locked sequence with YouTube WebSub restoration/verification, 2–5 minute fallback polling and aggressive Telugu official-source expansion.
