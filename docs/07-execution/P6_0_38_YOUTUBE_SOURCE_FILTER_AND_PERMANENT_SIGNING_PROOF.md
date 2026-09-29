# P6.0.38 — YouTube source filters + permanent Android signing proof

Status: **implementation complete; CI and permanent signer proof passed; physical in-place update proof remains**

## Scope

P6.0.38 closes two practical gaps created by the larger Phase 6 newsroom:

1. keep the 57-source YouTube lane useful by exposing source-role filtering in Android, without changing the evidence or ingestion contracts;
2. establish the first CI-published CineRelay APK signed by the permanent update key so future builds can be updated in place rather than requiring uninstall/reinstall.

## 57-source newsroom context

The active first-party YouTube mesh is now 57 sources. The latest role balance is:

- 34 production houses
- 14 music labels
- 8 OTT/platform sources
- 1 media/library source

The X lane remains intentionally separate and dormant. No X identity was activated as part of this slice.

## Android YouTube source-type filter

The newsroom API already returns each source's `source_role`, and Android already carries it as `NewsroomSignal.source.role`. P6.0.38 therefore adds the filter entirely on the Android client; there is no schema migration and no newsroom API contract change.

YouTube Live now exposes:

- All sources
- Production
- OTT
- Music

The source-type filter composes with the existing confidence filter. Examples include `OTT + Verified` and `Music + Developing`.

The control is YouTube-only. Switching to X resets the source-type filter to `All` and hides the source-type control, preserving the separate platform-lane model.

Implementation paths:

- `apps/android/app/src/main/java/com/cinerelay/app/ui/CineRelayViewModel.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/ui/NewsroomSourceFilterOverlay.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/MainActivity.kt`

Implementation commits included:

- `e01147d5c4f9e84e72f41bb4b94e6d4fec68943f` — source-role filter state/composition
- `44b0b9d55d640e6161b9065d33b58c87439e4abd` — source filter sheet
- `50b1e000bcd43bd02fb769270654078d2e26612f` — expose the YouTube source-type control on Home

## CI proof for the source-filter implementation

On implementation head `50b1e000bcd43bd02fb769270654078d2e26612f`:

- CineRelay CI run #487: **success**
- Android Canary run #153: Android/Kotlin build **success** through `:app:assembleDebug`
- Firebase build contract: **success**
- monotonic version/update-signing build contract: **success**

Run #153 then failed only in the post-build signer-verification shell parser. The APK itself had already compiled correctly.

## Signer-verification incident and root cause

The permanent signing secrets were present and valid. `apksigner --print-certs` emitted a line in the form:

`V2 Signer: certificate SHA-256 digest: <digest>`

The workflow parsed field `$2` after splitting on `: `, which returned the label `certificate SHA-256 digest` rather than the digest value. The resulting signer mismatch was therefore a CI parsing false negative, not an APK signing failure.

The parser was corrected in commit:

`451727489959c806d1ab8cc21b70a65a409db56d`

The corrected workflow extracts the actual digest field and compares it with the pinned CineRelay signer fingerprint.

## Corrected permanent-signer proof

On commit `451727489959c806d1ab8cc21b70a65a409db56d`:

- CineRelay CI run #488: **success**
- Android Canary run #154: **success**
- Firebase Android client configuration: **true / validated for `com.cinerelay.app`**
- permanent update signing: **configured and validated**
- APK assembly: **success**
- signer verification: **success**
- updateable Android artifact upload: **success**

Published baseline build:

- versionCode: `200154`
- versionName: `0.2.1-canary.154`
- artifact name: `cinerelay-android-v0.2.1-update-apk`
- artifact ID: `10552746141`
- pinned/verified certificate SHA-256:
  `17728AEDEE7361B8C7126C3317BD396FEE4DDED3AB8790594FDE5BD7E0123617`

This is the first fully verified CI-published CineRelay APK in the permanent signing lineage.

## Update-safety gate

CI proof establishes that the permanent key, Firebase client configuration, package identity, monotonic versioning and artifact publication are correct. It does **not** by itself prove Android Package Manager accepted an in-place upgrade on a physical device.

The remaining proof sequence is deliberately two-build:

1. install the permanent-signed baseline (`versionCode 200154`) on the physical device;
2. generate a later permanent-signed build with a strictly higher versionCode;
3. install that later APK over the baseline **without uninstalling**;
4. verify the app opens normally and retained app data/session where applicable.

If the currently installed CineRelay APK was signed by an older temporary/debug lineage, one final clean install is unavoidable before step 1. After the permanent baseline is established, no further uninstall should be required for normal updates signed by this key.

## Release-gate status

- 57-source YouTube mesh: **complete**
- source-role filtering: **complete**
- permanent signing secrets: **complete**
- signer parser: **fixed**
- permanent-signed baseline APK: **published and cryptographically verified**
- second higher-version permanent APK: **next CI build**
- physical no-uninstall update proof: **pending device execution**
- server FCM delivery proof: **separate gate; still requires `CINERELAY_FCM_SERVICE_ACCOUNT`**

PR #17 remains draft until the remaining release gates are closed.
