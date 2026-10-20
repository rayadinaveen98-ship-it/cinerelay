# CineRelay V2.5 — instantaneous Home return & autoplay acceptance

This PR stacks on V2.4 #86. Scope ONLY Home performance and hero slideshow; OTT, Today, Radar, onboarding, sources and data ingest unchanged.

## Diagnosed code problems
1. Navigating from Home to OTT/Radar unmounts the Home composable; `produceState(initialValue=null)` previously rebuilt all category rails and pairwise story clusters on every return. Loading spinner could be the only visible element during that projection.
2. V2.4 re-fetches personalization unnecessarily on each Home refresh. It also publishes YouTube before Web but the UI projection would be rebuilt twice.
3. Hero used a manual `HorizontalPager` with **no automatic page transition**.
4. Live Supabase edge-function evidence alone (median approximately 2.7s, 95th approximately 6.5s) does not establish the full reported 20–30s on device. Main-thread/frame timings need actual phone measurement.

## Changes
- Activity-scoped `HomeProjectionCacheV25` keeps previously grouped Home rails plus vertical scroll state across Home → Radar / OTT → Home.
- Identity/content/personalization-keyed cache; never reuse prior account's data. Rebuilds asynchronously on a genuine feed or favorites change.
- Render up to ten genuinely recent YouTube slides instantly from loaded signals while full discovery rails compute in background. Never put Web results into the hero.
- Suppress the tall loading spinner when the fast first hero is available.
- Remove needless personalization network call from regular Home refresh.
- Reduce cluster scoring overhead by retaining one representative per cluster during grouping.
- Automatically advance slides every 5000ms; keep manual swiping, respect off-screen state and stop when Home leaves composition; reverse wrap to first page.
- Add diagnostic log `CineRelayHomePerf projection_ms` alongside V2.4 cache/API timing logs.

## Device acceptance (Samsung A54)
- Cold launch, warm launch, Home → Radar → Home and Home → OTT → Home. Measure first visible content and fully populated rails, three times each.
- Passing target: returning to an already loaded Home must display content without a 20–30s wait. Target sub-second to reuse projection; cold load depends on network.
- Scroll 10+ rails, navigate to OTT and return; previous scroll position retained. Open a story, Back, no lost position.
- Hero 0, 1, 3, 10 recent YouTube items: automatic 5s progression, manual swipe, page indicators, wraparound, stop offscreen. Full story opens on tap.
- Load with no/slow internet and after a new YouTube update. No cross-account cache, no duplicate background refresh loops or data staleness.
- All GitHub CI green, signed APK artifact; keep draft until device tested.
