# P6.0.51 — Control Room + navigation cleanup

## Goal

Move CineRelay's operational controls out of floating feed overlays and into one deliberate, authenticated settings surface without changing the evidence-first newsroom model.

## Implemented in this slice

- Added `ControlRoomV051` as a full-screen authenticated control surface.
- Added a dedicated `You` entry to the primary Android navigation.
- Removed floating Home overlays for:
  - platform lane selection,
  - YouTube source-role selection,
  - verification/confidence filtering.
- Removed the floating Alerts master-notification overlay.
- Preserved the same underlying newsroom state and filtering APIs; the controls now live in Control Room.
- Control Room currently exposes:
  - signed-in account identity and sign-out,
  - active newsroom lane,
  - YouTube source-type filter,
  - signal-confidence filter,
  - source-notification master switch,
  - selected notification source count,
  - current Videos/Shorts notification scope.
- X remains intentionally paused and cannot be activated from the Control Room.
- Notification permission is still requested only when the user explicitly turns notifications on.

## Navigation contract

Current primary destinations remain:

1. Home
2. Sources
3. Radar
4. Alerts
5. You → Control Room

The long-term navigation target can be revisited when the OTT destination lands; Control Room is intentionally separated from content destinations so account/settings controls do not compete with content discovery.

## Safety / regression expectations

P6.0.51 must preserve:

- P6.0.50 auth gate,
- auth → onboarding → app ordering,
- onboarding retry path,
- source thumbnails and source-detail thumbnails,
- server-backed notification state,
- permanent signing and monotonic Android version codes,
- update-over-existing-install behavior.

## Next

- Finish Android CI/canary verification for this slice.
- Physical-device review of Control Room and navigation density.
- P6.0.52: official Web lane, RSS repair, first-party website onboarding.
- P6.0.53: Story Clusters, Film/Series hubs, global search.
- P6.0.54: OTT Release Intelligence.
