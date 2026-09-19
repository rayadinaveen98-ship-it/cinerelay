# P6.0.35 — YouTube source expansion wave 4

Status: **HOSTED-PROVEN**

## Goal

Continue the free-first official YouTube expansion after P6.0.34, with exact channel identities, zero-history baselines and no X reactivation.

## Starting state

- Active YouTube identities: 29
- Active X identities: 0
- X remains dormant after the P6.0.33 HTTP 402 provider payment gate.

## Wave 4 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Lyca Productions | PRODUCTION_HOUSE | `UCA7gwgLgmCZ8DSmdf2bhb8g` |
| AGS Entertainment | PRODUCTION_HOUSE | `UC9WXzTgk10ncJX1eOxHElCg` |
| JioHotstar Tamil | OTT_PLATFORM | `UC8lPjTzRiG37n1Q2kpz3Rfg` |
| Mango Music | MUSIC_LABEL | `UCWqyzn3cDkRDh3kRGWrIQwA` |
| Tips Telugu | MUSIC_LABEL | `UC2V5vzgmEmoiWqXfM2jN5_w` |
| Tips Tamil | MUSIC_LABEL | `UC48pE7QE4NZFTCsHT-IRxJw` |
| Saregama Tamil | MUSIC_LABEL | `UCzee67JnEcuvjErRyWP3GpQ` |
| Saregama Malayalam | MUSIC_LABEL | `UCoRF8GByEjmM_yHwUGIDGyQ` |
| Zee Music South | MUSIC_LABEL | `UCLsSLka8jODBozvi5VTQeaQ` |
| Annapurna Studios | PRODUCTION_HOUSE | `UCKA8af7IMMItFjqrYO9KgfQ` |
| Junglee Music Telugu | MUSIC_LABEL | `UCSXwEK86-OWEn_QF65X7c7Q` |
| Lahari Music | MUSIC_LABEL | `UCnSqxrSfo1sK4WZ7nBpYW1Q` |
| SriBalajiMovies | MEDIA_LIBRARY | `UCoy3dQzEdq1y2zMnT4pdj3Q` |
| Geetha Arts Music | MUSIC_LABEL | `UCDV5PLFWEgBW0Sx4p1wmXSA` |

All candidates were checked against the production registry before registration. No matching YouTube identity already existed.

## Hosted baseline proof

All fourteen sources completed the authoritative uploads-playlist fallback baseline successfully.

For every source:

- `latest_known_video_id` is non-null after the first successful poll;
- `last_fallback_check_at` is non-null;
- source health is `HEALTHY`;
- `last_error_code` is null;
- `raw_items = 0` immediately after baseline.

Therefore no historical upload flood was imported.

The existing authenticated YouTube fallback scheduler was temporarily copied to a one-minute cadence only to accelerate baseline verification. The temporary job was removed immediately after all sources established checkpoints. Remaining temporary wave-4 baseline jobs: **0**.

## Quota observation

After the expansion/baseline work, hosted YouTube quota accounting showed:

- YouTube read units used today: **1,112**
- YouTube provider requests recorded today: **1,112**
- failed provider calls today: **0**

The existing reserve guard remains unchanged.

## Final hosted state

- Active YouTube identities: **43**
- Active X identities: **0**
- Net YouTube growth in P6.0.35: **+14 official sources**
- Historical raw-item backfill from new sources: **0**

## Reproducibility

Production migration:

`20260919155806_p6_0_35_youtube_source_expansion_wave4`

Repository migration:

`supabase/migrations/20260919155806_p6_0_35_youtube_source_expansion_wave4.sql`

The migration is idempotent through `register_youtube_source(...)`, which uses the exact YouTube channel ID as its identity key and seeds the uploads playlist for authoritative discovery.

## Next

Use the remaining quota headroom for a small final expansion wave toward roughly 50 high-value official YouTube sources, prioritizing active South Indian production houses rather than catalogue/noise channels. Preserve exact-ID verification and zero-history baseline requirements.
