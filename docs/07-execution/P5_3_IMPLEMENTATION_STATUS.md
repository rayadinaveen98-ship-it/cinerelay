# P5.3 Implementation Status — Digest Composition

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING / NO HOSTED P5.3 DEPLOYMENT**

Branch:

`phase-5/digest-composition`

Parent:

`phase-5/device-delivery-infrastructure` @ `d656b8176b79047ecd289709a83bf3f54f903be3`

Implemented so far:

- `alert_digest_batches` durable user/slot envelope;
- `alert_digest_items` unique per-source-alert membership;
- P5.1 `alert_deliveries` adds `COMPOSED` and `composed_at`;
- bounded `compose_due_alert_digests(limit)` with `FOR UPDATE SKIP LOCKED`;
- `BUILDING` -> `READY` only after a slot has no due source rows remaining;
- deterministic priority/event-time ordering;
- deterministic count/title/payload composition from canonical event metadata;
- service-role-only composer RPC;
- authenticated own-row SELECT through RLS, no client composition writes;
- internal `digest-compose-worker` using the existing internal-secret boundary;
- `digest-compose` scheduler allow-list action prepared without cron;
- CI type-check/deployment bundle coverage;
- 30 pgTAP assertions covering RLS/privileges, bounded partial composition, READY transition, ordering, idempotency, future-row exclusion and PUSH isolation.

Production/hosted state is deliberately unchanged until fresh CI passes.

Next gate:

1. open stacked draft PR on P5.2;
2. run all four CineRelay CI jobs;
3. fix any migration/pgTAP/type-check issue without weakening the contract;
4. apply the CI-proven migration to hosted Supabase;
5. reconcile Supabase's migration version into Git and rerun canonical CI;
6. deploy exact CI-built digest worker and updated scheduler artifact;
7. verify hosted zero-side-effect/RLS/privilege/advisor state;
8. run a controlled duplicate-free hosted composition proof;
9. only then consider enabling unattended digest composition.

Design:

`docs/07-execution/PHASE5_P5_3_DIGEST_COMPOSITION_DESIGN.md`
