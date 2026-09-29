# P6.0.20 — Real-device push readiness

Status: **HOSTED-PROVEN / REAL DEVICE READY / FIRST NATURAL DELIVERY PENDING**

Date: 2026-09-17
Branch: `phase-6/android-v0.2-premium-evidence-ui`

## What is proven

A physical Android device using the Firebase-enabled CineRelay canary successfully registered with the hosted device-registration path.

Hosted production state after opt-in:

- active FCM Android devices: **1**
- active entity follows: **1**
- followed entity: **Family Pack** (`MOVIE`)
- pending push deliveries: **0**
- sent push deliveries: **0**

No user email, auth UUID, FCM token, installation id, or other personal/device identifier is recorded in this public proof document.

## Alert planner defaults verified

`public.plan_event_alerts()` safely handles the absence of an explicit `user_alert_preferences` row with these defaults:

- alert mode: `INSTANT`
- minimum priority band: `HIGH`
- include `DEVELOPING`: `true`
- include `RUMOR`: `false`
- quiet hours: disabled
- event-specific alert setting: enabled by default

This means the first real followed canonical `HIGH`/eligible update can be planned without requiring a separate preference bootstrap row.

## No retroactive alert replay

The active `Family Pack` canonical event existed before the follow was created.

The planner requires:

`follow.created_at <= event.created_at`

Therefore the historical event is intentionally **not** replayed as a new push. This is the desired anti-spam behavior.

## Signup-response client fix

The current branch contains the corrected signup parser: successful Supabase signup responses without an authenticated session are treated as confirmation-required instead of a malformed response.

Fresh Firebase-enabled canary proof:

- branch head used for build: `571cf9284af9848453b03f2e2809e18b7009e8e4`
- CineRelay CI #432: **SUCCESS**
- Android Canary #98: **SUCCESS**
- Firebase Android config for `com.cinerelay.app`: validated
- `CINERELAY_FIREBASE_CONFIGURED=true`
- Google Services processing: PASS
- Firebase build contract: PASS
- package/secret scan: PASS
- APK artifact id: `10509755894`
- APK SHA-256: `e0f2ba77cc2d08a8c3c9b57552c5913ba6d9e0268091ec75c360a83c3b8fd191`
- artifact ZIP digest: `sha256:ea15eae4d432f92e2c8ccb89c24362c905bf925fbe65e143f735b6babb634f47`

## Remaining P6.0.20 proof

Do not synthesize an event merely to produce a lock-screen screenshot.

The remaining proof is one **naturally eligible canonical event created after the follow** that:

1. belongs to the followed entity;
2. satisfies current priority/trust rules;
3. creates an alert delivery via `plan_event_alerts()`;
4. is delivered by `push-delivery-worker` to the registered FCM device;
5. is observed on the physical Android device.

Until that natural delivery occurs, P6.0.20 is push-ready but the final lock-screen delivery proof remains pending.
