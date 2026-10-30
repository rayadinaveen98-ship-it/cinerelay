# CineRelay C17 — Real temporary database + simulated YouTube integration

**30 October 2026 · draft, no new hosted environments or production changes**

## Confirmed state before C17
- PR #114 / C16 passed all eight GitHub workflows (web, Edge, DB, Android and release-specific checks).
- Connected Supabase CineRelay production project is `dnqaejljfzwhsainpdxb`; its read-only branch listing showed **zero development/staging branches** at the time of review.
- New C13/C14 one-shot ingest and C12 private creator observation API have **not been deployed**.
- Hosted Supabase staging branches may incur compute charges. **C17 does not create one** or perform any production schema, Edge, secrets or API changes.

## Scope of the new integration test
`tests/database/run-creator-c17-private-flow.mjs` calls the **actual C16 request-flow module** with real `Request` and `Response` objects. Its operator-auth and Google `channels.list`/`playlistItems.list` responses are **simulated**. Instead of mocking all database methods, it connects to GitHub CI's disposable local Supabase Postgres instance to exercise:

1. Real service-role `creator_c14_claim_and_reserve_activity` RPC, quota record and claim token.
2. Real C12 private observation insert/upsert with 28-day expiry trigger and hidden subscriber redaction.
3. Real C14 token-bound finalize RPC for success, then blocking the next claim without another quota charge.
4. A distinct second channel with hidden subscriber count.
5. A simulated provider 403: no private observation, **failed** claim finalized, two units still charged, provider payload excluded from response.
6. Existing `source_identities` unchanged.
7. Precise local fixture cleanup: temporary observation rows, claim rows, and associated quota receipts removed.

Safety: the test **refuses any invocation outside GitHub Actions with explicit `CINERELAY_C17_EPHEMERAL_TEST=true`**, only targets loopback localhost:54322 and database `postgres`, requires fixture identities to be absent, and contains **no real provider credential or network fetch**. It runs after C15's independent two-connection advisory-lock race and pgTAP, before CI stops temporary Supabase.

## Interpreting success correctly
- Green C17 demonstrates actual Postgres quota/retention integration for a simulated-provider HTTP request, under disposable CI. It is stronger than C16 mocks but **not** a hosted end-to-end test and does not validate real Google Cloud API usage or authentication to hosted Supabase.
- Existing CineRelay production source registry and 185-source baseline remain unchanged.
- C13 and C14 enable flags remain OFF. No recurring collection, channel enrollment, performance comparison, notifications, APK or release deployment.

## Required before hosted staging
1. Explicit authorization to provision a billed persistent or ephemeral Supabase staging branch, or provision an existing no-cost isolated staging project. Never accidentally point staging tests at the production project.
2. Verify C12 private table TTL, operator read API, service-role isolation, hourly deletion, **backup/log/export** lifecycle, and data-access permissions in staging.
3. Reconcile older C11 public YouTube metadata committed to Git history/PR refs; verify remote cache/forks/objects cleanup. C12's clean branch is insufficient.
4. Verify **actual Google Cloud quota** and 185-source operating reserve independently from its self-reported database ledger; do not enable C13/14 flags based on guessed headroom.
5. Audit official YouTube API data retention, human editorial approval of the pilot UC ID, and separate derived-metrics authorization before any competitive comparison.
6. Staging trial only after code/security review. Its first run must use mock provider data and no production credentials.

**Gate status: BLOCKED for hosted deployment and real monitoring.** C17 source-only CI does not satisfy the remaining gates.

## Commands (CI only)
```sh
CINERELAY_C17_EPHEMERAL_TEST=true PGHOST=127.0.0.1 PGPORT=54322 \
  node tests/database/run-creator-c17-private-flow.mjs
```

Official references: https://supabase.com/docs/guides/deployment/branching and https://supabase.com/docs/guides/functions/unit-test
