# P6.0.53 — Story Clusters, Film/Series Hubs and Search

Status: IN PROGRESS
Depends on: P6.0.52 Web Intelligence Lane
Feeds into: P6.0.54 OTT Release Intelligence

## Goal

Turn CineRelay's raw-source newsroom into a canonical cinema intelligence layer where users can search for a film/series, open one durable entity hub, and see story clusters backed by real evidence across YouTube and Web sources.

## Non-negotiable architecture

1. Raw posts are evidence, not the primary product object.
2. Clients consume canonical entities and canonical events.
3. Entity creation must be evidence-gated; no title-shaped raw post may create a film/series hub by itself.
4. Deterministic entity resolution remains ahead of any AI fallback.
5. Search remains Postgres-backed for V1; no external search cluster.
6. X remains dormant and is not required for P6.0.53.
7. Notification consent remains unchanged and YouTube-only in this slice.

## P6.0.53A — Evidence-gated entity discovery

Production before this slice had 244 raw items but only one canonical entity/event and one active source-to-entity scope. The resolver was therefore correctly leaving almost all source activity unresolved.

The new private discovery foundation adds:

- `entity_discovery_candidates`
- `entity_discovery_evidence`
- trigram indexes for canonical entity names and aliases
- deterministic name normalization
- candidate evidence submission
- operator review with explicit evidence gates
- reviewed promotion into the existing canonical `entities`, `entity_aliases`, and `source_entity_candidates` tables
- replay of matching unresolved raw items through the existing `PROCESS_RAW_ITEM` classifier after promotion

### Approval gate

A candidate can be approved only when:

- confidence >= 0.85,
- at least two independent source identities support it, and
- at least one source is first-party, OR at least three independent sources support it.

Promotion also refuses a candidate whose normalized name already matches an active movie/series/season canonical name or alias.

## P6.0.53B — Canonical Intelligence API

`cinerelay-intelligence-api` is guest-readable with optional authenticated user context. It exposes:

### `search`

- searches active `MOVIE`, `SERIES`, and `SEASON` entities
- searches canonical names and aliases
- deterministic ranking: exact canonical -> exact alias -> canonical prefix -> alias prefix -> contains
- returns followed state when a valid user session is supplied

### `hub`

- resolves an entity by UUID or slug
- returns canonical metadata and aliases
- returns recent canonical events with evidence counts
- returns recent raw activity only when it has resolved to that entity
- preserves source/platform provenance for every activity item

### `clusters`

- returns recent active canonical events as story clusters
- attaches canonical film/series identity
- exposes verification state/confidence and evidence composition

## First hosted proof

`The Paradise` is the first intended production proof because CineRelay already has independent evidence from:

- SLV Cinemas — tier-1 production-house YouTube source
- 123Telugu — trade-media RSS source

That satisfies the approval shape without fabricating a demo entity. The proof must pass the same review/promotion functions as every future title.

## Android product direction

Do not add a fifth bottom tab.

- Home gets Search entry.
- Search opens as a dedicated CineRelay surface.
- Search result opens a Film/Series Hub.
- Hub contains canonical story timeline + resolved source activity.
- Story clusters remain event-first surfaces.
- P6.0.54 OTT uses the same entity hub/search contract rather than becoming a new source platform.

## Completion gates

P6.0.53 is complete only when:

1. migration tests/lint are green,
2. Intelligence API passes Edge + mobile API type-check/bundle gates,
3. hosted production migration/API deployment succeeds,
4. at least one evidence-gated real title is promoted and searchable,
5. its unresolved evidence is replayed through the existing classifier,
6. Android Search + Hub build is green under the permanent update signer,
7. the resulting APK remains update-over-update compatible.
