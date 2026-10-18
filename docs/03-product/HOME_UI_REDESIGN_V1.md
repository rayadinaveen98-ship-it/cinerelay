# CineRelay — Home Visual Redesign v1 (Design-Only)

**Status:** Proposed visual system, not approved / not implemented in Android.
**Date:** 2026-10-18
**Figma master:** https://www.figma.com/design/odvZSY4SXmAZASRR4Ulrrn
**Existing source:** `apps/android/app/src/main/java/com/cinerelay/app/ui/CineRelayHomeV058.kt` and `P6039BottomNavOverlay.kt`.

## Why redesign

The Android client has locally defined typography, palette, card radii, spacing and navigation presentations across multiple screen files. Code inspection confirmed very small 7–9sp metadata in several areas and inconsistent card/radius rules. The goal is a coherent, content-first editorial system: easy scanning, clear source provenance and accessible hierarchy.

## Home information architecture (preserve existing product capabilities)

1. CineRelay identity + **For you**; one Search and one Refresh action.
2. One unobtrusive purpose line.
3. **Top Stories / What changed now** — headline, media, source identity, true verification state, event type, observed time and clear evidence/detail access.
4. Dynamically rendered rails, preserving the existing ranking, personalization and nonempty section logic:
   - From Your Favorites
   - Evolving Stories
   - Trending Across Sources
   - Just In
   - Indian Cinema and the individual language lanes
   - Trailers & Teasers
   - First Looks & Announcements
   - OTT & Streaming Updates
   - Official Movie Updates
   - Music & Songs
   - Interviews & Events
   - From the Web
   - Source-specific favorite lanes
5. Archive access and five active destinations: Home, OTT, Radar, Today, You. Preserve real navigation/deep links.

Do not add streaming playback, Continue Watching, fake poster listings, fabricated release dates or invented source-confirmation logic.

## Proposed tokens / initial design direction

| Role | Proposed value |
| --- | --- |
| Canvas | `#0D1015` |
| Surface | `#181C23` |
| Raised | `#232933` |
| Outline | `#333C49` |
| Primary text | `#F5F3EF` |
| Secondary text | `#AEB6C1` |
| Accent | `#E3BC70` |
| Confirmed semantic status | `#79CFAD` |
| Developing status | `#F2B970` |
| Error/conflict status | `#EB847C` |

Suggested Roboto type roles: page 26sp, section 20sp, card 16sp, body 14sp, metadata 12sp, with system font scaling. Standard content gutter 16dp; common card radii 16–20dp; interactive touch targets at least 48dp. The Figma master already contains provisional color, layout and type foundations.

## Hero anatomy and clipping fix

Make the media region and descriptive region separate layout zones; do not overlay a variable-length title on the image. Reserve distinct layout lines for:
- event type / relevance;
- maximum two headline lines (ellipsis allowed only after safe clipping);
- source and timestamp;
- open story / inspect original evidence action.

Media may be absent; no image placeholder may appear to imply actual evidence. Never use “Official” solely because an item has a thumbnail, favorite-source relationship, or apparently high engagement. Preserve backend verification state and its actual provenance.

## Rail anatomy

All rails share a single section-header component (title, optional context, count / See All). Card widths and image aspect ratios use shared tokens, with one metadata row and semantically meaningful verification presentation. Empty rail families should be omitted rather than filled with synthetic entries. The preview uses **fictional sample stories** only and does not represent production news.

## Interaction and accessibility acceptance

- Search, Refresh, story-to-detail, original-evidence access, See All, archive and bottom navigation remain reachable.
- Returning from detail preserves scroll position and filtered view.
- Test 360dp, 393dp, 412dp widths; normal, 1.3× and 2.0× font scaling; Telugu and English/long headlines; no-image and empty states.
- Text must not overlap source labels, controls or verification indicators.
- Never replace original URLs or true dates with decorative illustration or fabricated details.
- Test touch target, contrast, content descriptions, focus and back behavior.
- Independent design review is required before creating Kotlin/Compose implementation work.

## Process / scope

An interactive, **standalone HTML design preview** and screenshots were produced and reviewed in ChatGPT; these are *not* live app screens or imported Figma components. The connected Figma Starter account currently reports its MCP call limit; resume Figma edits in the existing master when that restriction lifts. Do not bypass plan limits by making duplicate files.

This PR is intentionally **documentation only**. It must not change consumer records, Supabase, data ingestion, notifications, Android source or APK delivery.
