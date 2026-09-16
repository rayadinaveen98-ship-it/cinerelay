# P5.4 Implementation Status — Creator Radar

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / CORRECTED CI PENDING / NO HOSTED P5.4 DEPLOYMENT**

Branch:

`phase-5/creator-radar`

Parent:

`phase-5/digest-composition` @ `19e9a3b52710291df73bd5d4909acc478062e716`

Draft PR:

`#14 — Phase 5.4: Creator Radar foundation`

Implemented so far:

- service-owned `creator_radar_entries` projection keyed by canonical event;
- deterministic 0–100 creator score;
- Engine Contract opportunity labels: `SHORT_OPPORTUNITY`, `BREAKING_EXPLAINER`, `TRAILER_ANALYSIS`, `FOLLOW_UP_NEEDED`, `NO_ACTION`;
- deterministic reason codes and factual input snapshot;
- strong separation from canonical event verification/priority/classification;
- `creator_radar_compute(event)` scorer;
- bounded `refresh_creator_radar(limit)` with `FOR UPDATE SKIP LOCKED`;
- input-driven stale detection from event type, verification, priority, status and evidence count, plus timestamp/version signals;
- `clock_timestamp()` generation timestamp for real wall-clock ordering;
- unchanged-event idempotency;
- service-role-only table/functions with RLS enabled;
- internal `creator-radar-worker` using the existing internal secret;
- scheduler allow-list action `creator-radar`, with no cron enabled;
- CI type-check/deployment-native bundle coverage;
- 32 pgTAP assertions covering scoring, labels, reason codes, security, bounded refresh, stale rescore and idempotency.

No AI/provider dependency is introduced in this slice.

## CI #319 finding and fix

CineRelay CI #319 applied the migration successfully and passed web, intelligence and Edge—including the new Radar worker. Three of 32 pgTAP assertions failed because timestamp-only stale detection did not see an event priority change made later in the same SQL transaction.

Root cause: PostgreSQL `now()` is transaction-stable.

The production selector was hardened rather than weakening the test. Radar now directly compares the current scorer inputs with the stored `input_snapshot`; timestamps remain only an additional stale signal. This makes same-transaction changes deterministic and replayable.

Next gate:

1. run corrected all-four-job CineRelay CI;
2. require all 32 Radar pgTAP assertions green;
3. only after corrected CI is green, apply the migration to hosted Supabase;
4. reconcile Supabase's canonical migration version into Git;
5. rerun canonical CI;
6. deploy exact CI-built Creator Radar worker + updated scheduler artifact;
7. verify hosted RLS/privilege/zero-side-effect/advisor state;
8. run a controlled transactional score/refresh/idempotency proof;
9. keep unattended Radar cron disabled until separately approved operationally.

Design:

`docs/07-execution/PHASE5_P5_4_CREATOR_RADAR_DESIGN.md`
