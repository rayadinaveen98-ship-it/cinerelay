# CineRelay Phase 1, Batch 2 — Producer corroboration

Date 2026-10-16. Production project `dnqaejljfzwhsainpdxb`.

## Research findings

- `Aspirants` Season 3: The Viral Fever's corporate LinkedIn profile https://www.linkedin.com/company/theviralfever and public employee reshares of the production-company statement verify TVF's own discussion of Season 3, **but the direct first-party post permalink has not yet been established**. The official Prime Video season listing https://www.primevideo.com/-/pt/detail/0JI1S2JJYE773KGHZY5AOPWBDE?tr=in confirms Season 3 and historical episode release of 2026-03-13. Do not turn this historical catalogue date into a new event.
- `Storm`: HRX Films' actual company-authored post https://www.linkedin.com/posts/hrxfilms_prime-video-hrx-films-a-powerful-creative-activity-7382342199146999809-dSFV confirms Prime Video production, producer Hrithik/Eshaan Roshan, director Ajitpal Singh, and explicitly labels **Storm a working title**. No original release date or confirmed primary language.
- Both producer references are independent from the existing Prime Video distributor platform as content **owners**, but not currently supported as *ingested source identities*. They were therefore recorded only in `entity_discovery_candidates.metadata.externalProductionCorroboration`, with `rawEvidenceIngested=false` and `countsTowardApprovalGate=false`. Exactly two `CATALOGUE_EXTERNAL_PRODUCTION_CORROBORATION` audit rows inserted. Existing first-party provider articles remain the only one ingested source identity per candidate.
- `Aspirants` confidence remains 0.86, `Storm` 0.83; both PENDING. No changes to canonical entities, source identities, raw ingestion, independent-evidence counts, or breaking-news events.
- Private operator console now displays the evidence URL, producer identity, working-title caveat, and **external-only/no-approval** warning. No login changes or Android updates.

## Ownership-model risk discovered

The live sources table has two separate logical source rows, `About Amazon India — Prime Video` (`070f383a-721f-4e07-8f59-2674be453d79`) and `Prime Video India` (`858b0eca-fef8-4dfb-948c-8e3393e2d4c1`). The deployed independent source-owner gate currently counts distinct `sources.id`; **these distinct source rows may belong to the same corporate Amazon parent** and must not be accepted as independent company corroboration. Do not link the existing Prime Video YouTube trailer to the About Amazon candidate as independent evidence until a canonical corporate-owner mapping is introduced and tested. The full generic owner-registry schema/change is reserved for the next database hardening PR, not silently invented here.

## Next real acceptance

Find an authentic direct TVF post URL and confirm owner; model producer LinkedIn/official website records via an approved provenance connector or reviewed offline evidence import. Verify metadata vs ingestion is always clearly distinguished. Once distinct eligible owner evidence is ingested and Storm's score supported by actual sources, operator can approve with the existing authorization gates, then verify no historical notification.

CI: build private console; check Cloudflare Pages deployment. No automatic approvals, no APK.
