# Phase 5.1 — Alert & Follow Foundation

Date: 2026-09-16

## Goal

Turn CineRelay's canonical event graph into a durable per-user alert plan without coupling event processing to Firebase Cloud Messaging or any external delivery provider.

Phase 5 remains creator-first. The alert system must preserve the same provenance, dedupe and verification rules as the event pipeline.

## Core decision

Alerts are planned from **canonical events**, never from raw posts.

```text
raw source activity
  -> raw item / revision
  -> canonical event + evidence
  -> follow + preference evaluation
  -> idempotent alert outbox
  -> later delivery worker / FCM
```

This ensures multiple reposts/evidence items cannot independently spam the user.

## P5.1 data contracts

### `user_entity_follows`

Per-user follow graph keyed by `(user_id, entity_id)`.

Only active follows that existed when the canonical event was first created are eligible. Following a title later does not backfill old alerts.

### `user_alert_preferences`

Per-user defaults:

- alert mode: `INSTANT`, `DIGEST`, `BOTH`, `MUTED`;
- minimum priority: `CRITICAL`, `HIGH`, `NORMAL`, `LOW`;
- developing-event opt-in/out;
- rumor opt-in/out;
- local quiet hours;
- IANA timezone;
- optional critical quiet-hours bypass;
- local digest hour.

Default behavior is deliberately conservative:

- `INSTANT`;
- minimum priority `HIGH`;
- developing events allowed;
- rumors disabled;
- quiet hours disabled until the user configures them;
- timezone `Asia/Kolkata` for the current India-first creator workflow;
- digest hour 09:00 local.

### `user_alert_event_preferences`

Optional event-type overrides. A user may disable a type or override its mode without duplicating the global preference row.

### `alert_deliveries`

Durable provider-neutral outbox.

A row represents one planned delivery for one user/event/kind. `dedupe_key` is unique and stable:

`alert:<user-id>:<event-id>:<push|digest>`

P5.1 does **not** send externally. Later workers will consume due outbox rows and update delivery state.

## Planning rules

`plan_event_alerts(event_id)` evaluates the follow/preference graph after the canonical event upsert.

Rules:

1. only `ACTIVE` canonical events are eligible;
2. `SUPPRESSED` events never alert;
3. the follow must be active and predate the event's first creation;
4. priority must meet the user's minimum threshold;
5. `RUMOR` is excluded unless explicitly enabled;
6. `DEVELOPING` respects its own user setting;
7. per-event-type preference can disable or change delivery mode;
8. quiet hours defer instant delivery rather than dropping it;
9. digest delivery is scheduled for the user's next configured local digest hour;
10. repeated evidence or repeated planning is harmless because outbox dedupe is unique.

## Failure isolation

Canonical event processing never calls FCM directly.

If FCM is unavailable, a token is invalid, the phone is offline, or a future delivery worker crashes, the canonical event/evidence transaction has already completed and remains correct. The alert outbox can be retried independently.

## Security model

User-owned follow/preference tables use RLS with `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

The alert outbox is user-readable but not user-writable. Authenticated clients cannot insert delivery rows or invoke the internal planner directly.

Timezone names are validated before persistence to avoid scheduling failures from invalid configuration.

## P5.1 test gate

Fresh-database pgTAP must prove:

- RLS enabled on all user/alert tables;
- user isolation;
- default HIGH instant behavior;
- muted user behavior;
- canonical repeat dedupe;
- default priority filtering;
- per-event DIGEST override;
- rumors disabled by default and enabled only through explicit opt-in;
- overnight quiet-hours calculation;
- explicit critical bypass;
- invalid timezone rejection;
- alert outbox cannot be inserted by authenticated clients;
- alert planner cannot be called by authenticated clients;
- following after an event does not backfill it;
- suppressed events never alert;
- canonical evidence behavior remains unchanged.

## Deferred to later Phase-5 slices

P5.1 intentionally does not yet implement:

- device-token registration;
- FCM credentials or sends;
- alert leasing/retry/dead-letter mechanics;
- notification-open/read state;
- digest composition;
- Creator Radar score;
- evidence-based concise summary generation;
- content-opportunity labels/UI.

Those depend on this durable provider-neutral foundation and must not bypass it.
