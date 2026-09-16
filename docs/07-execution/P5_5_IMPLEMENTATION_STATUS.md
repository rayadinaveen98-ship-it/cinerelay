# P5.5 Implementation Status — Evidence-Backed Summaries

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / CORRECTED CI PENDING / NO HOSTED P5.5 DEPLOYMENT**

Branch:

`phase-5/evidence-backed-summaries`

Parent:

`phase-5/creator-radar` @ `8a6422559cfa2852a00eaba549c866669b318d8f`

Draft PR:

`#15 — Phase 5.5: evidence-backed concise summaries`

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
- 42 pgTAP assertions covering withholding, ready summaries, conflict surfacing, evidence ordering, RLS/privileges, bounded refresh, same-transaction stale rebuild and idempotency.

## CI #327 bookkeeping finding

Fresh CI #327 successfully applied the P5.5 migration and passed intelligence, web and Edge—including the new summary worker and deployment-native bundle. The P5.5 pgTAP file executed **42 behavior assertions and all 42 passed**, but its TAP plan declared 40, so the database job correctly failed on plan mismatch.

No production SQL or runtime logic changed. The test plan was corrected from 40 to 42.

Next gate:

1. run corrected all-four-job CineRelay CI;
2. require all 42 P5.5 assertions green;
3. only after corrected CI is green, apply the migration to hosted Supabase;
4. reconcile Supabase's canonical migration version into Git;
5. rerun canonical CI;
6. deploy exact CI-built summary worker + updated scheduler artifact;
7. verify hosted RLS/privilege/zero-side-effect/advisor state;
8. run a controlled transactional summary/provenance/stale-refresh/idempotency proof;
9. keep unattended summary cron disabled until separately approved operationally.

Design:

`docs/07-execution/PHASE5_P5_5_EVIDENCE_BACKED_SUMMARIES_DESIGN.md`
