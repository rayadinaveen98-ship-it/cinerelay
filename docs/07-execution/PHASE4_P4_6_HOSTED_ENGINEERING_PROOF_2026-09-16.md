# Phase 4.6 Hosted Engineering Proof — Trusted Trade / Media

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / RIGHTS-COMPATIBLE REAL MEDIA CANARY PENDING**

## Scope proven

P4.6 adds a second, explicit trust decision after P4.3 candidate approval. Approval itself still creates no trusted source and assigns no authority. The new promotion path is operator-authenticated, audited and intentionally limited to reviewed `RSS_ATOM` media candidates.

Authority policy is enforced in the database transaction:

- Tier 3 -> `TRADE_MEDIA`;
- Tier 4 -> `GENERAL_MEDIA`;
- Tier 1/2 are rejected;
- `HOT_5M` is rejected;
- unapproved candidates are rejected;
- non-RSS candidates are rejected by this slice;
- exact existing canonical registry matches fail closed;
- double promotion is rejected.

## Canonical database migration

Hosted migration:

`20260916094320_trusted_media_feed_promotion`

Canonical Git reconciliation head:

`c614873f634f57568fe973327e75105cfd45d077`

The Git migration filename exactly matches the hosted Supabase migration ledger.

## Canonical CI proof

CineRelay CI:

- run number: `#279`;
- run id: `35081067614`;
- head: `c614873f634f57568fe973327e75105cfd45d077`;
- all four jobs PASS.

Fresh-database verification passed:

- all migrations apply from an empty database;
- pgTAP PASS;
- DB function lint PASS;
- web console build PASS;
- source-discovery Edge API type-check PASS;
- deployment-native Edge bundle PASS;
- connector/intelligence suite PASS.

The pgTAP contract explicitly proves authenticated users cannot invoke the promotion RPC directly, Tier 1 is rejected, hot cadence is rejected, an approved Tier-3 RSS candidate can promote atomically, feed runtime/health state and audit are created, promotion cannot be repeated, review cannot be bypassed, and public-page candidates cannot use the RSS promotion path.

## Exact CI artifact used for runtime deployment

Artifact:

- name: `cinerelay-edge-deploy-bundle`;
- artifact id: `10440103147`;
- digest: `sha256:fc1464343ad8bb36d56bb8c8d07cc77d565d1bb01bf3cb403917dac4d217d1b8`;
- source head: `c614873f634f57568fe973327e75105cfd45d077`.

## Hosted runtime

`cinerelay-source-discovery-api` v2 ACTIVE

- function id: `3db7fb55-c25e-461c-90aa-07358ab1d855`;
- bundle SHA: `ed314d2aa7ac8abd813dcee36f4a31438fcc85c393d918af4c00771279488b5e`;
- includes separate operator action `promoteMediaFeed`;
- retains P4.3 review behavior where `APPROVED` is non-promoting.

The Edge function uses its existing independent bearer-token/operator allowlist authorization boundary before it can invoke the service-role-only promotion RPC.

## Hosted privilege / no-side-effect proof

After migration and API deployment:

- promotion RPC exists: `true`;
- `authenticated` can execute promotion RPC: `false`;
- trusted media sources created by deployment: `0`;
- promoted candidates created by deployment: `0`;
- trusted media identities created by deployment: `0`.

Therefore deploying P4.6 does not silently promote or trust any discovery candidate.

## Advisor review

Security advisors produced no new P4.6-specific warning. The project continues to report the existing service-role-table `RLS enabled / no policy` informational findings, two pre-existing mutable-search-path warnings on older functions, and the existing leaked-password-protection setting warning.

Performance advisors likewise produced no P4.6-specific finding; the existing unindexed-foreign-key and unused-index informational findings remain unchanged.

## Real media canary gate

The originally researched Indian Express entertainment RSS feed is **not** enrolled as the P4.6 production canary. The publisher's own RSS directory states that RSS consumption is strictly for personal and non-commercial use and that reuse requires appropriate permission/licensing. CineRelay therefore treats that feed as research-only unless the relevant rights are obtained.

P4.6 remains pending a real publisher-owned/trusted-media RSS source whose stated terms or explicit permission are compatible with CineRelay's intended monitoring/use. That source must then prove:

1. candidate submission with evidence;
2. separate operator approval with no trust side effect;
3. explicit Tier-3 or Tier-4 promotion;
4. exactly one source + identity + feed state + audit record;
5. first feed poll baselines without historical replay;
6. unchanged repeat creates no duplicate raw/revision/job work;
7. later genuinely new feed item follows normal evidence-backed processing with its lower media authority preserved.

P4.6 must not claim production-canary verification until that rights-compatible proof is complete.
