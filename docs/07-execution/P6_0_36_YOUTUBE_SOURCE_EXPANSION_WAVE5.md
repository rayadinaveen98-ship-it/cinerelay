# P6.0.36 — YouTube source expansion wave 5

Status: **HOSTED-PROVEN**

## Goal

Reach a deliberate 50-source official YouTube milestone with another small production-house-focused wave, preserving exact-ID verification, zero-history onboarding and quota safety.

## Starting state

- Active YouTube identities: 43
- Active X identities: 0

## Wave 5 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Raaj Kamal Films International | PRODUCTION_HOUSE | `UC_gXhnzeF5_XIFn4gx_bocg` |
| Aashirvad Cinemas | PRODUCTION_HOUSE | `UC_J44kyEsEB8LPlhfm2Xb4g` |
| Prithviraj Productions | PRODUCTION_HOUSE | `UCH1Gszpy-NmA6ZXZaxhnlwA` |
| Paramvah Studios | PRODUCTION_HOUSE | `UCvBaJ5MfXVKfSiKP2beaNvw` |
| Seven Screen Studio | PRODUCTION_HOUSE | `UCVQOvjbw_Fjjscg1d4Y-LVQ` |
| Friday Film House | PRODUCTION_HOUSE | `UCv65_DW-OzwBgJw99zWJy3g` |
| Wunderbar Films | PRODUCTION_HOUSE | `UCIx3RWYwikMlDiJeCEUbfEA` |

The production registry was checked by exact YouTube channel ID before registration. No duplicate identity existed.

## Hosted baseline proof

All seven sources completed the authoritative uploads-playlist baseline successfully.

For every source:

- `latest_known_video_id` is non-null;
- `last_fallback_check_at` is non-null;
- source health is `HEALTHY`;
- `last_error_code` is null;
- `raw_items = 0` after baseline.

No historical upload flood was imported.

A temporary one-minute copy of the existing authenticated YouTube fallback action was used only to accelerate baseline verification. It was removed immediately after all seven checkpoints were established. Temporary wave-5 jobs remaining: **0**.

## Quota observation

Before Wave 5 baseline proof, today's YouTube read usage was 1,112 units. After the seven baseline calls it was:

- YouTube read units used today: **1,119**
- YouTube provider requests recorded today: **1,119**
- failed provider calls today: **0**

The expansion therefore consumed seven additional authoritative read units and remained comfortably inside the existing quota guard.

## Final hosted state

- Active YouTube identities: **50**
- Active X identities: **0**
- Net YouTube growth in P6.0.36: **+7 official sources**
- Historical raw-item backfill from new sources: **0**

## Reproducibility

Production migration:

`20260919160229_p6_0_36_youtube_source_expansion_wave5`

Repository migration:

`supabase/migrations/20260919160229_p6_0_36_youtube_source_expansion_wave5.sql`

## Next

Do not add sources just to increase the count. Inspect the 50-source mesh by source role, language/territory coverage, poll health and real creator value. Future additions should close documented gaps while keeping the official-source, exact-ID and zero-history requirements.
