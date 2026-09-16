# P5.5 Implementation Status — Evidence-Backed Summaries

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED SUMMARY CRON DELIBERATELY DISABLED**

Branch:

`phase-5/evidence-backed-summaries`

Parent:

`phase-5/creator-radar` @ `8a6422559cfa2852a00eaba549c866669b318d8f`

Draft PR:

`#15 — Phase 5.5: evidence-backed concise summaries`

Implemented:

- service-owned `event_summary_entries` projection keyed by canonical event;
- `READY | WITHHELD` lifecycle with DB invariant that READY requires linked evidence;
- separate `event_summary_evidence` provenance snapshots;
- deterministic V1 wording from canonical headline + verification + evidence metadata;
- no external model/provider dependency;
- explicit conflicting-evidence surfacing;
- up to five ranked provenance rows per summary;
- evidence signatures covering role, weight, content fingerprint, source authority/name and URL;
- bounded `refresh_event_summaries(limit)` with `FOR UPDATE SKIP LOCKED`, max 500;
- input-driven stale detection for canonical headline/state/evidence changes;
- same-transaction stale safety plus `clock_timestamp()` generation time;
- no writes back to canonical `events.summary` or other factual event fields;
- RLS + service-role-only tables/functions;
- internal `evidence-summary-worker` using the existing internal secret;
- scheduler allow-list action `evidence-summary`, with no cron enabled;
- CI type-check/deployment-native bundle coverage;
- 42 pgTAP assertions covering withholding, ready summaries, conflict surfacing, evidence ordering, RLS/privileges, bounded refresh, same-transaction stale rebuild and idempotency.

## CI history

CI #327 successfully applied the P5.5 migration and passed intelligence, web and Edge—including the new summary worker and deployment-native bundle. All 42 P5.5 behavior assertions passed, but the TAP file declared `plan(40)`, so the database job correctly failed on plan mismatch.

No production SQL or runtime behavior changed. The TAP plan was corrected to 42.

Corrected CI #329 / run `35096327569` passed all four jobs.

## Canonical hosted migration

Supabase assigned:

`20260916123420_evidence_backed_summaries`

Git was reconciled to the exact hosted version without changing the SQL blob.

Canonical hosted-ledger head:

`488f976c5512ed73459694b1b3e62808a04ba992`

Canonical CI #330 / run `35096783409` passed all four jobs, including all 42 P5.5 assertions and database lint.

## Exact deployment artifact

`cinerelay-edge-deploy-bundle`

- artifact id: `10445923788`;
- digest: `sha256:4be347048f8757aebbcb2fa5b33da10e5e9da50d269a613b1c33bc4749e2de52`.

Hosted runtimes from that exact artifact:

- `evidence-summary-worker` — ACTIVE v1 — id `81d2c0dc-cf8c-4175-9153-a4b988f0915b` — runtime SHA `bb3cb8af2067a1e56d17ba9645cd6270ca14371be727700a05519132640ff641`;
- `cinerelay-scheduler-dispatch` — ACTIVE v9 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `dc9843d5340e054d3b3923c2ecb1f65013e59f36c58b832f253a073fc5ca6df0`.

## Hosted proof

Security/zero-side-effect verification passed:

- both summary tables have RLS;
- authenticated direct SELECT denied;
- authenticated summary compute/refresh execution denied;
- explicit function search paths;
- 0 persistent summary entries before and after proof;
- 0 persistent summary-evidence rows before and after proof;
- 0 summary cron jobs.

Advisor review found no new P5.5 missing-FK or function-search-path regression.

Controlled rollback-safe canary proved:

1. existing real-event backlog was baselined inside the transaction only;
2. bounded synthetic refresh processed `2`, then `1`;
3. evidence-backed trailer became `READY` with 3 provenance rows, official PRIMARY evidence first, and one conflict explicitly surfaced;
4. evidence-backed date change became `READY`;
5. no-evidence interview became `WITHHELD` with null summary text;
6. same-transaction canonical-headline update caused exactly one stale refresh and rebuilt summary/snapshot from the corrected headline;
7. canonical `events.summary` remained unchanged;
8. same-transaction evidence addition caused exactly one stale refresh and changed evidence/provenance count `1 -> 2`;
9. repeat refresh returned `0`;
10. rollback removed all synthetic rows and transaction-local baseline projections.

No production summary cron is enabled.

Hosted proof:

`docs/07-execution/PHASE5_P5_5_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

Design:

`docs/07-execution/PHASE5_P5_5_EVIDENCE_BACKED_SUMMARIES_DESIGN.md`
