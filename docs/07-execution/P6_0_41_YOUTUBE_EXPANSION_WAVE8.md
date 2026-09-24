# P6.0.41 — YouTube expansion wave 8

Status: **HOSTED-PROVEN**

## Goal

Continue P6.0.41 with a regional production/distribution wave that closes Malayalam, Kannada, Tamil and Telugu gaps while avoiding high-volume music/aggregator noise.

## Starting state

- Active YouTube identities: 67
- Production houses: 44
- Music labels: 14
- OTT platforms: 8
- Media libraries: 1

## Wave 8 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| BHAVANA STUDIOS | PRODUCTION_HOUSE | `UCPvtzpmgq3fraUXl6lLoK3w` |
| Magic Frames | PRODUCTION_HOUSE | `UCmUODKy5Ilf4TFZmp2ZcUyA` |
| Weekend Blockbusters | PRODUCTION_HOUSE | `UCSuqUmF828n0ytdR0JcnrIA` |
| KRG STUDIOS | PRODUCTION_HOUSE | `UC-BS2WxqT5aQnC7FhxAkJuw` |
| E4 Entertainment | PRODUCTION_HOUSE | `UCXcgltdMvm3ph4D6u-wku5g` |
| Sathya Jyothi Films | PRODUCTION_HOUSE | `UCdbalkQDqCcOsYG5c4L8TAw` |
| Passion Studios | PRODUCTION_HOUSE | `UCDPWa-mWO2ePeErjHcWnHLw` |
| SHINE Screens | PRODUCTION_HOUSE | `UCTvj3-woimxixynrEzG1kUA` |
| Dawn Pictures | PRODUCTION_HOUSE | `UCx71fX-x6GW_QH97qdVyZBg` |
| Prince Pictures | PRODUCTION_HOUSE | `UC6szo4tLpqr8YRZqJ7939aw` |

Production duplicate check returned zero pre-existing identities for these ten exact channel IDs.

## Zero-history baseline proof

Immediately after registration:

- all ten source identities were active;
- `latest_known_video_id` was null;
- `last_fallback_check_at` was null;
- `raw_items = 0` for every source.

A controlled invocation of the existing authenticated `youtube-fallback` path was then used after prioritizing only the wave-8 identities. Request id `24311` returned HTTP 200 with:

- `due = 20`
- `checked = 20`
- `baselineSources = 10`
- `discoveredUploads = 1` across the full worker batch; the new wave itself remained zero-history
- `gapSources = 0`
- `highPrioritySources = 2`
- quota before = 246
- quota after = 266

Post-baseline proof for every wave-8 source:

- non-null `latest_known_video_id`;
- non-null `last_fallback_check_at`;
- `source_health.health_state = HEALTHY`;
- `last_http_status = 200`;
- `last_error_code = null`;
- `raw_items = 0`.

No historical upload flood was imported.

## Hosted mesh after wave 8

- Active YouTube identities: **77**
- Production houses: **54**
- Music labels: **14**
- OTT platforms: **8**
- Media libraries: **1**

## Notification safety

The global source-activity notification preference remains disabled during source expansion. FCM delivery remains operational, but blanket upload notifications will not be re-enabled. The next notification product step is per-user/per-source subscriptions with Shorts off by default.

## Reproducibility

Production/repository migration:

`20260920125000_p6_0_41_youtube_expansion_wave8`

Repository file:

`supabase/migrations/20260920125000_p6_0_41_youtube_expansion_wave8.sql`

## Decision

Wave 8 is healthy and accepted. Continue to wave 9 with additional high-signal production/distribution sources, preserving exact-ID verification, zero-history baselines and quota/health checks as hard gates.
