# CineRelay — OTT Editorial UI Redesign v1

**Design checkpoint:** October 18, 2026  
**Status:** Design-only proposal; not yet implemented or approved in Android.  
**Figma master:** https://www.figma.com/design/odvZSY4SXmAZASRR4Ulrrn  
**Current source:** `apps/android/app/src/main/java/com/cinerelay/app/ui/OttReleasesV054.kt`, `OttViewModelV054.kt`, `DiscoveryUiV080.kt`.

## Design decision

OTT should be a practical release guide, not a second Home page. The original large, decorative preview hero was removed after reviewing mobile screenshots: it pushed actual titles and release windows below the fold. Preserve CineRelay's warm dark editorial theme, but lead with filtered release counts, four release categories, trustworthy metadata and compact content cards.

## Navigation and screen anatomy

- Top header: CineRelay / OTT, **Streaming Guide**, refresh, short purpose line.
- Counters (derived from current filter data): **This Weekend**, **Today**, **Now Streaming**, **Next 30 Days**.
- Collapsible Refine discovery: **Platform**, **Language**, **Content type** (Movie/Series), **Verification** (All/Confirmed/Reported), **Reset**.
- Existing section order and behavior: **This Weekend**, **Today's OTT Releases**, **Now Streaming**, **Coming in the Next 30 Days**.
- Each section: one title/subtitle, matched count, **See All**, horizontally scrollable title cards or an honest empty state.
- See All: category-focused vertical list retaining active filters and return navigation; backend integration must retrieve complete eligible results, not simply copy the first 12 cards.
- Details: title, provider, language/type, state, source-backed release day (or date unknown), evidence status/count, original canonical evidence action, date history and source-conflict warning.
- Shared app navigation: Home, OTT, Radar, Today, You.

## Visual system

Reuse provisional Figma semantic tokens and Roboto style ramp. Recommended standard mobile gutter 16dp; common card radii 16–20dp; typography page 26sp, section 20sp, card 16sp, metadata 12–14sp; touch targets at least 48dp. Use editorial media/artwork only when grounded in an allowed source; otherwise fall back to a non-content placeholder / provider mark. Avoid different per-screen hardcoded color/spacing systems.

## Data and source-safety rules

- Preserve current `OttUiState` groups, date arithmetic and filters. Do **not** rewrite backend/view-model rules as part of this redesign.
- A currently available title may have no known premiere day: present **Available now / date unknown**, not an invented current date.
- `REPORTED` is not `CONFIRMED`; stylistic cues must not obscure the distinction.
- Date-changed and conflicting-source warnings remain visible in detail views.
- Original evidence must be reachable with the current real canonical URL. Do not substitute example URLs, media, fabricated providers or releases in production.
- Zero-result groups show meaningful states, never fake releases or nonfunctional See All buttons.

## Prototype and QA

A standalone interactive HTML prototype and visual screenshots were produced in chat using **fictional examples only**. Testing verified:
- all four category counts and rail displays;
- filter expansion, dynamic language selections, reset and disabled zero-result lists;
- full category list → title details → list → overview navigation;
- reported-item warning, unknown-date precision, evidence demo feedback;
- long Telugu/English titles without metadata collision;
- browser rendering widths of 360px, 393px, 412px and 720px with no document overflow or script errors.

**Still to verify before release:** Android Compose rendering and UI-accessibility tests (TalkBack, 1.3×/2× font, touch targets), API pagination, real poster behavior, deep links, session/state retention, and actual data accuracy. Browser-only preview tests are not substitutes.

## Current workflow limit

The connected Figma Starter workspace reported its MCP tool call limit in the preceding design pass. The new screen exists as a separate editable HTML design preview and this documented handoff; **no claim that Figma itself was updated**. Transfer into the same existing Figma master when tool editing is available. Do not duplicate Figma files to bypass plan limits.

## Implementation gate

No Android app, backend, data pipeline, notifications, published APK or live news data changes belong in this design-only PR. Move to implementation only after Home, OTT, Radar and Today have a reviewed, coherent design-system approach.
