# P6.0.15 — First Natural Tier-3 DEVELOPING Signal

Status: **HOSTED PROVEN**

This checkpoint records CineRelay's first genuine post-baseline trade-media delta flowing through production without synthetic test data.

## Source

`123Telugu — Movie News`

- source role: `TRADE_MEDIA`;
- authority tier: 3;
- platform: RSS;
- poll class: `ACTIVE_15M`;
- parser: `feed-parser-v1`.

## Natural delta

At the 18:40 feed poll on 2026-09-16, CineRelay detected one new real feed item with zero gaps:

- raw item id: `5913327d-933b-40f7-8304-e6fbb5af7ff4`;
- external/feed id: `https://www.123telugu.com/?p=848891`;
- title: `Spirit: A crazy theater sequence featuring Prabhas is going to be wild?`;
- source published at: `2026-09-16 18:30:53+00`;
- CineRelay first seen: `2026-09-16 18:40:01.94+00`.

The source text itself explicitly frames the story as trade discussion / sourced reporting and says the makers have not officially confirmed the details. CineRelay therefore must not upgrade it to first-party verification.

## Processing result

The feed worker created the raw item and enqueued `PROCESS_RAW_ITEM`.

Processing job:

- job id `a158af77-1e13-457b-a65f-f74011d05458`;
- state `SUCCEEDED`;
- attempt count 1;
- completed `2026-09-16 18:41:01.088057+00`;
- no processing error.

No `event_evidence` row or canonical event was created for this raw item.

Hosted entity inspection found no existing `Spirit` entity in the canonical entity catalog. The processor therefore did not invent a match or create a speculative canonical event.

## Hosted newsroom proof

`cinerelay-newsroom-api` v5 returned the real raw item as:

- state: **`DEVELOPING`**;
- source: `123Telugu — Movie News`;
- authority tier: 3;
- role: `TRADE_MEDIA`;
- item type: `FEED_ENTRY`;
- enrichment state: `RAW`;
- canonical event: `null`.

This is the exact intended raw-first behavior: useful cinema intelligence is visible immediately, but lower-authority reporting is clearly labelled DEVELOPING and is not silently promoted to VERIFIED.

## Safety properties proven

1. natural trade-media delta ingests without historical backfill;
2. raw item processing can succeed without forcing canonicalization;
3. absence of a canonical entity does not hide the useful update;
4. unresolved tier-3 data surfaces as DEVELOPING;
5. no first-party VERIFIED label is applied;
6. no synthetic production item was inserted for this proof.

## Follow-up

Do not manually create a `Spirit` entity merely to force this item into the canonical layer. The next safe step is to use the normal entity/source discovery and review path, or wait for authoritative/corroborating source evidence that can establish the canonical project identity without weakening trust rules.
