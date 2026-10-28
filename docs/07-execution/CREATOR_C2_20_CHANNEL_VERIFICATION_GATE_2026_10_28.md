# Creator Intelligence C2 — Verified-identity pilot gate (2026-10-28)

## Goal and current result

Grow CineRelay beyond cinema channels while comparing creators across subscriber-size cohorts and niches, **without creating duplicates or spending additional quota accidentally**.

- **94 initial RESEARCH_LEAD entries** on draft [PR #98](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/98), not activated. Provisional directories and subscriber bands are NOT official YouTube verification.
- **20 deliberately mixed handle leads** staged in `c2-verification-input-20.json`: 4 nano (third-party under 10K), 6 micro (10K–100K), 5 mid (100K–1M), 5 large (1M–10M). 14 Telugu, 3 Kannada, 3 Marathi. We must recruit further non-Telugu nano/micro creators before treating the full 94 as representative.
- **185 existing stable UC channel IDs** extracted via SELECT-only query from `public.source_identities` for `platform='YOUTUBE'`, *active and inactive*, in `c2-existing-youtube-ids-2026-10-28.json`. They are a dated, read-only snapshot, not a live uniqueness constraint.
- Existing production handle comparison found **0 exact overlaps among the 44 listed handles**, but that is **not a stable-ID duplicate proof**.
- Dedicated CI run [40667829716](https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/40667829716) **completed without errors** but reported `BLOCKED_MISSING_GITHUB_API_KEY`. **0 official API calls, 0 official IDs verified** because `YOUTUBE_API_KEY` was not exposed to this GitHub Actions workflow. The outcome is a **blocked validation**, not a successful verification.

## First-party YouTube channel page evidence (not official API calls)

Following the GitHub key blocker, three canonical `/channel/UC...` URLs were found on **YouTube-owned public channel pages** that also displayed the matching `@handle`. They are recorded with `apiVerified=false`, `reviewApproved=false`, `trackingEnabled=false` in `c2-first-party-page-identity-matches-2026-10-28.json`:

| Candidate | Found on first-party YouTube channel page | Snapshot duplicate? |
| --- | --- | --- |
| Chandoo – Tech in Telugu | https://www.youtube.com/channel/UCuaf89M0Lt5pmXzaUssXHvw | no |
| Ruchi Paakashaale | https://www.youtube.com/channel/UCcEXr6ZzppFU1jEbX42QP1A | no |
| CA Rachana Ranade (Marathi) | https://www.youtube.com/channel/UChnK-EoSW6er1qtWkwnJDRw | no |

This is real first-party identity progress but is **not equivalent** to a successful authorized `channels.list` call, a current channel-activity check, or operator approval. The dated 185-ID dedupe snapshot cannot prove permanent uniqueness; repeat the live production stable-ID check before future activation.

## What is already implemented

- `scripts/creator-intelligence/verify-c2-channels.mjs` uses Google's public `channels.list` `forHandle` with `part=snippet,contentDetails` and a restricted response field mask.
- Exactly **20 maximum** identity lookup attempts. If 401/403/429 occurs, stop (no retries). Does not invoke `search.list` or any expensive discovery method.
- Public Google response must provide exactly one valid `UC...` channel ID, title and corresponding `UU...` uploads playlist. Never substitute a guessed channel ID or trust a matching displayed name as identity proof.
- Compares verified stable channel ID to the dated 185-ID existing pool; marks `EXISTING_ID_DUPLICATE` if matched; otherwise marks `OFFICIAL_ID_FOUND_REVIEW_PENDING`.
- Output explicitly carries `trackingEnabled=false` and uses **30-day expiry**. Subscriber counts, private data, API keys, request URL containing API key and raw provider response bodies are never stored.
- GitHub workflow `.github/workflows/c2-creator-id-verification.yml` is branch-pinned, one-shot on its own creation and manually re-runnable. The result is saved only on the isolated research branch, never production.
- Tests validate invalid/missing IDs, duplicates, response schema, authentication/quota short circuit, credential redaction and URL correctness.
- Separate C1 scheduler/metrics contracts remain in draft [PR #99](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/99); no live jobs or snapshot tables here.

## Credential blocker and next verifiable step

GitHub Actions could not read `secrets.YOUTUBE_API_KEY`. **Do not copy the Supabase production Google API key into code, docs, public workflow logs or chat.** If an appropriately scoped GitHub Actions secret is later provisioned through repository settings, re-run this read-only workflow; it will perform at most 20 calls to the general-read bucket and commit the first verified-ID report.

The production YouTube fallback worker's existing runtime secret and its 185-channel polling schedule remain unchanged. We must also check the live general-read remaining quota before moving beyond 20 calls, even with a GitHub secret.

## Pilot activation hard gates

1. The official `UC...` IDs and `UU...` uploads playlists have been resolved, and at least one channel in each size segment has identity approval by an authorized operator. Subscriber-size class must be recomputed from fresh official, public data if available; unknown is **unknown**, never 0.
2. Deduplication must be repeated against current production stable channel IDs immediately before any insert/activation.
3. Confirm public content exists, recent activity, channel/individual-vs-brand classification and appropriate categories.
4. Confirm quota headroom for additional uploads-playlist polling (GENERAL_READ) **separately** from public video snapshot API (VIDEO_BATCH_STATS).
5. Build and test protected snapshot storage and enforced public-statistics retention before hourly collection. A stat count at an observed timestamp is NOT a retrospective hourly YouTube Analytics fact.
6. Human-approved pilot cohorts, nonzero counts across small/mid/large, minimum non-Telugu representation. Pilot first ten channels only after quotas and safety gates.
7. No auto-created film entities, movie events or push alerts from Creator Intelligence.

Current state: **C2 operational procedure ready; official-ID validation blocked by missing GitHub-side access to API credentials.** Live CineRelay unchanged.

## Sources

- YouTube official `channels.list` `forHandle`: https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- YouTube quota cost: https://developers.google.com/youtube/data/determine_quota_cost
- YouTube dedicated `videos.batchGetStats`: https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats
