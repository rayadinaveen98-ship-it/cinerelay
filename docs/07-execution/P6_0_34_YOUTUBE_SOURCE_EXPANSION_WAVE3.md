# P6.0.34 — YouTube source expansion wave 3

Status: **HOSTED-PROVEN**

## Goal

Prioritize the official YouTube ingestion mesh while X remains dormant after the P6.0.33 provider payment gate. Expand high-value first-party production, music and OTT coverage without historical backfill.

## Starting state

- Active YouTube identities: 16
- Active X identities: 0
- X remains intentionally dormant.

## Wave 3A

Existing source organizations gained exact-ID YouTube identities through the P6.0.28 two-phase onboarding helpers:

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Netflix India | OTT_PLATFORM | `UCZSNzBgFub_WWil6TOTYwAg` |
| Prime Video India | OTT_PLATFORM | `UC4zWG9LccdWGUlF77LZ8toA` |
| Sony LIV | OTT_PLATFORM | `UCOQNJjhXwvAScuELTT_i7cQ` |
| Sun NXT | OTT_PLATFORM | `UCials1wQnEN_NykYZr1048w` |

New tier-1 source organizations:

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Think Music India | MUSIC_LABEL | `UCLbdVvreihwZRL6kwuEUYsA` |
| T-Series Telugu | MUSIC_LABEL | `UCnJjcn5FrgrOEp5_N45ZLEQ` |
| Hombale Films | PRODUCTION_HOUSE | `UCarJoVXH0T2pdtcHBu9J8Bw` |

Hosted baseline proof for all seven:

- fallback checkpoint established on the newest known upload;
- `raw_items = 0` immediately after baseline;
- no historical upload backfill;
- source health `HEALTHY`;
- no connector error code.

Active YouTube coverage after Wave 3A: **23**.

## Wave 3B

Six additional exact-ID first-party channels were registered:

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| JioHotstar Telugu | OTT_PLATFORM | `UC2DDhRE75LKKPjAxC-zsGRg` |
| PrimeShow Entertainment | PRODUCTION_HOUSE | `UCXRLoewrwy4_10PuoMoUBug` |
| KVN PRODUCTIONS | PRODUCTION_HOUSE | `UC3DOgauBYLQQXdH1siGjfpw` |
| Sun Pictures | PRODUCTION_HOUSE | `UC17vzygnkDJ2wLlcU4pE-Qg` |
| Dream Warrior Pictures | PRODUCTION_HOUSE | `UCbpjEr8lHlnkf1SQ5tnDEYw` |
| 2D Entertainment | PRODUCTION_HOUSE | `UCj6rqKA33Ywu2GTFRDxHhnA` |

The normal fallback scheduler is intentionally bounded. A temporary one-minute copy of the existing authenticated YouTube fallback scheduler action was used only to accelerate baseline proof; the connector implementation, limits and credentials were unchanged. Controlled fallback batches were drained until all six established checkpoints.

Hosted baseline proof for all six:

- every source has non-null `latest_known_video_id`;
- every source has non-null `last_fallback_check_at`;
- `raw_items = 0` for every source after the first poll;
- source health is `HEALTHY` for every source;
- `last_error_code` is null for every source.

The temporary scheduler was removed immediately after proof and `p6_0_34_youtube_baseline_canary` jobs remaining = **0**.

## Final hosted state

- Active YouTube identities: **29**
- Active X identities: **0**
- Net YouTube growth in P6.0.34: **+13 official sources**
- No historical backfill from any newly onboarded source.

## Reproducibility

Production migration:

`20260919154722_p6_0_34_youtube_source_expansion_wave3`

Repository migration:

`supabase/migrations/20260919154722_p6_0_34_youtube_source_expansion_wave3.sql`

Existing source organizations use `attach_source_identity(...)` followed by `seed_source_identity_runtime(...)` to avoid duplicate source rows. Brand-new source organizations use `register_youtube_source(...)`.

## X decision

P6.0.33 proved the official X connector reaches the provider but is blocked by HTTP 402 without prepaid API credits. X identities and cron remain inactive. CineRelay must not replace the official connector with fragile website scraping; YouTube remains the active expansion path.

## Next

Continue exact-ID verification for another source wave, prioritizing active South/Indian production houses, Telugu-focused OTT/video channels and official music labels. Observe quota/fallback health as coverage increases and keep zero-history onboarding mandatory.
