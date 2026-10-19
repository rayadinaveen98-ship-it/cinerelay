# CineRelay V2.5 — S3 Production QA / RC1

Stacked on the integrated S2 candidate (PR #89); release-only validation, no visual changes, database deletes, migrations or backend deployments.

## Release candidate contract

- **Application ID:** `com.cinerelay.app`
- **Signed release QA APK:** `versionCode=221000`, `versionName=0.2.9-rc.1`.
- Android `release` variant with **R8 minification and resource shrinking enabled**; this is not the usual `assembleDebug` canary.
- Permanent CineRelay update-signing certificate must match `apps/android/signing/cinerelay-update-cert.sha256`.
- Firebase Android `google-services.json` for this app is **required**.
- The release APK must be non-debuggable, include no privileged key markers, and preserve package ID.
- **Stable release must use a higher versionCode than 221000.** Do not ship the RC tag as stable; use a separate approved release version and certificate check.
- CI upload contains the signed, installable RC release APK and verification manifest; do not publish or merge automatically.

## Automated QA gates

1. Build and run JVM tests with Gradle 9.6 / Java 17 / Android 36 toolchain.
2. Build `:app:assembleRelease` with minify and shrinkResources; verify R8 mapping exists.
3. Validate Android package/version/debuggable via aapt, valid APK signature via apksigner and cert hash against pinned signer SHA-256.
4. Require correct Firebase client JSON; fail release QA if unavailable.
5. Upload APK with SHA-256, signer/package/version/build type manifest.
6. Install and start on Android Google APIs API 35 emulator, confirm process survives, capture first-launch screenshot/logcat and reject startup FATAL EXCEPTION / ANR.
7. Continue to require original six workflows successful on S3 head.

## Manual device acceptance (Samsung A54)

User-device steps require human/on-device access and cannot be inferred from GitHub CI:

- Install RC1 **over signed S2 Build 680**, without uninstalling or clearing storage. Confirm Android accepts update and stored account/session/favorites survive. If using the initial clean-slate migration, confirm that it does not repeat on future versions.
- Cold launch + warm launch 3 times each; measure time to first useful Home image/story and completed sections.
- Home ⇄ OTT/Radar 10 cycles; scroll state stable; YouTube slideshow advances every ~5 seconds and pauses when offscreen.
- OTT Refine/reset/provider/language filter combinations, release dates, empty state, story/details/Back, Today date navigation and Radar.
- Account A logout → Account B login, no stale source/Archive/personalization/notification state. Tap Back during slow detail requests.
- Notification permission prompt, push registration, alarm/notifications arrival, deep-link route while foreground/background.
- Offline startup using cache, weak connection and recovery; recent YouTube-only hero; no Web content in hero.
- Background app + phone restart if feasible, no unexpected notification or sign-out regressions.

## Decision gates

- **S3 automated pass** = all CI including minified release + emulator smoke.
- **S3 device pass** = user's explicit acceptance of all critical flows.
- Only *after both* may release coordination integrate PR #89 (and S3 workflow via controlled method), cut stable version code > 221000, build/tag official release, and document rollback to the last approved signed APK.
- No Main merge, public deployment, or official stable release at RC1.
