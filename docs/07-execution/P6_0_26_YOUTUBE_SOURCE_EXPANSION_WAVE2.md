# P6.0.26 — Official YouTube Source Expansion Wave 2

Status: **HOSTED BASELINE PROVEN**

## Goal

Expand immediately usable official-source coverage while X remains credential-gated, and make the new Official Source Activity notification stream more likely to receive genuine future uploads.

## Added YouTube identities

- UV Creations — `@UVCreations` — channel `UCmse5JbKneJqVyerfhDVYvQ` — HIGH / 5m fallback
- Niharika Entertainment — `@NiharikaEnt` — channel `UCfm7ruQ8mPzPyw0w7e7pqEA` — HIGH / 5m fallback
- Saregama Telugu / Saregama South — `@saregamasouth` — channel `UC68nKdrLbLL0Vj7ilVkLmmg` — NORMAL / 15m fallback

The identities are attached to the existing tier-1 source records already used by X rather than creating duplicate source organizations.

## Ingestion contract

Each identity uses:

- `platform = YOUTUBE`
- `connector_type = YOUTUBE_WEBSUB`
- `access_mode = WEBHOOK`
- WebSub as accelerator
- uploads-playlist fallback as authoritative correctness path
- priority-aware fallback cadence

The uploads playlist is derived from the canonical channel ID (`UC...` -> `UU...`).

## Safe baseline proof

After state seeding, a controlled hosted `youtube-fallback` cycle returned:

- due: **3**
- checked: **3**
- baselineSources: **3**
- discoveredUploads: **0**
- gapSources: **0**
- highPrioritySources: **2**
- quota units: **253 -> 256**

This proves the first poll recorded the newest existing upload as the checkpoint without backfilling historical videos into the newsroom.

Hosted state after baseline:

- Niharika Entertainment: HEALTHY, HIGH, next check +5m, raw items `0`
- UV Creations: HEALTHY, HIGH, next check +5m, raw items `0`
- Saregama South: HEALTHY, NORMAL, next check +15m, raw items `0`

Official YouTube coverage is now **15 channels**.

## Reproducibility

Hosted migration: `20260918091924_p6_0_26_youtube_source_expansion_wave2`

Repository migration: `supabase/migrations/20260918091924_p6_0_26_youtube_source_expansion_wave2.sql`

P6.0.27 records the state-seeding correction discovered during hosted verification.
