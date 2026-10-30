# CineRelay C21 — Android Creator Intelligence Beta
**Android deliverable checkpoint, 30 October 2026**

This phase deliberately prioritizes an **installable, tested APK** over further creator backend C-stages.

## On-device experience
- **Settings → Creator Intelligence** in the signed-in CineRelay Android app. Existing Live, Following, Radar, Alerts, Settings, archive and notifications remain in place.
- Original cinematic dark Android Compose screen with **Discover** and **Verified** sections.
- Discover reads **94 genuine provisional discovery leads** from the C1/C9 offline research snapshot dated October 27, 2026, across 9 language/region groups. Search by name, handle or category; filter by language and *provisional* size tier; expand cards to see source provenance. Unknown handles are explicitly missing rather than invented.
- Verified shows honest **Awaiting fresh verification**, because C19/C20 protected verification storage has **not** been deployed. No old API UC IDs, no subscribers, views, hourly comparisons, upload monitoring, notifications or background collection.
- This feature is offline, read-only and separate from the existing film-source pipeline. No API key or privileged Supabase access is bundled into APK.
- The creator beta is available after ordinary CineRelay sign-in, rather than being confused with consumer feed subscriptions or hidden backend-only operator permissions. No claim of active monitoring.
- Native Kotlin filter/locale tests + CI asset/safety guards.

## Update-compatible APK
`.github/workflows/android-creator-beta-c21.yml` produces a **release-signed, minified** APK from the C21 branch:
- package: `com.cinerelay.app`
- versionCode: **221002**, above v0.2.9 stable's 221001
- versionName: `0.2.10-creator-beta.1`
- requires existing permanent Android update keystore, matching stored SHA-256 certificate, and verified Firebase client config
- runs existing Android unit tests and `assembleRelease`
- verifies app package, build version, release signature, non-debuggable APK, R8 output and absence of sensitive privileged strings
- uploads the resulting APK to the `cinerelay-c21-creator-intelligence-beta-apk` GitHub artifact (7-day retention)
- **does not publish GitHub Release, deploy a new backend, update Play Store or charge for a hosted staging branch**

**Safe install:** install this beta over the existing **same-signed** v0.2.9 APK, rather than uninstalling it. Back up personal data as usual before trying beta apps. A previously installed unsigned/differently signed debug preview may not be update-compatible.

## Backend release blockers remain
The staged C12–C20 creator-service branches are *not* deployed. Historical C2/C10/C11 API facts still exist in old Git commits and refs; backup/PITR/log retention and Google Cloud project quota require verification. All creator monitoring and cross-channel comparisons remain OFF. Do not represent research leads as officially identity-verified.

## Validation
`npm run test:youtube` includes the new C21 Android research asset guard and Kotlin `CreatorResearchBetaV21Test` runs in the signed beta workflow. PR CI validates existing web/Edge/database code independently.
