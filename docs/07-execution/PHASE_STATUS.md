# Phase Status

Date: 2026-09-14

## Current status

**Phase 0 — Product Foundation: COMPLETE (baseline v0.1)**  
**Phase 1 — Intelligence Core Skeleton: COMPLETE + merged to `main`**  
**Phase 2 — YouTube Production Connector: IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE PUSH + RENEWAL EVIDENCE PENDING**  
**Phase 3 — Internal Web Intelligence Console: BLOCKED until Phase-2 exit gates pass**

CineRelay is no longer only a specification or local intelligence prototype. A dedicated hosted Supabase backend is active, four Tier-A official YouTube sources are subscribed, recurring workers run unattended, real YouTube items have passed through the intelligence pipeline, and a real canonical cinema event has been produced.

## Locked product baseline

CineRelay remains:

- official-source-first;
- event-first, not article-first;
- India-first for rollout but global in domain design;
- evidence-backed and deduplicated;
- free-first for infrastructure;
- one shared backend for future web + native Android clients;
- designed so AI is assistive and replaceable rather than a source of truth.

The frozen foundation is under `docs/00-foundation` through `docs/06-roadmap`.

## Phase 0 — COMPLETE

The repository contains the product charter, locked decisions, market positioning, source strategy, system architecture, engine contracts, canonical data model, design philosophy, free-first stack/cost rules, verification contract, test strategy, roadmap and Definition of Done.

## Phase 1 — COMPLETE

Phase 1 established and CI-verified:

- monorepo/tooling boundaries;
- Supabase/Postgres schema;
- entities + aliases;
- sources + identities + health;
- raw items + revisions;
- jobs;
- entity-resolution results;
- claims/evidence;
- canonical events/evidence;
- deterministic normalize -> resolve -> classify -> verify -> dedupe pipeline;
- benchmark/contract CI.

Phase 1 is merged to `main` at the intelligence-core baseline.

## Phase 2 — CURRENT ACTIVE PHASE

Working branch: `phase-2/youtube-connector`  
Draft PR: `#2`

Implemented and hosted:

- YouTube channel/source registration;
- WebSub subscribe/challenge/unsubscribe/renewal lifecycle;
- generation-specific callback/HMAC credentials;
- targeted YouTube Data API enrichment;
- raw-item revision persistence;
- uploads-playlist safety fallback;
- quota accounting + reserve guards;
- scoped entity resolution;
- deterministic event classification;
- canonical event/evidence dedupe;
- source health;
- maintenance worker;
- Vault-backed hosted scheduler;
- recurring enrichment, raw processing, maintenance and fallback workers;
- eight active Edge Functions;
- PostgreSQL-17 migration/test parity and DB lint.

Current hosted project:

- project: `CineRelay`
- Supabase ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- recurring infrastructure cost currently: **₹0/month**

Current pilot channels:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

## Real hosted evidence already proven

### Canonical intelligence canary

A real Mythri Movie Makers upload (`rfP-ArN8nds`) was enriched, resolved to **Family Pack** at `0.98`, classified as `PROJECT_ANNOUNCED`, verified `OFFICIAL`, marked `HIGH`, attached to primary evidence, and deduplicated to exactly one canonical event.

### Real fallback safety incident

Three Geetha Arts uploads published after the generation-1 WebSub lease became active were not observed through the accepted WebSub receipt path. CineRelay's uploads-playlist fallback recovered all three and the normal enrichment + raw-processing workers completed successfully.

This incident proved the safety path while exposing two issues before merge:

1. callback rejection diagnostics were too quiet;
2. quiet channels were being incorrectly treated as WebSub-stale.

Both were fixed. Hosted `youtube-websub` and `youtube-fallback-worker` are now version 8, deployed from the exact artifact produced by green CI run **#115**.

Current source-health expectation:

- Geetha Arts: `DEGRADED / WEBSUB_MISSED_DELIVERY` until a successful real push proves recovery;
- Mythri Movie Makers: `HEALTHY`;
- Sithara Entertainments: `HEALTHY`;
- Haarika & Hassine Creations: `HEALTHY`.

See:

- `docs/07-execution/PHASE2_STATUS.md`
- `docs/07-execution/PHASE2_HOSTED_PILOT_WATCH.md`
- `docs/07-execution/PHASE2_PILOT_INCIDENT_2026-09-14.md`

## Current quality gate

Latest verified incident-hardening CI baseline:

- **13/13** intelligence benchmarks;
- **13/13** YouTube connector canaries;
- **12/12** planning/enrichment/fallback canaries;
- all **8** Edge Functions type-check;
- deployment-native Edge bundle builds;
- clean PostgreSQL-17 migration startup;
- **36 pgTAP assertions**;
- DB lint: no schema errors.

## Phase-2 exit gates still required

Phase 2 must remain open until both are observed in production:

### A. Natural valid WebSub push

A genuinely new post-version-8 official upload must arrive through WebSub, produce an accepted receipt and flow automatically through enrichment/intelligence. A fallback-only discovery does not pass this gate.

If the callback rejects/ignores the next delivery, the new version-8 persisted diagnostic must identify the precise failure before the gate can pass.

### B. Real zero-gap lease renewal

A real generation-2 renewal must be requested, verified and activated while generation 1 remains usable until superseded.

Current expected renewal eligibility is approximately `2026-09-22 11:04 UTC`; current generation-1 expiry is approximately `2026-09-24 11:04 UTC`.

## Next phase

**Phase 3 — Internal Web Intelligence Console** begins only after both Phase-2 gates pass and PR #2 is merged.

Planned Phase-3 scope remains:

- authentication;
- Live feed;
- event detail + evidence;
- title timeline;
- source registry;
- source-health dashboard;
- review/correction queue;
- merge/suppress/reclassify tools;
- filters/search;
- benchmark diagnostics.

Do not begin broad Android UI, X/Instagram ingestion, mass source onboarding or broad scraping before the Phase-2 production gate closes.

_Last updated: 2026-09-14_
