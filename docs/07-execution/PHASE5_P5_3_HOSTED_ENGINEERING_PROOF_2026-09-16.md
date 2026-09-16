# Phase 5.3 Hosted Engineering Proof — Digest Composition

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED DIGEST CRON DELIBERATELY DISABLED**

## Scope

P5.3 completes the Notification Engine's missing digest-composition responsibility. It converts P5.1 due `DIGEST` alert-outbox rows into durable, bounded, deterministic user digest batches. It does not add Creator Radar scoring, editorial recommendations, AI-written summaries or external delivery-provider coupling.

## Branch and PR

- branch: `phase-5/digest-composition`
- parent: `phase-5/device-delivery-infrastructure` @ `d656b8176b79047ecd289709a83bf3f54f903be3`
- draft PR: `#13 — Phase 5.3: digest composition`

## Canonical hosted migration

Supabase project: `dnqaejljfzwhsainpdxb`

Canonical hosted ledger entry:

- `20260916114913_digest_composition_foundation`

The Git migration was reconciled byte-for-byte to the Supabase-assigned hosted version before the canonical deployment CI.

## Database contract

P5.3 adds:

- `alert_digest_batches` — one durable envelope per `(user_id, scheduled_for)`;
- `alert_digest_items` — unique membership for a source digest alert;
- `COMPOSED` lifecycle state plus `composed_at` on P5.1 `alert_deliveries`;
- bounded `compose_due_alert_digests(limit)` with `FOR UPDATE SKIP LOCKED` and a hard clamp of 500 rows per call;
- deterministic ranking by priority band, event detection time, alert creation time and alert id;
- deterministic factual payload from canonical event metadata/headlines only;
- `BUILDING` state while due rows remain for a slot and `READY` only when the slot is complete.

The composer is service-role-only. Authenticated users receive own-row read access to digest batches/items through RLS and cannot perform composition writes or execute the composer RPC.

## Test proof

Initial CI #311 showed no behavior failure: all actual digest assertions passed, but the pgTAP file declared 30 tests while emitting 31. Only the test plan count was corrected.

Corrected CI #312 / run `35092082454` passed all four jobs, including all 31 digest assertions.

The suite proves:

- RLS and privilege boundaries;
- authenticated read-only own-row access;
- internal-only composer execution;
- bounded partial composition;
- `BUILDING -> READY` transition;
- item-count/highest-priority aggregation;
- deterministic event ordering;
- future digest exclusion;
- PUSH-row isolation;
- source-alert uniqueness;
- repeat idempotency.

## Canonical CI

Canonical migration-ledger head:

`dae32096623938e521abcfcd54a83e97b0ec9df3`

CineRelay CI #313 / run `35092445078` passed all four jobs:

- intelligence/connectors PASS;
- web console PASS;
- Edge type-check + deployment-native bundle PASS;
- fresh migrations + 31 P5.3 pgTAP assertions + DB lint PASS.

## Exact deployment artifact

Artifact: `cinerelay-edge-deploy-bundle`

- artifact id: `10444439396`
- digest: `sha256:819aa8ccc4b924b69bd848c32b65ba9142d9a011215e25568bf5a5e1d4f6e252`

Only the P5.3 runtime changes were promoted from this exact canonical CI artifact.

## Hosted Edge runtimes

- `digest-compose-worker` — ACTIVE v1 — id `837c87bf-790e-4100-bf00-e20a5f1d0867` — runtime SHA `9b7bc1cdb2983bfaa8efb1daccbccddf9f6f878c9a74d18def443db1d5e5aaa2`;
- `cinerelay-scheduler-dispatch` — ACTIVE v7 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `404b434689338ca606a84cc62725c0a88923ac21a66f020006e8025256053206`.

The scheduler allow-list now includes `digest-compose`, but no production digest cron was created.

## Hosted zero-side-effect/security verification

After migration and runtime deployment:

- `alert_digest_batches` RLS enabled;
- `alert_digest_items` RLS enabled;
- authenticated users have SELECT but not INSERT on both digest tables;
- authenticated users cannot execute `compose_due_alert_digests(integer)`;
- composer function has explicit `search_path=pg_catalog, public, extensions`;
- hosted digest batches: `0`;
- hosted digest items: `0`;
- hosted COMPOSED alerts: `0`;
- digest scheduler cron jobs: `0`.

## Controlled hosted composition proof

A synthetic proof was executed inside an explicit transaction and rolled back afterward. Two due DIGEST rows shared one user/scheduled slot.

Observed sequential behavior:

1. first bounded call `compose_due_alert_digests(1)` returned `1`;
2. batch state became `BUILDING` with `item_count = 1`;
3. second bounded call returned `1`;
4. batch state became `READY` with `item_count = 2`;
5. highest priority became `HIGH`;
6. payload kind was `CINERELAY_DIGEST` with `itemCount = 2`;
7. deterministic ordering placed the HIGH project-announcement item before the NORMAL poster item;
8. `ready_at` was recorded;
9. both source digest alerts were `COMPOSED` inside the transaction;
10. repeat `compose_due_alert_digests(100)` returned `0`.

Rollback verification then confirmed:

- synthetic user rows: `0`;
- synthetic entities: `0`;
- synthetic events: `0`;
- synthetic alerts: `0`;
- synthetic digest batches: `0`;
- all hosted digest batches: `0`;
- all hosted digest items: `0`;
- all hosted COMPOSED alerts: `0`;
- digest cron jobs: `0`.

## Advisor review

Supabase advisors show no new P5.3-specific security or missing-foreign-key-index regression.

The two P5.3 indexes appear in the normal unused-index informational list because hosted digest tables intentionally contain zero persistent rows. Existing project-wide findings remain unchanged, including the older YouTube mutable-search-path warning and leaked-password-protection warning.

## Release decision

P5.3 engineering and hosted foundation are complete.

Unattended digest composition remains deliberately disabled for now. Enabling a recurring digest cron is a product/operations activation decision, not a missing engineering requirement for this slice. The next independent Phase-5 engineering slice should implement Creator Radar / Creator Intelligence without modifying the factual event record or P5.3 composition semantics.
