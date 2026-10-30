-- C20 draft: manual per-handle official YouTube ID verification,
-- one atomic pre-provider quota unit. NOTHING scheduled or enabled.
begin;
create table public.creator_intelligence_handle_claims (
 handle_key text primary key check (handle_key ~ '^@[^[:space:]/]{3,30}$' and handle_key=lower(handle_key)),
 claim_token uuid not null default gen_random_uuid(),
 quota_receipt_id bigint not null references public.connector_quota_usage(id),
 claimed_at timestamptz not null,
 retry_after timestamptz not null,
 expires_at timestamptz not null,
 state text not null check (state in ('IN_FLIGHT','SUCCEEDED','FAILED')),
 result_status integer check(result_status is null or result_status between 100 and 599),
 constraint creator_c20_claim_ttl check(
  expires_at>claimed_at and expires_at<=claimed_at+interval '28 days'
  and retry_after<=expires_at)
);
create index creator_c20_handle_claims_expiry_idx
 on public.creator_intelligence_handle_claims(expires_at);
alter table public.creator_intelligence_handle_claims enable row level security;
revoke all on public.creator_intelligence_handle_claims from public,anon,authenticated;
grant select,insert,update,delete on public.creator_intelligence_handle_claims to service_role;

create function public.creator_c20_claim_and_reserve_identity(
 p_handle text,p_daily_limit integer,p_existing_reserve integer
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare
 v_handle text:=lower(p_handle);
 v_now timestamptz:=clock_timestamp();
 v_claim public.creator_intelligence_handle_claims%rowtype;
 v_used numeric;
 v_receipt bigint;
 v_token uuid:=gen_random_uuid();
begin
 if p_handle is null or p_handle !~ '^@[^[:space:]/]{3,30}$'
   or p_daily_limit is null or p_daily_limit<2 or p_daily_limit>10000
   or p_existing_reserve is null or p_existing_reserve<1000
   or p_existing_reserve>=p_daily_limit then
  raise exception 'creator_c20_invalid_claim_or_budget';
 end if;

 -- Share C14's global lock to serialize across C13/C14/C20 ledger writes.
 perform pg_advisory_xact_lock(hashtext('CINERELAY_C14_ACTIVITY_GLOBAL'));

 select * into v_claim from public.creator_intelligence_handle_claims
 where handle_key=v_handle for update;
 if found and v_claim.retry_after>v_now then
  return jsonb_build_object('state','BLOCKED_ACTIVE_OR_COOLDOWN');
 end if;
 -- Do not re-spend quota on records still fresh. One-shot manual refresh only
 -- near the end of their TTL (subject to separate operator approval).
 if exists (select 1 from public.creator_intelligence_identity_evidence
    where lower(listed_handle)=v_handle and expires_at>v_now+interval '1 day') then
  return jsonb_build_object('state','BLOCKED_FRESH_IDENTITY');
 end if;
 select coalesce(sum(units),0) into v_used
 from public.connector_quota_usage
 where provider='YOUTUBE_DATA_API' and quota_bucket='GENERAL_READ'
   and (occurred_at at time zone 'America/Los_Angeles')::date
    =(v_now at time zone 'America/Los_Angeles')::date;
 if v_used+1>p_daily_limit-p_existing_reserve then
  return jsonb_build_object('state','BLOCKED_QUOTA_RESERVE');
 end if;

 insert into public.connector_quota_usage(
  provider,quota_bucket,method,units,request_count,response_status,metadata
 ) values ('YOUTUBE_DATA_API','GENERAL_READ','creatorC20.oneShotIdentity',
   1,1,null,jsonb_build_object('purpose','CINERELAY_C20',
    'state','RESERVED_BEFORE_PROVIDER','noSensitiveApiData',true))
 returning id into v_receipt;

 insert into public.creator_intelligence_handle_claims(
   handle_key,claim_token,quota_receipt_id,claimed_at,retry_after,expires_at,state
 ) values (v_handle,v_token,v_receipt,v_now,v_now+interval '10 minutes',
   v_now+interval '28 days','IN_FLIGHT')
 on conflict(handle_key) do update set
   claim_token=excluded.claim_token,quota_receipt_id=excluded.quota_receipt_id,
   claimed_at=excluded.claimed_at,retry_after=excluded.retry_after,
   expires_at=excluded.expires_at,state='IN_FLIGHT',result_status=null;
 return jsonb_build_object('state','CLAIMED','claimToken',v_token,
   'quotaReceiptId',v_receipt);
end;
$fn$;

create function public.creator_c20_finalize_identity(
 p_handle text,p_token uuid,p_receipt_id bigint,p_success boolean,p_status integer
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare v_found integer;v_now timestamptz:=clock_timestamp();
begin
 if p_handle is null or p_handle !~ '^@[^[:space:]/]{3,30}$'
   or p_token is null or p_receipt_id is null or p_receipt_id<=0
   or p_success is null or p_status is null or p_status<100 or p_status>599 then
  raise exception 'creator_c20_invalid_finalize';
 end if;
 update public.creator_intelligence_handle_claims
 set state=case when p_success then 'SUCCEEDED' else 'FAILED' end,
  retry_after=least(expires_at,v_now+
   case when p_success then interval '24 hours' else interval '15 minutes' end),
  result_status=p_status
 where handle_key=lower(p_handle) and claim_token=p_token
   and quota_receipt_id=p_receipt_id and state='IN_FLIGHT';
 get diagnostics v_found=row_count;
 if v_found<>1 then return false; end if;
 update public.connector_quota_usage
 set response_status=p_status,
  metadata=jsonb_build_object('purpose','CINERELAY_C20',
   'state',case when p_success then 'PRIVATE_IDENTITY_STORED'
       else 'FAILED_AFTER_RESERVATION' end,'noSensitiveApiData',true)
 where id=p_receipt_id and provider='YOUTUBE_DATA_API'
  and quota_bucket='GENERAL_READ' and method='creatorC20.oneShotIdentity';
 get diagnostics v_found=row_count;
 if v_found<>1 then raise exception 'creator_c20_quota_receipt_missing'; end if;
 return true;
end;
$fn$;

revoke all on function public.creator_c20_claim_and_reserve_identity(text,integer,integer)
 from public,anon,authenticated;
revoke all on function public.creator_c20_finalize_identity(text,uuid,bigint,boolean,integer)
 from public,anon,authenticated;
grant execute on function public.creator_c20_claim_and_reserve_identity(text,integer,integer)
 to service_role;
grant execute on function public.creator_c20_finalize_identity(text,uuid,bigint,boolean,integer)
 to service_role;

select cron.schedule(
 'cinerelay-c20-handle-claim-ttl','17 * * * *',
 $purge$delete from public.creator_intelligence_handle_claims
 where expires_at<=now();$purge$
);
comment on table public.creator_intelligence_handle_claims is
 'C20 manual one-shot handle claims. Service-only. No API counters. 28-day TTL, hourly purge.';
commit;
