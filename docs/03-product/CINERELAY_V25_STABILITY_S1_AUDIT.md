# CineRelay V2.5 — Stability Audit S1

Base: PR #87 (V2.5 Home/performance), stacked after PRs #83–#86.
Scope: **bug fixes only**. No redesign, new product functions, database deletion or live deployment.

## Findings verified in source

| Severity | Finding | S1 action |
|---|---|---|
| High | In-flight personalization response could arrive after sign-out or login change and repopulate the previous account's favorites/onboarding state. | Account-specific request generations, checks on cached fetch, network success/failure and save callbacks. |
| High | Story detail fetch could finish after Back and reopen the dismissed detail overlay. | Increment detail generation on open/close; ignore stale responses and different account IDs. |
| High | Sources directory cached another account's notification selection; logout did not clear Sources VM. | Explicit reset and invalidation on unauthenticated state, guarded async notification toggle. |
| High | Archive state and pagination persisted across user sessions; in-flight result could arrive after logout. | Account-scoped Archive loading, reset and generation checks. |
| Medium | OTT, Today and Archive trigger duplicate loads from navigation click and LaunchedEffect. | Keep one loading lifecycle in the corresponding LaunchedEffect. |
| Medium | Archive loading state was set *inside* a launched job, allowing simultaneous calls to dispatch duplicate requests. | Set loading/loadingMore synchronously before scheduling fetch. |
| High | Startup bootstrap and push status response from old account could write into a newer session. | Account ID check before success/error state updates. |

## Tests and verification

- `CineRelayStabilityS1SessionTest` covers invalidation after logout/Back, newest-detail-wins and ignored stale archive pagination.
- Retain V2.1–V2.5 existing functional CI suites (OTT filtering, notification, consumer, app navigation, Home and build-signing).
- Test signed-in Account A → Sources / Archive / Favorites → sign out → Account B: **no Account A personalization or notification selection visible**. Ensure A's pending API responses do not resurface.
- Open story, press Back while loading, open another story and verify only the latest story appears. Test rapid back-to-back and offline requests.
- Open OTT, Today and Archive once and inspect network request counts. Reopen and refresh, ensuring data still loads and Back returns correctly.
- Phone QA: 10 Home→OTT/Radar→Home cycles and scroll restoration, 5-second hero autoplay, cold and warm startup, 1.3×/2× fonts, notification permissions, sign-out and sign-in.
- Capture Android Studio/adb logcat for crashes and latency. GitHub CI alone is not sufficient to mark stable.

## Release gating
- Six GitHub checks and Android APK-signing green on S1 head.
- Full QA on Samsung A54 plus explicit user approval after installed build.
- Consolidate stacked PRs #83–#87 and S1 in dependency order; do not independently merge an upper stacked PR onto main.
- Then prepare versioned stable APK and release tag. No stable version claimed during S1.
