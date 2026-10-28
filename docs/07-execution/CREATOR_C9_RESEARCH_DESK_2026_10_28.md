# CineRelay Creator Intelligence C9 — source-backed research desk
**28 October 2026 · DRAFT, not deployed**

## Delivered
A responsive **read-only internal Creator Research Desk** at `/creators/research` inside CineRelay's authenticated web operator console, stacked after C8.

- The original 27 October discovery CSV from research PR #98 supplies **94 source-backed leads across 13 discovery sources**. C9 builds a minimal typed JSON bundle from that curated source: 44 listed handles, 50 name-only leads; nine regional/language clusters; categories and provisional nano/micro/mid/large/mega/unknown size tiers.
- Source records have `researchStatus=RESEARCH_ONLY`, `apiVerified=false`, `monitoringEnabled=false`, `metricsEnabled=false`, **no UC stable IDs** and **no third-party snapshot subscriber counts displayed**.
- Search name/handle/niche and filter by region/language or provisional size. Select a lead to see its source URL and missing verification checklist; filter results cannot accidentally retain an invisible selection. Responsive list/detail layout on mobile/tablet/web.
- Separate tab for the three **preliminary YouTube public-page channel ID matches** from C2; these are visibly **API pending**, never counted as verified or incorporated into the 94 research registry's verified total.
- `CreatorResearchPage` checks the existing authenticated and active-operator-gated `fetchConsoleOverview` backend before showing the desk. Static bundled public-source leads are not secret; server-side authorization is still required for protected backend endpoints.
- Six Node regression contracts for the real 94-lead evidence totals, 13 sources, 44 vs 50 handles, provisional cohort diversity, disabled ingestion flags, preliminary page identity status and route guard; wired into `npm run test:youtube`.
- Web app TypeScript compilation, Android and CI smoke are required before merge; this milestone does **not** ship an APK.

## Where it appears
`Creator Intelligence → Research desk · 94 leads` in the operator console navigation. No deployment has been made; an operator must use a build containing this draft PR.

## Real data versus no data
This research desk uses **real dated editorial/public directory discovery entries**, not a live YouTube verification feed. It provides **no public counters, views per hour, statistics, creator rankings or leaderboards**. The three preliminary matches are independently sourced channel-page evidence, not official `channels.list` API verification.

C2 remains blocked at `BLOCKED_MISSING_GITHUB_API_KEY` with **0 official pilot API calls and 0 verified pilot IDs**. C7/C8 evidence gates still protect eventual onboarding. Existing 185 cinema YouTube identities and all live ingestion remain untouched. C6 side-by-side comparisons stay permission-locked.

## Next action
1. Authorized owner provisions an appropriately scoped repository GitHub Actions `YOUTUBE_API_KEY` secret, without exposing its value in any chat, source or CI log.
2. Trigger branch-pinned C2 20-handle read-only verification manually, inspect official API outputs, then bring the reviewed report forward through a PR.
3. Refresh live UC-ID deduplication at the point of approval (C8), verify actual project quotas and permitted retention/analytics use before any statistics collector.
4. Extend the research pool fairly across under-100K and non-Telugu channels, with provenance and explicit unknown fields. No creator activation via the research desk.

## Policy references
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
