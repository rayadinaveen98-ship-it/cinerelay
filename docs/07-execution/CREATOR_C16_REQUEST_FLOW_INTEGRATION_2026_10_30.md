# CineRelay C16 — complete one-shot HTTP flow integration harness

**30 October 2026 — isolated draft, no live deployment or external provider calls**

## What C16 changes

C13/C14 established a protected operator-only one-shot YouTube audit path, but its HTTP handler was tightly coupled to live Supabase and Google dependencies and therefore lacked a realistic request-level failure matrix.

C16 extracts the real request decision flow into `supabase/functions/cinerelay-creator-activity-ingest/flow.mjs`. The deployed entry point `index.ts` now supplies the real server-only implementations of the following: Supabase active operator authorization, atomic C14 channel/quota claim, official `channels.list` and `playlistItems.list`, C12 expiring private observation upsert, and token-bound C14 receipt finalization.

**Both existing server-side enable flags remain OFF by default**. Only the production wiring knows the Google API key and Supabase service role. The new flow module contains neither credential, network access nor direct database access.

## Integration contract exercised in CI

`tests/youtube-connector/run-creator-c16-request-flow.mjs` sends real `Request` objects through the actual HTTP decision flow and inspects real `Response` objects. Dependencies are simulated and never contact Google/Supabase. Cases include:

- Successful operator authorization → channel+quota claim → precisely two official-shape API responses → 28-day private observation → matching-token quota finalization.
- Both independent enable flags default OFF, missing server credentials, inactive operator denial and explicit intent denial: no claim or provider request.
- Revoked/expired UC-ID scope, malformed or oversized request body: no provider quota.
- Provider quota exhaustion, duplicate channel claim or recent observation: no provider request.
- Two simultaneous mocked request calls for the same channel: one succeeds, one receives 409, only one provider path runs. The **true concurrent PostgreSQL proof** remains in C15's separate ephemeral test and is not replaced by this mock.
- Hidden subscriber redaction; wrong stable channel identity; invalid public video response; provider 403/429; database write failure and thrown exceptions.
- A failed or thrown **quota claim finalization overrides an otherwise successful private write**, never returns success, and never leaks provider error or credential text.
- Success response contains no public counters, credential or publisher-derived scoring; all comparisons and monitoring remain false.

C13 and C14 source regression tests were adjusted to inspect the new shared flow rather than requiring those decisions to be in `index.ts`.

## Current boundaries and release conditions

1. **Not deployed**. No production migration, new provider request, cron, YouTube monitoring, APK or active creator source registration.
2. The complete browser-to-hosted-Edge-to-production-Supabase end-to-end flow has **not been tested**. This is a real HTTP handler with simulated dependencies in GitHub CI, plus separate ephemeral PostgreSQL concurrency tests.
3. The live C12 expiring table and operator read endpoint require a formally approved migration/deploy and hosted retention verification. Backup, logs and Git history for old C11 API data remain unresolved.
4. True Google project quota headroom is unknown beyond the local quota ledger. Do not infer it from earlier 20-channel reads; owner approval plus project-specific quota inspection is required.
5. The existing 185 cinema YouTube sources remain unchanged. All creator monitoring, comparison and engagement statistics remain disabled.
6. Even with main CI green, require manual staged operator authorization, actual same-site CORS/gateway JWT review and failure recovery checks before any release.

## Local verification

```bash
node tests/youtube-connector/run-creator-c16-request-flow.mjs
npm run test:youtube
```

These tests require **no YouTube API key**. They are wired into the standard CineRelay GitHub PR CI. C15 tests a real independent connection race against a local ephemeral PostgreSQL instance.

Official reference: https://supabase.com/docs/guides/functions/unit-test
