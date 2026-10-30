# CineRelay C14 — Atomic creator activity claims and release checklist
**30 October 2026 · draft only / no production deployment**

## Why C14 exists
The C13 endpoint checked whether an observation was recent, then reserved quota in a separate transaction. Two concurrent operator requests could both observe no recent data and each spend quota. C14 places the **per-channel claim, 24-hour successful cooldown, and two-unit provider quota pre-reservation in one Postgres transaction** before either YouTube request.

## Implemented
- `creator_intelligence_activity_claims`: private service-only, RLS-enabled claim table. It stores a stable UC identity, random claim token, quota receipt ID, claimed time, retry deadline and status **but no public subscriber/video metadata**.
- A global transaction-scoped Postgres advisory lock serializes all C14 claim attempts. New requests fail closed when the channel is already claimed/in cooldown or a C12 observation is less than 24 hours old. Only then can a verified budget reserve **two** general-read units atomically.
- Successful one-shot audits get a 24-hour repeat block; failed attempts stay blocked for 15 minutes. Claims in progress block for at least 10 minutes. All claim records expire by 28 days and have an hourly database deletion job.
- Finalization requires the exact claim token, channel ID and reserved quota ledger receipt; only the holder can transition `IN_FLIGHT` to `SUCCEEDED` or `FAILED`. The non-sensitive quota ledger records final outcome; reservations are never refunded on errors.
- The existing C13 Edge Function now uses the C14 atomic RPC and refuses to run unless **both** `CINERELAY_C13_ACTIVITY_INGEST_ENABLED=true` **and** `CINERELAY_C14_ATOMIC_CLAIM_ENABLED=true` are configured by an authorized operator. Both default to OFF.
- Identity allowlist, user token + active operator check, exact official channel ID and uploads playlist, one-shot request intent, body cap, 2-call maximum, private 28-day observation TTL and no logging of API credentials remain intact.
- Added pgTAP tests for service-only privileges, replay/collision blocking, precharged quota and finalize-token protections, and Node contracts enforcing the order of claim before provider network.
- No production queries, deployments, schema changes, APK, creator enrollment, scheduled monitoring, or YouTube API calls were made while implementing C14.

## Go/no-go — still open
1. **Google quota:** confirm actual Cloud project quota for the dedicated API key, accounting for external/manual usage, and verify existing CineRelay service reserve. A Postgres ledger is NOT an authoritative Google Cloud quota report.
2. **Retention and Git history:** C11's raw, dated public API metadata in its old Git branch/PR remains a clean-up and policy review issue; a clean C12 branch alone did not erase remotely reachable commits. Supabase backup/log/export retention must be independently reviewed.
3. **C12 production deployment:** not yet reviewed or applied; the service-only table/cron and protected operator read endpoint must pass hosted validation before private ingest can be enabled.
4. **Operator eligibility:** the new UC IDs were API identity-verified but never editorially admitted. Time-limited allowlist + human approval must be reviewed independently.
5. **Cross-channel analytics:** the C6 comparison feature stays disabled pending its separate YouTube API Services derived-metrics authorization.
6. **Concurrency test:** the pgTAP tests verify repeated claims in one transaction. True multi-connection stress against a hosted staging database remains pending and is a release gate.

## Code
- `supabase/migrations/20261030170000_creator_intelligence_c14_atomic_claim.sql`
- `supabase/tests/database/creator_intelligence_c14_atomic_claim.test.sql`
- `supabase/functions/cinerelay-creator-activity-ingest/index.ts`
- `tests/youtube-connector/run-creator-c14-atomic-claim.mjs`

No key is ever stored in source files. Public YouTube facts remain outside Git and source bundles. Developer policy and quota details:
https://developers.google.com/youtube/terms/developer-policies
https://developers.google.com/youtube/data/determine_quota_cost
