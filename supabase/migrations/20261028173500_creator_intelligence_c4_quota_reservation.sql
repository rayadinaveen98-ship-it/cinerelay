-- C4: serializable-in-practice single-request quota reservation.
-- No activation, no cron, no collector deployment is part of this migration.
begin;

create or replace function public.creator_intelligence_reserve_stats_quota(
  p_daily_limit integer,
  p_reserve integer,
  p_video_count integer
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, public
as $body$
declare
  v_used numeric;
  v_id bigint;
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 10000
    or p_reserve is null or p_reserve < 0 or p_reserve >= p_daily_limit
    or p_video_count is null or p_video_count < 1 or p_video_count > 50 then
    raise exception 'invalid_creator_metrics_quota_parameters';
  end if;
  perform pg_advisory_xact_lock(hashtext('CINERELAY_CREATOR_VIDEO_BATCH_STATS_RESERVE'));
  select public.connector_quota_used_today('YOUTUBE_DATA_API', 'VIDEO_BATCH_STATS')
    into v_used;
  if v_used + 1 > p_daily_limit - p_reserve then
    return null;
  end if;
  insert into public.connector_quota_usage (
    provider, quota_bucket, method, units, request_count, response_status, metadata
  ) values (
    'YOUTUBE_DATA_API','VIDEO_BATCH_STATS','videos.batchGetStats',
    1,1,null,
    jsonb_build_object('purpose','CREATOR_INTELLIGENCE_C4',
      'state','RESERVED_BEFORE_REQUEST','requestedVideoCount',p_video_count)
  )
  returning id into v_id;
  return v_id;
end;
$body$;

-- Approved and recently verified channels ONLY. A disabled/deactivated
-- operator or stale 30-day channel metadata automatically excludes a channel.
create or replace function public.creator_intelligence_metric_candidates(
  p_limit integer default 500
) returns table (
  video_id text,
  channel_id text,
  published_at timestamptz,
  last_observed_at timestamptz
) language sql stable security definer
set search_path = pg_catalog, public
as $body$
  select v.video_id, v.channel_id, v.published_at, last_sample.observed_at
  from public.creator_intelligence_videos v
  join public.creator_intelligence_channels c on c.channel_id = v.channel_id
  join public.operator_users o on o.user_id = c.approved_by
  left join lateral (
    select s.observed_at
    from public.creator_intelligence_metric_samples s
    where s.video_id = v.video_id
    order by s.observed_at desc limit 1
  ) last_sample on true
  where c.monitoring_enabled = true
    and c.review_state = 'APPROVED'
    and c.approved_at is not null
    and o.active = true
    and c.metadata_refreshed_at >= now() - interval '30 days'
    and v.metadata_refreshed_at >= now() - interval '30 days'
    and v.published_at <= now()
    and v.published_at >= now() - interval '30 days'
  order by coalesce(last_sample.observed_at, v.published_at) asc, v.video_id asc
  limit least(greatest(coalesce(p_limit,500),1),2000)
$body$;

revoke all on function public.creator_intelligence_reserve_stats_quota(integer,integer,integer)
  from public,anon,authenticated;
revoke all on function public.creator_intelligence_metric_candidates(integer)
  from public,anon,authenticated;
grant execute on function public.creator_intelligence_reserve_stats_quota(integer,integer,integer)
  to service_role;
grant execute on function public.creator_intelligence_metric_candidates(integer)
  to service_role;

comment on function public.creator_intelligence_reserve_stats_quota(integer,integer,integer) is
  'Atomic per-day pre-request quota ledger reservation for public YouTube video stats; unused reservations remain spent to avoid double billing on crashes.';
comment on function public.creator_intelligence_metric_candidates(integer) is
  'Returns at most 2000 current, approved, actively monitored creator videos with last public-metric observation; excludes stale/revoked operator approvals.';
commit;
