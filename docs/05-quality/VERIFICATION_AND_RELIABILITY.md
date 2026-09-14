# Verification and Reliability Contract

## Goal

CineRelay is useful only if users can distinguish **what was published** from **what CineRelay inferred** and can see whether the monitoring system itself is healthy.

Trust is therefore a product feature and an engineering requirement.

## Two independent questions

Every event must separate:

1. **Source authority** — how authoritative is the publisher for this subject?
2. **Interpretation confidence** — how confident is CineRelay that it understood the item correctly?

A perfectly parsed rumor is still a rumor.

A messy but direct official announcement can still be official even if some fields remain unresolved.

## Verification states

### `OFFICIAL`

Requirements:
- qualifying direct authoritative source;
- source identity is curated/verified;
- event is within that source's authority scope;
- no stronger contradictory official evidence is unresolved.

Examples:
- production house publishes trailer;
- Netflix announces streaming date for its title;
- official film account posts release-date change.

### `CONFIRMED`

Used when:
- no single primary official publication is available/recognized, but independent authoritative or highly reliable evidence establishes the fact;
- or multiple first-party participants corroborate it.

### `RELIABLE_REPORT`

Trusted trade/professional reporting without direct official confirmation.

### `DEVELOPING`

Credible evidence exists but:
- details are incomplete;
- sources conflict;
- confirmation is pending;
- interpretation has material ambiguity.

### `RUMOR`

Unverified claim intentionally retained for optional tracking.

Default behavior:
- not shown in official-only feeds;
- not eligible for high-priority alerts unless the user explicitly enables rumor monitoring.

## Source authority is contextual

Authority is not one global score.

Examples:
- a music label is Tier A for a song upload but may not be authoritative for the film's production schedule;
- an actor is authoritative that they joined/wrapped their own work, but not necessarily for a full project release date;
- an OTT platform is authoritative for its own release availability.

The schema must support source roles/scope.

## Evidence model

Every event exposes at least one evidence item.

Evidence roles:
- `PRIMARY`
- `CORROBORATING`
- `CONFLICTING`
- `REPEAT`

Preserve:
- original publisher/source identity;
- source URL;
- source publication time if available;
- first-seen time;
- item ID;
- relevant structured metadata/text pointer;
- revision where relevant.

## Conflict handling

Do not silently choose between materially conflicting trusted sources.

Example:

```text
Official distributor: 18 Dec
Official production house later: 25 Dec
```

Correct behavior:
1. create/update evidence;
2. detect changed value;
3. create `THEATRICAL_DATE_CHANGED` if chronology/authority supports it;
4. preserve the old event as superseded;
5. display the current date with historical change visible.

If chronology does not resolve the conflict, mark `DEVELOPING`/conflict and expose both evidence paths.

## Correction policy

CineRelay can be wrong.

Corrections must:
- preserve original raw evidence;
- record who/what made the correction;
- retain before/after values;
- update projections;
- avoid deleting the audit trail.

## Deduplication reliability

False merges and duplicate spam are both harmful.

Use conservative merge criteria for high-impact events.

A merge should consider:
- same primary entity;
- event-family compatibility;
- matching structured value;
- shared media/source link;
- close timing;
- original-source chain;
- normalized similarity.

If uncertain, keep candidates in review rather than irreversibly merging.

## Entity-resolution reliability

Wrong title association is one of the highest-risk errors.

Rules:
- explicit project-account mapping outranks fuzzy text;
- exact official hashtag/title alias outranks semantic similarity;
- known source-to-project scope is a strong signal;
- ambiguous common names require more evidence;
- unresolved is a valid outcome.

High-priority alerts should require stronger entity-resolution confidence than low-priority feed retention.

## Time semantics

Store separately:
- `published_at` — source publication time;
- `occurred_at` — real-world event time when known;
- `announced_at` — announcement time where distinct;
- `detected_at` — CineRelay first detection.

Do not pretend detection time equals event time.

## Latency targets

These are product SLO targets, not guarantees from external platforms.

### Push-capable Tier-A sources

Target:
- p50 detection < 2 minutes;
- p95 detection < 5 minutes after platform notification availability.

### HOT polling sources

Target:
- p95 detection within polling interval + processing budget.

### NORMAL/COLD sources

Latency is intentionally lower priority to preserve quota/cost.

## Availability/health principle

The UI must distinguish:

```text
No new updates
```

from:

```text
We have not successfully checked this source recently
```

This is mandatory.

## Source-health SLOs

For supported automated Tier-A sources:
- >99% successful scheduled checks/subscription maintenance over a rolling period once production-stable;
- zero silent auth-expiry states;
- parser breakage detected and surfaced;
- backlog age visible;
- dead-letter jobs visible.

Early prototype targets may be lower while connectors are under development, but measurement starts immediately.

## Processing guarantees

### At-least-once ingestion

Webhook/poll processing may occur more than once.

Therefore all stages are idempotent.

### No exactly-once fantasy

Do not rely on external providers delivering exactly once or in order.

### Replayability

Raw items can be reprocessed through newer engine versions without fetching the original platform again where retained metadata is sufficient.

## Backpressure

When the job queue grows:
- prioritize webhook/Tier-A/high-priority sources;
- defer low-priority reprocessing;
- avoid spawning unlimited jobs;
- expose oldest pending-job age.

## Quota exhaustion

Every quota-bound connector must define behavior before quota exhaustion occurs.

Example YouTube:
- WebSub continues to provide push IDs without routine polling;
- enrichment requests are budgeted;
- low-value enrichment can be delayed;
- quota state is observable.

Example X (future paid):
- hard budget cap;
- no automatic overage;
- connector becomes `BUDGET_EXHAUSTED`/degraded rather than spending silently.

## AI reliability

For every model-assisted output, store:
- provider/model identifier;
- prompt/ruleset version where relevant;
- structured result;
- confidence;
- evidence IDs;
- timestamp.

High-risk structured facts should use deterministic validation after model extraction.

Examples:
- parsed date must be a valid date;
- entity ID must exist;
- release-date event must identify title + date + evidence;
- officiality never comes from the model.

## Security/reliability basics

- never expose service-role keys to clients;
- validate webhook challenges/signatures where supported;
- rate-limit public write endpoints;
- use RLS for user data;
- sanitize external HTML before display;
- do not execute source-provided markup/scripts;
- validate canonical URLs and redirect handling;
- cap response sizes/timeouts for public-page fetchers;
- protect against SSRF in generic URL-fetch paths by allowlisting source domains/validated identities.

## Benchmark gates

Before expanding from prototype to serious daily use, a controlled benchmark should demonstrate:

- high precision on core event classes;
- low wrong-entity rate;
- near-zero false `OFFICIAL` labeling;
- acceptable duplicate rate;
- measured source coverage/recall;
- measured detection latency.

Suggested initial gate for curated fixtures:
- ≥95% precision for Tier-A core event classification;
- ≥95% correct entity assignment on unambiguous benchmark cases;
- 0 known false `OFFICIAL` cases in the release benchmark;
- duplicate feed-card rate <5% on benchmark event clusters.

Recall targets should be set per connector after we establish what each platform can legally/technically expose.

## Operational review

The internal dashboard needs:
- source-health summary;
- failed jobs;
- dead letters;
- oldest queue age;
- recent parser/auth failures;
- connector quota/cost;
- ambiguous entity matches;
- conflicting events;
- benchmark trend.

A “smart” system without operational visibility is not production-ready.

_Last updated: 2026-09-14_
