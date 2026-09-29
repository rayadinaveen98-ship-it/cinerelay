# P4.7 — Carefully Selected Additional Public Pages

Date: 2026-09-16

## Decision

P4.7 completes the locked Phase-4 source-priority list by onboarding carefully selected public pages without creating another scraper framework.

The implementation reuses P4.2's hardened generic HTML page connector and parser. `FIRST_PARTY_HTML` remains the historical technical connector-family identifier; it is **not** an authority claim for P4.7 sources. Selected-page provenance is recorded explicitly in `connector_config.sourceClass = SELECTED_PUBLIC_PAGE`, while authority continues to come only from `sources.authority_tier` and `source_role`.

P4.7 preserves the P4.3/P4.6 trust rule:

`APPROVED` is still non-promoting. A second audited operator action is required before any source identity or polling state exists.

## Eligibility

The first P4.7 slice accepts only discovery candidates where:

- candidate status is `APPROVED`;
- candidate kind is `PUBLIC_WEB`;
- the normalized/candidate URL is not already registered;
- a display name exists;
- an operator supplies a bounded declarative parser profile;
- an operator provides a promotion reason;
- authority tier and cadence satisfy the lower-authority public-page policy.

Technical reachability alone is not sufficient. The operator is expected to review ownership/relevance, usage terms where material, and parser suitability before promotion.

## Authority and cadence policy

Selected public pages cannot enter the direct/official authority bands through this path:

- Tier 3 -> `TRADE_MEDIA`;
- Tier 4 -> `GENERAL_MEDIA`;
- Tier 5 -> `DISCOVERY_ONLY`;
- Tier 1 and Tier 2 are rejected.

Polling is intentionally conservative:

- `NORMAL_60M`;
- `COLD_6H`;
- `DAILY`.

`HOT_5M` and `ACTIVE_15M` are rejected.

## Parser-profile contract

The promotion transaction requires a parser profile compatible with `packages/web-page-connector`:

Required:

- `profileVersion`;
- `itemSelector`;
- `linkSelector`.

Optional bounded fields include:

- title/summary/date/author selectors;
- date/item-id/link attributes;
- include/exclude URL regex patterns;
- `maxItems` from 1–100;
- `minItems` from 1 through `maxItems`;
- order `NEWEST_FIRST` or `OLDEST_FIRST`.

The operator Edge API sanitizes and bounds the profile before calling the database. The database independently revalidates the security/authority-critical shape before any source is created. Runtime parsing retains P4.2's fail-closed parser-drift handling.

A syntactically acceptable profile is not a claim that it correctly matches a real page. The operator must verify the target structure before promotion, and the first hosted poll must still prove a healthy baseline before the source can be considered production-verified.

## Promotion transaction

`operator_promote_selected_public_page_candidate(...)` performs one atomic transaction:

1. validates actor, reason, Tier and slow poll class;
2. validates/bounds the parser-profile contract;
3. locks the candidate;
4. requires `APPROVED / PUBLIC_WEB`;
5. rejects an existing canonical registry URL;
6. creates the source at Tier 3, 4 or 5;
7. creates a `WEB / FIRST_PARTY_HTML / PUBLIC_WEB` identity with `sourceClass=SELECTED_PUBLIC_PAGE`;
8. calls the existing `register_page_source(...)` contract;
9. marks the discovery candidate `PROMOTED` and links the identity;
10. writes `PROMOTE_PUBLIC_PAGE_CANDIDATE` audit evidence.

Any failure rolls the entire transaction back.

## Operator API and console

A focused `cinerelay-public-page-onboarding-api` is used instead of widening the generic source-discovery API further.

The function:

- accepts browser CORS preflight;
- validates the supplied bearer token with `auth.getUser()`;
- requires an active `operator_users` entry;
- sanitizes Tier, cadence, parser profile and reason;
- invokes only the service-role-only promotion RPC.

The internal console exposes the P4.7 panel only when a candidate is `APPROVED`, kind `PUBLIC_WEB`, and has no exact registry match. The operator must choose Tier/cadence, review/edit parser-profile JSON, and enter a promotion reason.

## Reused P4.2 safety properties

Once promoted, the existing `page-poll-worker` retains:

- HTTPS-only source registration;
- private/localhost host protection;
- bounded redirects and request timeout;
- 5 MB page cap;
- domain throttling;
- conditional HTTP;
- 429/retry/backoff handling;
- declarative parser profiles;
- structure/item-count drift detection;
- fail-closed `PARSER_BROKEN` behavior;
- first-poll anti-backlog baseline;
- bounded delta/gap detection;
- normal raw-item -> revision -> processing path;
- source-health and connector-run telemetry.

## Release gates

Engineering:

- fresh migration applies;
- pgTAP proves authority/cadence/approval/type/parser/duplicate/atomicity boundaries;
- onboarding API type-checks and deployment bundle builds;
- web console builds;
- existing connector/intelligence tests remain green.

Hosted foundation:

- canonical migration ledger reconciled to Git;
- exact green-CI API artifact deployed;
- direct `authenticated` RPC execution denied;
- deployment creates zero selected-page sources automatically;
- security/performance advisors reviewed.

Real-page production proof:

- select a useful public cinema/series page with acceptable usage/monitoring posture;
- submit evidence and approve separately;
- verify parser profile against the live structure before promotion;
- explicitly promote at Tier 3/4/5;
- prove exactly one source + identity + page state + health state + audit action;
- first worker poll baselines without historical replay;
- unchanged repeat is duplicate-free;
- parser drift fails visibly rather than silently advancing state;
- a genuinely new item follows the normal evidence pipeline with the selected page's lower authority preserved.

No P4.7 page should ever be described as official/direct solely because it uses the same technical parser family as P4.2.
