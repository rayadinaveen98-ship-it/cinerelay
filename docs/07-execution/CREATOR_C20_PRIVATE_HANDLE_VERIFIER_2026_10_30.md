# CineRelay C20 — Manual official identity verification into private TTL storage
**30 October 2026 · source-only draft, not deployed**

## What changed
C19 removed stale C2/C10 YouTube API identity JSON bundles and replaced the Pilot Review with a protected private identity queue. C20 adds an **isolated, one-shot server-side identity verification writer**, rather than restoring any provider-to-Git workflow.

1. **Dedicated Edge endpoint:** `cinerelay-creator-identity-verify`, disabled by default with **two independent** environment flags, `CINERELAY_C20_IDENTITY_VERIFY_ENABLED=true` and `CINERELAY_C20_ATOMIC_QUOTA_ENABLED=true`. JWT gateway validation and fresh Supabase Auth active operator database lookup are required. Only a small POST body `{ "handle": "@reviewedhandle" }` and `x-cinerelay-identity-intent: ONE_SHOT_OFFICIAL_IDENTITY` are accepted; there is no browser control or scheduler.
2. **Server-side candidate scope:** `CINERELAY_C20_REVIEWED_CANDIDATES_JSON` lists **at most 20 independently reviewed handles**, plus name, locale, provisional category/size and HTTPS source provenance. A separate `CINERELAY_C20_ALLOWED_UNTIL` UTC deadline must be within seven days of each invocation. The client cannot supply/override title, ID, category, approval or quotas. A missing/invalid/duplicate allowlist fails closed before requesting YouTube. No candidates are hardcoded in source.
3. **Atomic quota/idempotency:** `creator_c20_claim_and_reserve_identity` serializes handle claims with the same Postgres advisory lock as C14, atomically charging **exactly one unit before the official request** to the shared `GENERAL_READ` ledger. Distinct case variants of the same handle cannot evade the claim. An active claim, 24-hour successful cooldown, fresh (more than one day remaining) C19 identity or exceeded quota reserve block requests. Failed calls are charged and have 15-minute cooldown. This is only the **local** quota ledger, not confirmation of Google Cloud's actual remaining quota.
4. **One official public call:** `channels.list?forHandle=...` using `part=snippet,contentDetails`, with a restrictive `fields` selector. No search API, videos, statistics, subscriber counts, uploads snapshots or external scrapers. Validate exactly one official UC identity and its corresponding UU uploads playlist, a nonempty title and the approved source handle. Invalid data fails closed.
5. **C19 private write:** write only the above verified identity and independently vetted candidate context to `creator_intelligence_identity_evidence`. Set `review_state=REVIEW_PENDING`, monitoring and metrics to false, and expiry **27 days from observation**, below the C19 28-day max, with hourly delete. No new API JSON in Git, no browser bundle, no analytics/notification/creator enrollment. Failures never return provider JSON or tokens.
6. **Receipt finalization:** token-bound, one-time `creator_c20_finalize_identity` records success/failure in existing non-sensitive quota ledger and refuses to report success unless finalization succeeds. Claim rows are service-only with max 28-day expiry and hourly purge.
7. **Verification:** 13 mocked complete HTTP flow scenarios (success/denials/race/provider errors/DB errors/TTL), plus 17 pgTAP checks on claim privilege, one-unit reservation, duplicates, finalization and expiry. Standard CI type-checks the Deno Edge function. No live Google calls are made in CI.

## Server-only settings — **DO NOT ENABLE YET**
| Secret/config | Requirement |
|---|---|
| `CINERELAY_C20_IDENTITY_VERIFY_ENABLED` | unset/false |
| `CINERELAY_C20_ATOMIC_QUOTA_ENABLED` | unset/false |
| `YOUTUBE_API_KEY` | dedicated server-only API key restricted to YouTube Data API; never sent to browser |
| `CINERELAY_C20_REVIEWED_CANDIDATES_JSON` | operator-approved, max 20 entries, not populated by Git-snapshotted old API facts |
| `CINERELAY_C20_ALLOWED_UNTIL` | UTC deadline no farther than seven days ahead |
| `CINERELAY_C20_VERIFIED_GENERAL_READ_DAILY_LIMIT` | owner-verified actual project budget, integer 2–10000 |
| `CINERELAY_C20_GENERAL_READ_RESERVE` | at least 1000 units set aside for existing services |
| Supabase `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | server-side only, provided only in approved hosted deployment |

The identity-verification key in prior GitHub Actions is **not automatically the Supabase Edge key**. Do not copy or share a key in a chat, Git repo, frontend, UI or logs.

## Important release blockers
- **No staging or production deployment:** Neither the C19 private identity table nor the new C20 claims/RPC/Edge code has been applied to a hosted instance. Running a real verification before verified storage, backups and operator access would be unsafe.
- **Historical API data:** Old C2/C10/C11 commit objects and PR refs remain. Removing files from C19's branch tip does not purge GitHub historical objects/caches/forks. Git history remediation needs separate owner approval.
- **Backup retention:** Verify Supabase hosted backup/PITR/log/export deletion; a row-level TTL and hourly purge alone do not establish full deletion.
- **Actual Google quota:** Check Google Cloud quotas and daily usage for this exact project, including other sources and clients. The local ledger is not a Google quota attestation.
- **Candidate suitability:** official identity verification ≠ permission to enroll a creator, monitor channels or publish derived cross-channel comparisons. The operator approval and policy checks remain pending.
- **No functional consumer changes:** The 94 research leads remain, the protected Pilot remains empty until authorized fresh verification, and the 185 existing CineRelay cinema sources are untouched.

## Run offline checks
```sh
npm run test:youtube
npm run creators:audit
npm run creators:release-check  # deliberately returns blocked
```
Official docs: https://developers.google.com/youtube/data/reference/rest/v3/channels/list and https://supabase.com/docs/guides/functions/auth

**Do not merge/deploy C20 until hosted review, quota attestation, approved reviewed candidates and history/retention remediation.**
