-- C27: close the old C16 activity save-before-finalize race.
-- Service-only atomic store and receipt success, no schedules, never deployed automatically.
begin;

create function public.creator_c27_commit_public_activity(
 p_channel_id text,p_claim_token uuid,p_quota_receipt_id bigint,p_record jsonb
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare
 v_claim public.creator_intelligence_activity_claims%rowtype;
 v_checked_at timestamptz;
 v_observed timestamptz;
 v_expires timestamptz;
 v_row_count integer;
 v_receipt_count integer;
 v_subscribers numeric(20,0);
 v_videos numeric(20,0);
begin
 if p_channel_id is null or p_channel_id !~ '^UC[A-Za-z0-9_-]{22}$'
   or p_claim_token is null or p_quota_receipt_id is null or p_quota_receipt_id<=0
   or p_record is null or jsonb_typeof(p_record)<>'object' then
  raise exception 'creator_c27_invalid_commit_input';
 end if;

 -- Exactly the seven public provider data fields already validated by C13.
 -- No approval, monitoring state or arbitrary provider JSON may be persisted.
 if (select count(*) from jsonb_object_keys(p_record))<>7
   or not (p_record ?& array['channel_id','observed_at','expires_at',
     'subscriber_count','subscribers_hidden','public_video_count',
     'recent_public_uploads']) then
  raise exception 'creator_c27_unexpected_activity_columns';
 end if;
 if p_record->>'channel_id'<>p_channel_id
   or jsonb_typeof(p_record->'subscribers_hidden')<>'boolean'
   or jsonb_typeof(p_record->'recent_public_uploads')<>'array'
   or jsonb_array_length(p_record->'recent_public_uploads')>3
   or p_record->>'public_video_count' is null
   or p_record->>'public_video_count' !~ '^(0|[1-9][0-9]{0,19})$'
   or (p_record->>'subscriber_count' is not null and
      (p_record->>'subscriber_count') !~ '^(0|[1-9][0-9]{0,19})$')
   or (p_record->>'subscribers_hidden')::boolean
       and p_record->>'subscriber_count' is not null then
  raise exception 'creator_c27_invalid_activity_record';
 end if;

 v_observed:=(p_record->>'observed_at')::timestamptz;
 v_expires:=(p_record->>'expires_at')::timestamptz;
 v_subscribers:=(p_record->>'subscriber_count')::numeric;
 v_videos:=(p_record->>'public_video_count')::numeric;

 -- Lock exact C14 claim. Refresh time AFTER waiting for another DB transaction.
 select * into v_claim from public.creator_intelligence_activity_claims
   where channel_id=p_channel_id for update;
 v_checked_at:=clock_timestamp();

 if not found or v_claim.claim_token<>p_claim_token
    or v_claim.quota_receipt_id<>p_quota_receipt_id
    or v_claim.state<>'IN_FLIGHT'
    or v_claim.retry_after<=v_checked_at
    or v_observed is null or v_expires is null
    or v_observed>v_checked_at+interval '2 minutes'
    or v_observed<v_checked_at-interval '10 minutes'
    or v_expires<=v_checked_at
    or v_expires>v_observed+interval '29 days' then
  return false;
 end if;

 perform 1 from public.connector_quota_usage
  where id=p_quota_receipt_id and provider='YOUTUBE_DATA_API'
    and quota_bucket='GENERAL_READ' and method='creatorC14.oneShotPublicActivity'
    and units=2 and response_status is null
  for update;
 if not found then return false; end if;

 insert into public.creator_intelligence_activity_observations (
   channel_id,observed_at,expires_at,subscriber_count,subscribers_hidden,
   public_video_count,recent_public_uploads
 ) values (
   p_channel_id,v_observed,v_expires,v_subscribers,
   (p_record->>'subscribers_hidden')::boolean,v_videos,
   p_record->'recent_public_uploads'
 )
 on conflict(channel_id) do update set
   observed_at=excluded.observed_at,
   expires_at=excluded.expires_at,
   subscriber_count=excluded.subscriber_count,
   subscribers_hidden=excluded.subscribers_hidden,
   public_video_count=excluded.public_video_count,
   recent_public_uploads=excluded.recent_public_uploads;
 get diagnostics v_row_count=row_count;
 if v_row_count<>1 then raise exception 'creator_c27_observation_commit_failed'; end if;

 update public.creator_intelligence_activity_claims set
   state='SUCCEEDED',
   retry_after=least(expires_at,v_checked_at+interval '24 hours'),
   result_status=200
  where channel_id=p_channel_id and claim_token=p_claim_token
    and quota_receipt_id=p_quota_receipt_id and state='IN_FLIGHT';
 get diagnostics v_row_count=row_count;
 if v_row_count<>1 then raise exception 'creator_c27_claim_commit_failed'; end if;

 update public.connector_quota_usage set
   response_status=200,
   metadata=jsonb_build_object('purpose','CINERELAY_C14',
     'state','PRIVATE_TTL_STORED','noSensitiveApiData',true)
  where id=p_quota_receipt_id and provider='YOUTUBE_DATA_API'
    and quota_bucket='GENERAL_READ' and method='creatorC14.oneShotPublicActivity'
    and units=2 and response_status is null;
 get diagnostics v_receipt_count=row_count;
 if v_receipt_count<>1 then raise exception 'creator_c27_receipt_commit_failed'; end if;
 return true;
end;
$fn$;

revoke all on function public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)
 from public,anon,authenticated;
grant execute on function public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)
 to service_role;
comment on function public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb) is
 'C27: service-role-only current C14 lease validated after row lock; C12 observation and quota claim success committed atomically. No monitoring permission.';
commit;
