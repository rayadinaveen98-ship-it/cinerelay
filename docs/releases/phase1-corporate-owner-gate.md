# Phase 1 corporate publishing owner evidence gates

This release closes Issue #56: different logical CineRelay \`sources.id\` entries may represent the **same corporate publisher** (e.g., About Amazon Prime Video website vs Prime Video India YouTube).

- Add private-by-RLS \`source_corporate_owners\` and \`source_corporate_owner_memberships\` explicit audited mappings, seeded only for Amazon/Prime Video and Netflix India/South after reviewing first-party URLs.
- \`catalogue_independent_owner_count\` uses \`corporate:<verified-owner-id>\` for mapped sources and \`source:<source-id>\` for unmapped sources; no risky name heuristics or API exposure.
- Both privileged approval and promotion use the same independent *corporate* owner gate. Existing confidence, first-party, status, duplicate, overrides, user approval and historical replay checks remain.
- No candidate autoapproval, generated news event or notification.
- DB integration tests prove two records from a single corporate owner fail approval, then genuinely separate corroboration permits verified catalogue insertion. Use current pgtap database CI before production roll out. Source health must stay unchanged.

**Scope:** four individually verified source UUIDs — About Amazon India — Prime Video, Prime Video India, Netflix India, Netflix India South. Other sources remain distinct pending evidence. Do not infer all Sun or Tips brand ownership from naming alone.
