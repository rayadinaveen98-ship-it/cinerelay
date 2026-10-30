# CineRelay C24 — Real local PostgreSQL identity-flow integration
**30 October 2026 · source-only draft · no hosted database, provider calls or billing**

## Goal

Verify the actual C20 manual official-handle HTTP handler against **real** C19/C20/C23 PostgreSQL functions in disposable GitHub CI, before enabling any hosted operation. C22 Android already has a protected Verified tab; a new UI APK does not replace this backend check.

## Implemented

`tests/database/run-creator-c24-identity-db-flow.mjs` routes actual `Request` objects through `runC20IdentityRequest` and actual `Response` objects back to tests. Operator authentication is deliberately **simulated**, and YouTube `channels.list?forHandle` is **mocked**, with no Google API key or external network call. It uses **real SQL** for:

- `creator_c20_claim_and_reserve_identity`: service-role atomic one-unit quota reservation using the shared C14/C20 advisory lock.
- `creator_c23_commit_verified_identity`: matching lease/claim token check, private 27-day C19 identity upsert, and successful receipt finalization **in one database transaction**.
- `creator_c20_finalize_identity`: real failure-only claim and one-unit quota receipt finalization.

The CI test confirms:
1. Feature disabled and fake non-operator denied **before** spending quota.
2. Successful one-shot official identity results in **one** reserved unit, pending-review only, monitoring and metrics OFF, 27-day TTL.
3. Immediate replay receives 409 without a second provider call or quota charge.
4. Mock provider 403 produces no private identity row, does record a FAILED claim and preserves the charged unit, without leaking provider error body.
5. A delayed response whose claim token has been replaced **cannot** commit the identity or finalize a newer claim, though its pre-reserved unit remains counted.
6. The existing `source_identities` table count stays identical, and all synthetic fixture identities, claims and receipts are deleted from disposable CI database.

The script refuses execution unless `GITHUB_ACTIONS=true`, `CINERELAY_C24_EPHEMERAL_TEST=true`, PostgreSQL uses loopback host `127.0.0.1:54322`, database `postgres`, and user `postgres`. It calls only locally provisioned GitHub-CI Supabase; it does not connect to the production project. The C24 step runs **after** C15 real claim-concurrency and C17 real activity-flow tests in the main `database-migrations` CI job, before database lint and teardown.

## What this does NOT prove

- A temporary local database is not a **hosted Supabase staging deployment**.
- Mocked operator authorization is not proof of hosted JWT/operator role wiring.
- Mocked YouTube responses are not proof that the actual Google Cloud project has any spare quota.
- Local row deletion is not proof of production backup, PITR snapshot, logs or historical Git-object deletion.
- `C19/C20/C23` migrations and Edge endpoints remain **unapplied** to production. Both C20 feature flags remain off; **C22 Verified count may still read zero**, appropriately.
- The 94 provisional Discover leads are research-only. No automatic enrollment, performance metrics, subscriber tracking, hourly polling, notifications or comparisons have been authorized.
- This is not an Android APK update. The latest Android beta remains C22.

## Launch gate — manually reviewed, not bypassed by green CI

| Requirement | Gate |
|---|---|
| Old C2/C10/C11 YouTube API data from Git branches, PR refs, caches, forks and old objects reviewed and remediated | **BLOCKED** |
| Actual Cloud project YouTube Data API daily quota and current shared consumption, with reserve for existing 185 cinema sources | **UNVERIFIED** |
| Hosted Supabase plan-specific backup/PITR/log/export deletion and 28-day TTL behavior | **UNVERIFIED** |
| Operator-approved candidate handle, verified source provenance, policy / API compliance | **PENDING** |
| Separate hosted staging environment, cost approved if applicable, with synthetic-only test first | **NOT PROVISIONED** |
| Live creator monitoring and derived cross-channel comparisons | **OFF / NOT AUTHORIZED** |

Existing `npm run creators:release-check` remains deliberately blocked. C24 creates **no new hosted resource**, charges **no real YouTube API quota**, and does not alter existing source identities or installed Android app.

## Reproduce

```bash
# In GitHub Actions with disposable Supabase local postgres already started:
CINERELAY_C24_EPHEMERAL_TEST=true \
PGHOST=127.0.0.1 PGPORT=54322 PGDATABASE=postgres PGUSER=postgres \
node tests/database/run-creator-c24-identity-db-flow.mjs
```

Related: C22 Android beta PR #120, C23 atomic commit PR #121. Supabase local database and pgTAP testing documentation: https://supabase.com/docs/guides/local-development/testing/overview
