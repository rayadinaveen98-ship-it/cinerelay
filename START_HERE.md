# CineRelay — Start Here

This file is the entry point for every future CineRelay development session.

## Required reading order

Before implementation or architecture changes, read these documents in order:

1. `README.md`
2. `docs/00-foundation/PRODUCT_CHARTER.md`
3. `docs/00-foundation/LOCKED_DECISIONS.md`
4. `docs/01-sources/SOURCE_STRATEGY.md`
5. `docs/02-architecture/SYSTEM_ARCHITECTURE.md`
6. `docs/02-architecture/ENGINE_CONTRACTS.md`
7. `docs/02-architecture/DATA_MODEL.md`
8. `docs/03-product/DESIGN_PHILOSOPHY.md`
9. `docs/04-platform/TECH_STACK_AND_COSTS.md`
10. `docs/05-quality/VERIFICATION_AND_RELIABILITY.md`
11. `docs/05-quality/TEST_STRATEGY.md`
12. `docs/06-roadmap/ROADMAP.md`
13. `docs/06-roadmap/DEFINITION_OF_DONE.md`

## Current phase

**Phase 0 — Product Foundation**

Goal: freeze the product contract, source policy, architecture, free-first infrastructure, data model, design philosophy, quality model and staged roadmap before production implementation.

## Product definition in one sentence

> CineRelay continuously converts activity from official and trusted cinema sources into verified, deduplicated, evidence-backed movie and series events.

## Execution rules

- GitHub is the source of truth.
- Do not silently change a locked decision in code.
- Do not add a platform dependency without documenting its cost, quota, access model and failure mode.
- Do not treat a social post, article or AI inference as fact without provenance.
- Do not make scraping a foundational dependency when a documented API/feed/webhook exists.
- Do not make a paid API mandatory for the zero-cost V1.
- Do not store copyrighted posters/videos merely because they are publicly visible. Prefer source URLs and permitted metadata.
- Build engines before polishing a large UI surface.
- Every ingestion path must be idempotent, observable and retryable.
- Every user-visible event must preserve its evidence trail.
- AI may extract/classify/summarize; AI must never invent the underlying event.
- V1 is India-first for coverage, but the domain model must remain global.

## Vocabulary

**Source** — an account, channel, website, feed or organization that publishes information.

**Source identity** — a platform-specific identity belonging to a source, such as a YouTube channel or Instagram handle.

**Entity** — a movie, series, season, person, company, label, platform or other normalized cinema object.

**Raw item** — an unprocessed item received from an external source.

**Claim** — a structured statement extracted from one or more raw items.

**Event** — a normalized, evidence-backed change associated with an entity, e.g. `TRAILER_RELEASED` or `RELEASE_DATE_CHANGED`.

**Evidence** — the source item(s) supporting an event or claim.

**Confidence** — CineRelay's confidence in source authority and event interpretation; it is not a substitute for source labels.

**Official** — directly published by a verified/curated authoritative source for the relevant project or organization.

## Change discipline

When a locked decision needs to change:

1. identify the decision;
2. document why the old decision no longer works;
3. record the replacement and migration impact;
4. update architecture/data contracts if affected;
5. only then change implementation.

## Immediate next milestone after Phase 0

**Phase 1 — Intelligence Core Prototype**

Prove the complete path with a small curated source set:

`source registry → ingestion → raw item → entity match → verification → classification → dedupe → event timeline → API → minimal web console`

No large-scale UI build begins before this path is measurable and reliable.

_Last updated: 2026-09-14_
