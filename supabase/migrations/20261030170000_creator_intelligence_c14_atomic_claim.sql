-- C14 atomic creator audit claim + quota reservation.
-- DRAFT ONLY. Production schema, API keys and existing 185 sources unchanged.
begin;

create table public.creator_intelligence_activity_claims (
  channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  claim_token uuid not null default gen_random_uuid(),
  quota_receipt_id bigint not null references public.connector_quota_usage(id),
  claimed_at timestamptz not null,
  retry_after timestamptz not null,
  expires_at timestamptz not null,
  state text not null check (state in ('IN_FLIGHT','SUCCEEDED','FAILED')),
  result_status integer check (result_status is null or result_status between 100 and 599),
  constraint creator_c14_claim_ttl check (
    expires_at > claimed_at and expires_at <= claimed_at + interval '28 days'
    and retry_after <= expires_at
  )
);
create index creator_c14_claim_expiry_idx
 on public.creator_intelligence_activity_claims(expires_at);
alter table public.creator_intelligence_activity_claims enable row level security;
revoke all on public.creator_intelligence_activity_claims from public,anon,authenticated;
grant select,insert,update,delete on public.creator_intelligence_activity_claims to service_role;

create function public.creator_c14_claim_and_reserve_activity(
  p_channel_id text,
  p_daily_limit integer,
  p_existing_reserve integer
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $body$
declare
  v_now timestamptz := clock_timestamp();
  v_used numeric;
  v_claim public.creator_intelligence_activity_claims%rowtype;
  v_id bigint;
  v_token uuid := gen_random_uuid();
begin
  if p_channel_id is null or p_channel_id !~ '^UC[A-Za-z0-9_-]{22}$'
     or p_daily_limit is null or p_daily_limit < 2 or p_daily_limit > 10000
     or p_existing_reserve is null or p_existing_reserve < 1000
     or p_existing_reserve >= p_daily_limit then
    raise exception 'creator_c14_invalid_claim_or_quota_config';
  end if;

  -- This lock serializes reservations across all C14 channels; a second
  -- caller cannot race an identity claim or double-spend local quota.
  perform pg_advisory_xact_lock(hashtext('CINERELAY_C14_ACTIVITY_GLOBAL'));

  select * into v_claim
  from public.creator_intelligence_activity_claims
  where channel_id=p_channel_id for update;

  if found and v_claim.retry_after>v_now then
    return jsonb_build_object('state','BLOCKED_ACTIVE_OR_COOLDOWN');
  end if;
  -- Defense in depth even if the claim row was unavailable or purged.
  if exists (
    select 1 from public.creator_intelligence_activity_observations
    where channel_id=p_channel_id
      and observed_at>v_now-interval '24 hours' and expires_at>v_now
  ) then
    return jsonb_build_object('state','BLOCKED_RECENT_PUBLIC_OBSERVATION');
  end if;

  select coalesce(sum(units),0) into v_used
  from public.connector_quota_usage
  where provider='YOUTUBE_DATA_API'
    and quota_bucket='GENERAL_READ'
    and (occurred_at at time zone 'America/Los_Angeles')::date
      = (v_now at time zone 'America/Los_Angeles')::date;
  if v_used + 2 > p_daily_limit - p_existing_reserve then
    return jsonb_build_object('state','BLOCKED_QUOTA_RESERVE');
  end if;

  insert into public.connector_quota_usage (
    provider,quota_bucket,method,units,request_count,response_status,metadata
  ) values (
    'YOUTUBE_DATA_API','GENERAL_READ','creatorC14.oneShotPublicActivity',
    2,2,null,
    jsonb_build_object('purpose','CINERELAY_C14',
      'state','RESERVED_BEFORE_PROVIDER','noSensitiveApiData',true)
  ) returning id into v_id;

  insert into public.creator_intelligence_activity_claims (
    channel_id,claim_token,quota_receipt_id,claimed_at,retry_after,expires_at,state,result_status
  ) values (
    p_channel_id,v_token,v_id,v_now,v_now+interval '10 minutes',
    v_now+interval '28 days','IN_FLIGHT',null
  )
  on conflict (channel_id) do update set
    claim_token=excluded.claim_token,quota_receipt_id=excluded.quota_receipt_id,
    claimed_at=excluded.claimed_at,retry_after=excluded.retry_after,
    expires_at=excluded.expires_at,state=excluded.state,result_status=null;

  return jsonb_build_object('state','CLAIMED','quotaReceiptId',v_id,
    'claimToken',v_token);
end;
$body$;

create function public.creator_c14_finalize_activity_claim(
  p_channel_id text,
  p_claim_token uuid,
  p_quota_receipt_id bigint,
  p_succeeded boolean,
  p_response_status integer
) returns boolean
language plpgsql security definer
set search_path=pg_catalog,public
as $body$
declare
  v_row_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_channel_id is null or p_channel_id !~ '^UC[A-Za-z0-9_-]{22}$'
    or p_claim_token is null or p_quota_receipt_id is null or p_quota_receipt_id<=0
    or p_succeeded is null or p_response_status is null
    or p_response_status<100 or p_response_status>599 then
    raise exception 'creator_c14_invalid_finalize_parameters';
  end if;
  update public.creator_intelligence_activity_claims
    set state=case when p_succeeded then 'SUCCEEDED' else 'FAILED' end,
        retry_after=least(expires_at,v_now+
          case when p_succeeded then interval '24 hours' else interval '15 minutes' end),
        result_status=p_response_status
  where channel_id=p_channel_id and claim_token=p_claim_token
    and quota_receipt_id=p_quota_receipt_id and state='IN_FLIGHT';
  get diagnostics v_row_count=row_count;
  if v_row_count<>1 then return false; end if;

  update public.connector_quota_usage
    set response_status=p_response_status,
        metadata=jsonb_build_object('purpose','CINERELAY_C14',
          'state',case when p_succeeded then 'PRIVATE_TTL_STORED'
             else 'FAILED_AFTER_QUOTA_RESERVE' end,
          'noSensitiveApiData',true)
  where id=p_quota_receipt_id
    and provider='YOUTUBE_DATA_API' and quota_bucket='GENERAL_READ'
    and method='creatorC14.oneShotPublicActivity';
  get diagnostics v_row_count=row_count;
  if v_row_count<>1 then
    raise exception 'creator_c14_quota_receipt_not_found';
  end if;
  return true;
end;
$body$;

revoke all on function public.creator_c14_claim_and_reserve_activity(text,integer,integer)
 from public,anon,authenticated;
revoke all on function public.creator_c14_finalize_activity_claim(text,uuid,bigint,boolean,integer)
 from public,anon,authenticated;
grant execute on function public.creator_c14_claim_and_reserve_activity(text,integer,integer)
 to service_role;
grant execute on function public.creator_c14_finalize_activity_claim(text,uuid,bigint,boolean,integer)
 to service_role;

select cron.schedule(
 'cinerelay-c14-activity-claim-ttl','11 * * * *',
 $purge$delete from public.creator_intelligence_activity_claims
 where expires_at <= now();$purge$
);
comment on table public.creator_intelligence_activity_claims is
 'C14 service-only short-lived idempotency claims, not subscriber/video data. Hourly deletion at max 28 days.';
commit;
