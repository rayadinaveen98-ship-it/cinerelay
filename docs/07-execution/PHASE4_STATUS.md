# Phase 4 Status — Free Source Expansion

Date: 2026-09-16

## Overall state

**Phase 4: ACTIVE**

Phase 3 is complete, hosted, browser-verified and merged to `main` through PR #3.

Active branch:

`phase-4/free-source-expansion`

## Goal

Increase useful India-first cinema/series coverage without introducing mandatory paid APIs or an unmaintainable scraper farm.

Locked source priority:

1. official RSS/Atom feeds;
2. first-party studio/platform press/news pages;
3. Threads public-profile capabilities where permitted;
4. Instagram Professional-account capabilities where permitted;
5. trusted trade/media feeds/pages;
6. carefully selected additional public pages.

## P4.1 — Generic RSS/Atom connector foundation

Implementation in progress.

### Implemented on branch

- new `packages/feed-connector` TypeScript package;
- RSS 2.0 parsing;
- Atom parsing;
- normalized feed-entry contract;
- HTML-to-text normalization for feed summaries/content;
- stable item identity selection;
- conditional request header builder (`ETag` / `Last-Modified`);
- adaptive poll intervals for `HOT_5M`, `ACTIVE_15M`, `NORMAL_60M`, `COLD_6H`, `DAILY`;
- exponential failure backoff capped at one day;
- `Retry-After` parsing;
- RSS + Atom fixtures and connector canaries;
- `feed_source_state` database state;
- `connector_domain_state` per-domain request/rate-limit state;
- service-role-only `register_feed_source(...)` RPC;
- pgTAP coverage for feed registration/security;
- internal `feed-poll-worker` Edge Function;
- feed polling integrated into the existing scheduler dispatcher allowlist;
- hosted scheduler definition for 5-minute wakeups with worker-enforced adaptive cadence;
- feed worker output goes into the normal `raw_items` / `raw_item_revisions` / `PROCESS_RAW_ITEM` pipeline;
- connector run history and source-health updates;
- per-domain spacing and HTTP 429 handling;
- parser-broken health state on malformed/unsupported feeds;
- CI wiring for feed package tests, Edge type-checking and deployment bundle generation.

### Deliberately not deployed yet

No Phase-4 database migration or Edge Function has been applied to production yet.

No real external RSS/Atom source has been registered yet.

The branch must first pass full CI. After that, production rollout will use a very small set of verified official feed canaries before wider source onboarding.

## P4.1 exit gate

P4.1 is complete only when:

1. connector/unit canaries pass;
2. fresh database migration startup + pgTAP + lint pass;
3. `feed-poll-worker` type-checks/bundles with the existing Edge suite;
4. migration + worker deploy from an exact green CI artifact;
5. at least one genuine official RSS/Atom source is registered in hosted production;
6. a real feed item is discovered through conditional polling and persisted as a raw item/revision;
7. the item enters the normal intelligence pipeline without duplicate spam;
8. a second request proves `ETag` and/or `Last-Modified` conditional behavior where the source supports it;
9. source/domain health and scheduling remain observable;
10. no mandatory recurring paid API is introduced.

## Next slices after P4.1

- **P4.2** first-party studio/platform press/news connector framework;
- parser versioning + drift detection for HTML sources;
- source-discovery candidate workflow;
- larger curated India-first source expansion only after reliability is measured.

## Guardrails

- official/direct sources first;
- do not use aggressive scraping;
- respect conditional HTTP, rate limits and source-specific cadence;
- parser failures must become visible health errors rather than silent data loss;
- do not auto-promote discovered identities to trusted authority;
- source count is not a success metric; precision, recall, latency and connector health are.

_Last updated: 2026-09-16_
