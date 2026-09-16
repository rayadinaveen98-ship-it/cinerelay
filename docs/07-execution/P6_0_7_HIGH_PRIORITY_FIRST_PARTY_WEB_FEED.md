# P6.0.7 — High-Priority First-Party Feed/Web Freshness

Date: 2026-09-16
Status: HOSTED-PROVEN

## Goal

Bring CineRelay's existing official RSS and first-party Web sources into the FrameByNavin high-priority freshness contract without weakening parser safety, domain throttling, or failure backoff.

## Sources upgraded

### The Walt Disney Company

- platform: `RSS`
- connector: `RSS_ATOM`
- access mode: `FEED`
- source authority tier: `1`
- feed: `https://thewaltdisneycompany.com/feed/`
- previous poll class: `ACTIVE_15M`
- new poll class: `HOT_5M`
- discovery priority: `HIGH`

### About Amazon India — Prime Video

- platform: `WEB`
- connector: `FIRST_PARTY_HTML`
- access mode: `PUBLIC_WEB`
- source authority tier: `1`
- page: `https://www.aboutamazon.in/news/tag/prime-video`
- parser profile: `about-amazon-india-prime-video-v2`
- previous poll class: `ACTIVE_15M`
- new poll class: `HOT_5M`
- discovery priority: `HIGH`

## Scheduler proof

Existing production cron already dispatches both workers every five minutes:

- `cinerelay-feed-poll`: `*/5 * * * *`
- `cinerelay-page-poll`: `*/5 * * * *`

Therefore no scheduler migration was needed. Source-level `HOT_5M` clocks can be honored directly.

## Connector contract

Both connector packages already support `HOT_5M` natively:

- feed connector `pollIntervalMs('HOT_5M')` = 5 minutes;
- web-page connector `pagePollIntervalMs('HOT_5M')` = 5 minutes;
- consecutive failures exponentially back off the base interval;
- `Retry-After` is respected;
- per-domain throttling remains active;
- parser/structure health remains authoritative over raw speed.

## Hosted controlled canary

Both sources were forced due and dispatched through the normal secured scheduler path.

### Disney RSS result

- due: 1
- checked: 1
- itemsNew: 0
- itemsChanged: 0
- failed: 0
- rateLimited: 0
- gaps: 0
- parser: `feed-parser-v1`
- health after canary: `HEALTHY`
- next-check cadence: exactly `5.00` minutes

### Amazon Prime Video Web result

- due: 1
- checked: 1
- itemsNew: 0
- itemsChanged: 0
- failed: 0
- rateLimited: 0
- gaps: 0
- drifted on canary: 0
- parser: `first-party-html-v2`
- health after canary: `HEALTHY`
- next-check cadence: exactly `5.00` minutes

Amazon's persisted `drift_count = 5` is historical telemetry. It was not an active parser error at promotion time: source health was HEALTHY before the cadence change, the controlled HOT_5M fetch produced `drifted = 0`, and health remained HEALTHY afterward.

## Safety rule

High priority does not override connector health controls.

If either source begins failing, rate-limiting, or producing parser/structure problems, the existing retry/backoff and health state remain authoritative. CineRelay should never keep hammering a source merely to satisfy a nominal five-minute target.

## Result

CineRelay now has three fast first-party source classes in production:

1. HIGH official YouTube sources — five-minute authoritative uploads polling;
2. HIGH official RSS — five-minute conditional feed polling;
3. HIGH official first-party Web — five-minute structure-aware page polling.

Raw useful items from all three paths can enter the fast newsroom before canonical entity resolution completes.

## Next

1. inspect Instagram/Threads production enrollment and auth state; activate only with real proof;
2. promote approved first-party/public-page candidates where provenance and parser contracts are strong;
3. add trusted trade/public-page sources as DEVELOPING/UNCONFIRMED rather than treating them as official VERIFIED sources;
4. continue observing expanded newsroom output before adding new relevance/noise rules;
5. evaluate X separately from the current production source model.
