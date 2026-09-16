# CineRelay Android

Native Kotlin + Jetpack Compose client for CineRelay.

## Current milestone

**V0.1 Canary** is the first installable Android milestone. It deliberately does two jobs:

1. make the existing CineRelay intelligence stack visible and usable on a phone;
2. provide the real Android device needed to close the remaining Phase-5 Firebase/FCM delivery gate.

Current screens:

- Sign in;
- Live;
- Following;
- Creator Radar;
- Alerts;
- real-device FCM canary status.

The client reads only through authenticated Edge APIs. No service-role key, FCM service-account key, scheduler secret, connector credential or other privileged server secret belongs in the APK.

## Stack

- Android API 26+;
- target/compile API 37;
- Kotlin/Compose with AGP 9.4;
- Material 3;
- OkHttp;
- Firebase Cloud Messaging;
- Supabase Auth HTTP endpoints + authenticated CineRelay Edge APIs.

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

Without `app/google-services.json`, the APK still builds and the normal CineRelay UI works, but the Alerts screen clearly reports that the real-device FCM canary is not configured.

To activate FCM later:

1. create/register the Android app `com.cinerelay.app` in the Firebase project;
2. place the downloaded `google-services.json` at `apps/android/app/google-services.json` for the controlled Firebase-enabled build;
3. configure the matching server-side Firebase service-account JSON only in the hosted Edge secret `CINERELAY_FCM_SERVICE_ACCOUNT`;
4. install the APK on a physical Android device, sign in, and choose **Enable real alerts**;
5. run the controlled exactly-once/retry/invalid-token delivery canary before enabling unattended push delivery.

Never commit the Firebase service-account private key.

## CI artifact

`.github/workflows/android-canary-ci.yml` builds `:app:assembleDebug`, scans the source/APK for privileged credential markers, and uploads:

```text
cinerelay-android-v0.1-canary-apk
```

The same workflow type-checks and packages `cinerelay-mobile-api` so the APK and its shaped authenticated backend boundary are validated together.
