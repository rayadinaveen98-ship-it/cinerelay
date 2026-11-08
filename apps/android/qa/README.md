# S4 emulator upgrade QA baseline: published v0.2.7

The prior S4 workflow attempted to fetch `cinerelay-v25-s3-minified-release-rc1`
from historical GitHub Actions run `39275984882`. Its retention expired,
so the Android upgrade smoke could not start even though the current branch
successfully compiled, ran JVM tests, and built a signed/minified APK.

## Replacement test — scope is different and explicitly labeled

The Android emulator now tests the exact **published CineRelay v0.2.7 APK**
(`versionCode=210007`) upgrading to the newly compiled, signed S4
candidate (`versionCode=221001`). This is **not** the earlier S3 RC1
(`versionCode=221000`) comparison and must not be described as such.

The old release is anchored to official GitHub Release tag `v0.2.7`:

- Exact APK name: `CineRelay-v0.2.7.apk`
- GitHub release asset ID: `646215448`
- Byte count: `2317064`
- SHA-256: `3cef2f4a3b7586189f0e6731c5a65f4c82d263190cbfab6c1b8355fc7998c8ab`

`apps/android/qa/fetch_verified_v027.py` only accepts the matching
published GitHub release metadata, original asset ID/name/digest/size,
and downloads the APK via official GitHub HTTPS URLs. When the normal
release URL fails transiently it can try the **same asset ID** through
GitHub's official release-assets API. A mismatching file/JSON body fails;
there is no alternate mirror, file substitution or relaxed checksum.

Inside the Android emulator workflow, official Android SDK build tools
validate the previous APK package, version and signature fingerprint
against the repository's public permanent update certificate, before
`adb install -r`. The new candidate is built and verified separately
by the S4 release job. Version change, launch and sampled crash checks
run in the emulator.

## Verification and release status

- Python standard-library tests require no network and cover exact immutable
  metadata, transient 504 fallback, incorrect checksum, wrong byte count,
  API JSON response, forbidden 403, draft release and untrusted hosts.
- The previous release and current candidate are **QA inputs only**;
  this does not distribute a new APK or approve any website download.
- A green emulator startup check is not authenticated Home/OTT/Radar QA,
  saved-user-data migration, signing-key custody review or owner sign-off.
- The old S3 RC1 comparison remains unavailable until a separately verified
  copy of that exact RC1 APK is recovered. Do not pretend the new baseline
  is equivalent to that RC1 test.
- Never upload keystores, signing passwords, private test accounts or live
  user data to this public repository.

The NAVIN STUDIO release manifest remains unchanged until approved.
