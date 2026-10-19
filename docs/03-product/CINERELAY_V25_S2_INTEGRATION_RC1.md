# CineRelay V2.5 — S2 full-stack integration candidate (RC1)

**Status:** Integration validation; **not a stable release and not merged to `main`**.

## Branch topology

The approved Android UI/performance/session work is a strictly linear nine-PR stack:

| Order | PR | Change |
|---|---|---|
| 1 | #80 | Editorial Edition V2 native redesign |
| 2 | #81 | Navigation and jank cleanup |
| 3 | #82 | Professional compact UI |
| 4 | #83 | Cinematic V2.1 full-app |
| 5 | #84 | V2.2 Netflix-style Home rails |
| 6 | #85 | V2.3 hero, OTT, Today, original artwork |
| 7 | #86 | V2.4 startup, fresh-start cache and YouTube-only hero |
| 8 | #87 | V2.5 Home retention and autoplay |
| 9 | #88 | V2.5 Stability S1 account/session safeguards |

Integration base: `main`. Candidate includes all commits from #80–#88 through the final S1 head. At candidate creation the comparison was **159 commits ahead, 0 behind**, affecting **55 tracked files**, with no divergent merge base.

**Policy:** Do NOT merge each upper PR independently to `main`. Review/validate this single end-to-end candidate first; once device acceptance is recorded, choose a single approved integration method (consolidated merge vs dependency-order merges), reconcile/close superseded drafts and preserve rollback history. Do not tag or deploy before release QA.

## Automated validation
- Six CI workflows must pass **on this integration PR with base `main`**, not just on a stacked feature PR.
- Android preview signing certificate and Firebase client checks must remain green.
- Android debug unit tests must pass for Home freshness/auto-pager, archive/session generations, OTT release/date and evidence behavior.
- Integration diff must exclude destructive database changes, production ingestion deployment and unexplained permission increases.
- No UI adjustments or new features in S2.

## Release blockers that must be addressed during S3
1. **Physical-device sign-off on Build 677 / RC1:** Samsung A54 cold/warm startup, Home↔OTT/Radar (10 cycles), 5s hero autoplay, scroll retention, details and Back.
2. **Account A → sign out → Account B** regression: personalization, sources, notifications, Archive and late network responses. Current automatic tests cover request generations, not the entire end-to-end device flow.
3. **Offline/weak-network recovery, notification permission and push delivery**, current date and timezone, font size scaling and memory/scroll stress.
4. **True Android release variant:** current canary workflow builds `:app:assembleDebug` (debug variant) with stable-update signing; no minified `:app:assembleRelease` has yet been validated on this candidate. Release build must be tested, including R8/shrink rules and installation over existing app data.
5. **Monotonic version code:** latest signed preview baseline is `versionCode=220677`, `versionName=0.2.8-ui-canary.677`. Do not use Gradle's current fallback `210007` for a stable build (that would be a downgrade). Pin a stable version code **greater than the highest APK ever distributed**, and supply explicit release versionName.
6. **Update signature:** confirm APK signer SHA-256 matches the permanent CineRelay update certificate; do not ship unsigned or a different signer.
7. **Rollback:** keep last device-accepted signed preview and an annotated release SHA. Do not replace/delete shared cinema data.
8. **Auth cleanup:** the one-time V2.4 fresh-start migration is intentional for affected installs; verify onboarding and preservation of new credentials after initial migration.

## Stage gate
- S2 passes when this full-stack main-base PR is green and diff/release contracts are reviewed.
- S3 can then begin focused device/release-variant QA.
- **Stable** only after S3 all required checks pass and the user explicitly confirms device acceptance.
