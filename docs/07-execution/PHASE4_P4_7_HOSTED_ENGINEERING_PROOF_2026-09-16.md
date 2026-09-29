# Phase 4.7 Hosted Engineering Proof — Selected Public Pages

Date: 2026-09-16

## Status

**ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL SELECTED-PAGE CANARY PENDING**

Branch:

`phase-4/selected-public-pages`

Draft PR:

`#10`

Parent:

`phase-4/trusted-trade-media` / PR #9

## Trust model proven

P4.7 completes the locked Phase-4 source-priority list by adding a deliberately reviewed onboarding path for carefully selected public pages without creating a second scraper framework.

The promotion path is structurally constrained:

- candidate must already be `APPROVED`;
- candidate kind must be `PUBLIC_WEB`;
- approval itself creates no source and assigns no authority;
- Tier 1/2 are rejected;
- supported authority is Tier 3/4/5 only;
- Tier 3 derives `TRADE_MEDIA`;
- Tier 4 derives `GENERAL_MEDIA`;
- Tier 5 derives `DISCOVERY_ONLY`;
- polling is restricted to `NORMAL_60M`, `COLD_6H`, or `DAILY`;
- exact existing canonical URLs fail closed;
- a bounded parser profile is mandatory;
- double promotion fails closed;
- the identity is marked `sourceClass=SELECTED_PUBLIC_PAGE` even though it reuses the existing `FIRST_PARTY_HTML` technical parser family.

`FIRST_PARTY_HTML` therefore remains a connector/parser-family identifier, not a trust assertion.

## Atomic promotion transaction

`operator_promote_selected_public_page_candidate(...)` performs the following as one database transaction:

1. validates actor, reason, Tier and cadence;
2. validates parser-profile shape and bounded fields;
3. locks and revalidates the discovery candidate;
4. rejects unapproved, wrong-kind, already-promoted and duplicate-URL candidates;
5. creates the lower-authority source row;
6. creates the `WEB / FIRST_PARTY_HTML / PUBLIC_WEB` source identity;
7. persists parser profile and selected-page provenance in `connector_config`;
8. calls the existing `register_page_source(...)` contract;
9. creates/initializes page runtime + health state through that existing contract;
10. marks the candidate `PROMOTED` and links the identity;
11. persists a `PROMOTE_PUBLIC_PAGE_CANDIDATE` audit action.

Any failure rolls back the complete trust/onboarding transaction.

## Engineering CI

Initial full P4.7 implementation CI:

- CineRelay CI `#286` / run `35082859535`;
- all four jobs PASS;
- fresh migrations PASS;
- P4.7 pgTAP authority/cadence/parser/approval/type/atomicity/no-side-effect assertions PASS;
- DB lint PASS;
- web-console build and static-host checks PASS;
- `cinerelay-public-page-onboarding-api` type-check PASS;
- Edge deployment-native bundle PASS.

Supabase assigned the hosted migration version:

`20260916100515_selected_public_page_promotion`

The Git migration filename was reconciled to that exact hosted ledger version with no SQL semantic changes.

Canonical reconciliation head:

`d1ae419eda4605c690eca7065ef9b6984de202f0`

Canonical CI:

- CineRelay CI `#288` / run `35084264282`;
- all four jobs PASS;
- fresh application of the canonical migration PASS;
- pgTAP PASS;
- DB lint PASS;
- web console PASS;
- new onboarding API type-check and deployment-native bundle PASS.

## Exact deployment artifact

Canonical CI artifact:

- name: `cinerelay-edge-deploy-bundle`;
- artifact id: `10440759028`;
- digest: `sha256:46397db0829f1caabb2a404676aeb9c4ce2eee90a91ba6b41485e0020194c4bc`;
- workflow head: `d1ae419eda4605c690eca7065ef9b6984de202f0`.

The hosted API was deployed from the `cinerelay-public-page-onboarding-api/index.js` and `deno.json` files inside that exact artifact.

## Hosted runtime

Migration:

`20260916100515_selected_public_page_promotion`

Edge Function:

- name: `cinerelay-public-page-onboarding-api`;
- version: `1`;
- status: `ACTIVE`;
- function id: `bb255c7a-a7ab-4b23-ba18-561eebf8dcbf`;
- `verify_jwt=false` by design because the function independently validates the bearer session with Supabase Auth and requires membership in `operator_users` before the service-role RPC call;
- runtime bundle SHA: `7525b4bdf567dc4813fab427116b3296ad37985cfb9b5ac244748fcb181d5c50`.

## Hosted privilege and no-side-effect proof

After migration and API deployment, hosted SQL verification returned:

- promotion RPC exists: `true`;
- direct `authenticated` execute privilege: `false`;
- selected public-page identities: `0`;
- selected public-page sources: `0`;
- selected public-page page-state rows: `0`;
- promoted selected-page candidates: `0`.

This proves deployment itself did not trust or activate any real public page.

## Advisor review

Supabase security/performance advisors were run after hosted deployment.

No new P4.7-specific security or performance finding was introduced.

Existing project-wide findings remain, including:

- informational `rls_enabled_no_policy` notices on service-role-only/RLS-protected tables;
- two existing mutable-search-path warnings unrelated to P4.7 (`upsert_canonical_event_with_evidence`, `record_youtube_websub_delivery`);
- leaked-password protection disabled at the project Auth level;
- existing informational unindexed-FK/unused-index notices.

P4.7's privileged promotion function itself sets an explicit search path and direct public/anon/authenticated execution is revoked.

## Console deployment note

The P4.7 operator controls are implemented and pass the web-console CI build/static-host contract on the stacked branch. This proof does not claim the production Cloudflare Pages console has been updated with those controls yet. Production UI deployment remains tied to the normal ordered branch/PR release path.

## Remaining real-source release gate

P4.7 remains dormant with zero selected pages until a real candidate satisfies all of the following:

1. relevant cinema/series coverage;
2. acceptable ownership/usage posture for CineRelay monitoring;
3. separate P4.3-style review and approval;
4. validated bounded parser profile;
5. explicit operator promotion at Tier 3/4/5;
6. 60-minute-or-slower cadence;
7. first poll baselines with zero historical replay;
8. unchanged repeat remains duplicate-free;
9. parser drift becomes visible health degradation/failure instead of silent state advancement;
10. one genuinely new page item traverses normal raw/revision/processing while preserving lower authority.

No synthetic page proof may substitute for this real-source evidence gate.
