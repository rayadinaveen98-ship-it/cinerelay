# P5.4 Implementation Status — Creator Radar

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING / NO HOSTED P5.4 DEPLOYMENT**

Branch:

`phase-5/creator-radar`

Parent:

`phase-5/digest-composition` @ `19e9a3b52710291df73bd5d4909acc478062e716`

Implemented so far:

- service-owned `creator_radar_entries` projection keyed by canonical event;
- deterministic 0–100 creator score;
- Engine Contract opportunity labels: `SHORT_OPPORTUNITY`, `BREAKING_EXPLAINER`, `TRAILER_ANALYSIS`, `FOLLOW_UP_NEEDED`, `NO_ACTION`;
- deterministic reason codes and factual input snapshot;
- strong separation from canonical event verification/priority/classification;
- `creator_radar_compute(event)` scorer;
- bounded `refresh_creator_radar(limit)` with `FOR UPDATE SKIP LOCKED`;
- stale detection from event updates, evidence additions and engine-version changes;
- unchanged-event idempotency;
- service-role-only table/functions with RLS enabled;
- internal `creator-radar-worker` using the existing internal secret;
- scheduler allow-list action `creator-radar`, with no cron enabled;
- CI type-check/deployment-native bundle coverage;
- 32 pgTAP assertions covering scoring, labels, reason codes, security, bounded refresh, stale rescore and idempotency.

No AI/provider dependency is introduced in this slice.

Next gate:

1. open stacked draft PR on P5.3;
2. run all four CineRelay CI jobs;
3. fix migration/pgTAP/type-check issues without weakening the contract;
4. only after fresh CI is green, apply the migration to hosted Supabase;
5. reconcile Supabase's canonical migration version into Git;
6. rerun canonical CI;
7. deploy exact CI-built Creator Radar worker + updated scheduler artifact;
8. verify hosted RLS/privilege/zero-side-effect/advisor state;
9. run a controlled transactional score/refresh/idempotency proof;
10. keep unattended Radar cron disabled until separately approved operationally.

Design:

`docs/07-execution/PHASE5_P5_4_CREATOR_RADAR_DESIGN.md`
