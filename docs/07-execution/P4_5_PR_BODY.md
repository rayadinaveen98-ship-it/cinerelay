## Goal

Add an official Meta Instagram Professional / Business Discovery connector without browser scraping, consumer-account completeness claims, authority auto-promotion, or historical backlog replay.

## Current state

**ENGINEERING IMPLEMENTATION IN REVIEW / HOSTED META CREDENTIAL GATE PENDING**

This PR is intentionally stacked on `phase-4/threads-public-profiles`.

Implemented:

- official Instagram API with Facebook Login / Business Discovery connector package;
- exact curated username normalization/mismatch guard;
- explicit server-configured Graph API version;
- first-poll anti-backlog baseline;
- bounded media delta + explicit `INSTAGRAM_WINDOW_GAP` handling;
- deterministic V1/V2 Business Discovery fixtures and connector canaries;
- `instagram_business_source_state` + service-role-only registration RPC;
- RLS and pgTAP security/registration tests;
- internal `instagram-business-poll-worker`;
- standard raw/revision/processing pipeline integration;
- adaptive poll cadence, backoff and 429 handling;
- source health for auth/rate-limit/parser/fetch/gap failures;
- server-only Meta token / managed IG user ID / API version handling;
- scheduler dispatcher action prepared;
- CI coverage including Edge Function type-check/bundle and browser secret-marker checks.

No production Instagram cron is activated before Meta credentials exist.

## External release gate

Production proof requires a linked Professional Instagram account + Facebook Page, valid authorization/token, managed IG user ID, one curated official cinema/OTT/studio Professional target, zero-history baseline, one genuine post-baseline media item transported exactly once, and a duplicate-free unchanged repeat.

## Guardrails

- official API only;
- Business/Creator accounts only where Meta permits;
- no consumer-account completeness claim;
- no home-feed emulation or logged-in scraping;
- no media-file copying;
- API availability never grants source authority;
- P4.3 candidate approval still does not auto-promote trust;
- credentials remain server-side;
- no hosted cron until the credential/production canary gate is satisfied.
