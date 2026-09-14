# Canonical Data Model

This document defines the logical V1 schema. Exact SQL types/indexes are implemented through migrations, but these entities and relationships are the contract.

## Modeling principles

- Keep external-source data separate from canonical CineRelay entities.
- Preserve raw evidence before deriving claims/events.
- Prefer immutable/history-preserving records over destructive rewrites.
- Use stable UUIDs internally.
- Use explicit foreign keys and uniqueness constraints.
- Store platform IDs as text, never assume numeric IDs.
- Every high-value derived record stores provenance/version metadata.

## Core entity tables

### `entities`

Base identity table.

Fields:
- `id`
- `entity_type` — `MOVIE`, `SERIES`, `SEASON`, `PERSON`, `ORGANIZATION`, `FRANCHISE`, `EVENT_VENUE`, etc.
- `canonical_name`
- `slug`
- `primary_language`
- `country_code`
- `status`
- `created_at`
- `updated_at`

### `entity_aliases`

Used for working titles, transliterations, alternate spellings and platform-specific naming.

Fields:
- `id`
- `entity_id`
- `alias`
- `normalized_alias`
- `language_code`
- `alias_type` — `OFFICIAL`, `WORKING_TITLE`, `TRANSLITERATION`, `FORMER_TITLE`, `HASHTAG`, `ABBREVIATION`
- `valid_from`
- `valid_to`
- `source_evidence_id`

Indexes:
- trigram on normalized alias;
- exact normalized alias;
- entity + alias uniqueness where appropriate.

### `entity_relationships`

Graph edges.

Examples:
- movie → production company;
- movie → actor;
- movie → director;
- season → series;
- sequel → franchise;
- song → label where represented.

Fields:
- `id`
- `from_entity_id`
- `relationship_type`
- `to_entity_id`
- `valid_from`
- `valid_to`
- `verification_state`
- `evidence_event_id`

## Source tables

### `sources`

Real-world publisher/participant abstraction.

Fields:
- `id`
- `entity_id` nullable link to canonical organization/person/project
- `display_name`
- `authority_tier`
- `source_role`
- `territory`
- `languages[]`
- `active`
- `notes`

### `source_identities`

Platform-specific identity.

Fields:
- `id`
- `source_id`
- `platform` — `YOUTUBE`, `INSTAGRAM`, `X`, `THREADS`, `RSS`, `WEBSITE`, etc.
- `platform_identity_id`
- `handle`
- `canonical_url`
- `connector_type`
- `poll_class`
- `access_mode` — `WEBHOOK`, `API`, `FEED`, `PUBLIC_WEB`, `MANUAL`
- `connector_config` JSONB for non-secret config
- `active`
- `created_at`
- `updated_at`

Constraints:
- platform + platform identity ID unique;
- canonical URL unique when stable.

### `source_entity_scopes`

Optional explicit mapping that says a source identity is authoritative/relevant for specific entities.

Example: an official movie account maps directly to one movie.

Fields:
- `source_identity_id`
- `entity_id`
- `scope_type`
- `authority_override`

## Connector health tables

### `source_health`

One current row per source identity.

Fields:
- `source_identity_id`
- `health_state`
- `last_attempt_at`
- `last_success_at`
- `last_item_at`
- `next_due_at`
- `consecutive_failures`
- `last_http_status`
- `last_error_code`
- `last_error_message`
- `rate_limited_until`
- `auth_expires_at`
- `subscription_expires_at`
- `parser_version`
- `updated_at`

### `connector_runs`

Operational run history.

Fields:
- `id`
- `source_identity_id`
- `connector_type`
- `started_at`
- `finished_at`
- `status`
- `items_seen`
- `items_new`
- `items_changed`
- `requests_made`
- `quota_units`
- `estimated_cost_microunits`
- `error_summary`

## Raw ingestion tables

### `raw_items`

Stable representation of one external platform item.

Fields:
- `id`
- `source_identity_id`
- `platform_item_id`
- `canonical_url`
- `published_at`
- `first_seen_at`
- `last_seen_at`
- `item_type`
- `raw_title`
- `raw_text`
- `normalized_text`
- `language_code`
- `media_type`
- `metadata` JSONB
- `content_fingerprint`
- `deleted_or_unavailable_at`
- `current_revision_id`

Constraint:
- source identity + platform item ID unique when platform supplies stable IDs.

### `raw_item_revisions`

Tracks meaningful changes in source content.

Fields:
- `id`
- `raw_item_id`
- `observed_at`
- `title`
- `text`
- `metadata` JSONB
- `content_fingerprint`
- `change_kind`

Useful for YouTube title/description updates and website changes.

### `raw_payload_refs`

Optional compact references to raw webhook/API response diagnostics when retained.

Do not store unnecessary personal/sensitive data or large copyrighted binaries.

## Intelligence tables

### `entity_resolution_results`

Fields:
- `id`
- `raw_item_id`
- `entity_id`
- `score`
- `resolution_state`
- `methods` JSONB
- `engine_version`
- `created_at`

Multiple candidate rows may exist for ambiguous items.

### `claims`

Structured statements extracted from evidence.

Fields:
- `id`
- `subject_entity_id`
- `predicate`
- `value_json`
- `qualifiers_json`
- `claim_time`
- `extraction_confidence`
- `engine_version`
- `created_at`

### `claim_evidence`

Many-to-many mapping:
- `claim_id`
- `raw_item_id`
- `raw_item_revision_id`
- `evidence_role`
- `text_span_or_pointer` JSONB

### `events`

Primary user-facing canonical object.

Fields:
- `id`
- `primary_entity_id`
- `event_type`
- `event_schema_version`
- `occurred_at`
- `announced_at`
- `detected_at`
- `verification_state`
- `verification_confidence`
- `priority_score`
- `priority_band`
- `headline`
- `summary`
- `structured_data` JSONB
- `dedupe_key`
- `status` — `ACTIVE`, `SUPERSEDED`, `RETRACTED`, `SUPPRESSED`, `NEEDS_REVIEW`
- `supersedes_event_id`
- `classifier_version`
- `created_at`
- `updated_at`

### `event_entities`

Relates an event to secondary entities.

Examples: trailer event → movie + actor + studio.

Fields:
- `event_id`
- `entity_id`
- `role`

### `event_evidence`

Fields:
- `event_id`
- `raw_item_id`
- `claim_id` nullable
- `evidence_role` — `PRIMARY`, `CORROBORATING`, `CONFLICTING`, `REPEAT`
- `weight`
- `added_at`

### `event_conflicts`

Explicitly records incompatible supported values/events.

Fields:
- `id`
- `entity_id`
- `conflict_type`
- `event_a_id`
- `event_b_id`
- `status`
- `resolution_event_id`

## Canonical state / projections

Canonical current-state tables are projections derived from events and can be rebuilt.

### `title_state`

Possible fields:
- `entity_id`
- `production_status`
- `current_title`
- `theatrical_release_date`
- `ott_platform_entity_id`
- `ott_release_date`
- `last_event_id`
- `updated_at`

Never discard the events that produced these values.

### `entity_latest_activity`

Fast feed/title-page projection.

### `feed_entries`

Optional denormalized projection if query performance requires it later. Do not introduce before measurement.

## Jobs / reliability tables

### `jobs`

Fields:
- `id`
- `job_type`
- `idempotency_key`
- `payload` JSONB
- `priority`
- `state`
- `attempt_count`
- `max_attempts`
- `run_after`
- `lease_owner`
- `lease_expires_at`
- `last_error`
- `created_at`
- `completed_at`

Constraint:
- active/appropriate uniqueness on idempotency key.

### `dead_letters`

Terminal failures requiring review.

## User tables

### `profiles`

Minimal CineRelay profile linked to Supabase Auth user.

### `user_entity_follows`

- user
- entity
- follow priority
- notification mode

### `user_source_follows`

Optional direct source monitoring preferences.

### `user_notification_preferences`

Global and per-event-type settings.

### `device_tokens`

FCM device registrations with platform and last-seen metadata.

### `notification_outbox`

Durable pending delivery records.

### `notification_deliveries`

Delivery attempts/status for dedupe and debugging.

## Human review/audit tables

### `review_queue`

Ambiguous or low-confidence items/events.

### `audit_actions`

Fields:
- actor/user/system;
- action type;
- target type/id;
- before JSON;
- after JSON;
- reason;
- timestamp.

## Benchmark tables

### `benchmark_cases`

Known labeled source/event cases used to measure the pipeline.

### `benchmark_expected_events`

Expected entity, type, verification and timing.

### `benchmark_runs`

Metrics and engine version snapshot.

## Indexing priorities

Early indexes should cover:

- raw item platform identity + item ID;
- raw item published/first-seen times;
- event entity + occurred/detected time;
- event type + status;
- source health next due time;
- jobs state + run-after + priority;
- alias normalized exact and trigram search;
- full-text indexes for normalized raw text where useful.

Do not add speculative indexes before query plans show need.

## Retention strategy

Keep indefinitely where storage allows:
- entities;
- sources;
- raw item normalized metadata/text;
- claims/events/evidence;
- audit history.

Shorter retention is allowed for:
- verbose connector diagnostics;
- raw response payload copies;
- repetitive successful run logs;
- temporary processing artifacts.

The retention policy should preserve enough data to replay and explain important events.

## Data ownership boundary

CineRelay stores its own normalized facts, provenance and system metadata. It does not assume ownership of third-party images/video/audio simply because a source URL is public.

_Last updated: 2026-09-14_
