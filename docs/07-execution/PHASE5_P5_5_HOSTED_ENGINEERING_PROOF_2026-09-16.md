# Phase 5.5 Hosted Engineering Proof — Evidence-Backed Summaries

Date: 2026-09-16

State: **HOSTED FOUNDATION VERIFIED / UNATTENDED SUMMARY CRON DISABLED**

## Canonical migration

Hosted Supabase assigned:

`20260916123420_evidence_backed_summaries`

Git was reconciled to that exact migration version without changing the SQL blob.

Canonical hosted-ledger head:

`488f976c5512ed73459694b1b3e62808a04ba992`

## Canonical CI

CineRelay CI #330 / run `35096783409` passed all four jobs on the hosted-ledger head:

- intelligence/connectors — PASS;
- web console — PASS;
- Edge type-check + deployment-native bundle — PASS;
- fresh migrations + all 42 P5.5 pgTAP assertions + database lint — PASS.

The earlier CI #327 failure was TAP bookkeeping only: all 42 behavior assertions passed while the file declared `plan(40)`. The plan was corrected to 42; no production summary SQL or runtime behavior changed.

## Exact deployment artifact

Artifact:

`cinerelay-edge-deploy-bundle`

- artifact id: `10445923788`;
- artifact digest: `sha256:4be347048f8757aebbcb2fa5b33da10e5e9da50d269a613b1c33bc4749e2de52`.

Exact bundled-file hashes inspected before deployment:

- `evidence-summary-worker/index.js`: `7bcdf80f41eaacf4793a82f96bba5e95881b2aba2688c68bfd51569b795c78d8`;
- `cinerelay-scheduler-dispatch/index.js`: `44403ed7d6a6ee31180d9c524eaf05f81b59fb3264473eb736fe48559e2c86bb`.

Only those exact canonical-CI bundles were deployed.

## Hosted runtime

- `evidence-summary-worker` — ACTIVE v1 — id `81d2c0dc-cf8c-4175-9153-a4b988f0915b` — runtime SHA `bb3cb8af2067a1e56d17ba9645cd6270ca14371be727700a05519132640ff641`;
- `cinerelay-scheduler-dispatch` — ACTIVE v9 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `dc9843d5340e054d3b3923c2ecb1f65013e59f36c58b832f253a073fc5ca6df0`.

No summary cron was created.

## Hosted security / zero-side-effect verification

Before the canary:

- `event_summary_entries` RLS enabled;
- `event_summary_evidence` RLS enabled;
- authenticated direct SELECT denied on both tables;
- authenticated `event_summary_compute(uuid)` execution denied;
- authenticated `refresh_event_summaries(integer)` execution denied;
- both summary functions have explicit `search_path=pg_catalog, public, extensions`;
- persistent summary entries: `0`;
- persistent summary evidence rows: `0`;
- summary cron jobs: `0`.

Supabase advisors showed no new P5.5 missing-foreign-key warning and no new function-search-path warning. The two new summary tables appear only in the expected RLS-enabled/no-policy informational finding because they are deliberately service-owned and normal-client table privileges are revoked. The new indexes are reported unused while hosted summary tables contain zero rows.

## Controlled hosted canary

The proof ran inside one database transaction and rolled back completely.

Because hosted CineRelay already had one real canonical event without a summary projection, the proof first refreshed that existing backlog **inside the transaction only**. This isolated the synthetic assertions without persisting any real summary row.

Synthetic fixture:

1. active OFFICIAL / CRITICAL trailer with PRIMARY official evidence, CORROBORATING trade evidence and one CONFLICTING trade item;
2. active CONFIRMED / CRITICAL theatrical-date change with PRIMARY official evidence;
3. active RELIABLE_REPORT / NORMAL interview with no linked evidence.

Observed sequentially:

- baseline existing backlog refresh: `1` inside the transaction;
- first synthetic bounded refresh: `2`;
- second synthetic bounded refresh: `1`;
- trailer status: `READY`;
- trailer evidence count: `3`;
- trailer conflicting evidence count: `1`;
- trailer provenance rows: `3`;
- trailer ordinal 1 role: `PRIMARY`;
- trailer ordinal 1 source: official Tier-1 source;
- trailer text explicitly included `Verification: Official`, evidence count, lead source, and `Conflicting evidence retained: 1`;
- date-change status: `READY` with initial evidence count `1`;
- no-evidence interview status: `WITHHELD` and summary text remained null.

### Same-transaction canonical-headline change

The trailer canonical headline was changed later in the same transaction.

- next bounded refresh returned `1`;
- derived summary text rebuilt from the corrected canonical headline;
- stored input snapshot recorded the corrected headline;
- canonical `events.summary` sentinel remained unchanged.

### Same-transaction evidence addition

A second CORROBORATING evidence item was linked to the date-change event later in the same transaction.

- next bounded refresh returned `1`;
- summary evidence count changed `1 -> 2`;
- persisted summary-provenance rows changed `1 -> 2`.

### Idempotency

After all inputs were current:

- repeat `refresh_event_summaries(500)` returned `0`.

This proves the generator is evidence-driven, stale-aware and duplicate-free without relying only on transaction timestamps.

## Rollback verification

After rollback:

- persistent summary entries: `0`;
- persistent summary evidence rows: `0`;
- synthetic entity rows: `0`;
- synthetic event rows: `0`;
- synthetic raw items: `0`;
- summary cron jobs: `0`.

## Result

P5.5 is **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED SUMMARY CRON DELIBERATELY DISABLED**.

The deterministic V1 evidence contract is now proven end-to-end. Model-assisted wording remains explicitly deferred and must preserve this same provenance, withholding, stale-refresh and canonical-fact separation contract if introduced later.
