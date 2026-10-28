# CineRelay Creator Intelligence C7 — offline pilot preflight and review queue
Date: 2026-10-28

## Outcome
Implemented an **offline, read-only** identity-evidence audit. It is **NOT** an authorization to activate monitoring or comparisons.

- Source: `scripts/creator-intelligence/audit-c7-pilot.mjs`
- Regression suite: `tests/youtube-connector/run-creator-c7-preflight.mjs` (wired into `npm run test:youtube` and CI)
- Run locally from repository root: `node scripts/creator-intelligence/audit-c7-pilot.mjs`
- Inputs: checked-in C2 20-handle research candidates, the dated 185-ID source snapshot, and the C2 official API verification report.
- Output: machine-readable audit with explicit source status, quotas/approval gates, rejection causes and a maximum-10 **human-review** shortlist. No network requests, app changes, DB updates, HTTP server, cron, tracking enablement, or production writes.

## What it proves
1. Check C2 report provenance and structural integrity (20-call cap, observed and expiry instants, input cohort/identity snapshot sizes, consistent counts and matching handles).
2. Only accept officially returned `UC...` channel identities paired to a correct `UU...` uploads playlist. A matching name, first-party web result or guessed ID does not count.
3. Quarantine same-ID/different-handle collisions **within** the research cohort, and exclude IDs already in the 185 existing cinema-source snapshot.
4. Fail closed on expired, forged, inconsistent or previously enabled inputs. Rows never set `trackingEnabled=true`.
5. Preview a mixed nano/micro/mid/large human-review queue, considering non-Telugu candidates within each provisional tier. This is a *fairness policy for review order*, **not** an official subscriber-size measurement or creator performance ranking.
6. Report all independent activation gates explicitly **false**: human review, a fresh live production-ID duplicate check, actual Google Cloud project quota, YouTube derived-metrics permission, and production collection authorization.

## Current measured state
The checked-in C2 report says `BLOCKED_MISSING_GITHUB_API_KEY`: 20 research candidates, 0 Google API requests, 0 officially verified C2 channel IDs, 0 approved or activated channels. C7 returns `BLOCKED_MISSING_API_KEY` with an empty review queue. An all-green software CI build **is not** a real-data pilot.

## Next safe steps
1. An authorized repository owner provisions an appropriately scoped `YOUTUBE_API_KEY` **in GitHub Actions secrets**, not source control or chat.
2. On `feature/creator-intelligence-c2-verify-20261028`, manually dispatch **CineRelay C2 Verify 20 Creator IDs — Read-only** once. No retries; at most 20 general-read calls. Confirm remaining quota before use. C7 deliberately never calls YouTube itself.
3. Review the resulting C2 report. The C7 branch consumes that report only after it is explicitly brought forward into this stacked branch through normal code review. Do not silently override or change the stable app.
4. Refresh the production stable UC-ID snapshot immediately before any enrollment. Require human identity/activity review and independently verify the project-specific general-read and batch-stats buckets.
5. Collect **one supervised C4 public stats request** only after all gates are independently passed and production deployment is approved. This phase does **not** create that approval.
6. Cross-channel comparison C6 stays locked until the specific YouTube analytics/derived-metrics permission has been verified.

## Verification
- Six new Node regression cases for review queue, same-UC-ID collision, 30-day expiry, invalid/malicious fields, dishonest counts and actual checked-in blocked C2 report.
- Local unit simulation passed with a matching C2 validation contract. Full GitHub PR CI is the authoritative repository-wide run.
- No APK or production Supabase/Edge deployment.

Official references:
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://developers.google.com/youtube/terms/developer-policies-guide
