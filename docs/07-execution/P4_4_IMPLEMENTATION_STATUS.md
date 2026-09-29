# P4.4 Implementation Status — Threads Public Profiles

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL META CREDENTIAL + OFFICIAL-POST GATE PENDING**

Implemented on `phase-4/threads-public-profiles`:

- official Threads API connector primitives;
- exact curated handle normalization and mismatch guards;
- first-poll anti-backlog baseline;
- 50-post delta window with explicit gap detection;
- deterministic fixtures and Node canaries;
- service-role-only runtime state and registration RPC;
- RLS and pgTAP privilege/registration tests;
- internal `threads-profile-poll-worker`;
- normal `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` integration;
- adaptive polling/backoff and HTTP 429 handling;
- `AUTH_REQUIRED`, `RATE_LIMITED`, `PARSER_BROKEN`, `DEGRADED` and gap health visibility;
- server-only Meta token handling;
- CI type-check/deployment-bundle coverage;
- scheduler dispatcher action prepared but no production cron activated before credentials exist.

Hosted proof:

- canonical Git/hosted migration `20260916085300_threads_public_profile_connector`;
- `threads-profile-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v4 ACTIVE;
- hosted Threads identities `0`;
- hosted Threads state rows `0`;
- hosted Threads cron jobs `0`;
- authenticated direct state-table SELECT `false`;
- authenticated registration RPC execute `false`;
- CI #264 / run `35076303251` PASS on reconciliation head `1178a95263e42417246f306f84144ad6c2d5dc40`.

External hosted gate:

1. Meta app with Threads use case;
2. authorized access token containing `threads_profile_discovery`;
3. one curated official cinema/OTT/studio Threads identity;
4. baseline with zero historical replay;
5. one real post-baseline official post transported exactly once;
6. unchanged repeat proving no duplicate work;
7. auth expiry/failure visibly represented as `AUTH_REQUIRED`.

Full proof:

`docs/07-execution/PHASE4_P4_4_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

P4.4 must remain stacked behind P4.3 and must not bypass the Phase-4 parent chain.
