# CineRelay Creator Intelligence — C1 identity and stats admission (2026-10-28)

Status: **CODE/TEST FOUNDATION ONLY; NOT DEPLOYED OR ACTIVATED**  
Parent research: [PR #98](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/98) (94 research-only candidate rows, unverified).

## Critical 2026 YouTube API development

As of **June 3, 2026**, YouTube officially supports **`videos.batchGetStats`** on `GET /youtube/v3/videos:batchGetStats` for multiple video IDs with public `statistics.viewCount`, `statistics.likeCount`, `statistics.commentCount`, and optional snippet/duration parts. This method has its **own default 10,000-unit daily quota bucket** and costs **one unit per request**, separate from legacy `GENERAL_READ` and `SEARCH` buckets.

Official docs:
- https://developers.google.com/youtube/data/revision_history (2026-06-03)
- https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/determine_quota_cost

**Important:** Google's documentation confirms the independent bucket/default, but CineRelay's **actual Google Cloud quota allocation is not yet verified**. Treat all 10,000-unit figures as defaults, not guaranteed live headroom. We cap batch payloads to **50 unique video IDs as our conservative safety policy**; this is not an assertion of YouTube's official maximum for `batchGetStats`. Require a tiny authorized provider canary before production use.

## C1 code delivered

File: `packages/youtube-connector/src/creator-intelligence.ts`:

- Convert explicitly listed handles into a quota-metered `channels.list?forHandle` request. Reject ambiguous name-only candidates. Safe Unicode handle parsing, no API key in request builders.
- Parse official `channels.list` response, verify `UC...` stable channel ID and `UU...` uploads playlist, flag duplicates against already-monitored channel IDs. SubscriberCount is approximate/rounded and may be hidden (represented as null).
- Construct the dedicated `videos:batchGetStats` request for public videos and parse counters without converting absent likes or comments to zero. Decimal strings are preserved without unsafe JS precision loss. Failed/unavailable video IDs are explicitly surfaced.
- Pure fair scheduling planner: first **0–72 hours hourly**, **day 4–7 every six hours**, **day 8–30 daily**, older videos excluded; **never reconstruct missing historical hourly counters**. A busy channel cannot crowd out other channels in a quota-constrained tick.
- **Separate budget admission**: new channel onboarding plus playlist reads charge `GENERAL_READ`; counter snapshots charge `VIDEO_BATCH_STATS` only. Every planner returns a dry-run decision; no automatic activation.

## Example dry-run: 10 vs 50 new channels (NOT production metrics)

Using the scheduler's previously modeled upper bound **8,064 playlist reads/day**, other general reads **365/day**, and a **500-unit reserve** within a default 10,000 general-read budget:

| Hypothetical additional channels | Channel lookup calls | New playlist reads per channel/day | Extra general-read units/day | Projected general-read headroom after reserve |
| --- | ---: | ---: | ---: | ---: |
| 10 | 50 | 24 | 290 | **+781** |
| 50 | 50 | 24 | 1,250 | **−179 (reject)** |

These are static arithmetic scenarios, **not safe rollout approvals**; real quota consumption, retries, rechecks and existing ingestion must be measured for a complete provider day.

Separately, 500 prospective video metric snapshots **every hour** in complete 50-video batches would use `24 × ceil(500/50) = 240` calls/day in the new video-stat bucket, provided YouTube accepts that batch size and the project has separate allowance. No snapshots are collected by C1.

## Data governance and UX constraints

- **No channel has been activated.** All PR #98 rows remain RESEARCH_LEAD until verified by exact YouTube `UC...` ID, duplicate check, activity audit and human review. The C1 code doesn't call Google or Supabase.
- Public per-video counters are cumulative and may be rounded/adjusted; a difference between successive readings is an **observed interval delta**, not YouTube's private realtime Analytics. Never imply knowledge of performance before we started sampling.
- Missing public like/comment counters are **null**, not zero. Hidden subscriber counts likewise.
- Respect YouTube Data API developer policy storage/refresh/retention requirements: use ≤30-day retention for public raw snapshots by default until compliance review approves anything else; a later storage implementation **must prove automated purge**.
- A future collector must be separate from the cinema-source raw-item → film-event pipeline. Creator stats cannot generate cinematic events or user push notifications by accident.
- Small creators are first-class, including under-10K and 10K–100K cohorts. No arbitrary maximum channel catalogue size; monitoring is quota-capped separately from discovery.
- **No automatic cross-creator score or public leaderboard** prior to specific YouTube policy review. Display factual observations and age-normalized lines.

## Next acceptance gates

- [x] Model separate 2026 video-stat quota and general discovery quota.
- [x] Write offline pure identity/counter/retention/fairness planner.
- [x] Unit regressions for identity, invisible statistics, quota, duplicate IDs, age buckets, safe URLs.
- [ ] CI all green on this feature branch.
- [ ] Verify a handful of candidate `UC...` IDs using metered official lookup, compare to 185 existing active channel IDs.
- [ ] Confirm Google project actual `VIDEO_BATCH_STATS` quota and request-batch semantics using a handful of public IDs, without changing live pollers.
- [ ] Design and test RLS-protected snapshot storage + enforced 30-day purge before ingestion.
- [ ] Begin a controlled, reversible 10-channel pilot, with monitor/rollback and user-facing precision labels.

Current live cinema-news scheduler and fallback worker remain unchanged.
