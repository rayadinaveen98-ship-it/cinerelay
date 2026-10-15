-- CineRelay reliability: WebSub is only an accelerator; do not report stale
-- legacy source_health.next_due_at as scheduler drift for YouTube channels.
-- YouTube's authoritative fallback schedule lives in youtube_channel_state.
CREATE OR REPLACE FUNCTION public.source_effective_health(p_source_identity_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with base as (
    select
      si.id,
      si.platform,
      si.connector_type,
      si.poll_class,
      si.active,
      sh.health_state,
      sh.last_attempt_at,
      sh.last_success_at,
      sh.last_item_at,
      sh.next_due_at,
      sh.consecutive_failures,
      sh.last_error_code,
      sh.last_error_message,
      sh.subscription_expires_at,
      yc.last_websub_at,
      yc.last_fallback_check_at,
      yc.next_fallback_check_at,
      yc.fallback_gap_count
    from public.source_identities si
    left join public.source_health sh on sh.source_identity_id = si.id
    left join public.youtube_channel_state yc on yc.source_identity_id = si.id
    where si.id = p_source_identity_id
  ), derived as (
    select *,
      case
        when not coalesce(active, false) then 'INACTIVE'
        when platform = 'YOUTUBE'
          and last_error_code in ('WEBSUB_MISSED_DELIVERY','WEBSUB_STALE')
          and coalesce(consecutive_failures, 0) = 0
          and last_fallback_check_at >= p_now - interval '2 hours'
          then 'HEALTHY'
        when coalesce(consecutive_failures, 0) >= 5
          and coalesce(last_success_at, '-infinity'::timestamptz) < p_now - interval '72 hours'
          then 'DEAD'
        when coalesce(last_success_at, '-infinity'::timestamptz) < p_now - interval '24 hours'
          then 'STALE'
        else coalesce(health_state, 'UNKNOWN')
      end as effective_state,
      (
        platform = 'YOUTUBE'
        and last_error_code in ('WEBSUB_MISSED_DELIVERY','WEBSUB_STALE')
        and last_fallback_check_at >= p_now - interval '2 hours'
      ) as websub_accelerator_only,
      (
        platform <> 'YOUTUBE'
        and next_due_at is not null
        and next_due_at < p_now - interval '30 minutes'
        and coalesce(last_success_at, '-infinity'::timestamptz) > next_due_at
      ) as source_schedule_drift,
      (
        platform = 'YOUTUBE'
        and next_fallback_check_at is not null
        and next_fallback_check_at < p_now - interval '30 minutes'
        and coalesce(last_fallback_check_at, '-infinity'::timestamptz) > next_fallback_check_at
      ) as youtube_schedule_drift
    from base
  )
  select jsonb_build_object(
    'sourceIdentityId', id,
    'platform', platform,
    'connectorType', connector_type,
    'pollClass', poll_class,
    'storedState', health_state,
    'effectiveState', effective_state,
    'webSubAcceleratorOnly', websub_accelerator_only,
    'scheduleDrift', source_schedule_drift or youtube_schedule_drift,
    'lastAttemptAt', last_attempt_at,
    'lastSuccessAt', last_success_at,
    'lastItemAt', last_item_at,
    'lastFallbackCheckAt', last_fallback_check_at,
    'nextDueAt', case when platform = 'YOUTUBE' then next_fallback_check_at else next_due_at end,
    'nextFallbackCheckAt', next_fallback_check_at,
    'consecutiveFailures', coalesce(consecutive_failures, 0),
    'lastErrorCode', last_error_code,
    'fallbackGapCount', coalesce(fallback_gap_count, 0),
    'subscriptionExpiresAt', subscription_expires_at
  )
  from derived;
$function$;
revoke execute on function public.source_effective_health(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.source_effective_health(uuid,timestamptz) to service_role;
