# CineRelay C26 — Verification lease and daily quota clock correctness
**30 October 2026 • draft-only security hardening • no production changes**

## Risk discovered
C23 initialized `v_now := clock_timestamp()` when its function entered, **before** `SELECT ... FOR UPDATE` on the claim row. If that lock waited past `retry_after`, the comparison used a *stale* time and could accept a provider response with an expired claim. C20's quota-claim function likewise sampled the quota day and claim lease start **before** waiting on its global advisory lock; long contention near a Pacific-time quota reset could put a one-unit reservation in the wrong day.

## Fix
The additive, ordered `20261030213000_creator_intelligence_c26_lock_time_lease.sql` uses `CREATE OR REPLACE` to refine both draft C20 and C23 functions:
- C23 reads `v_lease_checked_at := clock_timestamp()` **after acquiring** the exact claim's row lock; token, receipt, state and `retry_after` are checked against that fresh timestamp, before any private identity upsert.
- After the lock wait, C23 rejects an expired identity record or one whose observation is older than the 10-minute processing window. A rejection returns false and never modifies identity or success receipt.
- C20 reads `v_now := clock_timestamp()` **after** the global C14/C20 ledger lock is acquired, so quota-day selection, existing-claim cooldown and fresh claim start use the correct post-wait time.
- Existing service-only privileges, monitoring=false, review-only constraints, atomic identity+receipt finalization, quota reservation and 28-day maximum TTL remain intact.

## Real concurrency proof (GitHub disposable Supabase only)
`tests/database/run-creator-c26-lease-expiry-race.py` uses **two PostgreSQL client connections** in GitHub CI:
1. Reserves one unit for a fixed synthetic handle; shortens its lease to 1.5 seconds.
2. Holds the real claim row lock for 3 seconds while invoking the C23 RPC with the still-current token.
3. Asserts the RPC returns false, no identity record is written, receipt remains unfinalized and original claim is still IN_FLIGHT.
4. Holds the **global C14 activity/quota lock** for 3 seconds while making another C20 identity claim, and asserts `claimed_at` is recent *after* lock release, not from before the wait.
5. Confirms existing cinema source registry unchanged; removes exactly its fixed synthetic test identities, claims and receipts.

The test refuses execution outside explicit `GITHUB_ACTIONS` + `CINERELAY_C26_EPHEMERAL_TEST=true` and loopback `127.0.0.1:54322` with local Postgres/database/user guards. It never calls Google, production Supabase, or other external services. Five Node regression checks guard post-lock SQL order and CI safety.

## Additional production read-only findings
Read-only Supabase inspection on **30 October 2026** confirms:
- `CineRelay` hosted project is ACTIVE_HEALTHY, but has **123 deployed migrations, zero C12–C26 creator migrations, no development branches**, and no deployed `cinerelay-creator-intelligence-api` or `cinerelay-creator-identity-verify` Edge Function.
- Project security advisor reports an **informational** `rls_enabled_no_policy` finding on 52 existing service-only/internal tables, not evidence that creator data is publicly accessible; it also reports a separate **WARN** about [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) not being enabled. No Auth settings changed.
- C11 historical API-result branch/PR remains reachable; real Google Cloud quota and Supabase backup/PITR/export retention remain unverified.

## Explicit limits
No SQL migration was applied to production; no Edge Functions deployed, paid staging created, historical Git refs deleted or live YouTube calls issued. The C22 APK remains the current Android beta; live Verified may still show zero. This fix strengthens future readiness but does **not** clear C25's deliberately blocked release and live-pilot gates.

## Local checks
```sh
npm run test:youtube
npm run creators:rollout-audit
npm run creators:pilot-check # exit 2 until explicit independent approvals
```
Run the real C26 concurrency test only inside GitHub's ephemeral Supabase database CI step. See [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter) and [Supabase password security](https://supabase.com/docs/guides/auth/password-security).
