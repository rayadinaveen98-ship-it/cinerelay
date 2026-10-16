# Phase 1 — Producer announcement intake: review lead, not ingested news

Operator-only first-party post staging for TVF/HRX and future official producer announcements. This intentionally DOES NOT write `raw_items`, `entity_discovery_evidence`, `source_identities`, catalogue entities, event or alerts.

- Exact source URL, claimed authoring company and what the original post establishes are recorded by signed-in operator, with the standard operator allowlist and auditable database RPC. URL must be a direct LinkedIn company post (not a company home page or employee reshare); no backend URL fetching or published-at inference.
- `operator_producer_evidence_leads` has one durable `NEEDS_PRIMARY_SOURCE_REVIEW` state, and `counts_toward_approval=false` enforced by CHECK. RLS denied to app users and function executable only by service role.
- Subsequent matching through a verified first-party source connector and raw item is a SEPARATE manual acceptance step; no silent promotion or breaking notification on submission.
- Original HRX Films direct post: https://www.linkedin.com/posts/hrxfilms_prime-video-hrx-films-a-powerful-creative-activity-7382342199146999809-dSFV . Actual Storm is explicitly a working title, and confidence currently 0.83.
- TVF company profile is NOT an original post permalink; must find an exact first-party post. Do not submit a corporate home page as corroboration.
- Tests require no evidence-count inflation, no event, strict original-post URL, unique source URL per candidate, and denied public table/function privileges.
- Signed-in operator UI test remains outstanding; authentication cannot be faked. No new APK required.
