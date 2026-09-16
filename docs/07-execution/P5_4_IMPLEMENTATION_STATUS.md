# P5.4 Implementation Status — Creator Radar

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED RADAR CRON DELIBERATELY DISABLED**

Branch:

`phase-5/creator-radar`

Parent:

`phase-5/digest-composition` @ `19e9a3b52710291df73bd5d4909acc478062e716`

Draft PR:

`#14 — Phase 5.4: Creator Radar foundation`

## Implemented

- service-owned `creator_radar_entries` projection keyed by canonical event;
- deterministic 0–100 creator score;
- Engine Contract opportunity labels: `SHORT_OPPORTUNITY`, `BREAKING_EXPLAINER`, `TRAILER_ANALYSIS`, `FOLLOW_UP_NEEDED`, `NO_ACTION`;
- deterministic reason codes and factual input snapshot;
- strong separation from canonical event verification/priority/classification;
- `creator_radar_compute(event)` scorer;
- bounded `refresh_creator_radar(limit)` with `FOR UPDATE SKIP LOCKED` and max 500;
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

The production selector was hardened rather than weakening the test. Radar now directly compares the current scorer inputs with the stored `input_snapshot`; timestamps remain only an additional stale signal. `clock_timestamp()` records actual generation time.

Corrected CI #322 / run `35094262117` passed all four jobs, including all 32 Radar assertions and DB lint.

## Canonical hosted migration

`20260916121143_creator_radar_foundation`

Canonical migration-ledger head:

`15008e1604434f081af6cd84669df0d7f48487f9`

Canonical CI #323 / run `35094571102` passed all four jobs:

- intelligence/connectors PASS;
- web console PASS;
- Edge type-check + deployment-native bundle PASS;
- fresh migrations + all 32 P5.4 pgTAP assertions + DB lint PASS.

## Exact deployment artifact

`cinerelay-edge-deploy-bundle`

- artifact id: `10445532906`
- digest: `sha256:4bb1bd39ceaecedf3d93ee05bafd9b4393481d624fd3c8a259733ad4fa419f3d`

Hosted runtimes deployed from that exact artifact:

- `creator-radar-worker` — ACTIVE v1 — id `e5159648-e5ca-4fc0-896c-8d7791b3d345` — runtime SHA `fac1c65c32f403ea23410b181f1f83d36ca7871eb0babc55ab324880e44b90d3`;
- `cinerelay-scheduler-dispatch` — ACTIVE v8 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `c3574ca9194079646368a24794ed348e1fac42bc85513d58d3e12e882c917fcc`.

## Hosted verification

Security/zero-side-effect checks confirm:

- Radar table RLS enabled;
- authenticated direct table SELECT denied;
- authenticated compute/refresh RPC execution denied;
- both Radar functions have explicit search paths;
- persistent Radar entries: `0`;
- Radar cron jobs: `0`.

Supabase advisors show no new P5.4-specific missing-FK or function-search-path regression. The service-owned Radar table appears in the expected RLS/no-policy informational list, and its two indexes are currently unused because persistent hosted Radar rows remain zero.

## Controlled hosted proof

A rollback-safe isolated hosted canary proved:

1. first bounded refresh processed `2` synthetic events;
2. second bounded refresh processed the remaining `1`;
3. official critical trailer -> score `85`, `TRAILER_ANALYSIS`;
4. confirmed critical theatrical-date change -> score `80`, `BREAKING_EXPLAINER`;
5. reliable-report normal interview -> score `18`;
6. changing that interview from `NORMAL` to `HIGH` later in the same transaction made exactly that entry stale;
7. next bounded refresh returned `1` and rescored it to `28`;
8. stored input snapshot recorded `HIGH`;
9. repeat refresh returned `0` once the isolated backlog was clean;
10. Radar did not rewrite the canonical event priority;
11. transaction rollback removed all synthetic rows and score projections.

Post-rollback hosted state:

- synthetic entities: `0`;
- synthetic events: `0`;
- Radar entries: `0`;
- Radar cron jobs: `0`.

## Remaining operational decision

P5.4 engineering is complete. A production Creator Radar cron remains deliberately disabled. Enabling recurring refresh should happen only when CineRelay is ready to operate and expose Radar continuously.

Next Phase-5 intelligence slice:

**optional concise evidence-based summaries**, kept separate from factual verification and from deterministic Radar scoring.

Hosted proof:

`docs/07-execution/PHASE5_P5_4_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

Design:

`docs/07-execution/PHASE5_P5_4_CREATOR_RADAR_DESIGN.md`
