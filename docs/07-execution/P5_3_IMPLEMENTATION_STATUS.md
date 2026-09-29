# P5.3 Implementation Status — Digest Composition

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED DIGEST CRON DELIBERATELY DISABLED**

Branch:

`phase-5/digest-composition`

Parent:

`phase-5/device-delivery-infrastructure` @ `d656b8176b79047ecd289709a83bf3f54f903be3`

Draft PR:

`#13 — Phase 5.3: digest composition`

## Implemented

- `alert_digest_batches` durable user/slot envelope;
- `alert_digest_items` unique per-source-alert membership;
- P5.1 `alert_deliveries` adds `COMPOSED` and `composed_at`;
- bounded `compose_due_alert_digests(limit)` with `FOR UPDATE SKIP LOCKED`;
- hard clamp of 500 rows per invocation;
- `BUILDING` -> `READY` only after a slot has no due source rows remaining;
- deterministic priority/event-time ordering;
- deterministic count/title/payload composition from canonical event metadata;
- no AI-written digest copy;
- service-role-only composer RPC;
- authenticated own-row SELECT through RLS, no client composition writes;
- internal `digest-compose-worker` using the existing internal-secret boundary;
- `digest-compose` scheduler allow-list action prepared without cron;
- CI type-check/deployment-native bundle coverage;
- 31 pgTAP assertions covering RLS/privileges, bounded partial composition, READY transition, ordering, idempotency, future-row exclusion and PUSH isolation.

## Canonical hosted migration

`20260916114913_digest_composition_foundation`

## CI proof

Initial CI #311 proved all behavior assertions but exposed only a pgTAP plan-count mismatch: the file declared 30 tests while emitting 31. No production SQL changed in that correction.

Corrected CI #312 / run `35092082454` passed all four jobs.

Canonical hosted-ledger head:

`dae32096623938e521abcfcd54a83e97b0ec9df3`

Canonical CI #313 / run `35092445078` passed all four jobs:

- intelligence/connectors PASS;
- web console PASS;
- Edge type-check + deployment-native bundle PASS;
- fresh migrations + all 31 P5.3 pgTAP assertions + DB lint PASS.

## Exact deployment artifact

`cinerelay-edge-deploy-bundle`

- artifact id: `10444439396`
- digest: `sha256:819aa8ccc4b924b69bd848c32b65ba9142d9a011215e25568bf5a5e1d4f6e252`

Hosted runtimes deployed from that exact artifact:

- `digest-compose-worker` — ACTIVE v1 — id `837c87bf-790e-4100-bf00-e20a5f1d0867` — runtime SHA `9b7bc1cdb2983bfaa8efb1daccbccddf9f6f878c9a74d18def443db1d5e5aaa2`;
- `cinerelay-scheduler-dispatch` — ACTIVE v7 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `404b434689338ca606a84cc62725c0a88923ac21a66f020006e8025256053206`.

## Hosted verification

Security/zero-side-effect checks confirm:

- both digest tables have RLS enabled;
- authenticated users have own-row SELECT only;
- authenticated INSERT is denied;
- authenticated composer execution is denied;
- composer has explicit `search_path` configuration;
- persistent digest batches: `0`;
- persistent digest items: `0`;
- persistent COMPOSED alerts: `0`;
- digest cron jobs: `0`.

Controlled hosted transactional proof:

1. first `compose_due_alert_digests(1)` returned `1`, leaving one-item batch `BUILDING`;
2. second call returned `1`, producing a two-item `READY` batch;
3. highest priority and deterministic ordering were correct;
4. `ready_at` was populated;
5. repeat composition returned `0`;
6. rollback removed every synthetic row.

Post-rollback hosted state returned to zero for synthetic users/entities/events/alerts and all digest batches/items/COMPOSED alerts.

Supabase advisors show no new P5.3-specific missing-FK or security regression. New digest indexes are listed as unused only because hosted digest tables intentionally remain empty.

## Remaining operational decision

P5.3 engineering is complete. A production digest-composition cron remains deliberately disabled. Enabling recurring composition should happen only when CineRelay is ready to operate real user digest traffic continuously.

Next Phase-5 engineering slice:

**Creator Radar / Creator Intelligence**, kept separate from factual event state and notification composition semantics.

Hosted proof:

`docs/07-execution/PHASE5_P5_3_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

Design:

`docs/07-execution/PHASE5_P5_3_DIGEST_COMPOSITION_DESIGN.md`

Final checkpoint rule: the latest documentation head must also pass all four CineRelay CI jobs before this slice is considered repository-complete.
