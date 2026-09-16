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
5. registers `feed_source_state` using the existing `register_feed_source` contract;
6. marks the discovery candidate `PROMOTED` and links the new identity;
7. writes a `PROMOTE_SOURCE_CANDIDATE` audit action.

Any failure rolls the whole promotion back.

## Operator surface

The existing source-discovery API/UI gains a promotion action visible only for:

- status `APPROVED`;
- kind `RSS_ATOM`;
- no exact existing registry URL match.

The operator must choose Tier 3 or Tier 4, a non-hot poll class, and provide a reason.

## India-first production canary

The Indian Express publishes its own RSS directory and currently exposes entertainment-specific feeds including Telugu entertainment. The initial P4.6 canary is therefore planned against a publisher-owned Indian cinema/entertainment RSS feed, not an aggregator or third-party mirror.

Target candidate:

`https://indianexpress.com/section/entertainment/telugu/feed/`

Planned classification:

- territory: `IN`;
- language of feed articles: `en`;
- authority tier: `3`;
- source role: `TRADE_MEDIA` for the controlled P4.6 trust-path proof;
- poll class: `NORMAL_60M`.

The production proof must baseline without historical replay and preserve clear Tier-3 provenance on every ingested raw item/event evidence path.

## Release gates

Engineering:

- migration + pgTAP PASS;
- source-discovery API type-check PASS;
- web-console build PASS;
- approval remains non-promoting;
- Tier 1/2 and `HOT_5M` promotion attempts fail closed.

Hosted:

- migration/API/console deployed;
- real publisher-owned candidate is submitted and approved separately;
- explicit promotion creates exactly one Tier-3 source + identity + feed state + audit record;
- first feed poll baselines with zero historical replay;
- unchanged repeat produces no raw-item duplication.

Official/direct evidence still outranks this source. P4.6 does not change the Tier-A/B meaning defined in Source Strategy.
