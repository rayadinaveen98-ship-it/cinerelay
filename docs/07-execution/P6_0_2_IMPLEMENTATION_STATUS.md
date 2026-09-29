# P6.0.2 Implementation Status — Premium Live + Evidence UI

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED EVIDENCE API DEPLOYED / APK READY / FIREBASE DEVICE CANARY STILL PENDING**

Branch:

`phase-6/android-v0.2-premium-evidence-ui`

Stacked parent:

`phase-6/android-v0.1-canary` @ `7721f04b6abad9d499a4a0028568e0ab555cc47b`

Draft PR:

`#17 — Phase 6 P6.0.2: Premium Live and evidence UI`

## Product changes

V0.2 replaces the launcher root with `CineRelayV02App` while leaving V0.1.1 intact as a rollback/reference surface.

Visible upgrades:

- compact guest-first Live intro rather than a large welcome card;
- stronger CineRelay/section typography hierarchy;
- premium dark cinema-intelligence card treatment;
- entity identity tiles without inventing poster art;
- non-wrapping bottom navigation;
- clearer verification and Radar signals;
- evidence promoted to a first-class action;
- strongest source still available directly from the card;
- lazy Evidence bottom sheet for the complete proof trail;
- clearer authenticated/guest boundaries;
- Android version `0.2.0-canary`, versionCode `3`.

## Evidence detail contract

New `cinerelay-evidence-api`:

- read-only;
- accepts active / needs-review canonical event IDs only;
- guest-readable;
- supplied invalid bearer is rejected with `401 invalid_session` rather than silently downgraded;
- returns ordered evidence: PRIMARY -> CORROBORATING -> REPEAT -> CONFLICTING;
- exposes source name, source role, authority tier, platform, handle, evidence role, weight, raw title, canonical URL, published time and first-seen time;
- creates no follow, alert or device state.

The Android client lazy-loads this endpoint only when Evidence is opened, keeping Live/Radar feed payloads small.

## CI proof

Corrected implementation head:

`28ee27a983602487d962ab28665134dfed4b1003`

### CineRelay CI #358

Run `35113978324` — all four jobs PASS:

- intelligence/connectors;
- fresh database migrations + pgTAP + lint;
- Edge functions;
- web console.

### Android Canary CI #24

Run `35113978187` — both jobs PASS:

- guest-aware mobile API type-check;
- evidence-detail API type-check;
- deployment-native bundles for both mobile APIs;
- stable Android API 36/JDK 17/Gradle 9.6 setup;
- source secret scan;
- V0.2 `assembleDebug`;
- APK package/secret verification;
- checksum generation;
- installable APK upload.

Artifacts:

- APK artifact ID `10454660661`;
- APK archive digest `sha256:c89db1f738bad4b83c43bcb972971c1fb78a517f05e7ee0863e4d54203086a09`;
- extracted APK SHA-256 `821fca4ff9d75661a56620169a4682c27c4ea4bc41ed7606244c145cea6d372f`;
- mobile-API bundle artifact ID `10452994317`;
- mobile-API archive digest `sha256:137a7f357fa464648f642628075252e4e170828c5951d438b38bc41817a5f6eb`;
- exact evidence API bundle file SHA-256 `1b3eef080f786ada01bff8d9f3ff18293de2d8317764d4ebb6e6f6fc019db67f`.

## Hosted evidence API proof

Hosted runtime:

- function `cinerelay-evidence-api`;
- ID `a39d65b8-d538-4005-820c-c64656a1fb38`;
- version `2`;
- status `ACTIVE`;
- runtime SHA `ffd5dac87ce1aecd0242219e8154bd3f8987dbdec849a1b37a637deca986b832`;
- `verify_jwt=false` by design because the function supports guest read-only access and performs its own optional bearer validation.

Family Pack hosted canary:

- event `6997a341-3753-5c59-a93f-68eb5221a5bd`;
- guest request -> HTTP `200`;
- verification `OFFICIAL`;
- evidenceCount `1`;
- conflictingEvidenceCount `0`;
- evidence role `PRIMARY`;
- source `Mythri Movie Makers`;
- authority tier `1`;
- source role `PRODUCTION_HOUSE`;
- platform `YOUTUBE`;
- handle `@mythrimoviemakers`;
- canonical source URL present;
- invalid bearer -> HTTP `401`, `invalid_session`.

Before/after hosted probes:

- follows `0`;
- alert deliveries `0`;
- device registrations `0`.

Therefore evidence inspection is zero-side-effect for personal state.

## Hosted bug caught during canary

The first hosted evidence deployment selected a nonexistent `raw_items.received_at` field and returned HTTP `500`.

The production contract was corrected to use the real hosted `raw_items.first_seen_at` column while preserving the Android-facing `receivedAt` response name. A fresh full CI was required and passed before the corrected runtime was deployed.

## Remaining external gate

P6.0.2 does not change the outstanding Firebase physical-device gate from P5.2/P6.0.1. Real FCM client/server configuration, token registration, exactly-once delivery, retry recovery and explicit `UNREGISTERED` handling are still required before that delivery gate can close.
