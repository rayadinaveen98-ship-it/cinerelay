# CineRelay — The Editorial Edition V2
**Status: design-only proposal, awaiting approval. Do not merge PR #78 as final UI.**
**Date: 2026-10-18**
**Figma master:** https://www.figma.com/design/odvZSY4SXmAZASRR4Ulrrn

## Decision
Restart the consumer Android redesign as a completely new *editorial cinema experience*, instead of adjusting the old UI's palette and font sizes. The prototype is a separate, offline self-contained HTML review artifact shared in the ChatGPT design conversation; it has **not** been synced into Figma due to the Starter MCP plan rate limit. No app, backend, Supabase, notification or production data changes in this PR.

## Visual system (provisional)
- Midnight navy: background #10141F, surrounding canvas #0A0D15
- Cards: #19212D; elevated #222C39; primary text #F6F2E9; secondary #A1ADBA
- Restrained champagne accent #E7C29B
- Confirmation teal #9ADAC9, reported/developing amber #EEC596, errors soft coral #EC9E99
- Elegant editorial serif headlines, clear system sans for metadata and controls; proper Telugu fallback required in Android
- 20dp screen gutters, purposeful 8/12/16/20/24/32 spacing, shared card anatomy, >=48dp touch targets

## Composition by destination
- **Home:** magazine cover with image region and separate readable headline/source body; editorial Followed Sources and New This Week rails; radar gateway; See All
- **OTT:** actionable release counts, filters, poster rails and reliable categories This Weekend / Today / Now Streaming / Next 30 Days; evidence status and unknown dates visible
- **Radar:** briefing-style evidence-first signals and separate developing list, preserving true ranking and original evidence
- **Today:** date-led hero, previous/next day and structured year timeline with actual historical date evidence
- **Search, Sources, Archive:** consistent hierarchy for search results, verified source identities, follow controls and date-ordered archival entries
- **Notifications, You, Settings:** calm, legible activity feed, account hub and grouped accessible settings
- **Story detail, Release detail, Source profile, See All:** complete navigation into evidence, providers, date precision, source timeline and full lists
- **Welcome, Sign in, Personalize, Alert setup:** coherent premium first-run experience with live functionality preserved only at implementation stage

## Prototype review
A browser-tested interactive HTML concept models 18 screen states. It includes 12 *original abstract artwork placeholders*, simulated hero paging, tab navigation, language filters, search, follow toggle, detail/See All, settings and onboarding. All titles, studios, dates, providers, images and verification examples are fictional. They are neither actual releases nor confirmed source facts.

The preview was tested with Chromium, screenshots were captured for the four core screens, and all 18 views rendered without JavaScript errors or horizontal content overflow. **These are browser-only checks**, not emulator/device validation.

## Approval/implementation gates
1. User reviews and approves the new visual direction, not merely the shared token palette.
2. Complete Figma frames and component library in the existing master when access allows. Do not create duplicate files to bypass Starter limits.
3. Lock empty/loading/error states, Telugu and long-title handling, true media fallback and verification/date wording.
4. Implement new Compose layouts **from the approved designs**, not quick relabeling of old screens.
5. Run Android CI, emulator and real device comparisons, TalkBack, large-font and nav QA before a signed complete redesign APK.
6. Keep the previous app-wide palette patch in draft PR #78; it is **not** the finished redesign.
