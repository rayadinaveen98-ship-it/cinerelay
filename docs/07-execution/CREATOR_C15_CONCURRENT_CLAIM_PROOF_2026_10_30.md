# CineRelay Creator Intelligence C15 — real concurrent-connection claim proof

**2026-10-30 · source-only draft, no production changes**

## Test design
C14's pgTAP assertions proved sequential idempotence. C15 adds an actual **three-session PostgreSQL race** in GitHub's disposable local Supabase database, not hosted production.

The test `tests/database/run-creator-c15-concurrency.py` executes only when both `GITHUB_ACTIONS=true` and `CINERELAY_C15_EPHEMERAL_TEST=true`, and refuses any host other than `127.0.0.1/localhost` or port other than `54322`. It requires the local `postgres` database. It makes no outbound API calls and uses only two synthetic stable channel IDs that are never onboarded.

1. Acquire the same `CINERELAY_C14_ACTIVITY_GLOBAL` transaction advisory lock C14 uses, in an independent database session, holding it for about three seconds.
2. Confirm that the lock is granted using a separate `pg_try_advisory_xact_lock` probe (no reliance on buffered client stdout).
3. Start **two simultaneous PostgreSQL client processes** attempting the C14 claim and two-unit reservation for the **same** synthetic channel, while the lock remains held. Assert both wait.
4. After release, exactly one call must return `CLAIMED` and the other `BLOCKED_ACTIVE_OR_COOLDOWN`. Quota ledger must rise by **exactly one receipt/two units**, not four.
5. A third replay must be blocked without additional spending. A different channel must be independently claimable.
6. Wrong claim tokens must fail to finalize; the matching token succeeds. A finalized success blocks immediate repeat.
7. Delete only the two fixture claims and their associated receipts from the **local disposable database** and assert the ledger returns to its starting values.

The concurrency proof runs after `supabase db start` and `supabase test db` in the `database-migrations` CI job. Source and web/Android QA run independently.

## What passing means
A successful test provides evidence of real multi-connection serialized quota and duplicate-channel claims **on ephemeral GitHub CI PostgreSQL**, stronger than sequential pgTAP tests. It does **not** prove that a production deployment has occurred, that Google Cloud has sufficient remaining quota, or that data-retention policy issues are resolved.

## Pending release gates
- C12 private storage, expiry cron, backup/log lifecycle and operator API have not been activated and validated in hosted production.
- C13/C14 server-side feature flags remain OFF. No real credentials were copied into CI.
- The dedicated YouTube API project's actual `GENERAL_READ` quota ceiling, other Google usage and reserve still require independent verification; local accounting alone is not definitive.
- The old C11 PR #109 and retained Git objects need appropriate historical YouTube API data cleanup and GitHub Support/fork/cache checks. The clean C12/C14 ancestry is not full deletion.
- A security review of Supabase service-only grants/privileged functions and a staging one-shot request with approved operator and mock provider should precede any live single-channel experiment.
- C6 public derived-metrics and cross-creator comparisons remain policy-gated and disabled.
- The existing 185 cinema YouTube source identities, notifications, app release, and APK are untouched.

## Test command in GitHub ephemeral CI
```bash
CINERELAY_C15_EPHEMERAL_TEST=true python3 tests/database/run-creator-c15-concurrency.py
```

The script intentionally **refuses local developer or production invocations** missing the GitHub CI flag. See PR #112 for C14 claim/RPC code and PR #111 for the one-shot Edge endpoint.
