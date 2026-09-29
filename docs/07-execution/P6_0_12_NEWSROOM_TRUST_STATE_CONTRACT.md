# P6.0.12 — Newsroom Trust-State Contract

Status: **IMPLEMENTED / CI-PROVEN / ANDROID-PROVEN**

Date: 2026-09-16

## Goal

Make CineRelay's newsroom trust-state mapping a mandatory regression contract so lower-trust media signals cannot silently regress into first-party-looking VERIFIED signals.

This checkpoint does **not** change production state behavior. It locks the existing behavior under CI by executing the actual `newsroomState` implementation from `supabase/functions/cinerelay-newsroom-api/index.ts`.

## Why this matters

P6.0.9 and P6.0.11 introduced real tier-3 `TRADE_MEDIA` feeds. Their transport health does not make their claims first-party verified authority.

The required unresolved-source mapping is:

- tier 1 -> `VERIFIED`;
- tier 2 -> `DEVELOPING`;
- tier 3 -> `DEVELOPING`;
- tier 4 -> `UNCONFIRMED`;
- missing authority -> `CONFLICT_RUMOR` rather than false confidence.

Canonical evidence may later change the state, but conflict and rumor states must remain conservative.

## Test design

New regression file:

`tests/newsroom/run-newsroom-state-contract.mjs`

The test deliberately avoids reimplementing the mapping in test code.

It:

1. reads the real `cinerelay-newsroom-api/index.ts` source;
2. extracts the actual `newsroomState(...)` function;
3. transpiles that exact TypeScript function with the repository TypeScript version;
4. evaluates it in the test process;
5. asserts the full trust matrix.

Root `package.json` now includes `test:newsroom-state`, and the test is mandatory in `npm run ci` immediately after the existing newsroom-noise regression suite.

## Mandatory cases

All 11 cases passed:

1. conflicting evidence overrides an otherwise official event -> `CONFLICT_RUMOR`;
2. `OFFICIAL` canonical event -> `VERIFIED`;
3. `CONFIRMED` canonical event -> `VERIFIED`;
4. `RELIABLE_REPORT` canonical state -> `DEVELOPING`;
5. `DEVELOPING` canonical state -> `DEVELOPING`;
6. `RUMOR` remains `CONFLICT_RUMOR` even from tier 1;
7. unresolved tier 1 first-party source -> `VERIFIED`;
8. unresolved tier 2 source -> `DEVELOPING`;
9. unresolved tier 3 trade-media source -> `DEVELOPING`;
10. unresolved tier 4 general-media source -> `UNCONFIRMED`;
11. missing authority -> `CONFLICT_RUMOR`.

CI output:

`Newsroom trust-state contract: 11/11 passed.`

The existing P6.0.8 newsroom noise suite also remained green at 7/7.

## Proven implementation head

Commit:

`b3c06c1f618c83018d4f0638277923b816a0743c`

### CineRelay CI #412

Run: `35134177774`

Result: **all green**

- database migrations + pgTAP;
- intelligence/connectors;
- 7/7 newsroom noise regressions;
- 11/11 newsroom trust-state regressions;
- push-presentation contract;
- all connector canaries;
- strict Edge type-check/build/bundle;
- web console.

### Android Canary CI #78

Run: `35134177776`

Result: **all green**

- mobile API shared-domain build;
- mobile/evidence/newsroom API type-checks;
- deployment-native mobile API artifact;
- Android V0.2 build;
- APK/package verification;
- APK artifact upload.

## Artifacts

Mobile API deploy artifact:

- id: `10462736909`;
- digest: `sha256:277d0b718b1712d30270c2f1094de58f0f462c529aa0108013fdb13b68a1b3cc`.

Android APK artifact:

- id: `10462502746`;
- archive digest: `sha256:6f8a157dba67f002ccbfd1d13020dec0a71a22ba47c69d8cfdaba9257b76e8ab`;
- extracted APK SHA-256: `02df5801374b7031a67e74f82b1b90e4761ceb4c77ca1b6fab4fcce08b76c299`.

## Production impact

No Edge function deployment is required for P6.0.12 because the production mapping itself is unchanged. The improvement is the regression gate: future edits that incorrectly map tier-3 trade media to VERIFIED, tier-4 media to DEVELOPING/VERIFIED, or rumor/conflict to a stronger state will fail CI.

P6.0.10 trust-safe push titles remain active in production through `push-delivery-worker` v3.

## Trade-feed reality at checkpoint

Current tier-3 set:

1. `123Telugu — Movie News` — `TRADE_MEDIA`, `ACTIVE_15M`, baseline proven, first natural post-baseline raw item pending.
2. `TeluguCinema — News` — `TRADE_MEDIA`, `ACTIVE_15M`, baseline proven, first natural post-baseline raw item pending.

No synthetic raw item was inserted to prove the contract.

## Next

1. Observe the first genuine post-baseline trade-feed delta.
2. Prove raw ingestion -> newsroom `DEVELOPING` end-to-end against hosted production data.
3. Observe canonicalization/corroboration without premature trust upgrades.
4. Prove the first naturally eligible DEVELOPING real-device push title.
5. Evaluate additional media feeds conservatively; a structurally valid feed alone does not determine authority tier.
