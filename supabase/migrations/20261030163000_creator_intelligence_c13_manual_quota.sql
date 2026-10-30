-- CineRelay C13: atomic pre-request 2-unit YouTube GENERAL_READ reservation.
-- Source draft only. No production DDL, schedules, monitoring or source activation.
begin;

create function public.creator_c13_reserve_public_activity_quota(
  p_daily_limit integer,
  p_existing_reserve integer
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, public
as $body$
declare
  v_used numeric;
  v_id bigint;
begin
  -- This cap must be set from the owner's *actual* Google Cloud project quota.
  -- The local ledger may not include external usage; it is not proof of headroom.
  if p_daily_limit is null or p_daily_limit < 2 or p_daily_limit > 10000
     or p_existing_reserve is null or p_existing_reserve < 1000
     or p_existing_reserve >= p_daily_limit then
    raise exception 'creator_c13_quota_configuration_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtext('CINERELAY_C13_GENERAL_READ_RESERVE'));
  select coalesce(sum(units),0)
    into v_used
  from public.connector_quota_usage
  where provider = 'YOUTUBE_DATA_API'
    and quota_bucket = 'GENERAL_READ'
    and (occurred_at at time zone 'America/Los_Angeles')::date
         = (clock_timestamp() at time zone 'America/Los_Angeles')::date;

  -- Charge both read calls *before* contacting Google. Even on provider
  -- failures the reservation is retained, avoiding retry double-spending.
  if v_used + 2 > p_daily_limit - p_existing_reserve then
    return null;
  end if;

  insert into public.connector_quota_usage
   (provider, quota_bucket, method, units, request_count,
    response_status, metadata)
  values
   ('YOUTUBE_DATA_API','GENERAL_READ','creatorC13.oneShotPublicActivity',
    2,2,null,jsonb_build_object('purpose','CINERELAY_C13',
       'state','RESERVED_BEFORE_PROVIDER','noSensitiveApiData',true))
  returning id into v_id;

  return v_id;
end;
$body$;

revoke all on function public.creator_c13_reserve_public_activity_quota(integer,integer)
  from public,anon,authenticated;
grant execute on function public.creator_c13_reserve_public_activity_quota(integer,integer)
  to service_role;

comment on function public.creator_c13_reserve_public_activity_quota(integer,integer) is
  'C13: service-only atomic max two general-read requests, Pacific daily ledger, preserves existing source quota reserve, no remote quota guarantee.';
commit;
