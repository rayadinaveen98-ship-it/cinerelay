# Source Strategy

## Objective

CineRelay succeeds only if it knows **which sources matter, what authority each source has, how to retrieve updates reliably, and when a source becomes unhealthy**.

The source system is therefore a first-class product subsystem, not a list of URLs.

## Source graph

Each real-world organization/person/project can own multiple platform identities.

Example:

```text
Organization: Mythri Movie Makers
  ├─ YouTube channel
  ├─ Instagram professional account
  ├─ X account
  ├─ Threads account
  ├─ Website
  └─ optional press/news feed
```

Each platform identity has its own connector, health state, polling/subscription metadata and access constraints.

## Authority tiers

### Tier A — Direct official

Highest authority for facts within its remit.

Examples:

- official movie/series account;
- production house/studio;
- official OTT platform;
- official distributor;
- official music label for song releases;
- broadcaster/network;
- certification/regulatory authority for certificate data.

### Tier B — Direct participant

Authoritative for first-person statements but not necessarily the whole project.

Examples:

- actor;
- director;
- producer;
- cinematographer;
- writer;
- composer.

A cast member saying “my schedule wrapped” is direct evidence of their participation; it is not automatically proof that the whole film wrapped.

### Tier C — Trusted trade / professional media

Useful for reliable reporting when official confirmation is absent.

This tier is curated manually and evaluated per territory/language.

### Tier D — General media / discovery source

May surface leads but needs corroboration.

### Tier E — Unverified social/community

Not part of default V1 notifications. May become an optional rumor/discovery layer later.

## Source scope for V1

Start with a **curated 200–500 high-value identities**, not thousands of noisy accounts.

Coverage priorities:

1. Telugu cinema official production houses, distributors, labels and high-value project accounts.
2. Tamil, Malayalam, Kannada and Hindi equivalents.
3. India-facing OTT/platform/studio accounts.
4. Major global streamers/studios relevant to India.
5. Selected high-signal people accounts.
6. Trusted trade/media sources only after direct-source coverage is strong.

The initial list must be measured for coverage before expansion.

## Platform acquisition matrix

| Platform | V1 method | Cost posture | Reliability posture |
|---|---|---:|---|
| YouTube | WebSub push + Data API enrichment | ₹0 within quota | Tier-1 / strongest |
| RSS/Atom | scheduled conditional fetch | ₹0 | strong where offered |
| Official websites | polite scheduled fetch/change detection | ₹0 | strong but site-specific |
| Instagram | permitted Professional-account API capabilities + manual radar/discovery | ₹0 where permitted | partial / platform-limited |
| Threads | official public-profile endpoints where permitted | ₹0 subject to API rules | experimental-supported |
| X | official API only when paid credits intentionally enabled; radar account for human discovery | optional paid | strong technically, not free |
| News/trade | RSS/API/public pages according to publisher access | usually ₹0 initially | source-dependent |

## YouTube strategy

YouTube is the first production-grade connector.

### Subscription

Use WebSub/PubSubHubbub channel-topic subscriptions so uploads and title/description changes arrive by webhook rather than polling.

Topic format:

```text
https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>
```

### Enrichment

After a notification:

1. validate channel/video identity;
2. upsert raw item;
3. fetch only necessary metadata through the Data API;
4. classify title/description/live state;
5. associate the video with entities;
6. generate one or more candidate events;
7. deduplicate against existing events.

### Quota policy

Do not use expensive search as the routine discovery mechanism. Use known channel IDs, upload notifications and targeted metadata calls.

## Instagram strategy

A dedicated CineRelay radar account can follow important cinema accounts for human visibility and source discovery, but the backend does not assume it can read that home feed programmatically.

Rules:

- prefer official Meta APIs;
- support Business/Creator identities where accessible;
- do not claim consumer-account completeness;
- do not claim external Story completeness;
- do not use permanent logged-in browser scraping as a core dependency;
- expose missing/unsupported coverage honestly.

## X strategy

A dedicated radar account is useful because the official API supports a reverse-chronological timeline of followed accounts, but reads are currently pay-per-use.

Therefore:

- maintain X handles in the source registry from day one;
- keep the connector implementation behind a feature flag;
- allow manual linking/opening from CineRelay;
- do not require API credits for V1 correctness;
- when enabled, record exact API spend per connector run and enforce a budget ceiling.

## Website/feed monitoring

For public first-party sites:

- prefer RSS/Atom if available;
- use `ETag` / `If-None-Match` and `Last-Modified` / `If-Modified-Since`;
- fetch only relevant listing/detail pages;
- store normalized content hashes;
- avoid aggressive intervals;
- add per-domain rate limits and backoff;
- identify parser breakage through health checks.

## Polling classes

Each source identity gets a `poll_class` rather than arbitrary intervals.

Suggested starting classes:

- **PUSH** — webhook/subscription; no regular content polling except health/fallback.
- **HOT_5M** — high-value time-sensitive source during active campaigns.
- **ACTIVE_15M** — active official source.
- **NORMAL_60M** — normal source.
- **COLD_6H** — low-frequency source.
- **DAILY** — reference/status page.
- **MANUAL** — no automated connector available.

Actual scheduling is adaptive: error rate, update frequency and quota budget can move a source between classes.

## Discovery strategy

New sources can be proposed by:

- links/mentions from existing Tier-A sources;
- official websites;
- newly announced project pages;
- verified platform account relationships where available;
- manual curator input;
- repeated high-confidence references in official posts.

Discovery never auto-promotes a source directly to trusted status.

Pipeline:

```text
candidate → evidence collection → identity matching → authority review → active source
```

## Update taxonomy

Each raw item may generate zero or more candidate events.

### Project

- `PROJECT_ANNOUNCED`
- `TITLE_ANNOUNCED`
- `TITLE_CHANGED`
- `SEQUEL_OR_SPINOFF_ANNOUNCED`
- `SEASON_RENEWED`
- `PROJECT_ON_HOLD`
- `PROJECT_CANCELLED`

### Cast / crew

- `CAST_ANNOUNCED`
- `CREW_ANNOUNCED`
- `CAST_EXIT_REPORTED`
- `CREW_EXIT_REPORTED`

### Production

- `PRODUCTION_LAUNCHED`
- `SHOOT_STARTED`
- `SHOOT_SCHEDULE_UPDATE`
- `SHOOT_WRAPPED`
- `BTS_RELEASED`
- `MAKING_VIDEO_RELEASED`

### Marketing / video

- `FIRST_LOOK_RELEASED`
- `POSTER_RELEASED`
- `GLIMPSE_RELEASED`
- `TEASER_ANNOUNCED`
- `TEASER_RELEASED`
- `TRAILER_ANNOUNCED`
- `TRAILER_RELEASED`
- `PROMO_RELEASED`

### Music

- `SONG_ANNOUNCED`
- `SONG_RELEASED`
- `ALBUM_UPDATE`

### Events / publicity

- `INTERVIEW_RELEASED`
- `PRESS_MEET_ANNOUNCED`
- `PRESS_MEET_STARTED_OR_RELEASED`
- `PRE_RELEASE_EVENT_ANNOUNCED`
- `PRE_RELEASE_EVENT_STARTED_OR_RELEASED`
- `PREMIERE_OR_SCREENING_ANNOUNCED`

### Release

- `THEATRICAL_DATE_ANNOUNCED`
- `THEATRICAL_DATE_CHANGED`
- `THEATRICAL_RELEASED`
- `OTT_PLATFORM_ANNOUNCED`
- `OTT_DATE_ANNOUNCED`
- `OTT_DATE_CHANGED`
- `OTT_RELEASED`
- `DELAY_OR_POSTPONEMENT`

### Certification / metadata

- `CERTIFICATION_UPDATED`
- `RUNTIME_UPDATED`

Taxonomy is versioned and may grow without rewriting historical raw items.

## Source health

Every automated identity tracks:

- last successful check/event;
- last attempted check;
- consecutive failures;
- auth/token status;
- rate-limit state;
- parser version;
- average updates/day;
- expected next check;
- last content fingerprint;
- webhook subscription expiry/renewal state where relevant.

Health states:

- `HEALTHY`
- `DEGRADED`
- `RATE_LIMITED`
- `AUTH_REQUIRED`
- `PARSER_BROKEN`
- `UNSUPPORTED`
- `DISABLED`

A broken connector must create an operational alert; it must not silently appear as “no updates.”

## Coverage measurement

For a controlled benchmark set of major titles/sources, manually record known meaningful events and compare CineRelay output.

Track:

- event recall;
- event precision;
- median detection latency;
- duplicate rate;
- false officiality rate;
- wrong-entity association rate;
- connector uptime.

Source count is not a success metric by itself.

## Current external constraints confirmed 2026-09-14

- YouTube Data API default allocation is 10,000 quota units/day.
- YouTube WebSub supports push notifications for uploads and video title/description changes.
- X API uses pay-per-use pricing; Post reads are currently listed at USD $0.005/resource.
- Instagram's official API focuses on Professional accounts and cannot provide unrestricted consumer-account/home-feed access.
- Threads currently exposes official public-profile lookup/post retrieval capabilities subject to Meta authorization and policy.

These constraints must be revalidated before connector implementation because platform policies change.

_Last updated: 2026-09-14_
