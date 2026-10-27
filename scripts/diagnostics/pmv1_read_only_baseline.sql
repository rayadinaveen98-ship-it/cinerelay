-- CineRelay PMV1: aggregate, read-only operational baseline.
-- Safe to run manually against the CineRelay Supabase project.
-- NO DDL, DML, function calls, privileged secrets, person-level, QIDs,
-- names, raw body text, evidence URLs, tokens, or external services.
-- Counts are time-sensitive; record execution time with the result.
-- Interpret source_health errors together with fresh fallback/subscription data.
--
-- 1. Current backend footprint (records != users).
SELECT now() AS observed_at, 'entities' AS metric, count(*) AS n FROM public.entities
UNION ALL SELECT now(), 'events', count(*) FROM public.events
UNION ALL SELECT now(), 'raw_items', count(*) FROM public.raw_items
UNION ALL SELECT now(), 'ott_releases', count(*) FROM public.ott_releases
UNION ALL SELECT now(), 'creator_radar_entries', count(*) FROM public.creator_radar_entries
ORDER BY metric;

-- 2. Source identities: avoid confusing dormant X with active coverage.
SELECT platform, active, count(*) AS identities
FROM public.source_identities
GROUP BY platform, active
ORDER BY platform, active DESC;

-- 3. Verify active WebSub lease *identity by identity*.
WITH active_youtube AS (
  SELECT id FROM public.source_identities WHERE platform = 'YOUTUBE' AND active = true
), current_leases AS (
  SELECT source_identity_id, count(*) AS lease_count
  FROM public.connector_subscriptions
  WHERE provider = 'YOUTUBE_WEBSUB' AND state = 'ACTIVE' AND expires_at > now()
  GROUP BY source_identity_id
)
SELECT count(*) AS active_youtube_identities,
       count(*) FILTER (WHERE COALESCE(l.lease_count,0) > 0) AS with_current_lease,
       count(*) FILTER (WHERE COALESCE(l.lease_count,0) = 0) AS missing_current_lease,
       count(*) FILTER (WHERE COALESCE(l.lease_count,0) > 1) AS duplicate_current_leases
FROM active_youtube y LEFT JOIN current_leases l ON l.source_identity_id = y.id;

-- 4. Freshness vs error state. WebSub event count is NOT upload-to-event latency.
SELECT h.health_state,
       COALESCE(h.last_error_code,'(none)') AS error_code,
       count(*) AS active_identities,
       count(*) FILTER (WHERE h.last_success_at > now() - interval '24 hours') AS successful_checks_24h,
       count(*) FILTER (WHERE y.last_fallback_check_at > now() - interval '24 hours') AS fallback_checks_24h,
       count(*) FILTER (WHERE y.last_websub_at > now() - interval '7 days') AS websub_callbacks_7d,
       count(*) FILTER (WHERE y.last_websub_at IS NULL) AS no_recorded_websub_callback,
       count(*) FILTER (WHERE y.fallback_gap_count > 0) AS with_historical_fallback_gaps
FROM public.source_identities s
JOIN public.source_health h ON h.source_identity_id = s.id
LEFT JOIN public.youtube_channel_state y ON y.source_identity_id = s.id
WHERE s.platform = 'YOUTUBE' AND s.active = true
GROUP BY h.health_state, COALESCE(h.last_error_code,'(none)')
ORDER BY active_identities DESC;

-- 5. Quality risk: patterns are **review hints**, never confirmed bad titles.
SELECT count(*) AS active_entities,
       count(*) FILTER (
         WHERE canonical_name ~* '(catch .* in |movie scenes|super show|hot takes)'
       ) AS suspect_pattern_candidates
FROM public.entities WHERE status = 'ACTIVE';

SELECT proposed_entity_type, status, count(*) AS candidates
FROM public.entity_discovery_candidates
GROUP BY proposed_entity_type, status
ORDER BY proposed_entity_type, status;

-- 6. Opt-in and provider status: device records are NOT distinct people.
SELECT count(*) AS subscriptions,
       count(*) FILTER (WHERE enabled) AS enabled_subscriptions
FROM public.user_source_activity_subscriptions;

SELECT count(*) AS registered_devices,
       count(*) FILTER (WHERE active) AS active_devices,
       count(*) FILTER (WHERE last_success_at IS NOT NULL) AS historically_successful_device_targets
FROM public.push_device_registrations;

SELECT count(*) AS source_activity_outbox_rows FROM public.source_activity_deliveries;

-- 7. Partial latency proxy: YouTube published_at -> raw first_seen_at (NOT consumer feed readiness).
-- Includes only items published and first observed in the previous seven days,
-- only currently active identities, and does not prove all uploads were ingested.
-- Rare negative lags can occur from upstream timestamp/clock inconsistencies.
WITH sample AS (
  SELECT EXTRACT(EPOCH FROM (r.first_seen_at - r.published_at)) / 60.0 AS lag_minutes
  FROM public.raw_items r
  JOIN public.source_identities s ON s.id = r.source_identity_id
  WHERE s.platform = 'YOUTUBE' AND s.active = true
    AND r.published_at >= now() - interval '7 days'
    AND r.first_seen_at >= now() - interval '7 days'
    AND r.published_at IS NOT NULL AND r.first_seen_at IS NOT NULL
)
SELECT count(*) AS items,
       count(*) FILTER (WHERE lag_minutes < 0) AS negative_lag,
       count(*) FILTER (WHERE lag_minutes > 360) AS over_six_hours,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY lag_minutes))::numeric, 1) AS p50_minutes,
       round((percentile_cont(0.95) WITHIN GROUP (ORDER BY lag_minutes))::numeric, 1) AS p95_minutes,
       round(max(lag_minutes)::numeric, 1) AS max_minutes
FROM sample;
