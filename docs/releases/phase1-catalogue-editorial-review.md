# Phase 1 catalogue verification surface

Reviewed official candidates are annotated with source-verified catalogue facts in `metadata.editorialVerification`. The private operator review panel now shows these reviewed facts and explicitly distinguishes them from candidate approval, published events and notification eligibility.

The backend review query now returns the candidate's current `source_count`, `confidence`, `primary_language`, and `country_code`. The panel describes these as *source identities*, not as independent owners; the independent-owner approval and promotion enforcement is in database migration `20261016090000_phase1_catalogue_owner_country_safety.sql`.

Aspirants (Hindi, India), Storm (India; language/date unknown), The Diplomat (global priority; country/language unproven) remain PENDING with one registered source identity apiece. Do not boost confidence, add fake evidence, infer a date, or auto-publish.

No Android change. The operator review screen remains authenticated and read-only until the operator explicitly chooses to act.
