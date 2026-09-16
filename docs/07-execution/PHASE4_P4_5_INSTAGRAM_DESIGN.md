# P4.5 — Instagram Professional / Business Discovery Connector Design

Date: 2026-09-16

## Decision

CineRelay will use Meta's official Instagram API with Facebook Login and Business Discovery for curated external Instagram Professional accounts. It will not use logged-in browser scraping, private mobile APIs, consumer-account scraping, or home-feed emulation.

Current official Meta workspace verification on 2026-09-16:

- Instagram API with Facebook Login supports Instagram Professionals (Business and Creator accounts);
- the permission model requires a Facebook Page linked to a Professional Instagram account;
- Page access-token discovery returns the linked `instagram_business_account` ID used by the Graph API;
- the API can retrieve basic metadata and metrics about other Instagram Business and Creator accounts;
- consumer Instagram accounts are not accessible through this API path;
- Meta's official examples keep the Graph API version as an `api_version` variable, so CineRelay will configure the version server-side instead of hard-coding a permanent version.

## Connector contract

Source identity:

- `platform = INSTAGRAM`
- `connector_type = INSTAGRAM_BUSINESS_DISCOVERY`
- `access_mode = API`
- `handle` is mandatory and curated
- poll class uses normal CineRelay adaptive classes

Runtime configuration:

- `INSTAGRAM_BUSINESS_DISCOVERY_ACCESS_TOKEN`
- `INSTAGRAM_MANAGED_IG_USER_ID`
- `INSTAGRAM_GRAPH_API_VERSION`
- optional `INSTAGRAM_BUSINESS_DISCOVERY_TOKEN_EXPIRES_AT`

Credentials are never stored in source rows, raw items, logs, browser bundles or Git.

## Ingestion behavior

1. Exact curated target username is requested through Business Discovery.
2. The managed Instagram Professional account ID is only the API anchor; it does not grant trust to target accounts.
3. The first successful poll baselines the newest media ID and imports no historical backlog.
4. Later polls compare the bounded current media window against the saved newest media ID.
5. New media flows through `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM`.
6. Missing prior media IDs produce visible `INSTAGRAM_WINDOW_GAP` health rather than a false completeness claim.
7. Media files are not copied or stored. CineRelay retains permitted metadata, caption text and the official Instagram permalink.
8. Graph API/provider errors are surfaced in source health rather than silently advancing state.

## Scope boundary

P4.5 is intentionally not an Instagram-completeness claim.

Covered where Meta permits:

- public Professional Business/Creator account metadata;
- current Business Discovery media window;
- captions, timestamps, media type and permalinks returned by the official API.

Not covered:

- consumer/personal Instagram accounts;
- private accounts or private content;
- arbitrary Stories completeness;
- a simulated Following/home timeline;
- browser-session scraping;
- unsupported or age-gated profiles.

## Release gates

Engineering gate:

- connector canaries pass;
- fresh migration + pgTAP pass;
- Edge Function type-check/bundle pass;
- browser bundle contains no Instagram privileged-secret markers.

Hosted foundation gate:

- migration deployed;
- worker/dispatcher deployed from green CI artifacts;
- RLS and direct privilege denial verified;
- no cron activated before real Meta credentials exist.

Production gate:

- valid Meta Facebook Login/Page authorization is configured;
- managed Professional IG user ID is verified;
- one curated official cinema/OTT/studio Professional account baselines with zero historical replay;
- one genuinely new post-baseline media item traverses raw/revision/processing exactly once;
- unchanged repeat creates no duplicate work;
- invalid/expired authorization is visible as `AUTH_REQUIRED`.

Until that production gate is satisfied, P4.5 is engineering-ready / hosted-foundation-ready only.
