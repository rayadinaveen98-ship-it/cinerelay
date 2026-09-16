# P4.5 Implementation Status — Instagram Professional / Business Discovery

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL META CREDENTIAL + OFFICIAL-MEDIA GATE PENDING**

Implemented on `phase-4/instagram-professional`:

- official Meta Business Discovery connector primitives;
- explicit Graph API version configuration;
- exact curated username normalization and mismatch guards;
- first-poll anti-backlog baseline;
- bounded media delta with explicit window-gap detection;
- deterministic Business Discovery fixtures and Node canaries;
- service-role-only runtime state and registration RPC;
- RLS and pgTAP privilege/registration tests;
- internal `instagram-business-poll-worker`;
- normal `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` integration;
- adaptive polling/backoff and HTTP 429 handling;
- `AUTH_REQUIRED`, `RATE_LIMITED`, `PARSER_BROKEN`, `DEGRADED` and gap health visibility;
- server-only Meta token / managed IG user ID / API version handling;
- scheduler dispatcher action prepared but no production cron enabled before credentials exist.

Canonical hosted migration:

`20260916091834_instagram_business_discovery_connector`

Hosted runtime:

- `instagram-business-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v5 ACTIVE;
- Instagram Business Discovery identities `0`;
- Instagram state rows `0`;
- Instagram cron jobs `0`.

Hosted security verification:

- state-table RLS enabled;
- authenticated direct SELECT denied;
- authenticated registration-RPC execute denied;
- no source identity was created or trusted by the deployment.

Canonical engineering proof before hosted deployment:

- head `a30e0011270d52aa6f61a7c001249a9d021408a5`;
- CineRelay CI `#270` / run `35078724368`;
- all four jobs PASS.

Full hosted proof:

`docs/07-execution/PHASE4_P4_5_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

External production gate:

1. Facebook Login / Instagram API authorization configured;
2. managed Professional Instagram account linked to a Facebook Page;
3. valid Page/API token and managed IG user ID stored server-side;
4. one curated official Professional cinema/OTT/studio target;
5. baseline with zero historical replay;
6. one real post-baseline media item transported exactly once;
7. unchanged repeat proving no duplicate work;
8. invalid/expired authorization visibly represented as `AUTH_REQUIRED`.

P4.5 remains stacked behind P4.4 and must not bypass the Phase-4 parent chain. No Instagram scheduler cron is enabled before the real Meta credential gate is satisfied.
