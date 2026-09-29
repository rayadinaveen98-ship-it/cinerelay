# P6.0.41 — YouTube expansion wave 9

Status: **HOSTED-PROVEN**

## Goal

Advance the official YouTube mesh from 77 toward the planned ~90-source operating point using ten additional high-signal production/distribution identities, with a strong Malayalam/Tamil/Telugu coverage bias and no bulk music/aggregator additions.

## Starting state

- Active YouTube identities: 77
- Production houses: 54
- Music labels: 14
- OTT platforms: 8
- Media libraries: 1

## Wave 9 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Potential Studios | PRODUCTION_HOUSE | `UCoU9DW4JJTmaVm7gsiAyK3Q` |
| Sree Gokulam Movies | PRODUCTION_HOUSE | `UC7rP8B90HTEXxQ6ApRVDyVg` |
| Anto Joseph Film Company | PRODUCTION_HOUSE | `UCAAufdrkoIXtfHQI9QE1tzA` |
| SRT Entertainments | PRODUCTION_HOUSE | `UC4Jn8EVdcJLK6IMWCEwOHRw` |
| Mythri Distributors LLP | PRODUCTION_HOUSE | `UCD9mBTXKz8xBn8_PKw7bK1A` |
| Million Dollar Studios | PRODUCTION_HOUSE | `UCpXFGF4KCES-ULIoyZwbRzg` |
| RS Infotainment | PRODUCTION_HOUSE | `UCUjM7AzodC55Dq6BncrsBjA` |
| Goodwill Entertainments | PRODUCTION_HOUSE | `UCq6f9bBWaWTHl0FhH167RgA` |
| Amal Neerad Productions | PRODUCTION_HOUSE | `UCOzubmwpVZI7gD0Jf7Bk3Aw` |
| LittleBig Films | PRODUCTION_HOUSE | `UCWjrksVAh6pL0Yl0bFOVJ8w` |

Production duplicate check returned zero pre-existing identities for all ten exact channel IDs.

## Zero-history baseline proof

Immediately after registration, all ten identities were active with null baseline checkpoints and `raw_items = 0`.

A controlled invocation of the existing authenticated `youtube-fallback` path then prioritized these identities. Request id `24330` returned HTTP 200 with:

- `due = 20`
- `checked = 20`
- `baselineSources = 10`
- `discoveredUploads = 0`
- `gapSources = 0`
- `highPrioritySources = 5`
- quota before = 275
- quota after = 295

Post-baseline proof for every wave-9 source:

- non-null `latest_known_video_id`;
- non-null `last_fallback_check_at`;
- `source_health.health_state = HEALTHY`;
- `last_http_status = 200`;
- `last_error_code = null`;
- `raw_items = 0`.

No historical upload flood was imported.

## Hosted mesh after wave 9

- Active YouTube identities: **87**
- Production houses: **64**
- Music labels: **14**
- OTT platforms: **8**
- Media libraries: **1**

At proof time, YouTube usage for the current quota day was only **295 general-read units / 295 requests**, including controlled baseline work. This is not a full-day steady-state measurement; the mesh must still be observed over a complete quota day after expansion.

## Notification safety

The old global upload-notification preference remains disabled. FCM transport is healthy, but blanket notifications will not be re-enabled. Per-source user subscriptions are the next notification product contract.

## Reproducibility

Production/repository migration:

`20260920131500_p6_0_41_youtube_expansion_wave9`

Repository file:

`supabase/migrations/20260920131500_p6_0_41_youtube_expansion_wave9.sql`

## Decision

Wave 9 is healthy and accepted. Use a final small gap wave to reach the planned ~90-source mesh, then stop count-driven YouTube expansion and observe steady-state quota/noise before any further additions.
