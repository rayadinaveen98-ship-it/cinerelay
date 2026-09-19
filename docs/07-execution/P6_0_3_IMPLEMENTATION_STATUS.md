# P6.0.3 — Fast Newsroom Implementation Status

Date: 2026-09-16

Status: **P6.0.3.1 PROVEN / P6.0.3.2 IMPLEMENTED / HOSTED RUNTIME V3 ACTIVE / MERGE HELD FOR FINAL COMBINED-HEAD CI**

## Product correction implemented

CineRelay Live no longer waits for canonical entity/event creation before it can show useful FrameByNavin source activity.

The existing canonical event + evidence layer remains the trusted knowledge model. P6.0.3 adds a separate fast newsroom projection over `raw_items`, so source activity can surface immediately after a relevance/noise gate and later acquire canonical enrichment on the same raw-item signal.

No database migration was required.

## Fast newsroom API

New function:

- slug: `cinerelay-newsroom-api`;
- hosted function id: `9fecda75-b7e4-4cef-bb68-b81f3b4a69ec`;
- hosted version: `3`;
- hosted status: `ACTIVE`;
- hosted runtime SHA-256: `5bb6884c55399b582e57ad04ab16c98d400091bdea8511b678e81daf0da0c0b8`;
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

## Relevance / noise gate

The implementation deliberately uses conservative filters rather than a destructive broad classifier.

Obvious archive/library titles are filtered when they contain patterns such as:

- `Movie Scene` / `Movie Scenes`;
- generic comedy/fight/action/emotional scene labels;
- `Full Movie`.

A title with explicit current-news intent is preserved, including release/releasing, trailer, teaser, glimpse, first look, poster, announcement, launch, pre-release, press meet, premiere, streaming/OTT, shoot/wrap, muhurtham/muhurat, pooja and title/release-date signals.

### Hosted-data correction

The first validation found a real bug: YouTube description boilerplate can contain generic words such as `release`, which could incorrectly rescue an obvious `Movie Scenes` upload.

The gate was corrected so archive-vs-current intent is evaluated from the title itself. Raw text is not allowed to rescue an archive-looking title.

### P6.0.3.2 duplicate suppression + telemetry

Hosted runtime v3 adds an additional safe noise layer:

- titles are Unicode-normalized, lowercased and whitespace-normalized;
- within one source identity and one feed scan, only the newest identical normalized title is retained;
- duplicate suppression happens after the explicit archive gate;
- response telemetry now exposes per-reason counts for `empty_content`, `archive_or_library_clip` and `duplicate_title`;
- the aggregate `filteredOut` count is derived from those reason counters.

This avoids hiding semantically different updates while giving CineRelay evidence for the next filter iteration.

### Hosted active-source validation

Recent active-source sample after the correction and v3 rules:

- scanned: `20` raw items;
- surfaced: `6`;
- filtered as obvious archive/library noise: `14`;
- duplicate-title filtered outside the archive set: `0`;
- empty-content filtered: `0`;
- surfaced items already carrying canonical evidence in the earlier canonical-link check: `1`.

Examples preserved:

- `#AadarshaKutumbam - Releasing on Oct 2nd, 2026 ...`;
- `M.S. Legacy on Screen Launch Event ...`;
- the existing canonicalized Family Pack / Sankranthi signal.

Examples suppressed:

- repeated Pasivadi Pranam `Movie Scenes` uploads;
- repeated Parugu `Movie Scenes` uploads;
- Nalla Trachu `Movie Scenes` uploads;
- other explicit archive-scene titles.

The filter intentionally does not yet suppress every ambiguous old-film clip. Source-specific/context-aware refinement remains future work and should be evidence-led.

## Android integration

New Android models:

- `NewsroomSource`;
- `NewsroomSignal`.

`AppTab.LIVE` loads `backend.newsroom()` instead of forcing all Live content through canonical `EventCard`.

The Live UI includes:

- four-state colored-dot newsroom labels;
- source name, platform and handle;
- raw signal title/body;
- source-observed vs CineRelay-ingested timing;
- `Open original source`;
- canonical-enrichment panel when available;
- Evidence and Follow controls only when a canonical event exists.

P6.0.3.2 also adds a newsroom filter control without modifying the proven V0.2 card layout:

- `All signals`;
- `Verified`;
- `Developing`;
- `Unconfirmed`;
- `Conflict / Rumor`;
- live count beside each state;
- filtering is local presentation only — accepted signals continue ingesting/enriching normally.

The filter state is owned by `CineRelayViewModel`; the unfiltered latest newsroom set remains available internally so switching filters never discards data.

Important boundary: an unresolved raw-item ID is never sent to the Evidence API and cannot be followed as an entity. Existing Following, Radar, Alerts and Evidence surfaces continue to use canonical `EventCard` contracts.

## P6.0.3.1 CI proof

The first newsroom engineering checkpoint was proven at:

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

P6.0.3.2 changes are kept on the same draft PR and must pass the final combined-head CI before merge/readiness is changed.

## Proven P6.0.3.1 build artifacts

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

The hosted Supabase function is confirmed ACTIVE at version 3 and its production database semantics were validated directly against current hosted data. A separate external HTTP POST canary is not used as the release proof here; CI type-check/build proof, hosted runtime metadata, Android integration builds and hosted-data validation form the engineering evidence.

## Next after final combined-head CI

1. add source/context-aware relevance scoring only where hosted evidence demonstrates a safe rule;
2. add regression fixtures from real hosted noise patterns;
3. restore/verify YouTube WebSub push;
4. keep a 2–5 minute high-priority fallback polling path;
5. aggressively expand official Telugu cinema YouTube coverage;
6. reduce high-priority RSS/first-party Web polling cadence;
7. activate Instagram/Threads only with real enrollment/auth proof;
8. add trusted trade/public-page developing signals;
9. evaluate X separately.
