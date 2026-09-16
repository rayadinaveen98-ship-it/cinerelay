# P4.3 — Source Discovery Candidate Workflow

Date: 2026-09-16

## Purpose

Grow CineRelay's official India-first source graph without turning discovery into automatic trust.

Discovery is a **candidate-generation** system only. A discovered URL or account does not become an active source identity until an operator explicitly approves it.

## Invariants

1. Discovery never changes `sources.authority_tier`.
2. Discovery never creates active trusted `source_identities` automatically.
3. Every candidate preserves provenance: who/what page exposed it, when, and the evidence URL.
4. Canonical URL dedupe happens before candidate creation.
5. Re-observation updates `last_seen_at` and evidence, not duplicate rows.
6. Approval is explicit and audited.
7. Rejection is reversible and audited.
8. Candidate confidence is descriptive metadata, not authority.
9. Private/local URLs are never accepted as candidates.
10. Free/direct official signals are preferred over search-engine scraping.

## Initial candidate sources

P4.3 begins from links already present on known official CineRelay sources:

- official website/newsroom links;
- official YouTube/channel links;
- official Instagram/Threads/Facebook/X links where publicly exposed;
- related official studio/platform sites;
- first-party press/news pages.

This does not mean every outbound link becomes a candidate. Link classification must first match a supported platform/domain or explicit first-party page pattern.

## Lifecycle

`DISCOVERED -> PENDING_REVIEW -> APPROVED | REJECTED | IGNORED`

Approved candidates are materialized through a separate operator action. The materialization action must specify the final authority tier, source role, connector type, access mode and poll class; none are inherited blindly from discovery confidence.

## P4.3 implementation slices

### P4.3.1 Candidate foundation

- candidate normalization/dedupe package;
- `source_discovery_candidates` state;
- provenance/evidence model;
- service-role ingestion RPC;
- RLS + pgTAP security tests;
- no automatic trust materialization.

### P4.3.2 Discovery worker

- inspect supported outlinks from known official page/feed source material;
- domain/platform classification;
- private/local URL rejection;
- bounded discovery fan-out;
- idempotent re-observation;
- health/run telemetry.

### P4.3.3 Operator review

- pending candidate queue in internal console;
- evidence/provenance detail;
- approve/reject/ignore with mandatory reason;
- approval creates or links a source identity only through audited privileged mutation;
- no auto-authority promotion.

## Exit gate

P4.3 is complete only when a real candidate can be discovered from a known official source, appears once in the operator queue with provenance, survives re-observation without duplication, and an operator can approve/reject it with an audit record while no candidate becomes trusted automatically.
