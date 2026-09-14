# CineRelay

**Every official update. One cinema feed.**

CineRelay is an official-source-first cinema and series intelligence platform. It continuously discovers, ingests, verifies, classifies, deduplicates and organizes meaningful updates about movies and series into a reliable, source-backed timeline.

CineRelay is not designed as another entertainment-news feed. Its job is to answer:

> **What changed around the movies and series I care about, where did it come from, how reliable is it, and what does it mean?**

## Status

**Phase 0 — Product Foundation**

This repository is the permanent source of truth for product decisions, architecture, implementation contracts and roadmap.

No production implementation should override a locked decision silently. If a decision must change, update the relevant document and record the reason first.

## Start here

1. [`START_HERE.md`](START_HERE.md)
2. [`docs/00-foundation/PRODUCT_CHARTER.md`](docs/00-foundation/PRODUCT_CHARTER.md)
3. [`docs/00-foundation/LOCKED_DECISIONS.md`](docs/00-foundation/LOCKED_DECISIONS.md)
4. [`docs/01-sources/SOURCE_STRATEGY.md`](docs/01-sources/SOURCE_STRATEGY.md)
5. [`docs/02-architecture/SYSTEM_ARCHITECTURE.md`](docs/02-architecture/SYSTEM_ARCHITECTURE.md)
6. [`docs/04-platform/TECH_STACK_AND_COSTS.md`](docs/04-platform/TECH_STACK_AND_COSTS.md)
7. [`docs/06-roadmap/ROADMAP.md`](docs/06-roadmap/ROADMAP.md)

## Product layers

CineRelay separates five concerns:

1. **Source graph** — who/what is authoritative for each title, person, studio, label, platform and distributor.
2. **Ingestion** — webhooks, feeds, APIs and carefully scheduled polling.
3. **Intelligence** — entity resolution, verification, classification, deduplication, importance scoring and timeline construction.
4. **Event database** — durable evidence-backed cinema events and change history.
5. **Clients** — web dashboard and Android app consuming one shared API/domain model.

## Core rule

> **CineRelay is an intelligence system with applications attached to it — not an application with scraping bolted on later.**

## Current target

V1 proves high-quality coverage on a curated India-first source set before global scale:

- Telugu
- Tamil
- Malayalam
- Kannada
- Hindi
- Major pan-India studios/platforms
- Major Hollywood/streaming sources where useful

The architecture remains language- and territory-neutral so source coverage can expand without a rewrite.

## Repository policy

The repository is public, but public visibility does not imply permission to reuse the code. No open-source license is granted unless a license is explicitly added later.

_Last foundation review: 2026-09-14_
