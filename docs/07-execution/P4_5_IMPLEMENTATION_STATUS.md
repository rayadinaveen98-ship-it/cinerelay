# P4.5 Implementation Status — Instagram Professional / Business Discovery

Date: 2026-09-16

State: **ENGINEERING IMPLEMENTATION IN REVIEW / HOSTED META CREDENTIAL GATE PENDING**

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

External production gate:

1. Facebook Login / Instagram API authorization configured;
2. managed Professional Instagram account linked to a Facebook Page;
3. valid Page/API token and managed IG user ID stored server-side;
4. one curated official Professional cinema/OTT/studio target;
5. baseline with zero historical replay;
6. one real post-baseline media item transported exactly once;
7. unchanged repeat proving no duplicate work.

P4.5 remains stacked behind P4.4 and must not bypass the Phase-4 parent chain.
