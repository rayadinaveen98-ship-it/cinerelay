# Phase 1 pending-catalogue owner-group audit — 16 October 2026

## Read-only production observation

SQL joined `entity_discovery_candidates`, `entity_discovery_evidence`, `source_identities`, `sources`, `raw_items` and verified `source_corporate_owner_memberships`. `status='PENDING'`: **18** suggestions (15 MOVIE, 3 SERIES). All **18 currently show only one distinct source-owner group** under the registry ownership model, even though one movie has two registered source identities.

| Candidate group | Count | Operator interpretation |
|---|---:|---|
| Suspicious OTT movie title strings | 10 | Promotional captions / article headline fragments; database automatic-promotion quality gate blocks them. Do not blindly rename or delete evidence. |
| Other movie names | 5 | `Bahubali 2 The Conclusion`, `Joe`, `Mynaa`, `Paranthu Po`, `SinghamYamudu2`. Their names pass string screening but all need independent title/alias verification. |
| First-party website series | 3 | `Aspirants`, `Storm` (working title), `The Diplomat` — each one source-owner group; not approved. |

Notable counterexample: `Aasha OTT release date: Urvashi, Joju George and Aishwarya Lekshmi's Malayalam` has **2 source identity records**, but both come from Filmibeat and point to the **same canonical source URL**. It therefore has **one** independent owner group and provides **zero** first-party source identities. Never treat it as corroborated solely because `source_count=2`.

## UX change

The private `pendingCatalogueReviewQueue` now reports a separately calculated `independent_owner_count` (distinct registered corporate parent, fallback source organization) plus `owner_count_complete` to avoid asserting an exhaustive group count when evidence was truncated. The operator console now shows the owner grouping apart from `source_count` and explains that owner grouping is necessary but not sufficient for catalogue verification. Read-only only: there is no promotion, status update, notification, or job queue side effect.

A mapping with unknown corporate ownership falls back to source organization and is **not** editorial proof that those organizations are independent. The existing production database's separate promotion rules remain the final authority.

## Verification

- CI exercises same corporate owner across Amazon/Prime Video, repeated Filmibeat feeds, two different source organizations, and rejection of missing source IDs.
- A signed-in allowlisted operator must see the new owner-group figure across YouTube, RSS, WEB candidates. The Cloudflare-hosted UI deployment remains a separate release acceptance step.
- No candidate can be treated as approved merely because its identity string looks plausible or the group count is two. Original-post provenance and approved editorial review remain mandatory.
