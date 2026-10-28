# CineRelay C8 — fresh production UC-ID reconciliation

**Date:** 2026-10-28  
**Status:** source/test milestone only; **NO live monitoring, provider requests, or production changes.**

## What actually happened

Via the connected Supabase project's **read-only SQL** interface, queried public \`source_identities\` with \`platform='YOUTUBE'\`, matching canonical \`UC...\` stable IDs **including active and inactive sources**. At **2026-10-28T15:51:05.333Z**, the live query returned:

- 185 canonical YouTube source IDs; 185 active.
- 185 unique IDs, an exact set match with the 2026-10-28 C2 baseline.
- Zero newly added or missing identities.
- Three first-party YouTube public-page identity leads already documented in C2 all remain absent from live production. They are **not** C2 API-verified or operator-approved.
- The existing C2 \`c2-official-id-results.json\` still reads \`BLOCKED_MISSING_GITHUB_API_KEY\`: zero official API lookups.

The audited complete point-in-time ID list and capture timestamp are stored in
\`research/creator-intelligence/c8-live-youtube-source-ids-2026-10-28.json\`.

**This snapshot is not permanently current.** C8 requires a snapshot captured within 15 minutes of the *audit instant*. It must be recaptured at each real admission decision, and a source drift must be reviewed before the gate can reopen.

## Implemented

- \`scripts/creator-intelligence/reconcile-c8-live-ids.mjs\`: pure offline evidence reconciler atop C7.
- Validates the source kind, capture instant, full \`UC...\` identity set, uniqueness and asserted count.
- Compares live and baseline source identities, reports added/removed counts plus SHA-256 digest of sorted IDs.
- Rechecks the reviewed C7 queue against the **live** ID set, not merely the prior 185-ID file; fail closed on new collisions.
- Aborts readiness for stale/future captures, source drift, C2 auth/quota stops, unapproved first-party page records or any malformed evidence.
- Preliminary public YouTube page evidence is shown separately from genuine C2 API lookups. It never counts as verification.
- No SQL queries inside the helper; it consumes a separately obtained JSON snapshot. No credentials or external API calls.
- No automatic creator approvals, tracking, cron, metrics, Android APK, notices, production DB writes, cross-channel comparisons or merges.

### Reproduction

Run from repo root:

\`\`\`bash
node scripts/creator-intelligence/reconcile-c8-live-ids.mjs
node tests/youtube-connector/run-creator-c8-reconcile.mjs
\`\`\`

The dated checked-in snapshot is for reproducibility, not future approvals. Running with \`new Date().toISOString()\` past the fifteen-minute window returns \`BLOCKED_STALE_LIVE_SNAPSHOT\`. To audit again, take a fresh, **authorized SELECT-only** snapshot of all current YOUTUBE \`UC...\` IDs and provide its JSON via a filename under \`research/creator-intelligence\`. Never fetch or publish production API secrets. Manual C2 key provisioning belongs to the separate branch-pinned GitHub verification workflow.

Seven focused Node regression scenarios cover fresh no-drift, staleness/future timestamp, new ID, missing ID, duplicate/forged evidence, interrupted provider run and the real checked-in 185-ID/0-API-call blocked state.

## Next real operational gate

1. An authorized owner enables the scoped GitHub Actions \`YOUTUBE_API_KEY\` secret. Do not copy existing production credentials to GitHub, docs or chat.
2. Re-run C2 read-only verification on its own controlled branch (max 20 general-read API calls), then **explicitly review and import** the resulting report into our stacked development history; no silent automatic synchronization.
3. Re-capture the live complete source-ID set within fifteen minutes of each review; block if any drift/duplicate exists.
4. Verify YouTube's policy/derived-metrics permission, Google Cloud project-specific actual quota and retention requirements before enabling any statistics storage/collector.
5. Obtain editorial identity/activity approval. A C8 green *identity* state is **still not** permission for public statistics or analytics comparisons.

See official YouTube policies: https://developers.google.com/youtube/terms/developer-policies-guide and https://developers.google.com/youtube/terms/derived-metrics-policy .
