# CineRelay C12 — Private, expiring YouTube public activity evidence
**2026-10-30 — DRAFT / not deployed / retention review required**

## Why C12 exists
Official [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies) section III.E.4 constrain non-authorized public API Data, including subscribers/public metadata, to a 30-day refresh/delete window. Public Git snapshots committed in C11 cannot reliably expire or be deleted from permanent Git history.

**C12 does not claim previous Git commits were purged**. GitHub may retain commit objects, PR refs, archived artifacts, forks or caches after a branch reset. Manual history remediation, repository/fork verification, and potentially GitHub Support are a release blocker. Also review prior C2/C10 public channel identity metadata stored in Git; those records carry their own storage/refresh obligations.

## Delivered in source
- Draft isolated migration `supabase/migrations/20261030110000_creator_intelligence_c12_activity_retention.sql`: service-role-only YouTube public channel observation table plus security-invoker exact-decimal view, RLS, no anon/authenticated direct read, valid 20-character UC identities, max 3 public video references, hidden-subscriber redaction, insert/update time validation.
- Per-row expiry **at most 29 days** after observation, with separate hourly pg_cron deletion so an hourly purge delay does not cross the standard 30-day retention limit. The Edge API also refuses expired records before the purge executes.
- The existing operator-authenticated Edge function now implements `pilotActivity`, returning a maximum of 20 unexpired channel observations from the private service-only view. No search, monitoring, cross-channel score, history backfill or analytics authorization is unlocked.
- Web pilot route now fetches via validated `fetchCreatorPilotActivity` only after active operator access; no Git-bundled public subscriber counts or upload timestamps. Before private storage is deployed, it intentionally shows no fresh evidence rather than fabricated values.
- Deleted `apps/web/src/data/creator-public-activity-2026-10-30.json` and `research/creator-intelligence/c11-public-activity-results.json` from the CURRENT TREE; replaced old snapshot-dependent CI test with C12 privacy contracts.
- C11 audit CLI now defaults to system temporary storage and rejects writes under `research/` and `apps/web/src/data/`. Historical C11 one-shot Git-committing workflow is disabled (no API requests, no write permission).
- Separate pgTAP tests verify isolation, RLS, expiration checks, hidden subscriber redaction and the hourly purge registration. C12 Node tests fail if raw activity snapshots reappear in the branch tip.

## Known limitations / blockers
1. **NOT DEPLOYED**: no new production SQL/Edge function; no production read/write or cron migration occurred. Private table is empty/unavailable until deployment and separate secure ingestion are approved.
2. **NO PRIVATE INGESTION YET**: migration and read APIs are drafted. A dedicated trusted server-side ingest endpoint and policy audit are required; do not copy a service-role key to public clients, chats, repository files or a new uncontrolled workflow.
3. **OLDER GIT HISTORY**: prior C11 Git commits and other branch snapshots may still be obtainable. A clean branch with sanitized *current tree* is not proof of remote object deletion. Explicit history clean-up/fork and PR-ref verification must occur before declaring policy remediation complete.
4. **RETENTION BACKUPS**: account for Supabase database backups, logs, support tooling, caches and exports when defining guaranteed deletion; cron and RLS alone are not full lifecycle management.
5. **YouTube authorization**: cross-channel derived metrics/rankings remain disabled without project-specific approval. Channel activity and original-content suitability still need human review; existing CineRelay cinema ingest remains untouched.

## Release go/no-go
- [x] C11 provider calls not repeated; existing one-shot evidence identified and current bundled JSON removed.
- [x] Read-only operator API and protected frontend implemented.
- [x] Draft service-only TTL schema, hourly purge and tests.
- [ ] Run full repository CI and local visual acceptance.
- [ ] Review/approve Supabase migration and protected ingestion endpoint with restricted service credentials.
- [ ] Validate actual retention deletion including backups and historical Git references.
- [ ] Refresh official public identities before any pilot approval and check quota headroom.
- [ ] Obtain any separate permission for derived/cross-creator analytics.

**Nothing in C12 is authorization to monitor creators, to deploy a new app, or to expose historical non-authorized YouTube data.**
