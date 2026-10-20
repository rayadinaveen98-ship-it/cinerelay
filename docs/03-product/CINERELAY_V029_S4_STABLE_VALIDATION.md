# CineRelay v0.2.9 — S4 Stable Candidate Validation

This stage is based on S3 [PR #90] and intentionally **does not merge main, create a tag, publish a GitHub release or deploy production services**. S4 creates and validates the APK that may be promoted after device sign-off.

## Version and signing

- Target `applicationId=com.cinerelay.app`.
- Candidate `versionName=0.2.9`, `versionCode=221001`, greater than S3 QA version `221000` and all prior 220xxx canaries.
- Android `assembleRelease` with R8 minification/resource shrink; Firebase project JSON required.
- Permanent CineRelay update signing certificate must match pinned certificate SHA-256; no new signer or changed package.
- Non-debuggable release APK, manifest, mapping, checksum and signer verified.
- CI-only release APK artifact for QA, with no automatic public release.

## S4 automated QA

1. Repeat JVM unit tests and build signed minified `assembleRelease`.
2. Validate package/version, manifest debuggable=false, signer hash, Firebase, R8 mapping and absence of privileged credentials.
3. Download previously signed S3 release QA APK `0.2.9-rc.1` from successful run 39275984882, install on Android 35 Google API emulator and assert code 221000.
4. Install `0.2.9` code 221001 with `adb install -r` (no uninstall), verify upgraded version, launch activity, wait for process, collect screenshot and reject fatal exception / ANR.
5. All original S3 and CineRelay CI checks pass on current S4 head.

## Remaining physical-device acceptance

The user's general positive feedback supports continued release preparation. However, specifically test on Samsung A54:
- Upgrade directly over Build 680 or installed RC1 without uninstalling, confirm login, favorites and cached data remain intact.
- Home cold/warm load, 5-second YouTube-only autoplay, Home↔OTT/Radar, scroll restoration.
- OTT filters, Today history, Radar, Archive and detail Back.
- Notification permission, push delivery and deep link in foreground/background.
- Account A sign out→B sign in, stale data isolation, interrupted API requests.
- Offline recovery and retry behavior.

**Stop gate:** Do not mark stable, merge or tag until these manual release-critical flows have been confirmed; device testing cannot be inferred from CI. Keep the signed S3 RC1 as rollback reference. On approval, merge approved stack through S2/S3/S4 in the correct order or via one consolidated review, then tag the verified release SHA and attach checksummed APK.
