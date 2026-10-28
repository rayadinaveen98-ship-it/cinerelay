# CineRelay Creator Intelligence C3 — private metric storage and expiry gates

**2026-10-28 | source-only draft | no live migration, channel activation or metric collection**

## Result

An independent creator data model, **not joined to existing cinema `sources`, `raw_items`, `events`, `jobs` or push notifications**:

1. `creator_intelligence_channels`: stable YouTube `UC...` primary key, current verified display metadata, `verification_method='CHANNELS_LIST'`, review status, operator approval and explicit `monitoring_enabled`. The table **cannot enable monitoring** without review state `APPROVED`, an actual operator-user foreign key and approval timestamp. No person automatically becomes monitored because their channel was discovered.
2. `creator_intelligence_videos`: stable public `11-character video_id`, linked to a creator channel, public `published_at`, explicit `LONG/SHORT/LIVE/UNKNOWN` format. No private or unconsented Analytics fields.
3. `creator_intelligence_metric_samples`: explicit observation timestamp, nullable public `view_count`, `like_count`, `comment_count` as **numeric(20,0)** to preserve unsigned 64-bit API counts. Missing public counters stay **NULL**, not 0. Uniqueness `(video_id,observed_at)` prevents identical-timestamp duplicates. Metrics for unapproved/unmonitored channels or timestamps before publication or outside a 30-day window are rejected.
4. `creator_intelligence_purge_expired(timestamptz)`: service-only function deletes expired samples plus older video metadata. A named daily pg_cron job (`17 5 * * *`) calls it independently of collection. If approved for deployment this job begins automatically, deleting only `creator_intelligence_*` records. Existing movie sources, events, subscriptions and notification queues are untouched.

## Security

- RLS enabled on **all three new tables**.
- `anon` and `authenticated`: no direct table privileges or policies. `service_role`: explicit CRUD, and service-only retention RPC. An authenticated client cannot invoke bulk deletion. No new public endpoint.
- `approved_by` references the existing `operator_users(user_id)` allowlist; the DB prevents activating an unapproved channel. API/worker runtime must independently check the operator is **currently active** at approval time.
- Service-role credentials and YouTube key must never enter Android/web clients, logs, public research or GitHub source.
- The release is intended as a **stacked draft PR** on C2; GitHub Actions builds and DB tests must pass. It is not a production migration until explicitly reviewed and merged/applied.

## API policy and comparisons

As of 2026-06-03, YouTube's public `videos.batchGetStats` API has a separate default 10k-unit/day quota and costs one per call; check **actual** project quota in Google Cloud before scheduling. Source: https://developers.google.com/youtube/data/revision_history and https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats .

For public API values, the conservative policy is no more than 30 days of retained raw metric observations. **Persistent derived, cross-creator ranking data and longer historical retention are not enabled** until YouTube API policy review. In addition, YouTube aligned public views across long-form, live and Shorts on 2026-08-27: comparisons need content-format and date annotations. Source: https://developers.google.com/youtube/data/revision_history .

Counts are cumulative, not YouTube Analytics hourly views. The difference of two captured samples is only *observed growth during an interval*, whose timestamps and count availability must always be visible.

## Acceptance

- [x] Independent isolated channel/video/snapshot schema in migration.
- [x] Operator-review approval / disabled-by-default database gate.
- [x] Decimal counters, nullable hidden likes/comments and observations after publication.
- [x] 30-day purge function, daily scheduled cleanup, RLS and service-only grants.
- [x] pgTAP contract tests authored for security, approval, time bounds and cleanup.
- [ ] CI database + integration checks green for C3 head.
- [ ] Official IDs for remaining C2 candidates, currently blocked by missing GitHub Actions `YOUTUBE_API_KEY`.
- [ ] Confirm batchGetStats actual provider quota, response and request-length behavior.
- [ ] Real collector with read-after-write idempotency, rate limiting, two quota buckets and zero propagation to cinema alerts.
- [ ] Operator-reviewed canary before any production enablement.

## Source-of-truth links

- [Research PR #98](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/98)
- [C1 rules PR #99](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/99)
- [C2 official identity gate PR #100](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/100)
