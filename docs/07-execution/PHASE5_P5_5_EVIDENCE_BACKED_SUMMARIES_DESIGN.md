# Phase 5.5 Design — Evidence-Backed Concise Summaries

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING / NO HOSTED P5.5 DEPLOYMENT**

Parent checkpoint:

`phase-5/creator-radar` @ `8a6422559cfa2852a00eaba549c866669b318d8f`

## Goal

Add a separate derived summary layer that gives CineRelay concise, auditable event summaries without changing canonical event facts, verification, priority, classification, evidence or notification state.

P5.5 first proves the evidence contract with a deterministic generator. Model-assisted wording can be added later only behind the same provenance and stale-refresh rules.

## Hard boundary

A summary is **derived presentation**, not factual truth.

The summary engine must never:

- write back to `events.summary`, `events.headline`, verification or priority;
- produce `READY` text when the event has no linked evidence;
- hide conflicting evidence;
- detach generated text from the exact raw evidence used;
- turn creator/editorial wording into a canonical claim;
- call an external model/provider in V1.

## Durable model

### `event_summary_entries`

One current summary projection per canonical event.

Important fields:

- `event_id` — primary key / FK to canonical event;
- `summary_status` — `READY | WITHHELD`;
- `summary_text` — nullable and only permitted for `READY` rows;
- deterministic reason codes;
- total evidence count;
- conflicting evidence count;
- factual input snapshot;
- generator version `evidence-summary-v1`;
- generated/updated timestamps.

A database check enforces that `READY` requires non-empty summary text and at least one linked evidence item. `WITHHELD` rows carry no summary text.

### `event_summary_evidence`

Up to five ranked provenance snapshots per event summary.

Each row retains:

- raw item id when still available;
- deterministic ordinal;
- evidence role;
- authority tier;
- source display name;
- canonical evidence URL;
- evidence title snapshot;
- content fingerprint.

`raw_item_id` uses `ON DELETE SET NULL` so a retained provenance snapshot does not silently vanish if a raw item is later removed.

## V1 summary wording

V1 is deterministic and deliberately conservative.

A `READY` summary contains:

1. the canonical event headline;
2. an explicit CineRelay verification label;
3. linked evidence count;
4. deterministic lead source when available;
5. explicit conflicting-evidence count when present.

Example shape:

`<canonical headline>. Verification: Official. Evidence: 3 linked items, led by <source>. Conflicting evidence retained: 1.`

The generator does not paraphrase raw article bodies and does not invent context beyond canonical event/evidence metadata.

## Withholding rules

A summary is `WITHHELD` when:

- no linked event evidence exists (`NO_LINKED_EVIDENCE`); or
- the event is not in a summarizable canonical state (`EVENT_NOT_SUMMARIZABLE`).

`ACTIVE` and `NEEDS_REVIEW` events may be summarized when evidence exists. Retracted/suppressed/superseded events are withheld rather than being given fresh presentation copy.

## Evidence ordering

Selected provenance rows are ranked by:

1. evidence role: `PRIMARY`, `CORROBORATING`, `REPEAT`, `CONFLICTING`;
2. stronger source authority tier;
3. evidence weight;
4. evidence recency;
5. raw item id for deterministic tie-breaking.

Conflicting evidence is intentionally retained and surfaced.

## Staleness / refresh

`refresh_event_summaries(limit)` is bounded to `1..500` events and uses `FOR UPDATE SKIP LOCKED`.

An entry is stale when any summary input changes:

- canonical headline;
- verification state;
- event status;
- evidence count;
- conflicting evidence count;
- deterministic evidence signature;
- generator version.

The evidence signature includes raw item id, role, weight, content fingerprint, source authority, source name and canonical URL. This catches same-transaction evidence changes without relying only on timestamps.

`clock_timestamp()` records actual generation time.

Once all inputs are current, repeat refresh returns `0`.

## Runtime

`evidence-summary-worker`:

- internal server-only Edge function;
- validates the existing independent internal secret;
- calls only `refresh_event_summaries(limit)`;
- no external model/provider;
- no new secret;
- scheduler allow-list action `evidence-summary` prepared with limit 100.

No production summary cron is enabled by this implementation.

## Security

Both summary tables are service-owned in P5.5:

- RLS enabled;
- no direct `anon` or `authenticated` SELECT/write privileges;
- compute/refresh RPCs unavailable to normal clients;
- service-role only mutation/execution.

A later read API can expose a shaped summary + evidence projection without exposing internal mutation surfaces.

## Explicitly deferred

P5.5 does not yet implement:

- LLM rewriting or abstraction;
- model-generated hooks/titles/scripts;
- per-user summary personalization;
- automatic publishing;
- production summary cron;
- client UI exposure.

## Release gate

Before hosted promotion:

1. fresh migration applies cleanly;
2. all P5.5 pgTAP assertions pass;
3. prior Phase-1..P5.4 tests remain green;
4. DB lint passes;
5. worker and scheduler type-check;
6. deployment-native Edge bundle contains the summary worker;
7. hosted migration version is reconciled into Git;
8. canonical CI is green;
9. exact canonical CI artifact is deployed;
10. hosted RLS/privilege/zero-side-effect/advisor checks pass;
11. controlled transactional summary/evidence/stale-refresh/idempotency proof passes and rolls back;
12. no summary cron is enabled without a separate operational decision.
