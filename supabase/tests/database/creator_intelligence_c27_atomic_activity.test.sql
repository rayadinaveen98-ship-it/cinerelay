begin;
create extension if not exists pgtap with schema extensions;
select plan(27);
select ok(to_regprocedure('public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)') is not null,
 'atomic public observation function exists');
select ok(not has_function_privilege('anon',
 'public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)','EXECUTE'),
 'public API cannot call private audit commit');
select ok(not has_function_privilege('authenticated',
 'public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)','EXECUTE'),
 'ordinary signed-in accounts cannot call private audit commit');
select ok(has_function_privilege('service_role',
 'public.creator_c27_commit_public_activity(text,uuid,bigint,jsonb)','EXECUTE'),
 'service-only code can call private audit commit');

create temporary table c27_claim as select
 public.creator_c14_claim_and_reserve_activity('UCffffffffffffffffffffff',10000,2000) receipt;
create temporary table c27_payload as select jsonb_build_object(
 'channel_id','UCffffffffffffffffffffff',
 'observed_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '28 days',
 'subscriber_count','12345','subscribers_hidden',false,
 'public_video_count','72',
 'recent_public_uploads',jsonb_build_array(jsonb_build_object(
   'videoId','aaaaaaaaaaa','publishedAt','2026-10-29T09:00:00.000Z'))) record;

select is((select receipt->>'state' from c27_claim),'CLAIMED',
 'current channel has precharged two-unit claim');
select ok(not public.creator_c27_commit_public_activity(
 'UCffffffffffffffffffffff',gen_random_uuid(),
 (select (receipt->>'quotaReceiptId')::bigint from c27_claim),
 (select record from c27_payload)),
 'wrong claim token cannot write the observation');
select is((select count(*) from public.creator_intelligence_activity_observations
 where channel_id='UCffffffffffffffffffffff'),0::bigint,
 'wrong-token attempt leaves no observation');
update public.creator_intelligence_activity_claims set claim_token=gen_random_uuid()
 where channel_id='UCffffffffffffffffffffff';
select ok(not public.creator_c27_commit_public_activity(
 'UCffffffffffffffffffffff',
 (select (receipt->>'claimToken')::uuid from c27_claim),
 (select (receipt->>'quotaReceiptId')::bigint from c27_claim),
 (select record from c27_payload)),
 'replaced old token cannot write an observation');
select is((select count(*) from public.creator_intelligence_activity_observations
 where channel_id='UCffffffffffffffffffffff'),0::bigint,
 'replaced token cannot overwrite newer observations');
select is((select count(*) from public.connector_quota_usage
 where method='creatorC14.oneShotPublicActivity' and response_status is not null),
 0::bigint,'stale request does not finalize two-unit receipt');

select ok(public.creator_c27_commit_public_activity(
 'UCffffffffffffffffffffff',
 (select claim_token from public.creator_intelligence_activity_claims
 where channel_id='UCffffffffffffffffffffff'),
 (select quota_receipt_id from public.creator_intelligence_activity_claims
 where channel_id='UCffffffffffffffffffffff'),
 (select record from c27_payload)),
 'current claim atomically persists public activity and finalizes quota');
select is((select subscriber_count::text from public.creator_intelligence_activity_observations
 where channel_id='UCffffffffffffffffffffff'),'12345',
 'stored decimal subscriber observation remains exact');
select is((select state from public.creator_intelligence_activity_claims
 where channel_id='UCffffffffffffffffffffff'),'SUCCEEDED',
 'claim succeeds in same transaction as private record');
select is((select response_status from public.connector_quota_usage
 where method='creatorC14.oneShotPublicActivity' limit 1),200,
 'two-unit quota receipt finalized in same transaction');
select ok(not public.creator_c27_commit_public_activity(
 'UCffffffffffffffffffffff',
 (select claim_token from public.creator_intelligence_activity_claims
 where channel_id='UCffffffffffffffffffffff'),
 (select quota_receipt_id from public.creator_intelligence_activity_claims
 where channel_id='UCffffffffffffffffffffff'),
 (select record from c27_payload)),
 'a completed request cannot replay or overwrite');

create temporary table c27_second as select
 public.creator_c14_claim_and_reserve_activity('UCgggggggggggggggggggggg',10000,2000) receipt;
select is((select receipt->>'state' from c27_second),'CLAIMED',
 'second channel independently precharges quota');
select throws_ok(
 $$select public.creator_c27_commit_public_activity(
  'UCgggggggggggggggggggggg',
  (select (receipt->>'claimToken')::uuid from c27_second),
  (select (receipt->>'quotaReceiptId')::bigint from c27_second),
  (select jsonb_set(jsonb_set(record,'{channel_id}',
   '"UCgggggggggggggggggggggg"'),
   '{monitoring_enabled}','true') from c27_payload))$$,
 'P0001','creator_c27_unexpected_activity_columns',
 'provider payload cannot smuggle monitoring fields into private store');
-- C28: a service-only caller cannot bypass C13's public upload shape validation.
select throws_ok(
 $$select public.creator_c27_commit_public_activity(
  'UCgggggggggggggggggggggg',
  (select (receipt->>'claimToken')::uuid from c27_second),
  (select (receipt->>'quotaReceiptId')::bigint from c27_second),
  jsonb_set(jsonb_set((select record from c27_payload),'{channel_id}', '"UCgggggggggggggggggggggg"'::jsonb),'{recent_public_uploads}','[{"videoId":"not-valid","publishedAt":null}]'::jsonb))$$,
 'P0001','creator_c27_invalid_public_uploads',
 'C28 rejects invalid videoId before storage');
select throws_ok(
 $$select public.creator_c27_commit_public_activity(
  'UCgggggggggggggggggggggg',
  (select (receipt->>'claimToken')::uuid from c27_second),
  (select (receipt->>'quotaReceiptId')::bigint from c27_second),
  jsonb_set(jsonb_set((select record from c27_payload),'{channel_id}', '"UCgggggggggggggggggggggg"'::jsonb),'{recent_public_uploads}','[{"videoId":"aaaaaaaaaaa","publishedAt":null,"privateAnalytics":"FORBIDDEN"}]'::jsonb))$$,
 'P0001','creator_c27_invalid_public_uploads',
 'C28 rejects nested private field before storage');
select throws_ok(
 $$select public.creator_c27_commit_public_activity(
  'UCgggggggggggggggggggggg',
  (select (receipt->>'claimToken')::uuid from c27_second),
  (select (receipt->>'quotaReceiptId')::bigint from c27_second),
  jsonb_set(jsonb_set((select record from c27_payload),'{channel_id}', '"UCgggggggggggggggggggggg"'::jsonb),'{recent_public_uploads}','[{"videoId":"aaaaaaaaaaa","publishedAt":null},{"videoId":"aaaaaaaaaaa","publishedAt":null}]'::jsonb))$$,
 'P0001','creator_c27_invalid_public_uploads',
 'C28 rejects duplicate video IDs before storage');
select throws_ok(
 $$select public.creator_c27_commit_public_activity(
  'UCgggggggggggggggggggggg',
  (select (receipt->>'claimToken')::uuid from c27_second),
  (select (receipt->>'quotaReceiptId')::bigint from c27_second),
  jsonb_set(jsonb_set((select record from c27_payload),'{channel_id}', '"UCgggggggggggggggggggggg"'::jsonb),'{recent_public_uploads}','[{"videoId":"aaaaaaaaaaa","publishedAt":"not-a-date"}]'::jsonb))$$,
 'P0001','creator_c27_invalid_public_uploads',
 'C28 rejects non-UTC malformed publishedAt before storage');
select is((select count(*) from public.creator_intelligence_activity_observations
 where channel_id='UCgggggggggggggggggggggg'),0::bigint,
 'C28 rejected uploads did not write private activity');
select is((select response_status from public.connector_quota_usage
 where id=(select (receipt->>'quotaReceiptId')::bigint from c27_second)),
 null::integer,'C28 rejected uploads did not finalize quota');

update public.creator_intelligence_activity_claims
 set retry_after=clock_timestamp()-interval '1 second'
 where channel_id='UCgggggggggggggggggggggg';
select ok(not public.creator_c27_commit_public_activity(
 'UCgggggggggggggggggggggg',
 (select (receipt->>'claimToken')::uuid from c27_second),
 (select (receipt->>'quotaReceiptId')::bigint from c27_second),
 (select jsonb_set((select record from c27_payload),'{channel_id}',
  '"UCgggggggggggggggggggggg"'))),
 'expired in-flight claim is rejected before any storage');
select is((select count(*) from public.creator_intelligence_activity_observations
 where channel_id='UCgggggggggggggggggggggg'),0::bigint,
 'expired claim leaves no private row');
select is((select response_status from public.connector_quota_usage
 where id=(select (receipt->>'quotaReceiptId')::bigint from c27_second)),
 null::integer,'expired claim cannot finalize quota receipt');
select ok((select count(*) from public.creator_intelligence_activity_observations
 where channel_id in ('UCffffffffffffffffffffff','UCgggggggggggggggggggggg')
 and expires_at<=observed_at+interval '29 days')=1,
 'stored observations remain under the C12 29-day retention cap');
select * from finish();
rollback;
