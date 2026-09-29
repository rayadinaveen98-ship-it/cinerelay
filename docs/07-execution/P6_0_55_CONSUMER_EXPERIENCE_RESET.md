# P6.0.55 — Consumer Experience Reset

Date: 2026-09-20
State: IN PROGRESS

## Goal

Turn CineRelay from an engineering-facing newsroom UI into a consumer-first cinema intelligence app while preserving the evidence-first backend.

The backend may remain technical. The Android experience must use ordinary movie/streaming language.

## Locked product principles

1. Home is personalized, visual and row-based instead of a long raw feed.
2. Favorites and notification subscriptions are separate user intentions.
3. Search is universal: titles, recent updates, sources and OTT releases.
4. Radar is a live creator-opportunity surface, not a blank infrastructure screen.
5. Settings uses consumer language; operator/debug controls stay out of the normal UI.
6. Notification taps must deep-link to the exact related update/event. Home is never the fallback when a valid notification target exists.
7. `On This Day` reuses the existing Cinema & Series catalog through a read integration; CineRelay must not duplicate the catalog manually.

## P6.0.55A — Personalization foundation

Persist per-user:

- favorite source identities;
- favorite languages;
- onboarding completion version.

Existing source-notification subscriptions stay independent.

Onboarding order for new accounts:

1. account/sign-in;
2. favorite languages;
3. favorite channels;
4. notification setup.

Existing accounts that completed the old notification onboarding get a one-time personalization setup without destroying their notification choices.

## P6.0.55B — Home V2

Home uses a hero carousel plus horizontally scrollable rails.

Hero rules:

- recent items from the user's favorite sources only;
- freshness first, with duplicate/noisy low-value items de-emphasized;
- visual thumbnail-first card;
- tap opens the update detail/source target.

Initial rails:

- From Your Favorites
- Just In
- Latest Telugu Updates
- Latest Hindi Updates
- Tamil Cinema
- Malayalam Cinema
- Kannada Cinema
- International / English
- Trailers & Teasers
- First Looks & Announcements
- OTT & Streaming Updates
- Releasing / Streaming Soon
- Official Movie Updates
- Interviews & Events
- Music & Songs
- one `Latest from <favorite source>` rail when that source has enough recent activity.

Empty rails are omitted.

## P6.0.55C — Consumer wording + Settings

Normal UI must prefer:

- `Official source` instead of `first-party source`;
- `Movie / Series` instead of `canonical title`;
- `Latest updates` instead of `resolved source activity`;
- `Official / Reported / Developing` instead of internal verification terminology;
- `Why we trust this` / `Sources` instead of internal evidence terminology where appropriate.

Settings groups:

- Account
- Your Favorites
- Languages
- Content Preferences
- Notifications
- Sources
- App Preferences
- About CineRelay
- Sign Out

Internal source-lane/signal/resolver controls are not shown in the consumer settings screen.

## Notification deep-link contract

Two notification classes are currently relevant:

### Source activity notification

Payload already carries `rawItemId`, `sourceIdentityId`, `canonicalUrl` and source metadata. Android must retain these extras and route to the exact update detail. If the raw item can no longer be loaded, the canonical URL is the recovery target. Only if both are unavailable may the app show an explanatory unavailable state.

### Canonical event notification

Payload already carries `eventId` and `entityId`. Android must route to the exact event detail / title hub. It must not silently land on Home.

Cold-start and warm-start (`onNewIntent`) paths must behave the same.

## P6.0.56 — Universal Search + Live Radar

Search result groups:

- Movies & Series
- Latest Updates
- Channels
- OTT Releases

A title does not need to already be a reviewed canonical hub for matching raw/source updates to appear. Canonical hubs rank above update matches when available.

Radar becomes continuously refreshed from canonical events. The deterministic scorer remains separate from factual verification. User-facing labels describe the opportunity in plain language (for example: `Good Short opportunity`, `Trailer worth analysing`, `Worth a quick explainer`, `Keep watching`).

## P6.0.57 — Today in Cinema

Integrate the existing Cinema & Series catalog as a read source.

Home rail: `On This Day`.

Dedicated view supports a date picker and language/content filters. Cards show title, release year and how many years ago the title released on the selected month/day.

## Release gates

P6.0.55 is not complete until:

- personalization is persisted server-side and reflected in Home;
- hero contains only favorite-source activity;
- Home rails render from real data and omit empty categories;
- Favorites remain independent from notification subscriptions;
- settings terminology is consumer-facing;
- notification deep links work on cold and warm app launches;
- update-safe Android signer/version contract remains green;
- no X activation is introduced.
