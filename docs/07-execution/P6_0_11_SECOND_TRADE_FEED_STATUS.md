# P6.0.11 — Second Trade Feed Status

Status: **ACTIVATED / HOSTED-BASELINED / FIRST NATURAL DELTA PENDING**

Date: 2026-09-16

## Goal

Expand CineRelay's lower-trust developing-signal layer with a second structurally proven cinema-news feed, while keeping first-party VERIFIED authority separate from tier-3 media reports.

## Source selected

**TeluguCinema — News**

- Feed: `https://telugucinema.com/news/feed`
- Scope: dedicated News category only; the broader site feed was intentionally not selected.
- Platform: RSS
- Connector: RSS_ATOM / FEED
- Authority tier: 3
- Source role: `TRADE_MEDIA`
- Poll class: `ACTIVE_15M`
- Source identity: `7459d5f4-164b-43e5-9c66-0c2c1405a45f`

## Hosted transport proof

The dedicated News feed returned:

- HTTP 200;
- RSS 2.0;
- `application/rss+xml`;
- current `lastBuildDate`;
- stable article URLs;
- ETag support;
- Last-Modified support;
- newest-first News items.

The broader `https://telugucinema.com/feed` endpoint was also valid RSS, but CineRelay selected `/news/feed` to avoid mixing broader site content into the newsroom signal layer.

## Audited onboarding

The source used the existing reviewed candidate workflow rather than direct source insertion:

1. submitted as an `RSS_ATOM` source-discovery candidate with hosted transport evidence;
2. operator-reviewed and explicitly APPROVED;
3. promoted through `operator_promote_media_feed_candidate`;
4. registered through the existing feed-source state machinery.

Promotion result:

- tier 3;
- role `TRADE_MEDIA`;
- poll class `ACTIVE_15M`;
- feed state registered successfully.

## Hosted baseline proof

The existing `feed-poll-worker` was invoked through the production scheduler-dispatch path after the source became due.

Worker result:

- due: 1;
- checked: 1;
- baselined: 1;
- notModified: 0;
- itemsNew: 0;
- itemsChanged: 0;
- failed: 0;
- rateLimited: 0;
- gaps: 0;
- parser: `feed-parser-v1`.

Post-baseline source state:

- last HTTP status: 200;
- gap count: 0;
- last entry anchor: `https://telugucinema.com/?p=232881`;
- next check interval: exactly 15.00 minutes.

No historical feed items were backfilled into `raw_items` during baseline.

## Trust boundary

TeluguCinema is not a first-party source and is not treated as VERIFIED authority merely because the transport is healthy.

Unresolved tier-3 items remain in the lower-trust media path and are intended to surface as `DEVELOPING` until stronger/canonical evidence changes the event state.

P6.0.10's push trust disclosure remains applicable: naturally eligible developing alerts must render as `CineRelay • Developing`, not as an unlabeled verified-looking notification.

## Still pending

CineRelay has not yet observed a genuine post-baseline TeluguCinema feed delta. Therefore this checkpoint does **not** claim:

- a real TeluguCinema raw item ingestion;
- a real DEVELOPING newsroom card from this source;
- a real canonicalization/corroboration result from this source;
- a real-device developing push caused by this source.

No synthetic production item will be inserted just to satisfy those proofs.

## Current trade/developing feed set

1. `123Telugu — Movie News` — tier 3 / TRADE_MEDIA / ACTIVE_15M / baseline proven / first natural delta pending.
2. `TeluguCinema — News` — tier 3 / TRADE_MEDIA / ACTIVE_15M / baseline proven / first natural delta pending.

## Next

1. Observe the first natural post-baseline delta from either tier-3 feed.
2. Prove raw ingestion and newsroom `DEVELOPING` mapping end-to-end.
3. Observe natural canonicalization/corroboration behavior without upgrading trust prematurely.
4. Prove the first naturally eligible developing real-device push label.
5. Add further media sources only through structurally proven feeds/parsers and the audited candidate-review workflow.
