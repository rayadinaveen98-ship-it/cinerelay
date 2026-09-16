# P6.0.1 Implementation Status — Android V0.1.1 Guest-First Canary

Date: 2026-09-16

State: **GUEST-FIRST APK COMPLETE / HOSTED MOBILE API V2 DEPLOYED / REAL FIREBASE DEVICE CANARY PENDING**

Branch: `phase-6/android-v0.1-canary`

Parent: `phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`

Draft PR: `#16 — Phase 6 P6.0.1: Android V0.1 canary`

Guest-first engineering head: `98374e239f298411a955bba6bccec0a0b58a5063`

## V0.1.1 first-run experience

The original V0.1 engineering canary proved the native app/runtime but opened on an authentication wall. V0.1.1 corrects that product behavior.

Fresh installs now:

1. open directly into **Live** as a guest;
2. load real hosted CineRelay canonical events immediately;
3. allow **Creator Radar** guest browsing;
4. expose source/evidence links without requiring an account;
5. ask for authentication only when the user chooses a personal feature.

Personal features remain authenticated:

- Following;
- Alerts;
- follow/unfollow mutation;
- device registration / push canary;
- user-specific counters and delivery history.

Guest taps on Follow, Following or Alerts receive a CineRelay account sheet rather than a hard failure.

## Authentication UX

The in-app auth sheet supports:

- **Create account**;
- **Sign in**;
- switching between both modes;
- email/password validation;
- automatic session persistence after successful auth;
- email-confirmation-required responses without pretending the user is signed in;
- closing the sheet at any time and continuing as a guest.

Existing valid sessions still resume directly into authenticated CineRelay.

Signing out returns to Guest Live instead of returning to a login wall.

## Guest/mobile API trust boundary

Hosted `cinerelay-mobile-api` v2 distinguishes public read-only actions from account-owned actions.

Public read-only:

- `live`;
- `radar`.

Authentication required:

- `bootstrap`;
- `following`;
- `alerts`;
- `setFollow`.

If no bearer is present on a public action, the API serves a guest projection and never queries user follow state.

If an `Authorization` header is present but invalid, the request returns `401 invalid_session`; it is never silently downgraded to guest access.

## CI proof

### CineRelay CI #353

Run `35107312490` — all four jobs PASS on head `98374e239f298411a955bba6bccec0a0b58a5063`:

- intelligence/connectors;
- database migrations + pgTAP + lint;
- Edge functions;
- web console.

### Android Canary CI #19

Run `35107312714` — both jobs PASS:

- guest-aware mobile API Deno type-check;
- deployment-native mobile API bundle;
- JDK 17 / Gradle 9.6 / stable API 36 setup;
- privileged-secret source scan;
- `:app:assembleDebug` for V0.1.1;
- APK contract/secret scan;
- checksum generation;
- installable APK upload.

## Exact V0.1.1 artifacts

Android APK:

- artifact: `cinerelay-android-v0.1.1-canary-apk`;
- artifact ID: `10451365825`;
- archive digest: `sha256:683ba036ceaa504df776303b5f45db2d13feebacf8801e8b8a7bdb82d90823fc`;
- extracted APK SHA-256: `f6038cbd5b88340b76b35fbc9433c3d22b2fe7c7b00b6740394fea751066fe01`;
- extracted size: `20,665,641` bytes.

Mobile API bundle:

- artifact ID: `10450528647`;
- archive digest: `sha256:3362f93d9500b948ec73c02581edfe8003f95c8be22078b472037c0cbe35270d`;
- bundled `index.js` SHA-256: `3667a60237e5d65769339499e6063027398847d2f4b5867a4bdee49060340249`.

## Hosted v2 proof

The exact CI-built bundle is deployed as:

- function: `cinerelay-mobile-api`;
- function ID: `c71305b1-b602-4b95-bb29-0914be6ebc80`;
- version: `2`;
- status: `ACTIVE`;
- hosted bundle SHA: `59eb5eda65340cb238055bd16c8ae0cb7034d9885a53d61e54a1dafbdd0160f1`.

Direct hosted probes:

- guest `live` -> HTTP `200`, `guest=true`, real event payload returned;
- guest `radar` -> HTTP `200`, `guest=true` (empty items is currently valid because no hosted Radar projection is materialized);
- guest `following` -> HTTP `401`, `authentication_required`;
- guest `alerts` -> HTTP `401`, `authentication_required`;
- invalid bearer on `live` -> HTTP `401`, `invalid_session`.

Before and after probes:

- `user_entity_follows = 0`;
- `alert_deliveries = 0`;
- `push_device_registrations = 0`.

Therefore guest browsing and rejected auth probes are zero-side-effect for personal state.

## Firebase state

Firebase client/server credentials are still intentionally absent from the engineering canary.

Still required before the remaining Phase-5 delivery exit gate can close:

1. Firebase Android client config for `com.cinerelay.app`;
2. hosted `CINERELAY_FCM_SERVICE_ACCOUNT` secret;
3. physical Android device registration;
4. controlled exactly-once push delivery;
5. transient retry/recovery proof;
6. explicit `UNREGISTERED` token deactivation proof;
7. final security/advisor recheck.

No production push cron is enabled before this gate passes.

Design: `docs/07-execution/PHASE6_P6_0_1_ANDROID_CANARY_DESIGN.md`

Hosted V0.1 proof: `docs/07-execution/PHASE6_P6_0_1_HOSTED_ENGINEERING_PROOF_2026-09-16.md`
