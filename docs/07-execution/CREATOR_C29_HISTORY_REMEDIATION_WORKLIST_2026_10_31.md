# CineRelay C29 — historical Git review and release-owner worklist

**31 October 2026 · read-only, no service deployment, no paid infrastructure**

## Observed facts
- Supabase **CineRelay** project is `ACTIVE_HEALTHY`; 123 deployed migrations, **zero** Creator Intelligence migrations and **zero** development branches (read-only connected check on 31 October).
- GitHub [C2 PR #100](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/100), [C10 PR #108](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/108) and [C11 PR #109](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/109) are open. The C11 branch is still accessible.
- PR #109 explicitly states that its **latest** reported non-authorized public YouTube API observation has an expiry of **2026-11-29T09:53:37.748Z**. This does **not** establish the expiry of earlier C2/C10 records or any right to retain data until then. The policy classification, earlier expiries, clones, forks and cached objects need independent review.
- C19 removed API snapshot JSON from the newer working tree; that does not remove older public Git objects or PR review references.
- Google Cloud project-specific quota and usage, backups/PITR/log retention, staging costs and the owner-approved single-channel pilot remain **unverified**.
- The newest Android APK remains **C22**; C28 fixed backend source and passed CI, not a deployed identity service.

## What C29 delivers
- Dated **metadata-only** inventory: `creator-c29-historical-review-evidence-2026-10-31.json`, containing names, PR numbers, branch visibility, and release gates, but no YouTube API values or credentials.
- A local read-only worklist generator `scripts/creator-intelligence/c29-history-worklist.mjs` that has no Git mutation, GitHub API, Google API, Supabase connection, network request or credential requirement. It never authorizes a release.
- Seven CI regression tests: fake clearance, branch disappearance, untrusted approvals, fabricated project, expiry misunderstanding, CLI release refusal and no destructive/network capabilities.
- `npm run creators:history-review` prints the worklist; `npm run creators:history-release-check` deliberately returns **2** while owner gates are blocked.

## Owner review order
1. **Evidence without raw values.** Inventory all affected branches, PR review refs, commit objects, forks, caches and clones. Determine C2/C10/C11 record types, exact origin and permitted retention from official API policy; do not place raw records in issues or PR comments.
2. **Explicit permission for destructive changes.** Get approval from the repository owner and affected collaborators before deleting branches, rewriting Git history, closing PRs or contacting GitHub Support. Record a rollback plan and impact on stacked C12–C28 PRs.
3. **History remediation.** Follow the GitHub guide on [removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) as an operational reference, recognizing that non-sensitive API data may not qualify for all GitHub Support removal paths. Rewriting a branch alone does not purge immutable retained PR objects or remote forks.
4. **Actual YouTube quotas.** Check the specific Cloud project in the [YouTube Data API quota console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas), including other clients' usage and operational reserve for the **185** cinema source IDs. Never assume the published default quota equals this project's allocation.
5. **Storage review.** In [CineRelay Database Backups](https://supabase.com/dashboard/project/dnqaejljfzwhsainpdxb/database/backups/scheduled), verify the actual plan, PITR toggle, backup retention, log and export lifecycle, and whether non-authorized API data can persist in backups after its active-row TTL. Verify the specific plan; do not enable any paid option without approval.
6. **Staging authorization.** Independently approve any staging cost, use synthetic records for operator/TTL/backup tests, then review one creator and authorize at most one manual official identity pilot. No automatic monitoring or comparisons.

## Commands and evidence limits
```bash
npm run creators:history-review
npm run creators:history-release-check  # expected exit 2: blocked
npm run test:youtube                  # includes C29 regressions
```
All output is a **historical snapshot**, not continuous monitoring or proof of live compliance. C25 still controls the broader rollout gate. Even after C29 CI passes, **do not** merge/deploy creator migrations, enable ingestion flags, place a live YouTube call or order paid staging until the owner approves all independent gates. No automatic history cleanup is implemented.
