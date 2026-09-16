# P4.7 Implementation Status — Selected Public Pages

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL SELECTED-PAGE CANARY PENDING**

Branch:

`phase-4/selected-public-pages`

Parent:

`phase-4/trusted-trade-media`

Draft PR:

`#10`

Implemented and verified in this slice:

- separate audited promotion of approved `PUBLIC_WEB` candidates;
- approval remains non-promoting;
- Tier 3/4/5 authority cap with `TRADE_MEDIA`, `GENERAL_MEDIA`, `DISCOVERY_ONLY` roles;
- Tier 1/2 rejected;
- page cadence restricted to `NORMAL_60M`, `COLD_6H`, or `DAILY`;
- required bounded parser profile;
- exact canonical registry duplicates rejected;
- selected-page provenance recorded as `sourceClass=SELECTED_PUBLIC_PAGE`;
- reuse of P4.2 `FIRST_PARTY_HTML` technical parser family and `register_page_source(...)` runtime contract;
- atomic source + identity + page state + health state + candidate promotion + audit action;
- direct `authenticated` execution of the promotion RPC revoked;
- focused operator-authenticated `cinerelay-public-page-onboarding-api`;
- internal-console promotion controls with Tier, cadence, parser JSON and reason;
- CI type-check/deployment bundle coverage for the new API;
- pgTAP authority, cadence, parser, approval, type, atomicity and no-side-effect coverage.

Canonical hosted migration:

`20260916100515_selected_public_page_promotion`

Canonical migration-reconciliation head:

`d1ae419eda4605c690eca7065ef9b6984de202f0`

Canonical CI:

- CineRelay CI `#288` / run `35084264282`;
- all four jobs PASS;
- fresh migrations + all P4.7 pgTAP assertions + DB lint PASS;
- web console build/static-host checks PASS;
- `cinerelay-public-page-onboarding-api` type-check PASS;
- deployment-native Edge bundle PASS.

Hosted runtime:

- `cinerelay-public-page-onboarding-api` v1 ACTIVE;
- function id `bb255c7a-a7ab-4b23-ba18-561eebf8dcbf`;
- runtime bundle SHA `7525b4bdf567dc4813fab427116b3296ad37985cfb9b5ac244748fcb181d5c50`;
- exact CI artifact id `10440759028`;
- artifact digest `sha256:46397db0829f1caabb2a404676aeb9c4ce2eee90a91ba6b41485e0020194c4bc`.

Hosted no-side-effect verification after deployment:

- promotion RPC exists: `true`;
- direct `authenticated` RPC execution: denied;
- selected public-page identities: `0`;
- selected public-page sources: `0`;
- selected public-page runtime state rows: `0`;
- promoted selected-page candidates: `0`.

Supabase security/performance advisors reported no new P4.7-specific finding. Existing project-wide findings remain unchanged.

The P4.7 console controls are CI-built on this stacked branch. The hosted production Pages console is not claimed as updated until the branch stack is merged/deployed through the normal console release path.

Remaining real-source gate:

1. choose a relevant public page whose ownership/usage posture is acceptable for CineRelay monitoring;
2. submit and review it separately as a `PUBLIC_WEB` candidate;
3. validate a bounded parser profile against the real page structure;
4. explicitly promote it at Tier 3, 4 or 5 with a 60-minute-or-slower cadence;
5. prove first poll baselines with zero historical replay;
6. prove an unchanged repeat creates no duplicate raw work;
7. prove parser drift fails visibly rather than silently advancing state;
8. prove one genuinely new page item traverses raw/revision/processing while retaining the selected page's lower authority.

No real selected public page has been promoted yet.
