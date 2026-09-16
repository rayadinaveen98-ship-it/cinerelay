# Phase 6 P6.0.1 Design — Android V0.1 Canary

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / APK CI PENDING / REAL FIREBASE DEVICE CANARY PENDING**

Parent checkpoint:

`phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`

## Purpose

P6.0.1 is intentionally the bridge between the completed Phase-5 engineering foundation and the visible Android product.

It must:

1. make real CineRelay signals visible on an installable Android app;
2. reuse the proven Phase-5 follow/Radar/alert contracts rather than invent parallel mobile state;
3. provide the authenticated real Android installation needed to complete the remaining P5.2 Firebase delivery canary;
4. become the durable base for full Phase-6 Android V1.

## Product boundary

This is not a mockup and not a sample-data demo.

The canary reads hosted CineRelay canonical events and user-specific state. It must not bypass the server-side trust model or put privileged backend credentials in the APK.

## Visual direction

The Android app follows the frozen CineRelay design philosophy:

- premium cinema intelligence newsroom / signal room;
- dark-first deep charcoal surfaces rather than pure black;
- cinematic through hierarchy, spacing and restraint rather than decorative movie clichés;
- dense but calm information;
- verification/evidence visible directly on event cards;
- semantic status colors used sparingly;
- bottom navigation and a single-column mobile feed.

## V0.1 navigation

The first installable build exposes four working destinations:

### Live

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
- follow/unfollow action;
- one-action original-source link.

### Following

The same trusted event anatomy restricted to the signed-in user's active entity follows.

### Creator Radar

Event cards ranked by the separate P5.4 editorial score. Radar remains an overlay and never changes canonical verification or factual priority.

### Alerts

User-specific alert-delivery history plus the real-device Firebase canary card.

## Authentication

V0.1 uses Supabase email/password authentication through the public Auth endpoint and stores a refreshable user session locally.

The phone receives only:

- Supabase project URL;
- Supabase publishable key;
- the user's own access/refresh session.

It never receives:

- service-role key;
- internal scheduler/worker secret;
- YouTube/Meta credentials;
- Firebase service-account private key;
- any connector or operator credential.

## Mobile API

`cinerelay-mobile-api` is the shaped authenticated boundary for normal mobile data.

It independently validates the bearer token using `auth.getUser()` and exposes only user-appropriate actions:

- `bootstrap`;
- `live`;
- `following`;
- `radar`;
- `alerts`;
- `setFollow`.

Service-owned internal tables remain unavailable directly to the Android client.

Device registration continues to use the already-proven `cinerelay-device-registration-api` rather than duplicating token ownership logic.

## Firebase contract

Package name is frozen for the canary and future V1:

`com.cinerelay.app`

The APK is buildable without Firebase client configuration. In that state:

- normal CineRelay login/data UI remains usable;
- the Alerts screen visibly reports that Firebase is not configured;
- no fake token or fake successful canary is produced.

When a valid `google-services.json` exists, the app:

1. asks for notification permission only when the user enables alerts;
2. obtains the FCM registration token;
3. registers it through the authenticated P5.2 device API;
4. re-registers on Firebase token rotation;
5. receives foreground notifications through `FirebaseMessagingService`;
6. deep-carries `eventId` into the app intent for later event-detail routing.

The Firebase server credential remains server-side only.

## Build / CI contract

A dedicated Android workflow must prove:

- `cinerelay-mobile-api` Deno type-check;
- deployment-native mobile API bundle creation;
- JDK 17 / Gradle 9.6 Android build;
- API-37 SDK availability;
- `:app:assembleDebug` success;
- installable APK exists and is non-empty;
- Android source/APK do not contain privileged server-secret markers;
- APK + SHA-256 are uploaded as an artifact.

The existing CineRelay four-job CI remains required in parallel so Android work cannot regress the intelligence/backend stack.

## V0.1 exit gate

Engineering-complete when:

1. existing CineRelay CI is green;
2. Android/mobile-API CI is green;
3. exact CI-built `cinerelay-mobile-api` bundle is deployed hosted;
4. hosted auth/zero-side-effect boundary is verified;
5. the exact APK artifact is downloadable and installable.

Real-device canary-complete when, in addition:

6. Firebase Android config exists for `com.cinerelay.app`;
7. server-side FCM credential is configured;
8. one authenticated physical device registers;
9. one controlled alert is delivered exactly once;
10. transient retry/recovery is verified;
11. explicit `UNREGISTERED` handling is verified;
12. hosted security/advisor checks remain clean.

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
