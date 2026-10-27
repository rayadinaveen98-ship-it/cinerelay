-- CineRelay P7: production catalogue trust and legacy title review.
-- SELECT-only. Designed for operator/offline execution with authorized access.
-- IMPORTANT: "does not pass automatic OTT title filter" means "needs human
-- review", not "invalid film/series". No deletion, status mutation, merge, push,
-- event editing, operator promotion, or direct user identifiers.
-- Test against current guard; counts can change as publishers update.
--
-- 1. Compact totals for an internal MVP data-quality gate.
WITH all_active AS (
  SELECT id, entity_type, canonical_name,
         public.automated_ott_candidate_title_looks_canonical(canonical_name) AS passes_gate
  FROM public.entities
  WHERE status='ACTIVE' AND entity_type IN ('MOVIE','SERIES')
), active_event_counts AS (
  SELECT primary_entity_id,COUNT(*) AS active_events
  FROM public.events WHERE status='ACTIVE'
  GROUP BY primary_entity_id
)
SELECT now() AS as_of,
       COUNT(*) AS active_movie_series,
       COUNT(*) FILTER(WHERE NOT e.passes_gate) AS manual_review_hints,
       COUNT(*) FILTER(WHERE NOT e.passes_gate AND e.entity_type='MOVIE') AS movie_hints,
       COUNT(*) FILTER(WHERE NOT e.passes_gate AND e.entity_type='SERIES') AS series_hints,
       COALESCE(SUM(COALESCE(ev.active_events,0)) FILTER(WHERE NOT e.passes_gate),0) AS affected_active_event_associations
FROM all_active e
LEFT JOIN active_event_counts ev ON ev.primary_entity_id=e.id;

-- 2. Prioritized ACTIVE canonical identities. A displayed title can be an
-- unsupported marketing caption OR a valid title with packaging appended.
-- Never turn this automated flag into automatic suppression.
WITH active_event_counts AS (
  SELECT primary_entity_id,
         COUNT(*) AS active_events,
         COUNT(*) FILTER(WHERE verification_state = 'VERIFIED') AS verified_active_events
  FROM public.events
  WHERE status='ACTIVE'
  GROUP BY primary_entity_id
), promoted_counts AS (
  SELECT promoted_entity_id,COUNT(*) AS promoted_candidates
  FROM public.entity_discovery_candidates
  WHERE promoted_entity_id IS NOT NULL AND status='PROMOTED'
  GROUP BY promoted_entity_id
)
SELECT e.entity_type,e.canonical_name,e.created_at,
       COALESCE(ev.active_events,0) AS active_events,
       COALESCE(ev.verified_active_events,0) AS verified_active_events,
       COALESCE(pc.promoted_candidates,0) AS promoted_candidates,
       'HUMAN_REVIEW_REQUIRED_NOT_AUTOMATICALLY_INVALID' AS review_state
FROM public.entities e
LEFT JOIN active_event_counts ev ON ev.primary_entity_id=e.id
LEFT JOIN promoted_counts pc ON pc.promoted_entity_id=e.id
WHERE e.status='ACTIVE' AND e.entity_type IN('MOVIE','SERIES')
  AND NOT public.automated_ott_candidate_title_looks_canonical(e.canonical_name)
ORDER BY active_events DESC,e.created_at,e.canonical_name;

-- 3. Pending candidate text-quality gate. Do not promote or reject rows here.
SELECT proposed_entity_type,
       COUNT(*) AS pending,
       COUNT(*) FILTER(
         WHERE NOT public.automated_ott_candidate_title_looks_canonical(proposed_name)
       ) AS needs_title_review,
       COUNT(*) FILTER(
         WHERE public.automated_ott_candidate_title_looks_canonical(proposed_name)
       ) AS passes_text_filter_only_not_owner_gate
FROM public.entity_discovery_candidates
WHERE status='PENDING' AND proposed_entity_type IN('MOVIE','SERIES')
GROUP BY proposed_entity_type ORDER BY proposed_entity_type;

-- 4. Detection of any fresh auto-promoted text that fails the current guard:
-- high priority incident if new records appeared AFTER guard installation.
SELECT e.entity_type,COUNT(*) AS newly_active_suspect_names,
       COUNT(*) FILTER(WHERE e.created_at > '2026-10-17T00:00:00Z') AS after_quality_migration
FROM public.entities e
WHERE e.status='ACTIVE' AND e.entity_type IN('MOVIE','SERIES')
  AND NOT public.automated_ott_candidate_title_looks_canonical(e.canonical_name)
GROUP BY e.entity_type ORDER BY e.entity_type;
