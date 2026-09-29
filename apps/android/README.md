# CineRelay Android

Native Kotlin + Jetpack Compose client for CineRelay.

## Current milestone

**V0.1.1 Guest-First Canary** is the first product-shaped Android milestone.

Fresh installs open directly into **Live** with real hosted CineRelay signals. An account is not required to understand what CineRelay is.

Guest access:

- Live;
- Creator Radar;
- evidence/source links.

Account-owned features:

- Following;
- Alerts;
- follow/unfollow;
- push-device registration.

Guests who choose a personal feature get an in-app **Create account / Sign in** sheet and can dismiss it to keep exploring. Existing sessions resume automatically, and signing out returns to Guest Live instead of a login wall.

The milestone also provides the real Android client needed to close the remaining Phase-5 Firebase/FCM delivery gate.

## Stack

- Android API 26+;
- stable target/compile API 36 (Android 16);
- Kotlin/Compose with AGP 9.4;
- Material 3;
- OkHttp;
- Firebase Cloud Messaging;
- Supabase Auth HTTP endpoints + shaped CineRelay Edge APIs.

Android 17 / API 37 is still a preview SDK at this checkpoint, so the canary stays on the stable platform instead of depending on preview tooling.

## Mobile API boundary

`cinerelay-mobile-api` v2 intentionally separates public reads from personal state.

Public read-only actions:

- `live`;
- `radar`.

Authenticated actions:

- `bootstrap`;
- `following`;
- `alerts`;
- `setFollow`.

A missing bearer is accepted only for the public read-only actions. A supplied invalid bearer is rejected rather than silently treated as a guest.

No service-role key, FCM service-account key, scheduler secret, connector credential or other privileged server secret belongs in the APK.

## Public configuration

The build embeds only the hosted Supabase URL and publishable key. CI supplies their current public values. Local builds may override them through environment variables or `local.properties`:

```text
CINERELAY_SUPABASE_URL=https://...
CINERELAY_SUPABASE_PUBLISHABLE_KEY=...
```

## Firebase canary configuration

The app package is locked to:

```text
com.cinerelay.app
```

Without `app/google-services.json`, the APK still builds and guest/normal CineRelay data UI works. The authenticated Alerts screen clearly reports that the real-device FCM canary is not configured.

To activate FCM later:

1. create/register Android app `com.cinerelay.app` in the Firebase project;
2. place `google-services.json` at `apps/android/app/google-services.json` for the controlled Firebase-enabled build;
3. configure the matching server-side Firebase service-account JSON only in hosted secret `CINERELAY_FCM_SERVICE_ACCOUNT`;
4. install the APK on a physical Android device, create/sign into an account, and choose **Enable real alerts**;
5. run the controlled exactly-once/retry/invalid-token delivery canary before enabling unattended push delivery.

Never commit the Firebase service-account private key.

## CI artifact

`.github/workflows/android-canary-ci.yml` builds `:app:assembleDebug`, scans source/APK for privileged credential markers, and uploads:

```text
cinerelay-android-v0.1.1-canary-apk
```

The same workflow type-checks and packages the guest-aware `cinerelay-mobile-api` so the APK and its backend trust boundary are validated together.

Canonical V0.1.1 implementation validation:

- CineRelay CI #353 / run `35107312490` — all four jobs green;
- Android Canary CI #19 / run `35107312714` — mobile API + APK jobs green.
