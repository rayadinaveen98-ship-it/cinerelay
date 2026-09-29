# P6.0.20 — Android signup-response fix

Status: BUILD VALIDATION TRIGGERED

## Problem reproduced on physical device

A successful Supabase email/password signup with Confirm Email enabled returned no authenticated session. The previously installed CineRelay APK treated that privacy-safe successful response as an incomplete auth response and showed a red error even though the account was created.

## Current branch behavior

`BackendClient.signUp()` now treats any successful signup response without access/refresh tokens as a confirmation-required result instead of throwing an error. The UI routes the user back to Sign in with a confirmation notice.

## Physical-device proof state

A new `rayadinaveen98@gmail.com` account was successfully created in hosted Supabase at 2026-09-17T17:11:13Z and remains unconfirmed. This proves the red error came from client response handling rather than failed account creation.

## Validation

This checkpoint intentionally triggers a fresh Firebase-enabled Android canary build from the current branch so the corrected auth behavior can be installed and tested on a physical device.
