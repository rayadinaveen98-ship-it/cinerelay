# Phase 5.3 Design — Digest Composition

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED DIGEST CRON DELIBERATELY DISABLED**

Parent checkpoint:

`phase-5/device-delivery-infrastructure` @ `d656b8176b79047ecd289709a83bf3f54f903be3`

## Why this is the next slice

The locked Phase-5 roadmap requires digest modes, FCM delivery, Creator Radar scoring, optional evidence-based concise summaries and content-opportunity labels. P5.1 already creates per-event `DIGEST` outbox rows and schedules them at the user's digest hour. P5.2 isolates FCM delivery. The missing Notification Engine responsibility was therefore to turn due digest outbox rows into one durable, bounded user digest before Creator Intelligence begins.

Creator Radar remains a later separate slice because the Engine Contract explicitly says creator interpretation is editorial assistance and never changes the factual record.

## Goal

Convert eligible due `alert_deliveries.delivery_kind='DIGEST'` rows into one durable digest batch per `(user, scheduled_for)` slot without external provider calls, duplicate items or unbounded work.

## Durable model

### `alert_digest_batches`

One durable digest envelope per user/scheduled slot.

Important fields:

- user id;
- scheduled slot;
- status `BUILDING | READY | READ | ARCHIVED`;
- item count;
- highest included priority band;
- deterministic title;
- deterministic JSON payload;
- composer version;
- ready/read timestamps.

Uniqueness: `(user_id, scheduled_for)`.

### `alert_digest_items`

Joins one P5.1 digest outbox row/event into one batch.

`alert_delivery_id` is globally unique in this table, so one source alert can never belong to two digest batches.

## Bounded composition

`compose_due_alert_digests(limit)` locks only a bounded number of due digest-alert rows with `FOR UPDATE SKIP LOCKED`.

The database clamps a run to `1..500` rows.

A large slot may therefore need more than one invocation:

1. first chunk creates/updates the batch as `BUILDING`;
2. later chunks append unique items;
3. the batch becomes `READY` only when no due source rows remain for that same user/slot.

This preserves the scheduler invariant that no worker invocation performs unbounded fan-out.

## Deterministic ordering

Items are ranked by:

1. CineRelay priority band (`CRITICAL` before `HIGH` before `NORMAL` before `LOW`);
2. newest event detection time;
3. source alert creation time;
4. alert id for stable tie-breaking.

The first version does not generate AI copy. It reuses factual canonical event metadata/headlines only.

## Source alert lifecycle

A due `DIGEST` alert becomes `COMPOSED` only after its durable digest-item relation exists. `composed_at` records that transition.

`PUSH` rows are never touched by the composer.

Future digest rows are never composed early.

## Security

- digest batch/item tables use RLS;
- authenticated users may read only their own batches/items;
- normal clients cannot insert/update/delete digest composition state;
- the internal composition RPC is service-role-only;
- `digest-compose-worker` requires the existing independent internal worker secret;
- no external provider secret is needed.

## Scheduler

The scheduler allow-list contains `digest-compose` -> `digest-compose-worker` with a 200-row batch.

No production digest cron is enabled by P5.3. The hosted engineering proof passed without creating unattended work.

## Completed release gate

All implementation gates passed:

1. fresh migrations pass;
2. all 31 P5.3 pgTAP assertions pass;
3. existing P5.1/P5.2 tests stay green;
4. worker and scheduler type-check/bundle pass;
5. hosted canonical migration is reconciled to `20260916114913_digest_composition_foundation`;
6. canonical CI #313 / run `35092445078` passes all four jobs;
7. exact artifact `10444439396` / `sha256:819aa8ccc4b924b69bd848c32b65ba9142d9a011215e25568bf5a5e1d4f6e252` is deployed;
8. hosted RLS/privilege/zero-side-effect checks pass;
9. advisors show no new P5.3-specific regression;
10. controlled hosted composition proves `BUILDING -> READY`, stable ordering and duplicate-free repeat;
11. rollback proves no synthetic or persistent digest residue.

## Operational activation rule

A recurring digest-composition cron is intentionally separate from engineering completion. It should be enabled only when CineRelay is ready to operate real user digest traffic continuously and monitor it operationally.

## Next boundary

The next Phase-5 slice should implement Creator Radar / Creator Intelligence as an independent editorial-assistance layer. It must not mutate canonical event facts or P5.3 notification composition semantics.

Hosted proof:

`docs/07-execution/PHASE5_P5_3_HOSTED_ENGINEERING_PROOF_2026-09-16.md`
