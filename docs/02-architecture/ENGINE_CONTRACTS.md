# Engine Contracts

This document defines the logical engines CineRelay must provide. An “engine” is a responsibility boundary, not necessarily its own deployable service in V1.

The V1 implementation may colocate several engines in one codebase/runtime, but their inputs, outputs and failure behavior stay distinct.

## 1. Source Registry Engine

### Responsibility
Maintain the canonical graph of real-world sources and their platform identities.

### Inputs
- manual curation;
- verified discovery proposals;
- connector metadata refreshes.

### Outputs
- source organization/person/project identity;
- platform identity IDs/URLs;
- authority tier;
- language/territory;
- connector config;
- poll class;
- active/disabled state.

### Invariants
- platform identity is unique within its platform;
- authority is explicit, never inferred only from follower count;
- every automated connector references a registered source identity.

## 2. Source Discovery Engine

### Responsibility
Find candidate official/relevant source identities.

### Signals
- official website links;
- Tier-A mentions;
- project announcements;
- known organization relationships;
- manually submitted candidates.

### Output
A `source_candidate` with evidence and proposed match.

### Rule
Discovery can propose; it cannot silently self-promote a candidate to Tier A.

## 3. Scheduler Engine

### Responsibility
Turn source monitoring policy into bounded jobs.

### Inputs
- source health;
- poll class;
- connector quota;
- last check/update time;
- campaign activity;
- retry state.

### Outputs
Idempotent jobs such as:
- `POLL_SOURCE`
- `RENEW_SUBSCRIPTION`
- `REFRESH_TOKEN`
- `REPROCESS_RAW_ITEM`
- `HEALTH_CHECK`

### Rule
No connector may create unbounded fan-out in a single invocation.

## 4. Ingestion Engine

### Responsibility
Receive source data and persist raw evidence safely.

### Inputs
- webhook payloads;
- API responses;
- RSS/Atom entries;
- public-page parser results;
- approved manual submissions.

### Outputs
- canonical `raw_item`;
- raw revision/fingerprint;
- processing job.

### Rule
Persist before interpretation whenever practical.

## 5. Normalization Engine

### Responsibility
Turn platform-specific raw items into a stable internal representation.

### Produces
- normalized title/body;
- canonical source timestamp;
- canonical URL;
- language hints;
- mentions/hashtags;
- outbound links;
- media types;
- stable fingerprint;
- source-specific structured fields.

### Rule
Normalization must be deterministic and replayable.

## 6. Entity Resolution Engine

### Responsibility
Associate items/claims with the correct title, season, person, organization or franchise.

### Candidate signals
- explicit source ownership;
- aliases/working titles;
- normalized title match;
- hashtag match;
- cast/crew relationships;
- link targets;
- language/territory;
- release/campaign context;
- fuzzy similarity;
- optional embeddings/model assistance.

### Output
Ranked candidates:

```text
entity_id
score
method[]
explanation[]
```

### States
- `RESOLVED`
- `AMBIGUOUS`
- `UNRESOLVED`

### Rule
Ambiguity is allowed. Wrong forced matches are worse than unresolved items.

## 7. Claim Extraction Engine

### Responsibility
Extract structured facts/statements from source content.

### Examples
- “Trailer tomorrow at 6 PM”
- “Releasing on 18 December 2026”
- “X joins the cast”
- “Shoot wrapped”

### Output
Structured claims with evidence spans/references.

### Rule
An extracted claim is not automatically verified truth.

## 8. Event Classification Engine

### Responsibility
Map item/claim semantics to the versioned CineRelay taxonomy.

### Method order
1. exact connector/source rules;
2. deterministic lexical/pattern rules;
3. structured metadata;
4. model-assisted classification for ambiguity.

### Output
- event type;
- classifier version;
- confidence;
- explanation/features.

## 9. Authority & Verification Engine

### Responsibility
Determine how strongly an event is supported.

### Inputs
- source authority tier;
- source relevance to subject;
- claim directness;
- corroborating evidence;
- conflicting evidence;
- source freshness.

### Outputs
- verification state;
- confidence score;
- supporting evidence IDs;
- conflicting evidence IDs;
- reason code.

### Critical rule
`OFFICIAL` requires qualifying source evidence. Model confidence cannot create officiality.

## 10. Deduplication & Merge Engine

### Responsibility
Collapse repeated coverage of one real-world change.

### Signals
- same entity;
- compatible event family;
- matching structured value;
- same linked media/video;
- close timestamps;
- normalized text/fingerprint similarity;
- shared original source.

### Outputs
- create event;
- merge evidence;
- supersede prior event;
- attach repeat mention;
- flag conflict.

### Rule
Deduplication must preserve evidence even when it suppresses duplicate feed cards.

## 11. Change Detection Engine

### Responsibility
Recognize when a newly supported claim changes previously known canonical state.

Examples:
- release date moved;
- OTT platform changed/added;
- title changed;
- project status moved from shooting to wrapped;
- event time changed.

### Output
A change event linking old and new values.

## 12. Timeline Engine

### Responsibility
Project events into a stable chronological lifecycle for each entity.

### Requirements
- supports superseded/corrected events;
- retains original dates and ingest dates;
- separates event occurrence time from publication/detection time;
- exposes verification state and evidence count.

## 13. Priority Engine

### Responsibility
Score *importance*, not truth.

### Inputs
- event type weight;
- followed title/person/source;
- title interest score;
- novelty/change magnitude;
- verification state;
- campaign activity;
- user preferences;
- recency.

### Output bands
- `CRITICAL`
- `HIGH`
- `NORMAL`
- `LOW`
- `SUPPRESSED`

## 14. Notification Engine

### Responsibility
Convert eligible events into user notifications without duplicate spam.

### Supports
- instant;
- batched;
- digest;
- quiet hours;
- per-title/event-type preferences;
- notification dedupe keys.

### Rule
Notification delivery failure never rolls back the event itself.

## 15. Creator Intelligence Engine

### Responsibility
Optional creator-oriented interpretation after factual event creation.

Possible outputs:
- `SHORT_OPPORTUNITY`
- `BREAKING_EXPLAINER`
- `TRAILER_ANALYSIS`
- `FOLLOW_UP_NEEDED`
- `NO_ACTION`

### Rule
This engine never changes the underlying factual record. It is editorial assistance only.

## 16. Source Health Engine

### Responsibility
Know whether “no updates” means no updates or a broken connector.

### Monitors
- successful fetch/notification recency;
- auth/token expiry;
- subscription expiry;
- HTTP/parser errors;
- rate limits;
- unusual silence relative to baseline;
- processing backlog.

### Output
Operational health state and actionable alert.

## 17. Review & Correction Engine

### Responsibility
Provide controlled human overrides.

Actions:
- reassign entity;
- change classification;
- merge/split events;
- downgrade/upgrade source authority with reason;
- suppress noise;
- resolve conflict;
- correct structured value.

### Rule
Corrections are audited and never erase original evidence.

## 18. Coverage Benchmark Engine

### Responsibility
Measure system quality on a known labeled test set.

### Metrics
- event recall;
- precision;
- latency;
- wrong-entity rate;
- duplicate rate;
- false verification rate;
- connector health.

## Cross-engine contract

Every derived object stores enough metadata to answer:

- which engine created it;
- which version/ruleset created it;
- what inputs/evidence were used;
- when it was created;
- whether it was later corrected/superseded.

This makes future reprocessing and debugging possible.

_Last updated: 2026-09-14_
