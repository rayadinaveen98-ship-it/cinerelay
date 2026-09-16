# Phase 5.4 Hosted Engineering Proof — Creator Radar

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED RADAR CRON DELIBERATELY DISABLED**

## Scope

P5.4 implements the first deterministic Creator Intelligence / Creator Radar layer. It produces a separate creator-oriented score, opportunity label and explanation snapshot from canonical CineRelay facts. It does **not** mutate factual events, verification, priority, classification, evidence or notification state, and it does not call an AI/provider API.

## Branch and PR

- branch: `phase-5/creator-radar`
- parent: `phase-5/digest-composition` @ `19e9a3b52710291df73bd5d4909acc478062e716`
- draft PR: `#14 — Phase 5.4: Creator Radar foundation`

## Canonical hosted migration

Supabase project: `dnqaejljfzwhsainpdxb`

Canonical hosted ledger entry:

- `20260916121143_creator_radar_foundation`

Git was reconciled byte-for-byte to the hosted migration version before canonical deployment CI.

## Database contract

P5.4 adds service-owned `creator_radar_entries`, one current projection per canonical event, containing:

- creator score `0..100`;
- one Engine Contract opportunity label;
- deterministic reason codes;
- factual input snapshot;
- scorer engine version;
- generation/update timestamps.

Allowed labels:

- `SHORT_OPPORTUNITY`;
- `BREAKING_EXPLAINER`;
- `TRAILER_ANALYSIS`;
- `FOLLOW_UP_NEEDED`;
- `NO_ACTION`.

The deterministic v1 scorer uses only event type, existing priority band, verification state, evidence count and actionable/suppressed status. Evidence supports the creator score but can never manufacture officiality.

## Staleness bug found by CI and fixed

Initial P5.4 CI #319 successfully applied the migration and passed web/intelligence/Edge, including the new worker. Three of the 32 Radar pgTAP assertions failed in the stale-rescore section.

Root cause: the original stale selector depended primarily on timestamps. PostgreSQL `now()` is transaction-stable, so a factual event update later in the same transaction could share the same timestamp and be missed.

The production implementation was hardened rather than weakening the test:

- current event type is compared with the stored input snapshot;
- current verification state is compared;
- current priority band is compared;
- current event status is compared;
- current evidence count is compared;
- engine version remains a stale signal;
- timestamps remain an additional stale signal;
- Radar generation uses `clock_timestamp()` for wall-clock generation time.

Corrected CI #322 / run `35094262117` passed all four jobs and all 32 Radar assertions.

## Canonical CI

Canonical migration-ledger head:

`15008e1604434f081af6cd84669df0d7f48487f9`

CineRelay CI #323 / run `35094571102` passed all four jobs:

- intelligence/connectors PASS;
- web console PASS;
- Edge type-check + deployment-native bundle PASS;
- fresh migrations + all 32 P5.4 pgTAP assertions + DB lint PASS.

## Exact deployment artifact

Artifact: `cinerelay-edge-deploy-bundle`

- artifact id: `10445532906`
- digest: `sha256:4bb1bd39ceaecedf3d93ee05bafd9b4393481d624fd3c8a259733ad4fa419f3d`

Verified deployment-native file hashes before deployment:

- `creator-radar-worker/index.js`: `2fb314bba9508ee3b51b078d64cbbb2ea9530ff984f6e388481b1347a3194763`;
- `cinerelay-scheduler-dispatch/index.js`: `d8c16622b79dac7ea0685508e46a6872fefd6b71b783ffd880e43a0aac5d07a1`.

Only the P5.4 runtime changes were deployed from this exact canonical CI artifact.

## Hosted Edge runtimes

- `creator-radar-worker` — ACTIVE v1 — id `e5159648-e5ca-4fc0-896c-8d7791b3d345` — runtime SHA `fac1c65c32f403ea23410b181f1f83d36ca7871eb0babc55ab324880e44b90d3`;
- `cinerelay-scheduler-dispatch` — ACTIVE v8 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `c3574ca9194079646368a24794ed348e1fac42bc85513d58d3e12e882c917fcc`.

The scheduler allow-list now contains `creator-radar`, but no Radar cron was created.

## Hosted security / zero-side-effect verification

After migration and runtime deployment:

- `creator_radar_entries` RLS enabled;
- authenticated direct SELECT denied;
- authenticated direct execute on `creator_radar_compute(uuid)` denied;
- authenticated direct execute on `refresh_creator_radar(integer)` denied;
- both Radar functions have explicit `search_path=pg_catalog, public, extensions`;
- persistent Radar entries: `0`;
- Radar cron jobs: `0`.

The migration and runtime rollout therefore did not silently score production events.

## Advisor review

Supabase performance advisor reports no new P5.4 missing-foreign-key-index finding. The two new Radar indexes appear only in the unused-index informational list because the hosted Radar table intentionally has zero persistent rows.

Supabase security advisor adds `creator_radar_entries` to the RLS-enabled/no-policy informational list. This is intentional for the service-owned table: direct authenticated table privileges are revoked. There is no new P5.4 function-search-path warning. Existing project-wide warnings, including the older YouTube mutable-search-path finding and leaked-password-protection setting, remain unchanged.

## Controlled hosted score / refresh proof

The proof was run inside an explicit transaction and rolled back afterward.

The hosted database already had one canonical event with no Radar projection. Because `refresh_creator_radar()` is intentionally global, the first canary demonstrated that the worker would legitimately consume existing unscored backlog. The proof was then isolated transactionally by creating a current Radar projection for that one pre-existing event before synthetic canary events were added. This isolation state was also rolled back.

Final isolated proof used three synthetic events:

1. `TRAILER_RELEASED` / `OFFICIAL` / `CRITICAL`;
2. `THEATRICAL_DATE_CHANGED` / `CONFIRMED` / `CRITICAL`;
3. `INTERVIEW_RELEASED` / `RELIABLE_REPORT` / `NORMAL`.

Observed behavior:

- first bounded `refresh_creator_radar(2)` returned `2` and created two synthetic entries;
- second bounded `refresh_creator_radar(1)` returned `1` and completed all three synthetic entries;
- trailer scored `85` with `TRAILER_ANALYSIS`;
- theatrical-date change scored `80` with `BREAKING_EXPLAINER`;
- interview initially scored `18`;
- interview priority was then changed from `NORMAL` to `HIGH` later in the **same transaction**;
- next `refresh_creator_radar(1)` returned `1`;
- interview rescored to `28`;
- stored input snapshot recorded priority `HIGH`;
- repeat `refresh_creator_radar(100)` returned `0` once the isolated backlog was clean;
- the Radar layer did not rewrite the canonical event priority.

This directly proves the CI #319 staleness defect is fixed in the hosted database.

## Rollback verification

After rollback:

- synthetic entity rows: `0`;
- synthetic event rows: `0`;
- hosted Radar entries: `0`;
- Radar cron jobs: `0`.

No canary data or score projection persisted.

## Release decision

P5.4 engineering and hosted foundation are complete.

Unattended Radar refresh remains deliberately disabled. Enabling a recurring Radar cron is an operational activation decision, not a missing engineering requirement for this slice.

The next Phase-5 intelligence slice can add optional concise evidence-based summaries, but it must remain separate from factual verification and must not weaken the deterministic Radar projection.
