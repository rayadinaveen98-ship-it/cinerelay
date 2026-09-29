# P6.0.37 — Gap-driven YouTube expansion

Status: **HOSTED-PROVEN**

## Goal

After reaching 50 active official YouTube sources, stop count-only expansion and use source-role coverage to close meaningful gaps. The audit showed production houses and music labels were already strong while OTT coverage was comparatively thin.

## Starting state

- Active YouTube identities: 50
- Active X identities: 0
- Source-role mix at 50: 29 production houses, 14 music labels, 6 OTT platforms, 1 media library.

Six existing YouTube identities were `DEGRADED` only because of `WEBSUB_MISSED_DELIVERY`. Their authoritative uploads-playlist polling remained healthy with HTTP 200 and current successful fetches, so this did not represent a correctness failure. WebSub remains an accelerator rather than the correctness path.

## Wave 6 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| aha videoIN | OTT_PLATFORM | `UCmO-jDLU-KUcweCzktuDsbg` |
| JioHotstar Kannada | OTT_PLATFORM | `UCMW3IOCCVOQfP26b3UkU9UA` |
| Dharma Productions | PRODUCTION_HOUSE | `UCKQKIY2YlI4L5QVg7hhfjrQ` |
| YRF | PRODUCTION_HOUSE | `UCbTLwN10NoCU4WDzLf1JMOA` |
| Red Chillies Entertainment | PRODUCTION_HOUSE | `UCjJKg01HAP01xCLVhDmnLhw` |
| Excel Movies | PRODUCTION_HOUSE | `UCn9BuiRZGR_tPM2GGT4jN-w` |
| Sony Pictures India | PRODUCTION_HOUSE | `UCFqyJFbsV-uEcosvNhg0PaQ` |

All exact channel IDs were checked against the production registry before registration; no duplicate YouTube identity existed.

## Hosted baseline proof

All seven sources established authoritative uploads-playlist baselines successfully.

For every source:

- `latest_known_video_id` is non-null;
- `last_fallback_check_at` is non-null;
- source health is `HEALTHY`;
- `last_error_code` is null;
- `raw_items = 0` after baseline.

The first controlled fallback pass baselined Dharma Productions, JioHotstar Kannada, Red Chillies Entertainment, Sony Pictures India and YRF. A second controlled pass baselined aha videoIN and Excel Movies. No historical upload flood was imported.

A temporary one-minute copy of the existing authenticated YouTube fallback action was used only for baseline verification and removed immediately after proof. Remaining temporary wave-6 jobs: **0**.

## Hosted mesh after P6.0.37

- Active YouTube identities: **57**
- Active X identities: **0**
- Production houses: **34**
- Music labels: **14**
- OTT platforms: **8**
- Media libraries: **1**

The recent real feed remained moderate during the audit. In the prior 24-hour window the busiest source produced eight raw items, with music labels naturally contributing the highest activity.

## Quota observation

After all expansion and baseline proof work:

- YouTube read units used today: **1,152**
- YouTube provider requests recorded today: **1,152**
- failed provider calls today: **0**

The existing quota reserve guard and normal fallback cadence remain unchanged.

## Reproducibility

Production migration:

`20260919160606_p6_0_37_youtube_gap_driven_expansion`

Repository migration:

`supabase/migrations/20260919160606_p6_0_37_youtube_gap_driven_expansion.sql`

## Decision

Pause count-driven source expansion at 57. Future sources must close a documented coverage gap or provide clear creator value. The immediate next source-related work should be observation of relevance/noise, source health and classification quality across the larger mesh, not simply increasing the number of channels.
