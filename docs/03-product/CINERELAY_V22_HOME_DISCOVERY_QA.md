# CineRelay V2.2 — Home discovery acceptance

Branch `feature/cinerelay-v22-netflix-home-discovery` stacks on the approved visual direction in V2.1 PR #83. No backend/database changes.

## Home behavior

- Hero carousel: only the content headline; NO source, verification, freshness or "featured" label. Dots permitted. Tapping the artwork opens the complete story/evidence screen.
- Toolbar: Search, Explore (grid icon with accessibility label) immediately beside Archive; Refresh remains available from pull-to-refresh.
- Latest Updates: cinematic landscape rail. A See all action opens the existing Just In category full listing.
- Following Latest, render every non-empty discovery collection as a real horizontal rail: Evolving Stories, Just In, Trending Across Sources, Indian Cinema, English & International, individual Indian languages, trailers, first looks, OTT, music, events, official sources and favorites.
- Remove the old "Explore More" chip row entirely. The header Explore icon opens the complete category directory and each collection has a See all full-screen destination with working Back.
- Controlled card families: landscape news stories; portrait artwork-led film categories; compact update rows. Only titles use the main emphasis; source/freshness in smaller secondary text.
- Only loaded, source-backed updates appear. A maximum of 160 recent loaded updates is grouped on Dispatchers.Default; no synchronous pairwise clustering on the UI thread.
- Featured and Latest items are restricted to the last 24h. Deep shelves may include older already-loaded content without marking it breaking. Just In excludes the hero and latest highlights to avoid immediate duplication; other topical shelves may legitimately overlap.

## Device visual + functionality QA

1. Hero for 1–3 items, images missing / failed, long English and Telugu headline, dots, tapping to story and Back.
2. Header Search, Explore and Archive on 360/393/412dp. Check title truncation; all actions remain 48dp tappable; pull-down refresh.
3. Explore directory → collection → Back. Home rail See all → full screen → story → Back. No blank list or stale overlay.
4. Home vertical scroll with 0, 1, 5, 20+ nonempty rails; sideways swipe a long rail; no scroll freeze; scroll restoration after 10 story-open/back cycles.
5. Sections disappear when empty; prevent adjacent repeated Just In thumbnails; ensure OTT/film claims are supported by original sources.
6. Test airplane mode/offline, loading, new account/no favorites, Telugu fonts 1.3x/2x and media cache behaviour on Samsung A54.
7. Confirm actual Android canary build and stable signing before sharing a preview APK. CI alone is not a device-acceptance signoff.
