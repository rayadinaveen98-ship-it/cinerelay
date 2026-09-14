# Design Philosophy

## Product feeling

CineRelay should feel like a **premium cinema intelligence newsroom / signal room**.

It must not look like:

- a Netflix clone;
- a gossip/news portal;
- a generic social-media feed;
- a crypto trading terminal;
- an overdecorated fan app.

The product should communicate three things immediately:

1. **freshness** — something may have changed recently;
2. **trust** — users can see why the information is credible;
3. **control** — the user can scan, filter, follow and act without noise.

## Visual principles

### Dark-first, not black-everywhere

Use deep charcoal/ink surfaces rather than pure black across the entire UI. Important media can stand out without the product becoming visually harsh.

A light theme may be added later, but V1 can prioritize a polished dark experience.

### Cinematic without imitation

Cinema cues should come from typography, spacing, image treatment, timelines and restrained motion—not fake film grain, clapperboard icons everywhere or excessive red/gold decoration.

### Dense but calm

CineRelay contains a lot of information. Density is acceptable if hierarchy is excellent.

Use:
- clear grouping;
- compact metadata rows;
- consistent event anatomy;
- whitespace between clusters;
- progressive disclosure for evidence/details.

### Trust is visual

Verification and source provenance cannot be hidden behind a detail screen.

Every important event card should expose:
- verification state;
- original source identity;
- source timestamp;
- event type;
- associated title;
- evidence/open-source action.

### Status colors are semantic

Do not flood the UI with bright colors.

Suggested semantic roles:
- official/confirmed — positive/trusted accent;
- developing — amber/warning;
- rumor/conflict — caution/error family;
- critical/high priority — strong accent used sparingly;
- neutral metadata — low-contrast gray.

Exact palette is frozen later in the design-system milestone after accessibility checks.

## Information architecture

### Primary navigation

V1 web/Android should converge around these major destinations:

- **Live** — latest meaningful events.
- **Following** — updates limited to followed entities/sources.
- **Titles** — movies/series and their timelines.
- **Radar** — filtered views such as Videos, Posters, Production, Releases, Events.
- **Alerts** — notification rules and recent alerts.
- **Sources** — tracked source identities and health.
- **Search** — global entity/event/source search.

For the creator-first internal web console, operational/review tools may also expose:

- Review Queue;
- Connector Health;
- Source Candidates;
- Benchmark/Diagnostics.

These admin tools should not clutter a future consumer UI.

## Live feed anatomy

Each event card should answer at a glance:

```text
[verification] [event type]                    [time]
TITLE / SERIES
Concise event headline
Optional one-line structured change/summary
Source: official identity  •  evidence count
[Open source] [Save] [Follow] [More]
```

If an event is a change, show the delta explicitly:

```text
Release date
18 Dec 2026  →  25 Dec 2026
```

If multiple sources support one event, do not create duplicate cards. Show evidence count / strongest sources.

## Title intelligence page

Header:
- title;
- type/language/year where known;
- follow state;
- current production/release status;
- current verification-sensitive key facts.

Core sections:

1. **Latest signal**
2. **Current state** — release/OTT/production status
3. **Timeline** — complete chronological event history
4. **Videos** — official teaser/trailer/song/promo events
5. **Posters/visual announcements** — linked source media where permitted
6. **People/companies** — relevant relationships
7. **Tracked sources** — which identities are contributing coverage
8. **Conflicts/corrections** — visible when facts disagree

## Timeline philosophy

A movie lifecycle is the natural mental model.

Timeline groups can include:

```text
Announcement
Pre-production
Production
Marketing
Theatrical release
Post-release
Streaming
Future / sequel / season activity
```

Do not fake stage boundaries when the evidence does not support them.

## Source page

A source page should show:
- organization/person/project identity;
- authority tier;
- platform identities;
- connector health;
- latest observed items/events;
- languages/territory;
- entities strongly associated with the source;
- reason/evidence for official status where appropriate.

## Creator Radar

Creator-specific intelligence is a separate overlay on facts.

Possible indicators:
- high-priority breaking update;
- new official trailer;
- release-date change;
- strong Short/Reel opportunity;
- multiple related updates forming a bigger story;
- follow-up required due to developing/conflicting evidence.

Do not auto-generate sensational headlines in the factual feed.

## Interaction principles

### Fast scan

A user should understand the feed without opening every card.

### Source in one action

Original evidence should be reachable in one obvious action.

### Filter without losing context

Filters should be chips/controls for:
- language;
- title/person/source;
- event type;
- verification state;
- time window;
- priority;
- media type.

### Deep link everything

Events, titles and sources need stable shareable URLs/deep links.

### Preserve position/state

When returning from an event/source, the user should not lose feed position or filters.

## Motion

Use restrained motion for:
- incoming live event indicator;
- card state changes;
- filter transitions;
- timeline expansion;
- success/error acknowledgement.

Avoid decorative autoplay animations that make monitoring harder.

## Typography

Use a highly readable sans-serif UI family with strong numeric/time readability. A display accent may be used sparingly for major title headers, but body/metadata text should prioritize scanning.

Android and web do not need identical fonts if platform-native performance/readability benefits differ; hierarchy and tokens should remain aligned.

## Accessibility

Minimum requirements:
- WCAG-minded contrast;
- do not encode verification only by color;
- keyboard navigable web UI;
- screen-reader labels;
- minimum sensible tap targets;
- scalable Android text;
- motion reduction support where practical.

## Responsive behavior

### Desktop web

Use information density:
- left navigation;
- central feed/content;
- optional right context rail for filters/source details.

### Mobile Android

Prioritize:
- bottom navigation;
- single-column event feed;
- bottom sheets for filters/details;
- title pages with collapsible sections.

## Design-system build order

1. semantic color/spacing/type tokens;
2. event card;
3. verification badge/source identity;
4. timeline primitives;
5. filters/search;
6. source health components;
7. navigation shells;
8. title page;
9. alert settings;
10. admin/review components.

The event card is the most important visual component in the product and should be tested with real data before large-scale screen design.

## Anti-patterns

Reject designs that:
- hide evidence;
- use huge poster art at the cost of information;
- make every item look “breaking”;
- show duplicate cards for the same announcement;
- use vague AI confidence as a trust badge;
- overload cards with paragraphs;
- copy Netflix horizontal carousels where a chronological feed/timeline is more appropriate;
- use glassmorphism/visual effects that hurt readability or are hard to reproduce on Android.

_Last updated: 2026-09-14_
