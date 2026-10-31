# CineRelay C30 — isolated first-creator identity verification rehearsal

**31 October 2026 · source-only · simulated Google, simulated operator, in-memory claims · NO hosted write**

## Goal
Before considering one real creator, test the **actual existing C20 handler** across five realistic outcomes using a fixed, clearly fake handle and fabricated YouTube identity. The rehearsal has no service credentials, has no Google or Supabase client, and neither provisions nor connects to external infrastructure.

This is *not* a production smoke test, a substitute for the C24 real disposable-Postgres integration, or an endorsement of real provider access. It cannot independently verify hosted auth, live quotas, GitHub retained objects, backups, PITR or API-policy compliance.

## What runs
`npm run creators:rehearse-first` imports the same `runC20IdentityRequest` used by the service, but injects an isolated in-memory fake:
- **Feature off:** HTTP 503 before auth, quota reservation or provider read.
- **Unauthorized:** HTTP 403 without quota reservation or provider read.
- **Success:** one simulated quota unit, one synthetic identity with `REVIEW_PENDING`, `monitoring_enabled=false`, `metrics_enabled=false`, 27-day identity lifetime; a second request hits the existing claim cooldown (409) with no second provider read.
- **Provider failure:** one simulated unit and failure-only finalize, no stored identity; provider error body hidden.
- **Late stale claim:** atomic commit refuses, no identity stored and no incorrect receipt finalization.

The CLI returns only counts, generic event names and HTTP statuses; never raw handles, UC IDs, snippets, API payloads, credentials or third-party observations. **No fake result is ever inserted into CineRelay, the APK, GitHub data snapshots or the current 185 cinema source registry.** All fake state disappears when the process exits.

## Safety conditions
- Enable flags and the placeholder credential flag exist **only** inside an injected fake configuration. The live backend flags are unchanged and OFF; they are not environment values or deployment configuration.
- The C25 and C29 audit reports are checked. Both still deny live pilots.
- `npm run creators:live-pilot-check` **always exits 2** even if the simulated rehearsal passes. This is intentionally a closed production-release gate, not an authorization command.
- Default CI runs `tests/youtube-connector/run-creator-c30-synthetic-first-pilot.mjs`. The prior C24 real *disposable* PostgreSQL CI remains the source for database atomicity.
- No new Android APK, hosted migration, Google call, scheduler, metrics collection, monitoring permission, real channel verification, paid branch, staging project, or release.

## Pending independent owner approvals
1. Historical C2/C10/C11 API-data lifecycle: record classification, scoped retention deadlines, PR-ref/fork/cache review, and authorized remediation; no unilateral force push or deletion.
2. Actual Google Cloud API project quota usage and available reserve after preserving the 185 cinema sources.
3. CineRelay Supabase plan, hosted backups/PITR, exports and log-retention verification.
4. Independent approval for any staging cost, plus synthetic TTL/auth/recovery testing in an isolated environment.
5. Editorial review of **one real creator**, explicit operator permission and separately approved single live official identity request.
6. No public engagement-rate rankings, comparisons or hourly monitoring before a separate policy/technical admission decision.

## Commands
```bash
npm run creators:rehearse-first    # expected success, offline only
npm run creators:live-pilot-check  # expected exit 2, never enables live
npm run test:youtube               # includes the C30 isolation regressions
```

**Release statement:** A passing C30 check only proves an offline handler rehearsal, never that the app has a verified creator or that new Creator Intelligence backend services are available. C22 remains the installable Android beta.
