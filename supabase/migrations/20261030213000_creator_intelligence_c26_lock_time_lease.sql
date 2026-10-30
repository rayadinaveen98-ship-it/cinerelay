-- C26: Rebind lease/ledger timestamps AFTER potential PostgreSQL lock waits.
-- Both C20/C23 are draft-only and have NEVER been deployed to CineRelay.
-- Keep this additive override for correct future migration sequencing.
begin;

create or replace function public.creator_c20_claim_and_reserve_identity(
 p_handle text,p_daily_limit integer,p_existing_reserve integer
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare
 v_handle text:=lower(p_handle);
 v_now timestamptz;
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
 -- C26: quota date, cooldown and claim lease start AFTER global lock wait.
 v_now := clock_timestamp();

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


create or replace function public.creator_c23_commit_verified_identity(
 p_handle text,
 p_claim_token uuid,
 p_quota_receipt_id bigint,
 p_record jsonb
) returns boolean language plpgsql security definer
set search_path = pg_catalog,public
as $body$
declare
 v_now timestamptz := clock_timestamp();
 v_handle text := lower(p_handle);
 v_claim public.creator_intelligence_handle_claims%rowtype;
 v_lease_checked_at timestamptz;
 v_count integer;
 v_receipt_count integer;
 v_record_count integer;
 v_channel text;
 v_observed timestamptz;
 v_expiry timestamptz;
begin
 if p_handle is null or p_handle !~ '^@[^[:space:]/]{3,30}$'
    or p_claim_token is null or p_quota_receipt_id is null or p_quota_receipt_id<=0
    or p_record is null or jsonb_typeof(p_record)<>'object' then
  raise exception 'creator_c23_invalid_commit_input';
 end if;
 -- Don't permit unrecognized columns, especially approvals, metrics or quota.
 select count(*) into v_count from jsonb_object_keys(p_record);
 if v_count<>14 or not (p_record ?& array[
    'channel_id','listed_name','listed_handle','official_channel_title',
    'uploads_playlist_id','locale','category_provisional','size_tier_provisional',
    'source_url','observed_at','expires_at','review_state',
    'monitoring_enabled','metrics_enabled']) then
  raise exception 'creator_c23_unexpected_identity_columns';
 end if;

 if lower(p_record->>'listed_handle')<>v_handle
    or p_record->>'review_state'<>'REVIEW_PENDING'
    or p_record->'monitoring_enabled'<>'false'::jsonb
    or p_record->'metrics_enabled'<>'false'::jsonb then
  raise exception 'creator_c23_handle_or_review_mismatch';
 end if;
 v_channel:=p_record->>'channel_id';
 if v_channel is null or v_channel !~ '^UC[A-Za-z0-9_-]{22}$'
    or p_record->>'uploads_playlist_id' <> 'UU'||substring(v_channel from 3) then
  raise exception 'creator_c23_invalid_channel_playlist';
 end if;

 v_observed:=(p_record->>'observed_at')::timestamptz;
 v_expiry:=(p_record->>'expires_at')::timestamptz;
 if v_observed is null or v_expiry is null
    or v_observed>v_now+interval '2 minutes'
    or v_observed<v_now-interval '10 minutes'
    or v_expiry<=v_now
    or v_expiry>v_observed+interval '28 days' then
  raise exception 'creator_c23_invalid_identity_freshness';
 end if;

 -- Lock this exact claim, and fail closed if replaced or lease expired.
 -- The separate C20 claim RPC uses FOR UPDATE on this same handle row.
 select * into v_claim from public.creator_intelligence_handle_claims
  where handle_key=v_handle for update;
 -- C26: check lease after ANY lock wait, never against function-entry time.
 v_lease_checked_at := clock_timestamp();
 if not found or v_claim.claim_token<>p_claim_token
    or v_claim.quota_receipt_id<>p_quota_receipt_id
    or v_claim.state<>'IN_FLIGHT'
    or v_claim.retry_after<=v_lease_checked_at
    or v_expiry<=v_lease_checked_at
    or v_observed<v_lease_checked_at-interval '10 minutes' then
  return false;
 end if;

 -- The receipt must be the precharged one-unit official read. No new charge.
 perform 1 from public.connector_quota_usage
  where id=p_quota_receipt_id and provider='YOUTUBE_DATA_API'
    and quota_bucket='GENERAL_READ' and method='creatorC20.oneShotIdentity'
    and units=1 and response_status is null
  for update;
 if not found then return false; end if;

 insert into public.creator_intelligence_identity_evidence(
  channel_id,listed_name,listed_handle,official_channel_title,
  uploads_playlist_id,locale,category_provisional,size_tier_provisional,
  source_url,observed_at,expires_at,review_state,monitoring_enabled,metrics_enabled
 ) values (
  v_channel,p_record->>'listed_name',p_record->>'listed_handle',
  p_record->>'official_channel_title',p_record->>'uploads_playlist_id',
  p_record->>'locale',p_record->>'category_provisional',
  p_record->>'size_tier_provisional',p_record->>'source_url',
  v_observed,v_expiry,'REVIEW_PENDING',false,false
 )
 on conflict(channel_id) do update set
   listed_name=excluded.listed_name,
   listed_handle=excluded.listed_handle,
   official_channel_title=excluded.official_channel_title,
   uploads_playlist_id=excluded.uploads_playlist_id,
   locale=excluded.locale,
   category_provisional=excluded.category_provisional,
   size_tier_provisional=excluded.size_tier_provisional,
   source_url=excluded.source_url,
   observed_at=excluded.observed_at,
   expires_at=excluded.expires_at,
   review_state='REVIEW_PENDING',
   monitoring_enabled=false,metrics_enabled=false
 where lower(public.creator_intelligence_identity_evidence.listed_handle)=v_handle;
 get diagnostics v_record_count=row_count;
 if v_record_count<>1 then
  -- The same official UC ID cannot be silently assigned to a different handle.
  return false;
 end if;

 update public.creator_intelligence_handle_claims
   set state='SUCCEEDED',retry_after=least(expires_at,clock_timestamp()+interval '24 hours'),
       result_status=200
   where handle_key=v_handle and claim_token=p_claim_token
    and quota_receipt_id=p_quota_receipt_id and state='IN_FLIGHT';
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'creator_c23_claim_finalization_rolled_back'; end if;

 update public.connector_quota_usage
  set response_status=200,
      metadata=jsonb_build_object('purpose','CINERELAY_C20',
        'state','PRIVATE_IDENTITY_STORED','noSensitiveApiData',true)
  where id=p_quota_receipt_id and provider='YOUTUBE_DATA_API'
    and quota_bucket='GENERAL_READ' and method='creatorC20.oneShotIdentity';
 get diagnostics v_receipt_count=row_count;
 if v_receipt_count<>1 then raise exception 'creator_c23_quota_finalization_rolled_back'; end if;
 return true;
end;
$body$;


comment on function public.creator_c23_commit_verified_identity(text,uuid,bigint,jsonb) is
 'C26: service-only atomic current-token commit; checks freshness and claim lease with clock_timestamp after handle row lock.';
comment on function public.creator_c20_claim_and_reserve_identity(text,integer,integer) is
 'C26: service-only one-unit quota claim; sample quota day and cooldown after global advisory lock.';
commit;
