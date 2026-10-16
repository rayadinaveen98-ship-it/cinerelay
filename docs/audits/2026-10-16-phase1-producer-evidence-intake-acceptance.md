# CineRelay — Phase 1 producer-post intake, protected staging (2026-10-16)

Production project: `dnqaejljfzwhsainpdxb`.
PR #58: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/58, merged at `4898e13263b2ae71d67f400ab436af2a2a290abc`.
PR #59: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/59, merged at `cfea5e73880605cac09eb2477e484f2517fcab24`.

## Implemented

- Private `operator_producer_evidence_leads` table for *original company-authored LinkedIn post leads*, distinct from first-party connector ingestion.
- Every lead includes candidate ID, original direct-post URL, claimed production owner, operator summary, creator ID, immutable `NEEDS_PRIMARY_SOURCE_REVIEW` status and `counts_toward_approval=false` enforced in database.
- The operator-only `operator_submit_producer_evidence_lead` RPC rejects LinkedIn **company profile pages** (TVF's generic profile isn't a direct announcement), empty / short justifications and non-pending title candidates. URLs are normalized to remove query/fragment before duplicate detection.
- Existing private Supabase `cinerelay-review-api` **v6 ACTIVE** exposes a `submitProducerEvidenceLead` action after validating the current Supabase session and the active `operator_users` allowlist. The same operator queue returns only staging leads associated with the already visible pending title suggestions.
- Private web console has a collapsible evidence-lead form, explicit manual attestation, lists pending original links, and warns that leads **do not automatically count towards candidate approval**.
- Capturing leads never writes `raw_items`, `source_identities`, `entity_discovery_evidence`, `entities`, events, OTT release facts or alerts. Original producer post must later be verified through a separately approved provenance intake connector or manual evidence review mechanism before any corroboration gate can change.
- Operator evidence lead action is audited. Duplicate POST URL per candidate is idempotent.
- Two production migrations applied successfully: `phase1_operator_producer_evidence_leads` and `phase1_producer_leads_append_only_grants`.

## Automated validation

- PR #58 passed database pgTAP, Edge, web console, consumer, intelligence and notification tests. New pgtap specifically verifies company-profile rejection, deduplication, zero new discovery evidence / canonical news, and no access from public roles.
- PR #59 passed database pgTAP and web/API tests after tightening service role grants. Why #59 was necessary: this Supabase project grants default UPDATE and DELETE to `service_role` on new public tables. Explicitly revoked ALL and granted SELECT/INSERT only.

## Production security and data verification

- `operator_producer_evidence_leads`: RLS ON; anon SELECT=false; authenticated SELECT=false; service SELECT=true, INSERT=true, UPDATE=false, DELETE=false. Underlying RPC has `EXECUTE` service role only.
- Unauthenticated attempt to submit real-looking HRX Films evidence via the production review API returned **HTTP 401 authentication_required**; no record was created.
- **Zero** staged leads present. An actual logged-in operator submission is deliberately untested / not fabricated.
- `Aspirants`: PENDING, 1 independent owner, score 0.86, zero events.
- `Storm`: PENDING, 1 independent owner, score 0.83, zero events, **working title**.
- `The Diplomat`: PENDING, 1 independent owner, score 0.87, zero events.
- 184 YouTube + 8 WEB + 38 RSS = **230/230 HEALTHY** source identities.
- No Android code or APK needed.

## Next Phase 1 acceptance

1. In signed-in private console → Sources & ops → Movie & series article review → pending Aspirants or Storm → **Submit original producer post for verification**.
2. For **Storm**, the actual HRX Films company-authored post link is https://www.linkedin.com/posts/hrxfilms_prime-video-hrx-films-a-powerful-creative-activity-7382342199146999809-dSFV . The operator must open and inspect it before submitting the lead; the title remains working.
3. For **Aspirants**, the TVF corporate profile alone is **not** acceptable: find the specific original TVF company-authored post URL, not an employee reshare.
4. Independently verify producer ownership, build a supported original-post collector with source timestamps preserved (no scraping without lawful access). Only then consider promotion, and test zero historical notifications.
5. Real user browser interaction (signed-in operator form) still requires human device acceptance. Do not state Phase 1 fully finished until this is confirmed.
