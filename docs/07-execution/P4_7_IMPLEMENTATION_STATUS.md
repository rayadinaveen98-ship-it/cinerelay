# P4.7 Implementation Status — Selected Public Pages

Date: 2026-09-16

State: **ENGINEERING IMPLEMENTATION IN REVIEW**

Branch:

`phase-4/selected-public-pages`

Parent:

`phase-4/trusted-trade-media`

Implemented in this slice:

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

Engineering is not complete until the first fresh-database CI run is green. No hosted migration/API deployment and no real selected page promotion should occur before that gate.
