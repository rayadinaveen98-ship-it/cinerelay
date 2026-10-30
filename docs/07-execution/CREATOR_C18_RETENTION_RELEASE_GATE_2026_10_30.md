# CineRelay C18 — YouTube data retention and release gate
**2026-10-30 • draft • source-only safety work • no production or paid staging changes**

## Verified GitHub/Supabase facts
- [C17 draft PR #115](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/115) completed all **eight** CI workflows successfully.
- The old [C11 draft PR #109](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/109) remains OPEN, based on C10, and the branch `feature/creator-intelligence-c11-activity-audit-20261030` is still accessible. It previously committed raw YouTube public channel statistics and latest-public-upload observations on 2026-10-30.
- The clean C17 tip **does not** contain the C11 raw activity results files, but **does** still track the C2 official identity result `research/creator-intelligence/c2-official-id-results.json` and C10 API-verified identity pilot `apps/web/src/data/creator-official-pilot-2026-10-30.json`. These require retention review as non-authorized YouTube API data. A historical C9 public-page snapshot is tracked separately and needs provenance/classification review.
- Connected CineRelay production Supabase project had **no development branches** at read-only inspection. The new C12 private activity data backend and C13 one-shot ingest function have **not** been deployed.
- No owned Google Cloud **actual quota remaining** was accessible in connected tools, and the internal ledger is insufficient to prove it. Google Cloud Quotas page must be inspected for this exact YouTube Data API project and actual usage.
- Supabase hosted database backup/PITR/log retention was **not** independently verified; no project billing plan or backup export should be guessed.

## What is built in C18
- `scripts/creator-intelligence/c18-retention-gate.mjs` scans **only tracked file paths** (via `git ls-files -z`), never the contents of confidential/raw snapshots. It detects new named public API exports/bundles without leaking data values.
- Existing tracked C2/C10 official API JSON files are **reported as legacy blockers**, not silently certified safe. C11 history/PR refs, verified Google project quotas, hosted backups and editor/monitoring approvals remain explicit **manual release gates**.
- `npm run creators:audit` passes if no **new** raw snapshots have been added, while printing **releaseReady=false** and current blockers. Every PR now runs it as part of `npm run ci`.
- `npm run creators:release-check` returns **exit code 2** while manual release gates remain; regression paths return exit code 1. This is intentionally *not* a claim of safe deployment.
- `.gitignore` discourages reintroduction of new temporary YouTube activity dumps. Historical tracked files are unaffected by `.gitignore`; they require separate remediation.
- Automated regression tests cover existing legacy files, new raw snapshot reintroduction, empty-tree false-clearance prevention, duplicate paths, and the actual blocking release CLI.
- No API keys, secrets, YouTube calls, Supabase writes, production releases, or new paid resources.

## Historical Git-data remediation — separate, high-risk operator procedure
1. Preserve a **non-sensitive** audit inventory of relevant refs/paths and affected PRs. Determine whether public API observations from C11, C2, C10, and forks/caches must be purged or refreshed.
2. Obtain operator approval for rewrite/branch/PR cleanup. Do **not** blindly force-push or run `git-filter-repo` on shared history; doing so can invalidate stacked PRs and erase collaborators' work.
3. If a history rewrite is justified, use a fresh clone; scope the affected paths/ref ranges, carefully inspect `git-filter-repo` output and affected PR refs; coordinate owners/clones/forks before changing any remote refs.
4. GitHub's documentation warns a force-push alone does **not** remove PR refs, cached views or remote clones. Contact GitHub Support if eligible/needed to remove retained objects and cached views. GitHub Support may not perform removal for non-sensitive API data, so do not presume they will.
5. Re-run the check after the documented remediation, verify relevant raw-data paths/commits are no longer accessible, and record permitted storage/retention decisions before updating the release gate.
6. Do not delete the currently referenced C2/C10 files without first changing the application and tests to consume retention-appropriate non-authorized data from expiring storage. Current use of these files is a separate dependency.

Official GitHub history guidance: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

## YouTube API policy / quota audit
- The official [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies) specify no more than 30 days for non-authorized data without refresh or deletion, subject to their full policy conditions. Non-authorized subscriber statistics are specifically discussed.
- The [quota calculator](https://developers.google.com/youtube/data/determine_quota_cost) lists `channels.list` and `playlistItems.list` at **one unit each**; daily quotas reset Pacific Time. The quota allocation **of this actual Cloud project** has not been confirmed merely by the default documentation.
- Check the active Google Cloud YouTube Data API Quotas and usage pages for quota ceiling, daily consumption, method buckets, other clients sharing the project, and operating reserve for the 185 existing CineRelay cinema sources.
- No cross-channel derived scoring or comparison is authorized by an identity verification or quota grant. Keep C6 policy gate locked.

## Hosted retention audit
- C12's proposed 28–29-day TTL and hourly cron deletion are **source-level logic** and passed local tests; they cannot establish deletion of old backups, PITR snapshots, exports, logs, or cached Git objects.
- Supabase documentation currently describes plan-dependent daily backup retention; verify exact CineRelay plan, whether PITR is enabled, actual backup availability and purge behavior **for this project**.
- Use an authorized, separate hosted staging environment and intentionally synthetic, non-personal data to validate deletion, expiry filtering, operator authentication and any restore-from-backup procedure.
- Never enable the C13/C14 production flags, create a paid staging branch, merge to main, or run a real provider audit before all release blockers have been reviewed.

Supabase backup reference: https://supabase.com/docs/guides/platform/backups

## Gate and validation
```bash
npm run creators:audit        # tracked path regression test; may be green, RELEASE STILL BLOCKED
npm run creators:release-check # exit 2 until historical + quota + hosted manual gates cleared
npm run test:youtube          # includes C18 regression tests
```

### Outstanding disposition
| Gate | Status |
|---|---|
| Prevent **new** tracked public API exports | Implemented in C18 |
| C11 historical branch/PR retained objects | **OPEN / NOT REMEDIATED** |
| C2/C10 official API files still tracked | **OPEN / APPLICATION MIGRATION NEEDED** |
| Actual Cloud YouTube project quota reserve | **UNVERIFIED** |
| Supabase backups/PITR/logs retention | **UNVERIFIED** |
| Independent paid hosted staging | **NOT PROVISIONED** |
| Human creator roster / comparisons permission | **NOT APPROVED** |
| Production creator monitoring | **DISABLED** |

**This is a release gate, not an automatic compliance certificate.**
