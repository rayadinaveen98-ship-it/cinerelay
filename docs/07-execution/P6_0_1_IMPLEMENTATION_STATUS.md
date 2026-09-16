# P6.0.1 Implementation Status — Android V0.1 Canary

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / APK CI PENDING / MOBILE API NOT YET HOSTED / REAL FIREBASE DEVICE CANARY PENDING**

Branch:

`phase-6/android-v0.1-canary`

Parent:

`phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`

Draft PR:

`#16 — Phase 6 P6.0.1: Android V0.1 canary`

## Implemented so far

### Visible Android product

- standalone native Gradle Android project in `apps/android`;
- package `com.cinerelay.app`;
- stable Android 16 API 36 compile/target baseline, min API 26;
- Kotlin + Jetpack Compose + Material 3;
- dark-first CineRelay signal-room theme;
- authenticated sign-in screen;
- Live feed;
- Following feed;
- Creator Radar feed;
- Alerts history;
- verification badges;
- evidence/source metadata and source links;
- evidence/conflict counts;
- follow/unfollow actions;
- Creator Radar score/opportunity labels;
- session refresh/sign-out;
- visible real-device FCM canary state.

### Mobile backend boundary

- new `cinerelay-mobile-api` Edge source;
- independent bearer validation through `auth.getUser()`;
- shaped `bootstrap`, `live`, `following`, `radar`, `alerts`, `setFollow` actions;
- P5.5 READY summary reuse where available;
- P5.4 Radar reuse where available;
- no direct Android access to service-owned internal tables.

### Push bridge

- existing P5.2 device registration API reused;
- Firebase token acquisition when client config exists;
- automatic token re-registration on rotation;
- Android 13+ notification permission requested only when enabling alerts;
- foreground Firebase message handling;
- notification channel configured;
- no fake Firebase success when configuration is absent.

### CI

- dedicated `.github/workflows/android-canary-ci.yml`;
- mobile API type-check + deployment bundle artifact;
- JDK 17 / Gradle 9.6 / stable Android API 36 build;
- `assembleDebug` APK generation;
- privileged-secret marker scans;
- APK SHA-256 generation;
- installable APK artifact upload.

## CI findings so far

- Android Canary CI #1 proved `cinerelay-mobile-api` type-check/bundle success, but `android-actions/setup-android@v3` tried to install obsolete SDK package `tools`; workflow fixed to request `platform-tools` only.
- Android Canary CI #2 again proved the mobile API green and advanced past `setup-android`, then showed that stable `sdkmanager` does not publish `platforms;android-37` because Android 17/API 37 is still preview-only.
- The canary was therefore pinned to stable Android 16/API 36 rather than opting into preview tooling. No application compiler failure has occurred yet; both findings were CI/SDK setup issues before Gradle compilation.

## Security boundary

Allowed in APK:

- Supabase URL;
- Supabase publishable key;
- user's own refreshable auth session.

Forbidden from APK:

- Supabase service-role key;
- CineRelay internal worker/scheduler secret;
- Firebase service-account private key;
- connector provider credentials.

## Current Firebase state

The canary intentionally compiles without `google-services.json`.

Until Firebase is configured, normal app functionality can still be verified, while the Alerts canary card reports that push activation is pending.

## Next gates

1. require the stable-API-36 replacement CI to reach and pass the actual Gradle/Kotlin/Compose build;
2. keep the existing four-job CineRelay CI green in parallel;
3. require an installable APK artifact;
4. deploy `cinerelay-mobile-api` only from its exact green CI bundle;
5. verify hosted mobile API auth/no-side-effect boundary;
6. provide the exact green CI APK for installation;
7. configure Firebase client/server credentials when available;
8. run real-device exactly-once/retry/invalid-token canary;
9. formally close the remaining Phase-5 delivery exit gate.

Design:

`docs/07-execution/PHASE6_P6_0_1_ANDROID_CANARY_DESIGN.md`
