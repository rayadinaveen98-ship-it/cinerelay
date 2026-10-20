# CineRelay V2.3 — Home / OTT / Today cinematic acceptance

Stacked V2.3 Android-only visual revision on V2.2 PR #84.

## Shipping intent

- **Home:** Up to 10 distinct, truly latest stories within the past 24h, ordered by published/observed recency rather than favoring older image-rich stories. The hero's overlay remains headline-only. Refresh whenever the feed changes and on a ten-minute foreground Home interval; do not claim background push polling or guarantee 10 if insufficient feed results. Preserve other Home rails and story/Back behavior.
- **Artwork:** `CineArtworkBackdropV23` is original, local, deterministic graphic art. It is a visually appealing non-official fallback for absent/failed remote artwork (not an official logo, photo, movie poster or sourced film still). Mood per STORY / STREAMING / HISTORY / SOURCE. Real supplied art always wins.
- **OTT:** Refine (and active count) immediately beside Refresh. Button opens a bottom sheet: provider, language, type, evidence, Reset, Show Results. Filter state remains ViewModel-backed; only existing loaded evidence-supported releases are shown. Eliminate the previous big filter panel and redundant dashboard chips, put release rails near the top. Avoid text-only empty category repeats; preserve See All, precise dates, source links, conflict alerts and details.
- **Today:** Cinematic featured history visual chosen from real current-date entries (prefer genuine poster/backdrop when supplied), otherwise original HISTORY mood art. The date selector, quick-jump, full year rails, detail and evidence are retained. Posters consistently use 2:3 ratio. No random unrelated poster represented as historical film art.
- **Radar:** No direct visual changes; test shared fallback artwork compatibility only.

## Acceptance gates

1. All CI and canary Android builds green. Verify APK signing, Firebase contract and unit tests for timestamp eligibility.
2. Physically review 10/3/1/0 recent-story hero; stale/future timestamps; feed refresh while app is in Home; English and Telugu headline fit, no clipped indicators and no ghost image after URL change.
3. OTT: filter sheet opens/dismisses with swipe / Done / system Back; multiple filters combine correctly; Reset is reliable; changing filter does not leave category/details stale; refresh and date precision remain correct; empty results afford recovery.
4. Today: poster / backdrop / missing / failed artwork; date navigation across month/year boundaries; featured card opens correct detail; year See All; current date / non-current date label correctness.
5. Screen-size screenshot matrix 360, 393, 412dp, font scaling 1.3x / 2x and Samsung A54 checks. Monitor Home scroll/navigation smoothness and coil image caching.
6. Keep stacked PR a draft until on-device acceptance; passing CI is not a visual acceptance certificate.
