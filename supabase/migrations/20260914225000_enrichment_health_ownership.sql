begin;

create or replace function public.record_youtube_enrichment_success(
  p_source_identity_id uuid,
  p_succeeded_at timestamptz,
  p_item_at timestamptz default null
)
returns void
language plpgsql
set search_path = public, extensions
as $$
begin
  if p_source_identity_id is null or p_succeeded_at is null then
    raise exception 'source identity and succeeded_at are required';
  end if;

  insert into public.source_health (
    source_identity_id,
    health_state,
    last_attempt_at,
    last_success_at,
    last_item_at,
    consecutive_failures,
    last_http_status,
    last_error_code,
    last_error_message,
    parser_version,
    updated_at
  ) values (
    p_source_identity_id,
    'HEALTHY',
    p_succeeded_at,
    p_succeeded_at,
    p_item_at,
    0,
    200,
    null,
    null,
    'youtube-v1',
    p_succeeded_at
  )
  on conflict (source_identity_id) do update
    set last_attempt_at = p_succeeded_at,
        last_success_at = p_succeeded_at,
        last_item_at = case
          when p_item_at is null then public.source_health.last_item_at
          when public.source_health.last_item_at is null then p_item_at
          else greatest(public.source_health.last_item_at, p_item_at)
        end,
        health_state = case
          when public.source_health.last_error_code is null
            or public.source_health.last_error_code in (
              'YOUTUBE_API_ERROR',
              'ENRICHMENT_FAILED',
              'RESERVE_GUARD',
              'HARD_LIMIT'
            ) then 'HEALTHY'
          else public.source_health.health_state
        end,
        consecutive_failures = case
          when public.source_health.last_error_code is null
            or public.source_health.last_error_code in (
              'YOUTUBE_API_ERROR',
              'ENRICHMENT_FAILED',
              'RESERVE_GUARD',
              'HARD_LIMIT'
            ) then 0
          else public.source_health.consecutive_failures
        end,
        last_http_status = 200,
        last_error_code = case
          when public.source_health.last_error_code is null
            or public.source_health.last_error_code in (
              'YOUTUBE_API_ERROR',
              'ENRICHMENT_FAILED',
              'RESERVE_GUARD',
              'HARD_LIMIT'
            ) then null
          else public.source_health.last_error_code
        end,
        last_error_message = case
          when public.source_health.last_error_code is null
            or public.source_health.last_error_code in (
              'YOUTUBE_API_ERROR',
              'ENRICHMENT_FAILED',
              'RESERVE_GUARD',
              'HARD_LIMIT'
            ) then null
          else public.source_health.last_error_message
        end,
        parser_version = 'youtube-v1',
        updated_at = p_succeeded_at;
end;
$$;

comment on function public.record_youtube_enrichment_success is
  'Records successful YouTube enrichment while clearing only enrichment-owned failures; unrelated WebSub/fallback/subscription health remains authoritative.';

revoke execute on function public.record_youtube_enrichment_success(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.record_youtube_enrichment_success(uuid, timestamptz, timestamptz) to service_role;

commit;
