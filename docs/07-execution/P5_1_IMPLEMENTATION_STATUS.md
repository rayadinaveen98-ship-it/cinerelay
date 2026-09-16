# P5.1 Implementation Status — Alert Foundation

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING**

Branch:

`phase-5/alerts-creator-intelligence`

Parent:

`phase-4/selected-public-pages`

Implemented in this slice:

- user-owned entity follows;
- user alert defaults;
- per-event-type overrides;
- quiet-hours and digest scheduling helpers;
- provider-neutral `alert_deliveries` outbox;
- canonical-event alert planner;
- planner integrated into canonical event upsert;
- default HIGH-priority instant alerts;
- rumors off by default;
- no historical backfill for follows created after an event;
- stable per-user/event/kind dedupe;
- RLS user isolation for follows/preferences;
- authenticated read-only access to own alert outbox;
- service-only alert planning;
- 24 pgTAP assertions covering security, eligibility, dedupe and canonical-event regression behavior.

Not yet included in P5.1:

- FCM device registration/delivery;
- delivery leasing/retries;
- digest composition;
- Creator Radar scoring;
- concise evidence-backed summaries;
- content-opportunity labels.

No hosted migration is allowed until fresh-database CI passes.
