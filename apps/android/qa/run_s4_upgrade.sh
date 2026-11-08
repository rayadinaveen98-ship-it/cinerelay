#!/usr/bin/env bash
# Runs as ONE shell process under the Android emulator runner.
# Never distribute either APK or treat this as public-release approval.
set -euo pipefail

PACKAGE=com.cinerelay.app
BASELINE=previous-v027/CineRelay-v0.2.7.apk
CANDIDATE=s4-release-results/CineRelay-v0.2.9-stable-candidate.apk
mkdir -p s4-emulator-evidence
adb wait-for-device
test -s "$BASELINE"
test -s "$CANDIDATE"

# Baseline was independently verified on initial download; check again.
printf '%s  %s\n' \
  3cef2f4a3b7586189f0e6731c5a65f4c82d263190cbfab6c1b8355fc7998c8ab \
  "$BASELINE" | sha256sum --check --status

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
test -d "$SDK_ROOT/build-tools"
AAPT="$(find "$SDK_ROOT/build-tools" -type f -name aapt | sort -V | tail -n 1)"
SIGNER="$(find "$SDK_ROOT/build-tools" -type f -name apksigner | sort -V | tail -n 1)"
test -x "$AAPT"
test -x "$SIGNER"

BADGING="$("$AAPT" dump badging "$BASELINE")"
grep -Fq "package: name='com.cinerelay.app' versionCode='210007' versionName='0.2.7'" <<< "$BADGING"

EXPECTED="$(tr -d '[:space:]' < apps/android/signing/cinerelay-update-cert.sha256 | tr '[:lower:]' '[:upper:]')"
[[ "$EXPECTED" =~ ^[A-F0-9]{64}$ ]]
for apk in "$BASELINE" "$CANDIDATE"; do
  CERTS="$("$SIGNER" verify --print-certs "$apk")"
  ACTUAL="$(awk -F': ' '/certificate SHA-256 digest/{print toupper($NF); exit}' <<< "$CERTS" | tr -d ':[:space:]')"
  [[ "$ACTUAL" =~ ^[A-F0-9]{64}$ ]]
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "::error::APK does not match CineRelay's permanent update-signing certificate"
    exit 1
  fi
done

# No uninstall or pm clear between installations. In-place Android upgrade.
adb install -r "$BASELINE"
adb shell dumpsys package "$PACKAGE" | grep -F 'versionCode=210007'
adb install -r "$CANDIDATE"
adb shell dumpsys package "$PACKAGE" | grep -F 'versionCode=221001'

adb logcat -c
adb shell am start -W -n "$PACKAGE/.MainActivity"
sleep 8
adb shell pidof "$PACKAGE" >/dev/null
adb shell dumpsys activity activities | grep -F "$PACKAGE"
adb exec-out screencap -p > s4-emulator-evidence/first-launch.png
test -s s4-emulator-evidence/first-launch.png
adb logcat -d -v brief > s4-emulator-evidence/startup-logcat.txt
if grep -q -E "FATAL EXCEPTION|ANR in $PACKAGE" s4-emulator-evidence/startup-logcat.txt; then
  echo "::error::Possible fatal exception or app ANR during upgrade startup smoke test"
  exit 1
fi

echo "Verified: published v0.2.7 -> signed S4 candidate in-place upgrade and launch."
echo "Not claimed: historical S3 RC1 upgrade, account/data migration, physical-device QA, or publication approval."
