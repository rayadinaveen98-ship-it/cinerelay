# Phase 1A — Correction impact and evidence review

Date: 16 October 2026. Status: **review prepared; no production correction applied**.

This is a production read-only audit with official first-party source links and external cross-checks. The existing operator audit at `https://cinerelay-console.pages.dev` has the new **Preview correction / merge impact** workflow. Proposed classifications below are **editorial recommendations**, not live migrations.

## Case 1 — Kappi Squad: type mismatch + duplicate identities (high priority)

Contemporary independent coverage on 27 September identifies **Kappi Squad as a 100-episode Malayalam JioHotstar SERIES** scheduled to premiere 15 October:
https://www.cinemaexpress.com/malayalam/news/2026/Sep/27/kappi-squad-heres-when-jiohotstars-100-episode-malayalam-series-will-premiere

Live CineRelay identities:
- `0e649f4f-75c0-44b0-9e2f-19d4381928d3`: `Kappi Squad` — **MOVIE** (wrong type to review), 2 ACTIVE events, JioHotstar OTT release 2026-10-15.
- `ec3cb600-f73d-4c11-85f7-2d3ec5917a9c`: `Catch Joel Joseph in Kappi Squad` — MOVIE from cast caption, 1 ACTIVE event, own JioHotstar 2026-10-15 OTT release.
- `4a0f01af-6970-46f0-af5b-925cce07d98d`: `Catch Rinosh George in Kappi Squad` — MOVIE from cast caption, 1 ACTIVE event, own JioHotstar 2026-10-15 release.
- `4d996352-b0d5-45fc-80f6-dc0bda985e7a`: `Watch Anagha Ajith in Kappi Squad` — MOVIE from cast caption, 1 ACTIVE event, own JioHotstar 2026-10-15 release.

These four MOVIE entities refer to one JioHotstar **series**. Simply redirecting three cast-caption records into the fourth MOVIE entity would preserve the wrong type, clone same-provider release entries, and duplicate events. Do **not** automatically merge or create a new SERIES without operator source/type and URL verification. A proper correction needs one SERIES identity, deduplicated OTT records, audited event handling, migrated follow/relationship records if any, and preserved original evidence. No active follows or alert deliveries were found for these identities at audit time, but recheck immediately before correction.

## Case 2 — Jailer 2 Super Show!: special programme, not Jailer 2 film OTT release

- Source identity: `4cbf36de-2500-4135-ba04-49cdcf966d9e` MOVIE, 5 ACTIVE events, Sun NXT release 2026-10-09.
- Original Sun NXT promo and multi-part Sun TV pre-release show videos linked from CineRelay event evidence.
- External checks distinguish the *pre-release promotional show* from theatrical sequel:
  https://www.pinkvilla.com/entertainment/south/jailer-2-super-show-ott-release-when-and-where-to-watch-rajinikanth-starrer-pre-release-event-online-1405775
  https://timesofindia.indiatimes.com/articleshow/134753438.cms

Do not relabel this as `Jailer 2` movie OTT release or attach the show streaming date to the film. Editorial options: dedicated SPECIAL/EVENT content type if supported or keep as unclassified source/evidence rather than a MOVIE title; preserve show history and consider whether the five movie-event headlines should be suppressed or reclassified through existing operator-reviewed flow.

## Case 3 — Month of Madhu: valid 2023 film with packaging suffix

- Existing CineRelay identity `edb3dba5-170c-40fd-85a2-01e49157f742` is MOVIE `Month Of Madhu Telugu Movie`, 3 ACTIVE events, 1 RETRACTED OTT_DATE_ANNOUNCED event.
- Official title from aha: **Month of Madhu**:
  https://www.aha.video/movie/month-of-madhu
- Official aha page records OTT release in **November 2023**. **Do not reinstate** CineRelay's retracted `2026-11-07` release date.
- Proposed title-spelling normalization could be lower risk than Kappi or Jailer, but a transaction should check slug uniqueness, existing aliases, future matching, old headline preservation, referenced OTT release and notifications. Never silently create another movie.

## Case 4 — Karmakhya: valid name with packaging suffix; verify streaming providers

- Existing CineRelay identity `86db0e99-1627-476f-bc7b-0ce7d1da38de` MOVIE `Karmakhya Telugu Movie` has 3 ACTIVE events (2 OTT_RELEASED, 1 TRAILER_RELEASED), and two OTT provider records with **unknown release dates** (AHA CONFIRMED / Prime Video REPORTED).
- Candidate normalization `Karmakhya` needs a direct official title source; do not invent release days.

## Implementation: operator-only correction impact dry-run

- Under **Sources & ops → Active-title quality audit**, open one flagged title and click **Preview correction / merge impact (read-only)**.
- Set **independently verified content type** MOVIE or SERIES, optionally find an existing target identity using operator-only entity search, then inspect related events, OTT release rows and direct conflicts by provider/territory/release type.
- Review active followers, sent and unsent alert deliveries, claim links, source/relationship references, promoted candidates and aliases, and the scan-completeness indicator. A dry-run deliberately has `canAutoApply:false`; there is **no mutation action**.
- Any correct-to-canonical plan must specify expected entity IDs, required operator authorization, the precise transition of event/OTT histories and their dedupe keys, rollback plan and a post-change no-notifications assertion.
- Existing `operator_suppress_event` / `operator_merge_events` functions are event-only operations; they are NOT a complete safe entity merge or type-change pathway. Never bypass the logged operator identity by invoking them as the database admin from a generic source audit.

## Acceptance blockers

- Existing hosted Cloudflare console contains catalogue review features, but a human operator must sign in and inspect this dry-run.
- A nonoperator's authenticated 403 is not yet independently tested.
- No canonical entity, alias, release row, event, notification or user-follow record should be touched by Phase 1A preview deployment.
