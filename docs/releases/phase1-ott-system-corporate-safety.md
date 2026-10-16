# Phase 1 — Prevent automatic OTT corporate corroboration bypass

The explicitly private operator catalogue promotions were fixed in PR #57, but the distinct automated OTT `system_promote_verified_ott_candidate_two_source` still counted `source_identity_id` instead of verified corporate-owner groups. Its COUNTRY default, and the independent single-first-party OTT pathway, also inferred India for missing country.

- Corporate owner gate added to the precise OTT_RELEASE, DETERMINISTIC_TITLE evidence subset. Both separate Amazon YouTube and About Amazon WEB source rows count only as one owner.
- Both OTT system promotion functions now preserve `country_code=NULL`.
- No expansion of eligibility or source trust, only rejecting false independence.
- pgTAP tests verify same-company distinct identities do not promote, independent corroboration can, and unknown country remains null.
- Existing user-facing news/notification pipeline unchanged; no archived producer raw evidence created.
- TVF first-party YouTube channel was independently verified and registered in production as a new source; old 2021 TVF Aspirants trailer is **not** imported as breaking news. 
