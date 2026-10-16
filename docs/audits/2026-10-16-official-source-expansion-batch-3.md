# CineRelay — Verified official-source expansion, Batch 3

Date: 2026-10-16 IST. Production Supabase project `dnqaejljfzwhsainpdxb`.

## Scope and result

The user authorized additional **official studio / YouTube / website** source registrations. This batch registered **two net-new first-party source identities**, with no Android APK or schema change. Overall source identities increased from **228 to 230**.

| New official identity | Platform / source | Proof | Runtime status |
|---|---|---|---|
| Pritish Nandy Communications (PNC), official film/streaming press releases | `WEB`; `https://www.pritishnandycom.com/news` | Production company's official self-hosted newsroom: Webflow first-party origin, branded contact/company details, 52 bounded press-release HTML cards; actual film and streaming projects | Registered Tier-A `PRODUCTION_HOUSE` company + `FIRST_PARTY_HTML` identity. Initial live poll HTTP 200, 30 eligible filtered candidate records (capped), no parser drift, `HEALTHY`. Baseline only, no historic notification fan-out. Scheduled `COLD_6H`. |
| Anand Audio Kannada Video Songs | `YOUTUBE`; `UCH16QdvlzgfEaMW8PjeiBsw` | Owner-operated Tier-A Anand Audio existing YouTube channel links to `@AnandAudioKannadaVideoSongs`; YouTube canonical URL resolves to unique `UC...` ID with branded title | New identity linked to **existing** Anand Audio source, no duplicate company. WebSub ACTIVE and verified, fallback HTTP 200, upload baseline video `mTtw30WgKQg`, `HEALTHY`. |

Both additions have `OFFICIAL_SOURCE_BATCH_REGISTRATION` in `audit_actions`. Anand candidate `998db2e7-433b-43b6-b487-e26d8523ddb5` was marked `PROMOTED` and officiality proposal resolved.

### PNC parser design

- Page `https://www.pritishnandycom.com/news`
- `itemSelector = div.n__item.w-dyn-item`
- `linkSelector = a.n__unit[href^="/news/"]`
- `titleSelector = div.n__unit__title`
- `dateSelector = div.n__unit__date`
- First-party link include: `^https://www[.]pritishnandycom[.]com/news/[^/?#]+$`
- Film/OTT title pattern included to avoid pure quarterly investor updates; generic finance and stock-market posts should not be published as movie news.
- `maxItems=30,minItems=1`, `NEWEST_FIRST`. PNC website response around 113 kB and initial poll successful; monitor upcoming 6-hour checks.

## Audited but skipped

- `https://www.youtube.com/c/TipsTamil` resolves to `UC48pE7QE4NZFTCsHT-IRxJw` and **already has an active CineRelay identity**.
- `https://www.youtube.com/c/TipsFilms` resolves to `UCqXO3ktBw0D0sw1z5hZFeDg`, also **already active**.
- The discovery ledger still labels both alternate URLs as PENDING despite their channel IDs being registered; resolve by stable-ID reconciliation in a later discovery-cleanup pass. Do not add copies.
- `https://www.jiostar.com/news-category/entertainment/` has an existing **intentionally retired** generic page identity (active=false, `SOURCE_RETIRED_TYPED_PARSER_REQUIRED`). Its archive mixes film, sports/television and series. Never reactivate the old generic parser without a separately verified typed film-vs-series connector.

## Data pipeline and reliability checks

- Prior batch's Netflix Tudum identity has ingested 2 genuinely new raw items since its first baseline check. Their publication/moderation status was not certified in this batch.
- During validation, existing TeluguCinema News RSS feed `https://telugucinema.com/news/feed` had one transient `FEED_FETCH_FAILED` timeout after an earlier successful poll. A direct official RSS request succeeded (HTTP 200); the existing `feed-poll` worker retried successfully (HTTP 200 dispatch with 2 not-modified results) and source health returned to HEALTHY. No underlying code changes.
- Final verified active identity totals: **184 YouTube**, **8 WEB**, **38 RSS**, **230 total**. All **230/230** are `HEALTHY` under `source_effective_health` at verification time.
- Baselines and subscriptions prove connection/parsing health, **not** a new-post-to-device end-to-end delivery for these exact two new sources. Wait for naturally arriving eligible new items before closing that separate behavioral acceptance gate; do not synthesize or backdate notifications.

## Operational policy

- Verify unique immutable YouTube `UC...` ID **before** proposing a new channel.
- A linked alias, fan channel, private artist account, topic auto-generated account, or existing channel cannot increase the source count.
- Only verified owner-operated first-party web sources. An official company link does not confer Tier-A authority on third-party news linked from that site.
- Keep feeds bounded, first-poll baseline only, no notification storms, no source auto-promotion without ownership evidence.
