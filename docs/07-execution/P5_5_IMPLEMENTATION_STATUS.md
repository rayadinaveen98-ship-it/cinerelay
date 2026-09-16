# P5.5 Implementation Status — Evidence-Backed Summaries

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING / NO HOSTED P5.5 DEPLOYMENT**

Branch:

`phase-5/evidence-backed-summaries`

Parent:

`phase-5/creator-radar` @ `8a6422559cfa2852a00eaba549c866669b318d8f`

Implemented so far:

- service-owned `event_summary_entries` projection keyed by canonical event;
- `READY | WITHHELD` lifecycle with DB invariant that READY requires evidence;
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
- 40 pgTAP assertions covering withholding, ready summaries, conflict surfacing, evidence ordering, RLS/privileges, bounded refresh, same-transaction stale rebuild and idempotency.

Next gate:

1. open stacked draft PR on P5.4;
2. run all four CineRelay CI jobs;
3. fix migration/pgTAP/type-check issues without weakening the evidence contract;
4. only after fresh CI is green, apply the migration to hosted Supabase;
5. reconcile Supabase's canonical migration version into Git;
6. rerun canonical CI;
7. deploy exact CI-built summary worker + updated scheduler artifact;
8. verify hosted RLS/privilege/zero-side-effect/advisor state;
9. run a controlled transactional summary/provenance/stale-refresh/idempotency proof;
10. keep unattended summary cron disabled until separately approved operationally.

Design:

`docs/07-execution/PHASE5_P5_5_EVIDENCE_BACKED_SUMMARIES_DESIGN.md`
