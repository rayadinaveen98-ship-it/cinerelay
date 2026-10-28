# CineRelay Creator Intelligence C6 — equivalent-age public video observations

**Date:** 2026-10-28  
**Status:** Source-only, **NOT APPROVED FOR LIVE CROSS-CHANNEL USE**. No production deployment, metrics, channel onboarding or quota spend.

## Why this release is strictly gated

Google's current YouTube API Services developer policies prohibit gamified/rivalry-style cross-channel tracking, derived analytics and creator rankings without the separate analytics authorization. As of June 2026, a distinct derived-metrics approval process permits specific audited analytics use cases, but CineRelay has **not demonstrated this approval**.

Official sources:
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/terms/derived-metrics-policy

This phase must NEVER be interpreted as authorization. An operator's role in CineRelay is **not** YouTube analytics approval.

The production-default C6 endpoint **fails closed**. `comparisonStatus` may report `enabled: false`, but `comparison` cannot query pairs unless BOTH server-side environment conditions are explicitly configured after audit:
- `CINERELAY_CREATOR_COMPARISONS_APPROVED=true`
- `CINERELAY_YOUTUBE_ANALYTICS_PERMISSION_REFERENCE=<real independently reviewed approval reference>`

The reference is an audit trail, **not proof by itself**. Validate the project/application permission directly with Google/YouTube before configuring either option. Never set those variables for demo or debugging. No client prop, query param, browser action or source code default can unlock comparison.

## Delivered in PR

1. **Pure, deterministic equivalent-age engine**: `apps/web/src/lib/creator-comparisons.ts`. It accepts precisely sourced public `observedAt`, `publishedAt`, `viewCount`, `likeCount`, `commentCount` strings. It never interpolates or backfills missing hourly counts.
2. Five **explicit windows**, measured in actual video age since publication: 6h ±1h; 24h ±2h; 48h ±3h; 72h ±4h; 7d ±12h. Nearest observed timestamp only, with its true age displayed. No fabricated 24h reading from a 27h observation.
3. Requires two **different** stable YouTube video IDs, valid timestamps, **same known video content format** (LONG/SHORT/LIVE; UNKNOWN refused), and non-expired actual samples in the past 30 days. Missing public view counts are missing; actual `0` stays `0`. Counter decreases must not become engagement scores.
4. **Operator-only server action `comparison`** in existing private C5 dashboard API. It validates active operator JWT as usual, then fails closed on YouTube analytics permission before touching candidate pair tables. If enabled, requires both channels are enabled/approved, both approving operators still active, metadata recently refreshed, two selected videos belong to correct channels with same format, and maximum 1,000 public observations. Exceeding the cap returns an error, not a truncated comparison.
5. **UI route `/creators/compare`**, behind the same signed-in operator console as C5. It shows lock-state details until separately approved, then offers two verified channel/video selectors and factual two-column window observations. **No public leaderboards, 'winners', scores, competitive language, ratios, forecasting, private creator Analytics or monetization estimates.** Shows coverage rows and actual observation ages and absent windows.
6. Strict Zod API schemas and 10 Deno unit tests for denied defaults, invalid formats/IDs, exact 24h matching, unavailable counters, time-zone handling, 30-day limits and 800-sample bound. Web typecheck and Edge typecheck/native artifact included in main CI.

## Limitations, not claimed results

- No C6 provider requests, statistics are **not currently live**. This is a code/test milestone only.
- C2 GitHub Actions verification still lacks secure `YOUTUBE_API_KEY`; stable IDs for most research candidates remain unverified.
- C3/C4/C5 migrations and Edge functions are in **draft stacked pull requests**, not deployed to the production project.
- The current C5 operator directory page displays the first 100 verified channels and only the 10 newest recorded videos per channel. C6 inherits these browsing caps. No global 1,000-creator competitive report yet.
- Comparison is meaningful only when both videos have observations reasonably close to equivalent ages. A side-by-side raw view count is **not** a statement of creator quality, fair monetization or audience affinity.
- Since YouTube API may revise statistics and view count definitions, numbers remain explicitly captured cumulative public counts with timestamp and format labels.

## Acceptance gates to go beyond code

- [x] Build C6 gated read-only engine, type validation, UI and unit tests.
- [ ] All C6 CI jobs green on this head, including security/API compile and mobile layout smoke.
- [ ] Obtain and document Google YouTube analytics permission for this specific use case.
- [ ] Resolve official C2 channel IDs, obtain first real consent/policy-safe pilot dataset, confirm project quota and retention.
- [ ] Validate age-window coverage with actual observations, test no-data states and mobile/tablet view.
- [ ] Only after all checks: enable C6 for **approved** internal analytics and plan compliant wider rollout.

**C6 is deliberately non-operational without permission. Do not use it to circumvent YouTube's API policies.**
