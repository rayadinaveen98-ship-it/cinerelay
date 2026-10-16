# CineRelay Phase 1 catalogue safety

## Evidence-gate decisions

- `source_count` is historically a distinct source **identity** count. YouTube and WEB identities of the same OTT owner do not represent independent news corroboration. Both operator approval and promotion now require two distinct parent `sources.id` values.
- The operator promotion function must preserve unknown `country_code=NULL` rather than silently assigning India. The candidate-submission RPC also defaults omitted country to NULL, so global titles stay unclassified until editorial evidence is available.
- Direct operator actions remain service-role only; operator identity + reason are still required.
- None of the three current candidates meets the two-independent-owner gate; Storm is additionally below confidence 0.85. This change does NOT approve candidates, create events, or generate notifications.
- GitHub PR contains pgtap integration tests; commit and deployment to production must await CI success.
