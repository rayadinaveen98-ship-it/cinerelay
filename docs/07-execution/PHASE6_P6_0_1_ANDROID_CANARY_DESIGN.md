# Phase 6 P6.0.1 Design — Android V0.1.1 Guest-First Canary

Date: 2026-09-16

State: **GUEST-FIRST APK COMPLETE / HOSTED MOBILE API V2 DEPLOYED / REAL FIREBASE DEVICE CANARY PENDING**

Parent checkpoint:

`phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`

## Purpose

P6.0.1 is the bridge between the completed Phase-5 engineering foundation and the visible Android product.

It must:

1. make real CineRelay signals visible immediately on an installable Android app;
2. reuse the proven Phase-5 follow/Radar/alert contracts rather than invent parallel mobile state;
3. provide the authenticated real Android installation needed to complete the remaining P5.2 Firebase delivery canary;
4. become the durable base for full Phase-6 Android V1.

## Product boundary

This is not a mockup and not a sample-data demo.

Fresh users must see CineRelay before they are asked to create an account. The product therefore uses a **guest-first** boundary:

- app launch opens directly into **Live**;
- **Live** and **Creator Radar** are public read-only experiences;
- original evidence/source links remain available in guest mode;
- **Following**, **Alerts**, follow/unfollow mutation and device registration remain account-owned features;
- authentication is an upgrade path for personalization, not a wall in front of cinema intelligence.

Existing valid sessions resume authenticated automatically. Signing out returns the user to guest Live rather than a login wall.

The client must never bypass the server-side trust model or put privileged backend credentials in the APK.

## Visual direction

The Android app follows the frozen CineRelay design philosophy:

- premium cinema intelligence newsroom / signal room;
- dark-first deep charcoal surfaces rather than pure black;
- cinematic through hierarchy, spacing and restraint rather than decorative movie clichés;
- dense but calm information;
- verification/evidence visible directly on event cards;
- semantic status colors used sparingly;
- bottom navigation and a single-column mobile feed;
- account prompts use an in-product bottom sheet rather than replacing the application surface.

## Android platform baseline

V0.1.1 uses:

- `minSdk = 26`;
- `compileSdk = 36`;
- `targetSdk = 36`;
- JDK 17;
- AGP 9.4 / Gradle 9.6.

API 36 is the stable Android 16 platform at this checkpoint. Android 17 / API 37 remains a preview SDK, so the canary does not depend on preview SDK channels merely to produce a reliable installable build.

## Navigation and access model

### Live — guest + authenticated

Latest active canonical CineRelay events.

Cards expose:

- verification state;
- event type;
- detected time;
- entity/title;
- canonical headline;
- concise evidence-backed summary when a READY P5.5 projection exists;
- strongest evidence/source;
- evidence/conflict counts;
- Creator Radar score/label when available;
- one-action original-source link.

Follow is account-owned. A guest tapping Follow is offered Create account / Sign in rather than receiving a failed mutation.

### Following — authenticated

The same trusted event anatomy restricted to the signed-in user's active entity follows.

Guests see an explanatory locked-state card with Create account, Sign in and Continue exploring Live actions.

### Creator Radar — guest + authenticated

Event cards ranked by the separate P5.4 editorial score. Radar remains an overlay and never changes canonical verification or factual priority.

### Alerts — authenticated

User-specific alert-delivery history plus the real-device Firebase canary card.

Guests see an explanatory account gate; no alert/device state is created until they authenticate.

## Authentication

CineRelay uses Supabase email/password authentication through public Auth endpoints and stores a refreshable user session locally.

The auth sheet supports:

- Create account;
- Sign in;
- switching between both modes;
- basic email/password validation;
- successful-session persistence;
- email-confirmation-required responses without pretending the user is authenticated;
- dismissal at any point so the user can continue browsing as a guest.

The phone receives only:

- Supabase project URL;
- Supabase publishable key;
- the user's own access/refresh session after authentication.

It never receives:

- service-role key;
- internal scheduler/worker secret;
- YouTube/Meta credentials;
- Firebase service-account private key;
- any connector or operator credential.

## Mobile API trust split

`cinerelay-mobile-api` is the shaped mobile boundary.

Public read-only actions:

- `live`;
- `radar`.

Authenticated actions:

- `bootstrap`;
- `following`;
- `alerts`;
- `setFollow`.

For public actions, absence of a bearer means guest access. The guest projection does not query user-specific follow state and emits `followed=false`.

If an Authorization bearer is supplied, it is validated with `auth.getUser()`. An invalid bearer returns `401 invalid_session` even for Live/Radar; it is never silently downgraded into a guest request.

Account-owned actions with no valid user return `401 authentication_required`.

Service-owned internal tables remain unavailable directly to the Android client.

Device registration continues to use the already-proven authenticated `cinerelay-device-registration-api` rather than duplicating token ownership logic.

## Firebase contract

Package name is frozen for the canary and future V1:

`com.cinerelay.app`

The APK is buildable without Firebase client configuration. In that state:

- guest Live/Radar and normal authenticated data UI remain usable;
- the Alerts screen visibly reports that Firebase is not configured after authentication;
- no fake token or fake successful canary is produced.

When a valid `google-services.json` exists, the app:

1. asks for notification permission only when the authenticated user enables alerts;
2. obtains the FCM registration token;
3. registers it through the authenticated P5.2 device API;
4. re-registers on Firebase token rotation;
5. receives foreground notifications through `FirebaseMessagingService`;
6. deep-carries `eventId` into the app intent for later event-detail routing.

The Firebase server credential remains server-side only.

## Build / CI contract

A dedicated Android workflow must prove:

- guest-aware `cinerelay-mobile-api` Deno type-check;
- deployment-native mobile API bundle creation;
- JDK 17 / Gradle 9.6 Android build;
- stable API-36 SDK availability;
- `:app:assembleDebug` success;
- installable APK exists and is non-empty;
- Android source/APK do not contain privileged server-secret markers;
- APK + SHA-256 are uploaded as an artifact.

The existing CineRelay four-job CI remains required in parallel so Android work cannot regress the intelligence/backend stack.

## Guest-first exit gate

Engineering-complete when:

1. existing CineRelay CI is green;
2. Android/mobile-API CI is green;
3. exact CI-built guest-aware `cinerelay-mobile-api` bundle is deployed hosted;
4. guest Live/Radar succeed anonymously;
5. Following/Alerts remain authentication-gated;
6. invalid supplied bearer remains rejected;
7. guest/auth-failure probes create no personal state;
8. the exact V0.1.1 APK artifact is downloadable and installable.

These conditions are satisfied by CineRelay CI #353, Android Canary CI #19 and hosted mobile API v2. Exact proof is recorded in `docs/07-execution/P6_0_1_IMPLEMENTATION_STATUS.md`.

## Real-device canary gate

Real-device canary-complete when, in addition:

1. Firebase Android config exists for `com.cinerelay.app`;
2. server-side FCM credential is configured;
3. one authenticated physical device registers;
4. one controlled alert is delivered exactly once;
5. transient retry/recovery is verified;
6. explicit `UNREGISTERED` handling is verified;
7. hosted security/advisor checks remain clean.

Only then is the remaining Phase-5 delivery exit gate formally closed.

## Deferred to later Phase-6 slices

- Titles/timeline detail UI;
- Search;
- source pages;
- Room offline cache;
- deep-link event detail routing;
- polished launcher icon/brand assets;
- richer filters and bottom sheets;
- final encrypted/credential-protected session storage;
- notification preference editing;
- production push cron activation.
