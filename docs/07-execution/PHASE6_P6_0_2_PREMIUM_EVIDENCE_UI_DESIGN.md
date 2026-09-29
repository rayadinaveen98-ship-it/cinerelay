# Phase 6 P6.0.2 Design — Premium Live + Evidence UI

Date: 2026-09-16

State: **LOCKED / IMPLEMENTED / HOSTED-PROVEN**

## Product intent

V0.2 upgrades CineRelay from a functional Android canary into a more credible cinema-intelligence product without hiding or embellishing source quality.

The design must feel premium through information hierarchy, spacing and provenance — not through decorative movie imagery or invented poster assets.

## Visual principles

- deep charcoal / near-black surfaces;
- warm CineRelay gold only for brand, selection and creator-opportunity emphasis;
- verification colors remain semantic and restrained;
- large headline hierarchy, compact metadata;
- cards should read like intelligence briefs rather than generic social posts;
- no fake poster artwork: use an entity identity tile until canonical media assets exist;
- guest onboarding should occupy one compact strip, not dominate the feed;
- bottom navigation labels must remain single-line on normal phone widths.

## Live event card hierarchy

1. entity identity tile;
2. entity/title name;
3. verification badge + event type;
4. event time;
5. canonical headline;
6. evidence-backed summary when available;
7. Creator Radar overlay when materialized;
8. evidence headline (`1 linked source`, `N linked sources`, conflicts when present);
9. explicit Evidence action;
10. follow action;
11. strongest-source shortcut.

## Evidence UX

Evidence is a first-class product surface, not a hidden debug field.

Tapping Evidence opens a lazy-loaded bottom sheet containing:

- event verification state;
- total evidence count;
- conflict count;
- source-by-source evidence entries;
- evidence role;
- source authority tier and role;
- source platform + handle;
- evidence weight;
- raw source title;
- original canonical URL.

When only one canonical evidence item exists, CineRelay explicitly explains that the count is not inflated and more items appear only after ingestion + canonical linking.

## Evidence backend boundary

`cinerelay-evidence-api` is separate from the main feed response so normal Live/Radar loads remain compact.

Rules:

- active / needs-review events only;
- read-only;
- guest-readable;
- invalid supplied bearer -> `401 invalid_session`;
- no user follow/alert/device writes;
- service-role credential remains server-side;
- evidence order: PRIMARY, CORROBORATING, REPEAT, CONFLICTING, then weight/time tie-breaks.

## Compatibility

- package stays `com.cinerelay.app`;
- minSdk 26;
- compile/target API 36;
- V0.1.1 root remains in source as a rollback/reference implementation;
- V0.2 launcher root is `CineRelayV02App`;
- Firebase behavior is unchanged from P6.0.1.

## Deferred

- canonical poster/backdrop asset pipeline;
- title detail/timeline screen;
- search;
- richer filters;
- offline cache;
- production Firebase activation.
