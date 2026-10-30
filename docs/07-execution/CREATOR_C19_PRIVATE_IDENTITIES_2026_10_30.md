# CineRelay C19 — Remove Git-bundled API-verified identities
**30 October 2026 | draft / source only / no production deployment**

## Problem confirmed
C18 blocked new raw YouTube public activity dumps but two prior *non-authorized YouTube API identity snapshots* remained in the current Git tree:
- `research/creator-intelligence/c2-official-id-results.json`
- `apps/web/src/data/creator-official-pilot-2026-10-30.json`

The C10 Pilot Review and C9 Research Desk imported that latter snapshot, producing stale verified state after expiry. The original C2 workflow still had permission to commit API identity responses to Git. These were **real past API observations**, not safe immutable fixtures.

## Changes
1. **Deleted** the two dated provider API identity files from the current C19 tree. `.gitignore` also blocks accidental re-addition by default.
2. Disabled the old C2 identity-verification GitHub workflow (`if: false`, contents: read, no provider secret and no Git push). Its standalone CLI now refuses live execution; **pure verification logic remains importable for mock tests**.
3. Added draft `creator_intelligence_identity_evidence` private table: exact UC and UU identity link, source provenance, locale/segment, review-only state, explicit monitoring and metric fields permanently false, 28-day expiry with hourly pg_cron purge. RLS denies anon/authenticated direct reads, service-role-only storage operations.
4. Added read-only `pilotIdentities` action to the already operator-authenticated creator Edge API. Returns **only nonexpired, valid, pending-review records** (20 maximum) with explicit monitoring/comparison flags OFF, never an activation endpoint.
5. Replaced C10 React page's static JSON import with authenticated `fetchCreatorPilotIdentities` and validated Zod model; client also checks record expiry. It shows **"Awaiting fresh official verification"** when the private store is absent/empty, rather than claiming old 20 channel identities are current. Public activity data remains separately obtained through C12's private TTL API.
6. Research Desk preserves its 94 provisional discovery leads and 3 historical first-party page references, but no longer claims that the October 30 API verification is currently fresh. It points operators to the protected Pilot queue.
7. Existing C11 provider tests now use twenty **synthetic** UC identities. Replaced the old C10 test fixtures with private-storage and historical-review contract tests. Added dedicated C19 release-safety regression tests and pgTAP RLS/28-day TTL tests.

## Important limitation: no new identity writer in C19
This PR does **not** import the old 20 API identity results into the new private table. Reimporting from an expired, dated Git dump would not establish fresh official verification. The table starts empty. A future approved private identity verification/writer must use the real official API and verified quota budget, under strict retention controls, before the app can show any fresh identities. C19 itself makes **zero Google API requests**.

## Remaining release blockers
- **Historical Git:** deleting files from this branch's current tree does not remove the older C2/C10/C11 commits and PR references. C11 PR #109 remains open and its historic branch is still accessible. Coordinate safe history cleanup and GitHub cache/fork audit; no force push or branch deletion is authorized as part of this PR.
- **Hosted lifecycle:** C12/C19 service-only migrations are NOT applied to production. Verify Supabase backup/PITR/log/export retention and deletion before any hosted provider ingestion.
- **Google project quota:** actual owner project's quota headroom has not been verified directly in Google Cloud; internal ledger is not authoritative.
- **Human review:** no creator has been newly approved; permission for derived cross-channel comparisons remains separate and C6 stays locked.
- **Existing 185 cinema YouTube sources remain untouched**; no new schedule, monitoring, notification, APK, Cloudflare deploy or paid Supabase branch was created.

## Validation
```bash
npm run test:youtube
npm run creators:audit
npm run creators:release-check # deliberately blocked with code 2
```
The existing CI runs isolated pgTAP tests against disposable Postgres, then web and Edge checks; no live consumer effect.

**This PR is not a compliance certificate.** In particular, historical refs and backups must be handled separately.
