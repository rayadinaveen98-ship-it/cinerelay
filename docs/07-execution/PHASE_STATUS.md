# Phase Status

## Current status

**Phase 0 — Product Foundation: COMPLETE (baseline v0.1)**

Date: 2026-09-14

The first frozen product/architecture package is now established in GitHub.

## Locked baseline

CineRelay is:
- an official-source-first cinema/series intelligence system;
- event-first, not article-first;
- India-first for rollout but global in domain design;
- free-first for infrastructure;
- built around evidence, source authority, deduplication, timeline history and visible connector health;
- one shared backend with web + native Android clients;
- designed so AI is assistive and replaceable.

## Phase 0 artifacts

- `README.md`
- `START_HERE.md`
- `docs/00-foundation/PRODUCT_CHARTER.md`
- `docs/00-foundation/LOCKED_DECISIONS.md`
- `docs/00-foundation/MARKET_POSITIONING.md`
- `docs/01-sources/SOURCE_STRATEGY.md`
- `docs/02-architecture/SYSTEM_ARCHITECTURE.md`
- `docs/02-architecture/ENGINE_CONTRACTS.md`
- `docs/02-architecture/DATA_MODEL.md`
- `docs/03-product/DESIGN_PHILOSOPHY.md`
- `docs/04-platform/TECH_STACK_AND_COSTS.md`
- `docs/05-quality/VERIFICATION_AND_RELIABILITY.md`
- `docs/05-quality/TEST_STRATEGY.md`
- `docs/06-roadmap/ROADMAP.md`
- `docs/06-roadmap/DEFINITION_OF_DONE.md`

## Next phase

**Phase 1 — Intelligence Core Skeleton**

### P1.1 Repository / CI skeleton

Create:
- `apps/web`
- `apps/android` placeholder/Gradle boundary as appropriate
- `supabase`
- `packages/contracts`
- `packages/domain`
- `packages/source-fixtures`
- `tests/benchmark`
- `.github/workflows`

Add formatting, linting, TypeScript strict config and baseline CI.

### P1.2 Supabase local foundation

Create:
- local Supabase config;
- extension migrations (`pg_trgm`, optional future `vector` behind need);
- enum/reference taxonomy strategy;
- RLS baseline;
- migration CI.

### P1.3 Database schema v0

Implement the minimum end-to-end tables:
- entities;
- aliases;
- sources;
- source identities;
- source health;
- raw items/revisions;
- jobs;
- claims/evidence;
- events/event evidence;
- audit actions.

### P1.4 Versioned contracts

Define:
- event taxonomy v1;
- verification states;
- priority bands;
- source authority/access modes;
- normalized raw item schema;
- canonical event DTO.

### P1.5 Fixture pipeline

Build the first deterministic pipeline:

`fixture → ingest → normalize → entity resolve → classify → verify → dedupe → event`

No live social connector is required to prove this slice.

### P1.6 Benchmark v0

Create labeled cases for:
- trailer;
- teaser/glimpse;
- song;
- poster;
- release-date announcement/change;
- shooting update;
- irrelevant upload;
- duplicate repost cluster;
- ambiguous title.

### Phase 1 exit gate

A fresh clone must be able to start local backend, apply migrations, execute the fixture pipeline and prove idempotent expected events in CI.

## Deferred until later phases

Do not start yet:
- large polished UI;
- Android feature screens;
- X paid integration;
- bulk scraping;
- broad 500-source onboarding;
- expensive AI;
- public consumer product features.

## Cost baseline

Expected recurring cost through the early prototype: **₹0/month**, assuming free-tier limits are respected and X automated reads remain disabled.

_Last updated: 2026-09-14_
