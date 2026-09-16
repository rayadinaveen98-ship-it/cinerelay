# Phase 5.4 Design — Creator Radar / Creator Intelligence Foundation

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED RADAR CRON DELIBERATELY DISABLED**

Parent checkpoint:

`phase-5/digest-composition` @ `19e9a3b52710291df73bd5d4909acc478062e716`

## Goal

Add a separate creator-oriented interpretation layer that ranks canonical CineRelay events for editorial usefulness without changing any factual event field, verification state, priority band or notification state.

This is the first implementation of the Engine Contract's Creator Intelligence responsibility.

## Hard boundary

Creator Radar is **editorial assistance, not factual truth**.

The system must never:

- make an event `OFFICIAL` because its creator score is high;
- modify `events.priority_band` to improve creator ranking;
- mutate event classification or evidence;
- trigger notification state transitions as a side effect of scoring;
- hide the factual event because a creator label is `NO_ACTION`.

All creator output lives in a separate table and can be recomputed or discarded without losing canonical facts.

## Durable model

### `creator_radar_entries`

One current creator-intelligence projection per canonical event.

Fields:

- `event_id` — primary key / FK to canonical event;
- `creator_score` — integer `0..100`;
- `opportunity_label` — one of the five Engine Contract outputs;
- `reason_codes[]` — deterministic explanation codes;
- `input_snapshot` — factual inputs used by the scorer;
- `engine_version` — `creator-radar-v1`;
- generated/updated timestamps.

Allowed labels:

- `SHORT_OPPORTUNITY`
- `BREAKING_EXPLAINER`
- `TRAILER_ANALYSIS`
- `FOLLOW_UP_NEEDED`
- `NO_ACTION`

## V1 scoring philosophy

The first version is intentionally deterministic and replayable. No model call is required.

Inputs:

1. canonical event type;
2. existing CineRelay priority band;
3. verification state;
4. current evidence count;
5. event actionable/suppressed status.

The score measures **creator usefulness**, not truth. Truth remains represented by verification/evidence.

### Event-type signal

High creator-value classes receive stronger base weights:

- trailer release -> strongest dedicated analysis signal;
- major release-date/title/project changes -> breaking explainer signal;
- project/title/release announcements -> breaking explainer signal;
- teaser/glimpse/first-look -> short-form opportunity;
- song/poster/cast/crew/launch/wrap/promo-event updates -> short-form opportunity;
- exits/on-hold -> follow-up signal;
- lower-signal event types start below action threshold.

### Priority signal

Existing factual/user-facing importance is reused only as an input:

- `CRITICAL` strongest boost;
- `HIGH` medium boost;
- `NORMAL` small boost;
- `LOW` no boost;
- `SUPPRESSED` forces creator score `0` / `NO_ACTION`.

### Verification signal

- `OFFICIAL` and `CONFIRMED` receive the strongest trust boosts;
- `RELIABLE_REPORT` receives a smaller boost;
- `DEVELOPING` becomes `FOLLOW_UP_NEEDED`;
- `RUMOR` is penalized, capped and remains `FOLLOW_UP_NEEDED` unless it falls below the action threshold.

### Evidence signal

Evidence count is a small confidence/support signal only. It never creates officiality.

### Action threshold

Scores below `25` map to `NO_ACTION`.

## Explainability

Each score stores stable reason codes such as:

- `TYPE_TRAILER_RELEASED`
- `TYPE_MAJOR_CHANGE`
- `PRIORITY_CRITICAL`
- `VERIFICATION_OFFICIAL`
- `VERIFICATION_DEVELOPING`
- `EVIDENCE_2`
- `EVENT_NOT_ACTIONABLE`
- `SCORE_BELOW_ACTION_THRESHOLD`

The stored `input_snapshot` includes the event id/entity id, event type, verification state, priority band, event status, evidence count and event update time.

## Refresh/staleness model

`refresh_creator_radar(limit)` is bounded to `1..500` events and uses `FOR UPDATE SKIP LOCKED`.

The staleness contract is **input-driven first**, not timestamp-only. An event is refreshed when any scorer input differs from the stored snapshot:

- event type;
- verification state;
- priority band;
- event status;
- evidence count;
- engine version.

Timestamps remain an additional signal for event/evidence changes that occur after generation.

This is deliberate because PostgreSQL `now()` is transaction-stable. CI #319 proved that a timestamp-only selector can miss a factual change made later in the same transaction. The corrected implementation compares current factual scorer inputs directly and uses `clock_timestamp()` for actual generation time.

Corrected CI #322 and the hosted transactional canary both prove same-transaction priority changes are detected and rescored.

An unchanged event is not rescored. Repeat refresh returned `0` in the isolated hosted canary once the relevant backlog was clean.

## Runtime

`creator-radar-worker`:

- internal server-only Edge function;
- validates the existing independent internal secret;
- calls only the bounded refresh RPC;
- no external AI/provider API;
- no new secret;
- scheduler allow-list action `creator-radar` with limit 100.

Hosted runtime:

- `creator-radar-worker` ACTIVE v1;
- `cinerelay-scheduler-dispatch` ACTIVE v8.

No production Creator Radar cron is enabled.

## Security

`creator_radar_entries` is service-owned in P5.4:

- RLS enabled;
- no direct `anon`/`authenticated` table privileges;
- compute/refresh RPCs unavailable to normal clients;
- service-role only mutation/execution.

A later read API/UI can expose a deliberately shaped Radar projection without exposing internal mutation surfaces.

## Explicitly deferred

P5.4 does not implement:

- LLM-generated summaries;
- automated scripts/hooks/titles;
- social-platform publishing;
- per-creator learned ranking;
- engagement prediction;
- automatic factual event modification;
- unattended production Radar cron;
- Android UI.

## Completed release gate

All P5.4 engineering gates passed:

1. corrected fresh migration applied cleanly;
2. all 32 Creator Radar pgTAP assertions passed, including same-transaction stale-rescore proof;
3. existing Phase-1..P5.3 tests stayed green;
4. DB lint passed;
5. worker and scheduler type-check/bundle passed;
6. hosted migration reconciled to `20260916121143_creator_radar_foundation`;
7. canonical CI #323 / run `35094571102` passed all four jobs;
8. exact canonical artifact `10445532906` / `sha256:4bb1bd39ceaecedf3d93ee05bafd9b4393481d624fd3c8a259733ad4fa419f3d` was deployed;
9. hosted security/zero-side-effect/advisor checks passed;
10. controlled hosted score/refresh/same-transaction-rescore/idempotency proof passed and rolled back;
11. post-rollback Radar rows and synthetic rows returned to zero;
12. no Radar cron was enabled.

## Operational activation rule

A recurring Radar refresh cron is intentionally separate from engineering completion. It should be enabled only when CineRelay is ready to expose and monitor Creator Radar continuously.

## Next boundary

The next Phase-5 intelligence slice can implement optional concise evidence-based summaries. Summary text must cite/derive from canonical evidence and must not modify verification state or replace the deterministic Radar score.

Hosted proof:

`docs/07-execution/PHASE5_P5_4_HOSTED_ENGINEERING_PROOF_2026-09-16.md`
