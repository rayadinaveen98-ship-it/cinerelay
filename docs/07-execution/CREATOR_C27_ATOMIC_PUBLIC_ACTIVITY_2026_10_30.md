# CineRelay C27 — Close C16 activity save-before-finalize race
**30 October 2026 · draft only · zero live provider calls and zero hosted changes**

## Critical integration gap found
C20/C23 protects **official identity** records with an atomic current-token store-and-finalize RPC. However, the independent C16 public **activity** ingest still called `admin.from('creator_intelligence_activity_observations').upsert(...)` **before** `creator_c14_finalize_activity_claim`. A delayed/expired provider response could overwrite a valid newer observation, then fail finalization. The C17 CI test exercised that same unsafe order against local PostgreSQL; it never corrected the live Edge wiring.

## C27 fix
- Draft ordered migration `20261030223000_creator_intelligence_c27_atomic_public_activity.sql` installs service-only, `SECURITY DEFINER` RPC `creator_c27_commit_public_activity(channel_id,claim_token,receipt_id,record)`.
- The RPC accepts **exactly** the seven existing C13 public-data record fields; it validates channel ID, nullable subscriber value, video count, hidden-subscriber redaction, <=3 video uploads and C12's expiry. Arbitrary provider JSON or creator monitoring/approval cannot be stored.
- It locks the C14 channel claim, reads `clock_timestamp()` **after the row lock**, rejects replaced tokens, mismatched quota receipt, non-IN_FLIGHT claims or elapsed leases **before any observation write**.
- It checks the already-reserved **two-unit** `GENERAL_READ` YouTube quota receipt, performs the C12 private upsert and marks both claim and receipt **SUCCEEDED** in the **same database transaction**. Any exception rolls back the entire write.
- C16 Edge no longer upserts the private observation directly. Success requires the one C27 atomic RPC; the old C14 finalizer remains **failure-only** for provider, parsing and database exceptions. A stale/false commit returns error without finalizing anyone else's claim. No new API calls or quotas.
- Existing 28-day record age and the 29-day C12 hard retention/automatic purge remain unchanged.

## Regression coverage
- **21 pgTAP assertions** cover RPC privilege, first two-unit claim, wrong/replaced token rejection, no observation and no receipt finalization after rejection, valid atomic success, replay rejection, forbidden monitoring fields and expired claim rejection.
- The C16 HTTP mocks now assert `commit`, not `save` then `finalize` on success.
- C17's real disposable-Postgres HTTP integration now calls the C27 RPC for successful writes; providers and auth remain simulated.
- Seven source/HTTP assertions explicitly prohibit returning to a direct C12 Edge upsert.
- Runs under existing free GitHub CI / local Supabase services. No new paid staging branch.

## Boundaries
Connected CineRelay production had **123 migrations and no C12-C27 creator migrations** or new identity/activity Edge functions deployed at latest read-only check. This PR does **not** change production, the existing 185 cinema source IDs, Git historical snapshot objects, provider secrets, Cloud quota usage, or the C22 installed Android beta. Monitoring and cross-channel comparisons stay OFF.

The C25 rollout/pilot gates remain blocked pending historical Git cleanup approvals, actual Google quota, plan-specific hosted backup/PITR/log retention, approved operator, and independent staging signoff. Even green C27 tests do **not** authorize live release.
