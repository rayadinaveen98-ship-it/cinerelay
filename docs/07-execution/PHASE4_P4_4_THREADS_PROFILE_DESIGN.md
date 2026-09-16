# P4.4 — Threads Public Profile Connector Design

Date: 2026-09-16

## Decision

CineRelay will use Meta's official Threads API public-profile capabilities, not logged-in browser scraping or public-page HTML scraping.

Current official capability verified on 2026-09-16:

- `GET /profile_lookup?username={exact_handle}` for public profile lookup;
- `GET /profile_posts?username={exact_handle}&fields=...` for public-profile Threads;
- app/user authorization is required;
- the capability is represented by the `threads_profile_discovery` permission in Meta's current Threads API materials.

## Connector contract

Source identity:

- `platform = THREADS`
- `connector_type = THREADS_PROFILE_API`
- `access_mode = OFFICIAL_API`
- `handle` is mandatory and curated
- poll class uses the normal CineRelay adaptive classes

Runtime secret:

- `THREADS_PROFILE_DISCOVERY_ACCESS_TOKEN`
- optional `THREADS_PROFILE_DISCOVERY_TOKEN_EXPIRES_AT` for health visibility

Tokens are never persisted in source rows, raw items, logs, browser bundles or Git.

## Ingestion behavior

1. Exact curated username is requested through the official API.
2. First successful poll baselines the newest post ID and imports no historical backlog.
3. Later polls compare the top 50 posts against the saved newest post ID.
4. New posts flow through `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM`.
5. Missing prior IDs trigger visible `THREADS_WINDOW_GAP` health instead of silent completeness claims.
6. Repeated post IDs are idempotent; content fingerprints support revision handling for any post that is actually re-observed through the new-item window.
7. Media files are not copied or stored. CineRelay retains permitted metadata, text/alt text and the official permalink.

## Trust and privacy rules

- A Threads identity is trusted only because the CineRelay source registry says it is trusted; API availability never grants authority.
- P4.3 discovery approval still does not auto-promote a candidate.
- Only public-profile posts returned by the official API are processed.
- No follower graph, private content, home-feed emulation or browser-session scraping is part of P4.4.
- API/provider failures and permission expiry must surface as source health states.

## Release gates

Engineering gate:

- connector package canaries pass;
- fresh migration + pgTAP pass;
- Edge Function type-check/bundle pass;
- security advisors remain clean for the new state surface.

Hosted gate:

- Meta app authorization with `threads_profile_discovery` is configured server-side;
- one curated official cinema/OTT/studio Threads profile baselines without historical replay;
- one genuinely new post traverses the normal raw/revision/job path exactly once;
- an unchanged repeat creates no duplicate work;
- access-token failure is visible as `AUTH_REQUIRED` rather than silent data loss.

Until the Meta app/token gate is satisfied, P4.4 remains engineering-ready but not production-verified.
