# CineRelay C11: one-shot official public upload activity and channel facts (30 Oct 2026)

## Scope and quota decision
- Research-only, one-shot 20-channel audit of official C10 verified stable UC IDs.
- API methods: **one** channels.list (20 IDs in a single request) with public subscriberCount/hiddenSubscriberCount/videoCount and uploads playlist identity; **up to 20** playlistItems.list requests with maxResults=3 and contentDetails (videoId and videoPublishedAt). Maximum **21 general-read units/requests**, no retries.
- The connected CineRelay production quota ledger recorded approximately 8,072 (Oct 29) and 8,161 (Oct 28) general-read requests on full recent Pacific-day periods; Oct 30 at inquiry showed 1,019 units. This ledger is an *incomplete accounting source* and does not assert current Google Cloud quota or guarantee that additional calls will succeed.
- Google official quota documentation lists channels.list and playlistItems.list at 1 unit each. A 401, 403, or 429 halts further collection, safely. No production use of the dedicated GitHub verification key.
- The workflow is **pinned to the C11 isolated development branch** and runs one time only when its workflow YAML is first pushed. It has no cron and no production deployment.

## Verified execution result (2026-10-30)

- [C11 one-shot GitHub run #41036715214](https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/41036715214) **completed successfully** with 21/21 maximum requests and no retries.
- All 20 official channel IDs returned current public channel fields and uploads-playlist evidence; 20/20 returned three public video items each (60 total IDs with public publication timestamps).
- All 20 exposed official *public, rounded* subscriber counts. No hidden subscriber count was reported in this 20-channel snapshot.
- Snapshot recorded at **2026-10-30T09:53:37.748Z**, with expiration **2026-11-29T09:53:37.748Z** (30-day maximum; inspect API data freshness earlier when necessary).
- Relative to the *observation instant* (not as of any later date): 13 channels' latest listed uploads were within 30 days; 3 were between 31 and 90 days; 4 were older than 90 days.
- Two examples needing additional editorial review: SKCB Telugu Facts (latest public upload 2023-08-26) and Telugu Car Guide (2025-03-16 at this snapshot). Older last visible upload is not proof a channel has closed or that no unlisted content exists.
- Results were committed only to the isolated C11 branch. The protected pilot review page now displays this dated, capped evidence and clearly marks stale data; monitoring remains disabled.

## Output
- `scripts/creator-intelligence/audit-c11-activity.mjs` validates exactly 20 never-enabled C10 identities, queries the official public API, verifies current uploads playlist linkage, and records at most three recent publicly listed videos per channel.
- Public subscriber counts are explicitly an *approximate current API field*, not verified research bands; hidden subscriber count stays null, not zero.
- `research/creator-intelligence/c11-public-activity-results.json` begins at `NOT_RUN`; only the isolated workflow may write an observed report. Output has a 30-day expiration and timestamps.
- Never store the key, full request URLs, raw API bodies, private data, views/likes/comments, watch time, derived performance scores, comparison tables, or cross-channel rankings.
- No automated category classification, content originality judgment, age eligibility, or editorial approval. An uploads-playlist row does not prove suitability; humans must inspect titles and video context before any onboarding.
- All creator approval, monitoring, metrics and notifications remain OFF; 185 existing production cinema YouTube identities untouched.

## Interpretation and limitations
- The latest 3 uploads playlist items are a **sample**. They may exclude deleted/private videos, do not provide a complete upload cadence, and shouldn't be represented as complete channel history.
- A newly discovered record may have null publication timestamps, unknown subscriber counts, or empty public uploads. Treat each distinctly from a real zero.
- Research-only results expire after 30 days, and newly published uploads may make the snapshot stale sooner. Refresh before using for an admission decision.
- C6 performance comparisons remain policy-gated; do not turn them on based on this audit.

## Progression after C11
1. Review the verified public activity report, identify channels with recent visible uploads and missing evidence.
2. Perform editorial checks on channels, activity, publisher type and suitability; diversify outside the current Telugu-heavy pilot.
3. Refresh **live** source identity dedupe just before any insertion or activation.
4. Confirm actual Google Cloud project quota, reserve for the existing app, privacy/retention and derived-metrics permission (as applicable).
5. Get explicit operator review/approval and a separately authorized limited pilot before any source monitoring.

Official docs:
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://developers.google.com/youtube/terms/developer-policies-guide
