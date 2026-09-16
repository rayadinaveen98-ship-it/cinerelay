# P4.6 — Trusted Trade / Media Onboarding

Date: 2026-09-16

## Decision

P4.6 begins trusted trade/media coverage by adding a deliberately separate trust-promotion step after P4.3 candidate review.

`APPROVED` still means only that a candidate passed review. It does not grant authority and creates no source identity. A second audited action is required to promote an approved candidate into the trusted registry.

The first production slice supports RSS/Atom media candidates only because they can reuse the already production-hardened generic feed connector without adding a new scraper/parser dependency.

## Authority policy

This promotion path is structurally unable to assign direct-source authority:

- Tier 3 -> `TRADE_MEDIA`;
- Tier 4 -> `GENERAL_MEDIA`;
- Tier 1 and Tier 2 are rejected;
- `HOT_5M` is rejected for this media-feed path;
- approved candidates cannot skip directly from discovery to trusted status without an explicit promotion action.

Media reports may discover or corroborate claims. Their authority tier remains distinct from official/direct evidence.

## Promotion transaction

For an approved `RSS_ATOM` candidate, one transaction:

1. locks and revalidates the candidate;
2. rejects existing canonical-URL registry matches;
3. creates a `sources` row at Tier 3 or 4;
4. creates an `RSS / RSS_ATOM / FEED` source identity;
5. registers `feed_source_state` and source health using the existing `register_feed_source` contract;
6. marks the discovery candidate `PROMOTED` and links the new identity;
7. writes a `PROMOTE_SOURCE_CANDIDATE` audit action.

Any failure rolls the whole promotion back.

## Operator surface

The existing source-discovery API/UI gains a promotion action visible only for:

- status `APPROVED`;
- kind `RSS_ATOM`;
- no exact existing registry URL match.

The operator must choose Tier 3 or Tier 4, a non-hot poll class, and provide a reason.

The public RPC boundary accepts a normal integer authority tier because JSON/PostgREST callers naturally send integer values. The function still permits only `3` or `4` and casts to the frozen `smallint` source-authority column only after validation.

## Hosted foundation

Canonical migration:

`20260916094320_trusted_media_feed_promotion`

Canonical CI:

- head `c614873f634f57568fe973327e75105cfd45d077`;
- CineRelay CI `#279` / run `35081067614`;
- all four jobs PASS.

Hosted API:

`cinerelay-source-discovery-api` v2 ACTIVE

Hosted verification after deployment proved the promotion RPC exists, authenticated callers cannot invoke it directly, and the deployment created zero media sources, zero promoted candidates and zero media identities.

## Real-media canary policy

A source is not eligible for the real P4.6 canary merely because its RSS endpoint is technically public. The onboarding review must also check the publisher's stated feed/usage terms or obtain explicit permission appropriate to CineRelay's intended use.

The Indian Express entertainment/Telugu RSS feed was researched as an India-focused publisher-owned candidate. Its own RSS directory states feed consumption is strictly for personal and non-commercial use and that reuse requires appropriate permission/licensing. It is therefore **research-only / blocked for the P4.6 production canary unless the relevant rights are obtained**.

P4.6 will instead wait for a publisher-owned/trusted-media RSS source whose stated terms or explicit permission are compatible with the intended monitoring/use. A technically reachable feed or absence of an obvious restriction is not by itself enough to promote a source when usage rights remain unclear.

## Release gates

Engineering — COMPLETE:

- migration + pgTAP PASS;
- source-discovery API type-check PASS;
- web-console build PASS;
- approval remains non-promoting;
- Tier 1/2 and `HOT_5M` promotion attempts fail closed;
- double promotion fails closed;
- fresh-database migration and DB lint PASS.

Hosted foundation — COMPLETE:

- canonical migration applied;
- source-discovery API v2 deployed from exact green-CI artifact;
- privileged RPC inaccessible to authenticated clients directly;
- no source/candidate/identity was auto-promoted by deployment;
- advisor review produced no new P4.6-specific security/performance finding.

Real canary — PENDING:

- select a rights-compatible publisher-owned/trusted-media RSS source;
- submit candidate + evidence;
- approve candidate separately with no trust side effect;
- explicitly promote to Tier 3 or 4;
- prove exactly one source + identity + feed state + audit record;
- first poll baselines with zero historical replay;
- unchanged repeat stays duplicate-free;
- one genuinely new item follows normal raw/revision/processing with the lower media authority preserved.

Official/direct evidence still outranks this source. P4.6 does not change the Tier-A/B meaning defined in Source Strategy.

Full hosted proof:

`docs/07-execution/PHASE4_P4_6_HOSTED_ENGINEERING_PROOF_2026-09-16.md`
