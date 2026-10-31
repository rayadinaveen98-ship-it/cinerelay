# CineRelay C28 — nested public upload validation in the C27 private commit

**31 October 2026 — draft source-only, no production rollout**

## Why
C13 validates up to three public YouTube upload IDs and UTC publication times before calling C27. C27 already locked the claim and atomically saved the private observation, but its service-only SQL commit checked only the outer `recent_public_uploads` array length. If future service-side code bypassed C13's parser, a malformed nested record or extra fields could be saved to the private store.

## Change
- Harden the **still-undeployed C27 migration**, instead of creating a duplicate production migration. There is no live C27 function to upgrade.
- Before locking/finalizing any claim, reject an upload unless each array item is exactly `{videoId,publishedAt}`, with an 11-character public YouTube ID and publication timestamp either null or the normalized UTC ISO form produced by C13.
- Reject duplicate video IDs in the same observation, malformed objects, unsupported nested/private fields and non-UTC timestamp strings.
- Retain C27's two-unit quota claim, row lock after which current time is sampled, transactionally atomic private observation/claim/receipt success, and service-role-only execution.
- Extend the C27 pgTAP test from 21 to 27 checks. Extend its always-run Node source guard to check the nested-validation path and test cases. No API, Android or new credential.

## Release boundary
No migration, Edge function, enrollment, live YouTube API request, monitoring, hourly metrics, paid staging, production change or APK in this PR. C22 remains the latest installable beta. Keep C25 rollout and pilot gates blocked pending historical Git remediation, actual provider quota, Supabase backup/PITR/log retention and operator/editorial approvals.

## Verification
CI runs the existing Node contract and disposable-database pgTAP tests on the draft branch. **Do not interpret the existence of this file as proof tests passed**; verify the GitHub Actions PR checks before considering merge.
