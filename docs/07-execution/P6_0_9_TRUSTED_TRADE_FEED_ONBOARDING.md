# P6.0.9 — Trusted Trade Feed Onboarding

Date: 2026-09-16
Status: ACTIVATED / BASELINED / FIRST LIVE DELTA PENDING

## Goal

Add lower-trust developing signals without weakening CineRelay's first-party verification contract.

P6.0.9 deliberately keeps first-party and trade-media trust paths separate:

- first-party authority tier 1 remains eligible for immediate `VERIFIED` newsroom state when unresolved;
- trade-media authority tier 3 is a developing-signal path;
- trade reports do not become equivalent to an official production-house/platform statement;
- RSS/Atom is preferred over brittle HTML when a clean feed exists;
- initial registration must baseline without historical backfill.

## First activated trade feed

### 123Telugu — Movie News

Candidate/feed:

`https://www.123telugu.com/category/mnews/feed/`

Hosted transport validation:

- HTTP status: `200`
- format: RSS 2.0
- content type: `application/rss+xml; charset=UTF-8`
- conditional-fetch support: ETag + Last-Modified
- hosted validation request id: `7608`
- first observed item publication time in the validated response: `Wed, 16 Sep 2026 17:31:00 +0000`

The candidate was submitted through `submit_source_discovery_candidate` with hosted transport evidence attached, then explicitly reviewed and approved through `operator_review_source_candidate`.

Candidate id:

`08b311b0-1181-4aa3-9a0e-4ca61aaf2af3`

Review action id:

`43095b32-f8bb-4253-a13a-56b7572d47d2`

Promotion used the audited `operator_promote_media_feed_candidate` contract.

Promotion action id:

`b89a7a54-3b88-4f32-be68-d04ce25688f9`

Created source:

- source id: `e1082d86-5b4e-4afd-a3a4-aaf9c176276b`
- source identity id: `03b72e80-091e-4b1b-839b-da440408739a`
- platform: `RSS`
- connector: `RSS_ATOM`
- access mode: `FEED`
- authority tier: `3`
- source role: `TRADE_MEDIA`
- poll class: `ACTIVE_15M`
- territory: India
- declared languages: English + Telugu

## Hosted baseline proof

The normal secured scheduler path was used; no worker bypass was introduced.

Feed dispatcher request id:

`7611`

Dispatcher result:

- due: 2
- checked: 2
- baselined: 1
- notModified: 1
- itemsNew: 0
- itemsChanged: 0
- failed: 0
- rateLimited: 0
- gaps: 0
- parser: `feed-parser-v1`

The second due source was the already-live Disney RSS source; it returned not-modified.

The new trade feed intentionally produced **zero historical raw items** during baseline.

## Hosted state after baseline

For source identity `03b72e80-091e-4b1b-839b-da440408739a`:

- health: `HEALTHY`
- last HTTP status: `200`
- consecutive failures: `0`
- gap count: `0`
- last checked: `2026-09-16 18:03:59.303+00`
- next check: `2026-09-16 18:18:59.303+00`
- exact scheduled cadence: `15.00` minutes
- baseline last entry id: `https://www.123telugu.com/?p=848889`

## Newsroom trust contract

This source is deliberately not first-party verified authority.

For unresolved raw items, the current newsroom state contract maps:

- authority tier <= 1 -> `VERIFIED`
- authority tier <= 3 -> `DEVELOPING`
- authority tier 4 -> `UNCONFIRMED`
- lower/unknown authority -> caution/conflict path

Therefore an unresolved 123Telugu feed item is intended to surface as `DEVELOPING`, while later canonical corroboration may change the event-level verification state.

No synthetic production raw item was inserted merely to demonstrate this mapping.

## Important limitation

P6.0.9 is **activated and baselined**, but the feed has not yet published a new post after the baseline checkpoint during this execution window.

Therefore the following are not yet claimed:

- first real post-baseline raw-item ingestion from this source;
- hosted newsroom rendering of an actual 123Telugu item;
- downstream canonical/event enrichment from this source.

Those should be proven only after a real future feed delta occurs.

## Current trust stack

First-party high-authority coverage remains separate:

- 12 official YouTube sources;
- Walt Disney Company RSS;
- About Amazon India — Prime Video first-party Web source.

Trade/developing coverage now begins with:

- 123Telugu — Movie News RSS, tier 3 / `TRADE_MEDIA` / 15-minute polling.

## Next

1. observe the first genuine post-baseline 123Telugu delta and verify raw-item + newsroom state end-to-end;
2. do not add historical backfill simply to create a test signal;
3. evaluate another structurally clean RSS/Atom trade source before using a public HTML parser;
4. keep trade-media claims visually and semantically distinct from first-party verified signals;
5. add source-specific noise rules only when hosted evidence justifies them;
6. keep Netflix Newsroom unpromoted until stable chronological ordering is proven.
