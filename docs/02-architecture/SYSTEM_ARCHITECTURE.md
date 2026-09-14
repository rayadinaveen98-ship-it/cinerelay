# System Architecture

## Architectural goal

Build a reliable, low-cost event intelligence pipeline that can grow source-by-source without rewriting the product.

The architecture separates **collection**, **interpretation**, **persistence** and **presentation**.

## High-level flow

```text
External sources
    │
    ├─ YouTube WebSub
    ├─ APIs
    ├─ RSS / Atom
    ├─ first-party websites
    └─ optional/manual connectors
    │
    ▼
Ingestion boundary
    │
    ├─ validate source identity
    ├─ persist raw payload metadata
    └─ enqueue normalized processing job
    │
    ▼
Normalization pipeline
    │
    ├─ normalize text/time/URLs
    ├─ extract media/content metadata
    ├─ detect language
    └─ compute fingerprints
    │
    ▼
Intelligence pipeline
    │
    ├─ entity resolution
    ├─ source-authority evaluation
    ├─ claim extraction
    ├─ event classification
    ├─ event verification
    ├─ deduplication / merge
    ├─ importance scoring
    └─ timeline projection
    │
    ▼
Postgres event graph
    │
    ├─ API / RLS
    ├─ realtime updates
    └─ notification outbox
    │
    ├───────────────┐
    ▼               ▼
Web app         Android app
```

## Primary infrastructure

### Supabase Postgres

Canonical store for:

- entities and aliases;
- organizations/people/projects;
- source identities;
- raw items;
- claims;
- events;
- evidence;
- relationships;
- jobs and retries;
- source health;
- subscriptions/follows;
- notifications;
- audit/correction history.

### Supabase Edge Functions

Used for:

- webhook endpoints;
- connector fetchers;
- processing workers;
- notification fan-out;
- privileged API operations;
- token refresh and connector maintenance.

Functions remain small and composable. A function invocation handles a bounded batch, records outcome and exits.

### Supabase Cron

Used to schedule:

- due-source polling;
- WebSub renewal checks;
- retry queues;
- source health scans;
- notification digest generation;
- cleanup/retention routines.

Cron does not contain source-specific business logic; it invokes workers that pull work from database queues.

### Web client

A static React/TypeScript dashboard deployed independently of backend compute.

### Android client

Native Compose app consuming the same API/domain objects.

## Processing model

CineRelay uses a database-backed work queue rather than one permanent crawler process.

### Job states

- `PENDING`
- `LEASED`
- `SUCCEEDED`
- `RETRY_WAIT`
- `DEAD_LETTER`
- `CANCELLED`

### Job properties

Every job stores:

- job type;
- unique/idempotency key;
- payload reference;
- priority;
- attempt count;
- max attempts;
- scheduled time;
- lease owner/time;
- last error;
- created/completed timestamps.

### Leasing

Workers atomically lease a small batch of due jobs.

If a worker dies after leasing, the lease expires and the job becomes available again.

### Retry strategy

Use exponential backoff with connector-aware behavior:

- 429 / quota → respect `Retry-After` and mark rate-limited;
- auth errors → stop blind retry and move source to `AUTH_REQUIRED`;
- 404/removed content → record terminal source-item state where appropriate;
- parser/schema changes → mark `PARSER_BROKEN` and alert;
- transient 5xx/network errors → retry with backoff/jitter.

## Idempotency

Every ingestion path must be safe to replay.

Examples of natural keys:

- YouTube: platform + video ID + relevant revision fingerprint;
- RSS: feed ID + GUID/permalink;
- website item: source identity + canonical URL + content fingerprint;
- platform post: platform + post/media ID.

Event creation also uses semantic dedupe keys so the same trailer announced by multiple sources does not create many user-visible events.

## Raw-first persistence

The system stores the raw item metadata before interpretation.

Reason:

- processing can be replayed after classifier improvements;
- model changes do not destroy provenance;
- debugging becomes possible;
- historical corrections can be audited.

Large third-party binaries are not mirrored by default.

## Intelligence pipeline stages

### 1. Normalize

Produce stable normalized text, canonical URL, timestamps, source-local identifiers, extracted hashtags/mentions and content hash.

### 2. Candidate entity resolution

Use:

- explicit source-to-project mappings;
- title aliases;
- hashtags;
- official mentions/links;
- known cast/crew/project relationships;
- transliteration variants;
- fuzzy/trigram similarity;
- optional semantic matching.

Return ranked candidates plus explanations.

### 3. Claim extraction

Extract structured statements such as:

```json
{
  "subject": "movie:123",
  "predicate": "theatrical_release_date",
  "value": "2026-12-18",
  "evidence": ["raw_item:456"]
}
```

### 4. Event classification

Map claims/items to versioned event types.

### 5. Verification

Combine source authority, directness, corroboration and conflicts.

### 6. Deduplication

Compare against recent events for the same entity/event family/value/time window.

Possible outcomes:

- create new event;
- append evidence to existing event;
- supersede previous event;
- mark conflict;
- ignore low-value duplicate.

### 7. Importance scoring

Score independently from truth status.

Inputs may include:

- event type;
- title/user-follow priority;
- source tier;
- novelty;
- campaign activity;
- proximity to known release;
- user interests;
- whether value changed vs merely repeated.

### 8. Projection

Update fast read models:

- latest title status;
- latest release date;
- timeline;
- live feed;
- source activity;
- pending notifications.

## Event sourcing posture

CineRelay is not strict event-sourcing architecture, but it follows event-history principles:

- raw evidence is immutable where practical;
- derived canonical state can change;
- changes are represented by new events/supersession rather than silently rewriting history;
- corrections are auditable.

## Realtime

Supabase Realtime may publish new/updated event rows to active clients.

Realtime is an enhancement, not a persistence mechanism. Clients always reconcile from canonical database/API state.

## Notification architecture

Use an outbox table.

```text
verified event
   ↓
notification rule evaluation
   ↓
notification_outbox
   ↓
FCM delivery worker
   ↓
device
```

This prevents an event transaction from depending on FCM availability.

Notification modes:

- instant critical/high;
- normal batched;
- daily digest;
- muted;
- per-title/per-event-type overrides.

## Security model

### Client access

- Supabase Auth.
- Row Level Security for user-specific tables.
- Public/shared event reads exposed through safe views/RPCs.
- Service-role keys never shipped to web/Android.

### Connector secrets

- stored in Supabase secrets/Vault or platform secret manager;
- never committed to GitHub;
- rotated independently;
- scoped per connector where possible.

### Webhook security

- validate platform challenge/signature where supported;
- validate expected source IDs;
- rate-limit suspicious requests;
- keep raw request metadata for operational diagnostics without storing unnecessary sensitive data.

## Scalability path

### Stage A — personal prototype

Single Supabase free project; bounded source set; small polling batches.

### Stage B — serious creator tool

More workers/connectors, denser monitoring, indexes/materialized views, selective caching.

### Stage C — multi-user product

Partition hot tables if necessary, separate ingestion workers from public API, dedicated observability, paid DB/compute.

### Stage D — high-volume intelligence platform

Move queue/workers to dedicated infrastructure only when measurements justify it. Preserve domain contracts so clients do not care.

## Failure philosophy

The system must prefer **visible degradation over silent false completeness**.

Examples:

- X disabled → show connector unavailable, not “no X updates”.
- Instagram token expired → mark source degraded.
- YouTube WebSub subscription renewal failed → switch to bounded fallback check and alert.
- classifier uncertain → retain raw item/candidate review instead of inventing certainty.

## Repository target structure

```text
cinerelay/
  apps/
    web/
    android/
  supabase/
    migrations/
    functions/
    seed/
  packages/
    contracts/
    domain/
    source-fixtures/
  docs/
  tests/
    fixtures/
    integration/
    benchmark/
  .github/
    workflows/
```

The Android build remains Gradle-native inside `apps/android`; JS tooling must not become a prerequisite for building the APK.

_Last updated: 2026-09-14_
