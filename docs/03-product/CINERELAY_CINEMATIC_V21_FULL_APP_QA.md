# CineRelay Cinematic V2.1 — complete Android experience contract

Status: **implementation branch; device acceptance pending**  
Base: Android V2 compact preview (PR #82), stacked on performance PR #81 and editorial PR #80.  
Goal: a distinctive Netflix-inspired cinematic discovery experience **without changing** data, evidence, release dates, notifications or source authority.

## Unified visual rules

- Original CineRelay identity, not Netflix branding: charcoal `#09090D`, panels `#17171D`, raised `#25252D`, restrained crimson `#FF5865`, high-contrast text `#F8F8FA`.
- Shared page/section/card title roles: 22/18/15sp; readable 14sp body and 12sp metadata. Do not remap a requested page title to 18sp.
- A consistent 16dp screen gutter, 12dp standard card radius, 12dp horizontal rail separation, at least 48dp action targets.
- Home shows image-led hero + source-backed horizontal news rails. Streaming, Radar, Today and Search use their existing genuine content and evidence models in matching compact compositions.
- Use only real, supplied artwork URLs, not fabricated official posters or title-to-image guessing. Use honest lightweight fallbacks for absent or failed artwork; never display duplicate text inside a fallback image.
- No fabricated release-day precision, source authority or event state. Details maintain original evidence and outbound references.
- Optimize on-device performance: keep current destination mounted behind story overlay; retain tab data and scroll state; avoid main-thread clustering.

## Screen and route coverage checklist

The first column enumerates **all user-facing families, not just bottom tabs**.
Status "styled" means common palette and geometry changes have been applied; it does not mean screenshot QA is complete.

| Surface | Entry and nested flows to verify | V2.1 code coverage |
|---|---|---|
| Splash / welcome | Animation, brand, reduced-motion, transition | shared cinema palette and sans-serif branding |
| First-run auth | Welcome, guest/auth choice, login, registration, failure, loading | shared palette and card geometry |
| Personalization | Languages, favorites, source selection, edit-and-save, empty/loading | shared palette and card geometry |
| Notifications onboarding | Source selection, content choices, permission, finish, failed setup | shared palette and card geometry |
| Home | App bar, hero, latest, favorite sources, category preview | new cinematic hero and horizontal rails |
| Home nested | Explore all, full rail list, story open, Back | shared headers and compact cards |
| OTT | All/date windows, language/provider/type/evidence filters, refresh, error | cinematic palette, compact no-poster cards |
| OTT nested | Weekend/Today/Now Streaming/Next 30 Days See All, release detail | shared headers, precise dates, card geometry |
| Radar | Featured signals, raw opportunities, source and scoring, error | compact typography, shared cards |
| Radar nested | Cover Now/Fresh/Watchlist See All, story | existing rails with common styling |
| Today | Date navigation, anniversaries, quick jump, loading/empty/error | portrait artwork, cinematic palette, shared cards |
| Today nested | Year See All, title detail and Back | shared headers and artwork |
| Universal Search | Query, title rail, updates, channels, OTT results, empty/error | portrait cards, consistent text and spacing |
| Search hub | Entity detail, activity/source/streaming, follow/unfollow | inherited shared screen surfaces |
| Sources | Directory, source details, notification toggle, platform/filter/role overlays | shared palette, cards and overlays |
| Archive | Query, pagination, story open and Back/scroll restoration | shared header, palette and cards |
| Story Details | Event/source update, changes, timeline, evidence, URLs, error/retry | shared typography and card geometry |
| Settings / You | Notification master, source settings, favorites, sign out | shared palette and cards |
| Legacy reachable routes | Older feed/signal/alerts/auth and control screen | shared palette and card geometry |
| Bottom navigation | Home, OTT, Radar, Today, You | common charcoal background and crimson selection |
| All overlays | Search, filters, source-role/platform, notifications, full-screen story | shared palette, consistent shapes |

## Acceptance gates before merging or calling this a complete redesign

1. Build Kotlin/Compose Android, run unit tests, check generated debug APK signature and versionCode.
2. Screenshot **every screen/overlay above** at 360, 393 and 412dp and at 1.3x and 2x font scale. Verify both Telugu and English multi-line headlines.
3. Reproduce Home/Radar/Today/Archive → story → Back 10 times; no frozen navigation, lost scroll, crashes or stale overlays.
4. Test empty, loading, error, offline and missing-artwork states without invented posters or incorrect evidence/date.
5. Verify OTT filter counts, all See All routes, notification permission, authentication/setup, source tracking and deep links.
6. Physical Samsung A54 acceptance: status/navigation insets, contrast, clipped text, tap targets, 60fps-feel scrolling, power/memory, actual artwork behavior.
7. Keep PR in draft until screenshot sign-off; a successful CI build is **not** proof of full-screen visual acceptance.

## Scope boundaries

No Supabase/database migrations, ingestion changes, source ranking changes, claim changes or permissions are part of this design PR. Build and device verification must occur before calling any APK final.
