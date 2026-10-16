# CineRelay — YouTube alias reconciliation and new-source ingestion verification

**Date:** 2026-10-16 IST
**Environment:** CineRelay production Supabase, `dnqaejljfzwhsainpdxb`.
**Owner objective:** Keep only first-party official sources; avoid duplicate YouTube identities; verify real post processing before claiming new sources deliver news.

## Verified production work

**16 existing YouTube discovery leads** were safely reconciled as `DUPLICATE` rather than activated as new channel identities.

- All 16 candidates now have `duplicate_of_source_identity_id` linking to an **existing active registered channel**.
- All 16 officiality proposals have been marked `RESOLVED`, with their actual existing source and channel ID recorded.
- All 16 changes have corresponding `SOURCE_DISCOVERY_DUPLICATE_RECONCILIATION` entries in `audit_actions`.
- No subscription, channel identity, source record, existing event or notification was deleted or altered.
- 13 aliases were checked against live YouTube pages returning HTTP 200 and a canonical immutable `UC...` channel ID identical to CineRelay's registered channel ID. Three were confirmed with unique IDs already captured from the earlier verification pass.

### Reconciled aliases

| Candidate URL | Existing registered source | Resolution |
|---|---|---|
| https://www.youtube.com/c/TipsTamil | Tips Tamil | Existing channel |
| https://www.youtube.com/c/TipsFilms | Tips Films | Existing channel |
| https://www.youtube.com/channel/UC5rGGthSt-CQue8V0bj1bWg | **Divo Music** | Weekend Blockbusters outbound link points to existing Divo Music channel; not Weekend Blockbusters ownership |
| https://www.youtube.com/c/TipsTelugu | Tips Telugu | Existing channel |
| https://www.youtube.com/c/NetflixIndiaOfficial | Netflix India | Existing channel |
| https://www.youtube.com/user/dharmamovies | Dharma Productions | Existing channel |
| https://www.youtube.com/c/UVCreations | UV Creations | Existing channel |
| https://www.youtube.com/user/sonyliv | Sony LIV | Existing channel |
| https://www.youtube.com/c/zeemusicsouth | Zee Music South | Existing channel |
| https://www.youtube.com/user/Saregamatamil | Saregama Tamil | Existing channel |
| https://www.youtube.com/c/tipsofficial | Tips Music | Existing channel; YouTube title "Tips Official" |
| https://www.youtube.com/c/HaryanviSTAGEApp | STAGE | Existing channel |
| https://www.youtube.com/c/Addatimes | Addatimes | Existing channel |
| https://www.youtube.com/c/TipsPunjabi | Tips Music | Existing channel |
| https://www.youtube.com/user/Saregamamalayalam | Saregama Malayalam | Existing channel |
| https://www.youtube.com/c/TipsBhojpuri | Tips Music | Existing channel |

### Final source inventory and discovery queue

- Active source identities: **184 YouTube + 8 WEB + 38 RSS = 230 total**.
- Effective-health query: **230/230 HEALTHY** at time of verification.
- YouTube source discovery status: 16 DUPLICATE, 6 PROMOTED, **76 PENDING**.
- Website discovery: **18 PENDING**; do not bulk activate until real first-party article parser is proven.
- Core source-discovery, page-poll, process-raw-item, and YouTube fallback cron jobs had **zero failures over preceding hour**.

## First genuine new website items: Netflix Tudum

Two new first-party Netflix Tudum `WEB_ARTICLE` raw items were ingested and processed:

1. `A New Documentary About Natalee Holloway Recounts Teen’s Infamous Disappearance`.
2. `The Diplomat Season 4: The Drama is Back With More Power Plays and Politics`.

Both have a corresponding `PROCESS_RAW_ITEM` job in `SUCCEEDED` status. **Neither has a linked canonical event nor appears in the official-news event evidence table.** The specific reason is confirmed by `current_entity_resolution_results`: each is `UNRESOLVED`, score 0, with **0 source-scoped and 0 canonical-title candidate entities**. There are no rejection records; the worker deliberately completes unresolved jobs without publishing an unverified event.

**Interpretation:** The source connector and job infrastructure work; entity identification / catalogue coverage is the current bottleneck to surfacing these kinds of first-party announcements. An existing first-party page does not automatically make an unknown film or series safe to promote into a verified entity event.

### Recommended next development phase (not deployed in this cleanup)

1. Add a **reviewable, typed entity-discovery path** for official movie, documentary and series articles that cannot resolve. Avoid labelling series as movies or auto-creating verified records based only on unstructured headlines.
2. Extract page-level film/series title and article publication date where official metadata exists, preserve evidence provenance; leave date null if none is confirmed.
3. Use `current_entity_resolution_results` as a dashboard gate: `ingested -> processed -> entity resolved -> event classified -> published` with counts and reasons.
4. Prefer India-relevant film/OTT entities when prioritizing an India-first feed. Do not broadly publish unrelated global headlines from a first-party source without clear relevance.
5. Test using real new articles, not manufactured backfill events. Real notification delivery should remain subject to existing source preferences and provenance policy.

### Exclusions and safety

- The pending ManoramaMAX website candidate matched a **retired/inactive** identity. This was **not** auto-closed as an active-channel duplicate; it needs separate review, since reactivating a retired connector may undo deliberate safety controls.
- No speculative channel ownership transfer: an official channel linking another official brand does not confer ownership.
- No APK, Edge function, migration or event-publication changes were made in this pass; only reconciled discovery records, proposals and audit log.
