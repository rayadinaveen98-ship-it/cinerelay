# P7 incident: film trailer/glimpse events incorrectly derived from a promotional TV special

Date: 27 Oct 2026 · CineRelay  
Status: **CONFIRMED, FORWARD CLASSIFIER PATCH IN DRAFT PR #97; HISTORICAL CORRECTION REQUIRES OPERATOR**  
Source: read-only current production SQL and independent first-party Sun Pictures / Sun TV programme descriptions.

## Identity boundary

- Official film: **Jailer 2**, movie, producer film page https://www.sunpictures.in/movies/jailer2/.
- Separate pre-release promotional TV/streaming programme: **Jailer 2 Super Show**, classified as an entertainment special on Sun Network https://www.sunnetwork.in/program-details.aspx?IProgramID=8Bse7qjVjzU%3D&ShowType=banner. The show's Sun NXT availability from 9 Oct 2026 is NOT the film's OTT release.
- CineRelay incorrectly has source identity `4cbf36de-2500-4135-ba04-49cdcf966d9e` as `entity_type=MOVIE` under canonical name `Jailer 2 Super Show!`, with one OTT release record and five active events. At read-only audit time there were zero active followers. Future state may differ.
- Do not rename this entity to the movie `Jailer 2`, and do not migrate the special's Oct 9 streaming date to the movie.

## Direct evidence and event-type discrepancy

| Existing CineRelay event | Evidence originally linked | Interpretation |
| --- | --- | --- |
| `GLIMPSE_RELEASED` | Sun TV video `In conversation with Jailer 2 technicians \| Jailer 2 Super Show` https://www.youtube.com/watch?v=-02nNPYJqAw | Interview / programme talk segment, not an official film glimpse |
| `TRAILER_ANNOUNCED` | Sun TV `Jailer 2 Super Show - Full Show \| Part 1/2/3` https://www.youtube.com/watch?v=jUDij3RrbGY | Complete TV-special programme parts, not a film trailer announcement |
| `PROMO_RELEASED` | Sun TV programme promos, including https://www.youtube.com/watch?v=MYJQ9QHXA1Q | Promo for special programme; potentially appropriate only when attached to a correctly modeled event/programme |
| `OTT_DATE_ANNOUNCED` | Sun NXT `Jailer 2 Super Show! \| Streaming from October 9th` https://www.youtube.com/watch?v=tdj60b0WCvE | Date applies to **special programme**, not movie |
| `OTT_RELEASED` | Sun NXT `Jailer 2 Super Show! \| Streaming Now` https://www.youtube.com/watch?v=Pa3scJie9CY | Release applies to **special programme**, not movie |

These are **five active events** with approximately 12 source evidence links across them (including multiple programme-promo and programme-part links); distinct evidence counts should not be interpreted as unique event counts.

## Forward classification fix (#97)

The shared domain classifier previously considered the combined video title **and description** before deciding event type. On full programme recordings and talks, descriptions naturally mention `trailer`, `glimpse` and cinema dates. Those keywords could transform event recordings into movie trailer/glimpse records even from a legitimate official channel.

Guard using the normalized **title first** only when:
- title explicitly denotes a `Super Show` or `pre-release event/function` **AND** `Full Show`, `Full Episode`, or `Full Event`, or
- title begins `In conversation with` / `Conversation with`.

Then classify an event recording as existing `PRE_RELEASE_EVENT_STARTED_OR_RELEASED`, or conversation as `INTERVIEW_RELEASED`, before generic theatrical/trailer/glimpse description keywords. Real film teasers/trailers and ordinary short promos remain on the existing path. No change to canonical title creation/OTT special entity typing.

## Existing record correction: separate operator-only gate

- Open authenticated `cinerelay-review-api` `activeCatalogueQualityAudit`, then run `catalogueCorrectionImpactPreview` for this entity.
- Evidence-backed editorial decision must determine whether programme specials are in scope as SERIES, require a new SPECIAL type, or should remain only as verified source items. Do **not** automatically assume TV specials are series.
- Evaluate current active event IDs, streaming-date and OTT release references, user follows, push deliveries, dedupe keys, event summaries, aliases, source-candidate links, status changes and rollback. Keep receipts/evidence.
- Use operator-identity-bound, logged correction functions for event type/status changes. The current correction preview is read-only and cannot safely change movie-vs-special entity type by itself.
- After authorized editing, verify the movie `Jailer 2` is not assigned the special's Sun NXT date and notifications are not replayed.

## Acceptance

- [x] First-party programme-vs-film distinction grounded.
- [x] Original evidence mapping checked read-only.
- [x] Narrow future classifier fix and regression tests committed to PR #97.
- [ ] CI tests of #97 all green.
- [ ] Forward classifier deployed only via pinned bundle and safe worker release.
- [ ] Historical five-event correction reviewed by signed-in operator and audited.
- [ ] User-facing event feed and OTT display verified after correction.
- [ ] PMV1 consumer pilot can proceed only after historical high-risk false claims are resolved.
