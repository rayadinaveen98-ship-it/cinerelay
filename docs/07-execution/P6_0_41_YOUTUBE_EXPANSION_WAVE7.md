# P6.0.41 — YouTube expansion wave 7

Status: **HOSTED-PROVEN**

## Goal

Resume gap-driven official YouTube coverage after the P6.0.39 Home/Sources work, but expand in small verified waves instead of a bulk source dump. Wave 7 focuses on major production/distribution studios that materially improve Hindi/Malayalam/Tamil coverage without adding broad music-channel noise.

## Starting state

- Active YouTube identities: 57
- Production houses: 34
- Music labels: 14
- OTT platforms: 8
- Media libraries: 1

## Wave 7 sources

| Source | Role | YouTube channel ID |
| --- | --- | --- |
| Mammootty Kampany | PRODUCTION_HOUSE | `UC6wkoCUd5gIYTDK6YUfI7Rw` |
| Nadiadwala Grandson Entertainment | PRODUCTION_HOUSE | `UC7bd9i-yWpUOhvC72fATxrQ` |
| Madras Talkies | PRODUCTION_HOUSE | `UCXvSFDtBkDs9UJkPaPXOzCg` |
| Maddock Films | PRODUCTION_HOUSE | `UC-LOdiPoxninevJ0DkleCLg` |
| Zee Studios | PRODUCTION_HOUSE | `UC3jMepkLKF8y4iiwWmAB3RA` |
| Pen Movies | PRODUCTION_HOUSE | `UC3ar28GS6o1p0m_wabfk2zw` |
| Panorama Studios | PRODUCTION_HOUSE | `UC47fJuLOxYsOOq5R3adUXQA` |
| Balaji Motion Pictures | PRODUCTION_HOUSE | `UCSHLoG-bXj1aVA2T5y8t84A` |
| Tips Films | PRODUCTION_HOUSE | `UCqXO3ktBw0D0sw1z5hZFeDg` |
| Pooja Entertainment | PRODUCTION_HOUSE | `UCw_qKx4QAhnrhuOEwhah8ew` |

Production duplicate check returned zero pre-existing identities for these ten channel IDs.

## Zero-history baseline proof

Immediately after registration:

- all ten source identities were active;
- `latest_known_video_id` was null;
- `last_fallback_check_at` was null;
- `raw_items = 0` for every source.

A controlled invocation of the existing authenticated `youtube-fallback` path was then used after prioritizing only the new identities. The worker returned:

- `due = 20`
- `checked = 20`
- `baselineSources = 10`
- `discoveredUploads = 0`
- `gapSources = 0`
- quota before = 205
- quota after = 225

After the baseline pass, every wave-7 source had:

- non-null `latest_known_video_id`;
- non-null `last_fallback_check_at`;
- `source_health.health_state = HEALTHY`;
- `last_http_status = 200`;
- `last_error_code = null`;
- `raw_items = 0`.

No historical upload flood was imported.

## Hosted mesh after wave 7

- Active YouTube identities: **67**
- Production houses: **44**
- Music labels: **14**
- OTT platforms: **8**
- Media libraries: **1**

## Notification safety during expansion

The old global source-activity preference for the currently active Android installation was disabled while source coverage expands. The FCM transport remains proven and active, but blanket upload notifications stay paused until per-user/per-source subscriptions replace the global switch. This prevents new source waves from increasing notification noise.

## Reproducibility

Repository/production migration:

`20260920123000_p6_0_41_youtube_expansion_wave7`

Repository file:

`supabase/migrations/20260920123000_p6_0_41_youtube_expansion_wave7.sql`

## Decision

Wave 7 is healthy and accepted. Continue P6.0.41 with regional gap waves, keeping exact-ID verification, zero-history baselines, source-health proof and quota checks as hard gates before each subsequent wave.
