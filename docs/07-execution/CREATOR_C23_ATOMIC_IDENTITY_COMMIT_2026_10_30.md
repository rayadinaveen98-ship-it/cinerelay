# CineRelay C23 — claim-bound atomic official identity verification

**30 October 2026 · source-only draft; no production database or YouTube calls**

## Why C23 exists
C20 submitted a provider-verified channel ID to `creator_intelligence_identity_evidence` using an independent `upsert`, then called a second `creator_c20_finalize_identity` RPC. If the network stalled beyond the 10-minute claim lease, the old provider reply could overwrite a newer identity **before** the old claim finalization was rejected. Returning HTTP 503 did not repair that write.

C23 replaces that sequence with one service-only Postgres function, `creator_c23_commit_verified_identity(handle, token, receipt, record)`. A single transaction:
1. Validates the exact 14 identity fields, 27–28-day freshness, official UC/UU correspondence and permanently disabled monitoring/metrics, with no unknown approval attributes.
2. `SELECT ... FOR UPDATE` locks the exact handle claim row. The token, receipt ID, in-flight state **and unexpired 10-minute lease** must all match. An expired or replaced token returns false **before any identity write**.
3. Confirms the correct, already-reserved **one-unit** YouTube GENERAL_READ quota receipt (without issuing a second charge).
4. Inserts or updates the private C19 identity only if an existing UC channel ID already has the **same** reviewed handle. A different handle cannot silently take over another channel ID.
5. Updates claim state to `SUCCEEDED` and receipt status to HTTP 200 inside the **same Postgres transaction**. Any error rolls everything back, so no partial identity can be left visible if finalization fails.

The Edge function now calls only that RPC for a successful identity response; **no direct table upsert** remains in C20's success path. For provider errors or malformed API replies, it still invokes the older **failure-only** finalize routine so charged quota and cooldown remain accounted for. A rejected stale commit does not attempt another finalization.

## Validation
- C23 pgTAP test: 18 tests against disposable CI PostgreSQL. Cases: service-role permissions, a wrong token, a stale/replaced token, no private write or receipt status on rejection, successful current-token atomic write, pending-review state, one-time finalization, replay prevention and monitoring activation refusal.
- C23 Node contracts: strict SQL ordering, no direct Edge upsert, denial on stale commit, success without old finalizer, and failure handling without leaking provider payload.
- Existing C20 mocked HTTP tests adapted to transaction-based success, preserving C22 Android Verified behavior.

## Still blocked
C23 adds **no APK UI changes**, because C22 already reads protected verified identities if available. It does **not deploy** the private C19/C20/C23 database functions, install the new Edge endpoint, or enable quota-spending feature flags. The Android verified count may remain zero. The old C2/C10/C11 Git history, actual Google quota, hosted backup/PITR/log deletion and editorial approval remain blockers. No hosted staging or other potentially billable services were created. Existing 185 cinema YouTube source identities are untouched.

A future hosted implementation must audit actual account backup retention, provision a cost-approved isolated test project, verify owner quota in Google Cloud and run a manual one-channel trial. C23 alone does not constitute production or policy readiness.
