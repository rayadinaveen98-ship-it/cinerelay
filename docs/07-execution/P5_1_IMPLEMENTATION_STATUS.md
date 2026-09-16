# P5.1 Implementation Status — Alert Foundation

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / DELIVERY PROVIDER WORK DEFERRED TO P5.2**

Branch:

`phase-5/alerts-creator-intelligence`

Parent:

`phase-4/selected-public-pages`

Draft PR:

`#11`

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
- preservation of operator suppression and operator-reviewed classifier semantics during deterministic reprocessing;
- covering index for `user_alert_event_preferences.event_type`;
- 24 pgTAP assertions covering security, eligibility, dedupe, quiet hours, rumor opt-in and canonical-event regression behavior.

Canonical hosted migrations:

- `20260916103904_alert_creator_foundation`
- `20260916103923_alert_creator_foundation_contract_fix`
- `20260916104832_alert_creator_foundation_index_hardening`

Canonical hosted-ledger CI:

- head `21d8950e9bc95e14bff4ce194c49d06d32cd4fa9`;
- CineRelay CI #302 / run `35087024713`;
- all four jobs PASS;
- fresh migrations PASS;
- all pgTAP suites PASS, including 24 P5.1 alert assertions;
- database function lint PASS;
- intelligence/connectors PASS;
- Edge type-check/bundle PASS;
- web console PASS.

Hosted verification:

- all four P5.1 tables have RLS enabled;
- authenticated users can use user-facing follow/preferences surfaces but cannot insert alert-outbox rows;
- authenticated users cannot execute `plan_event_alerts(uuid)`;
- hosted P5.1 follow rows: `0`;
- hosted global preference rows: `0`;
- hosted event-preference rows: `0`;
- hosted alert-delivery rows: `0`;
- `next_alert_digest_at` uses the reconciled integer-hour signature;
- canonical event upsert retains explicit `search_path` and operator suppression/reclassification safeguards.

Advisor verification:

- the P5.1 `user_alert_event_preferences.event_type` unindexed-FK finding is resolved;
- no new P5.1-specific security warning remains;
- fresh P5.1 indexes are reported unused while hosted P5.1 has zero user data, which is expected;
- unrelated pre-existing project findings remain tracked separately.

Not included in P5.1:

- device-token registration;
- FCM delivery;
- delivery leasing/retry/dead-letter handling;
- digest composition;
- Creator Radar scoring;
- concise evidence-backed summaries;
- content-opportunity labels.

Next slice:

**P5.2 — device registration + provider-isolated push delivery/retry infrastructure.**

Full hosted proof:

`docs/07-execution/PHASE5_P5_1_HOSTED_ENGINEERING_PROOF_2026-09-16.md`
