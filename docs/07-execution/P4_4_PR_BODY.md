## Goal

Add an official Meta Threads public-profile connector without browser scraping, authority auto-promotion, or historical backlog replay.

## Current state

**ENGINEERING IMPLEMENTATION IN REVIEW / HOSTED META CREDENTIAL GATE PENDING**

This PR is intentionally stacked on `phase-4/source-discovery-candidates`.

Implemented:

- official Threads API connector package;
- exact curated username normalization/mismatch guard;
- `/profile_posts` request contract with bounded fields/window;
- first-poll anti-backlog baseline;
- top-50 delta + explicit `THREADS_WINDOW_GAP` handling;
- deterministic V1/V2 fixtures and connector canaries;
- `threads_profile_source_state` + service-role-only registration RPC;
- RLS and pgTAP security/registration tests;
- internal `threads-profile-poll-worker`;
- standard raw/revision/processing pipeline integration;
- adaptive poll cadence, backoff and 429 handling;
- source health for auth/rate-limit/parser/fetch/gap failures;
- server-only `THREADS_PROFILE_DISCOVERY_ACCESS_TOKEN` handling;
- scheduler dispatcher action prepared;
- CI coverage including Edge Function type-check/bundle and secret-marker browser check.

No production cron is activated before Meta credentials exist.

## External release gate

Production proof requires a Meta app/user token with `threads_profile_discovery`, one curated official cinema/OTT/studio profile, zero-history baseline, one genuine post-baseline item transported exactly once, and a duplicate-free unchanged repeat.

## Source/API verification

Current Meta Threads API materials expose public profile lookup and public profile post retrieval under OAuth and include `threads_profile_discovery` in the current permission set.

## Guardrails

- official API only;
- no home-feed emulation or logged-in scraping;
- public profile content only;
- no media-file copying;
- API availability never grants source authority;
- P4.3 candidate approval still does not auto-promote trust;
- token remains server-side;
- no hosted cron until the credential/production canary gate is satisfied.
