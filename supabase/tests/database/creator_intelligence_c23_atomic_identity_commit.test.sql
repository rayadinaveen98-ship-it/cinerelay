-- C23: real SQL transactional-claim evidence, all data synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(to_regprocedure('public.creator_c23_commit_verified_identity(text,uuid,bigint,jsonb)') is not null,
 'atomic C23 identity-and-claim commit is installed');
select ok(not has_function_privilege('anon',
 'public.creator_c23_commit_verified_identity(text,uuid,bigint,jsonb)','EXECUTE'),
 'anonymous clients cannot invoke the identity commit');
select ok(not has_function_privilege('authenticated',
 'public.creator_c23_commit_verified_identity(text,uuid,bigint,jsonb)','EXECUTE'),
 'normal signed-in users cannot invoke the identity commit');
select ok(has_function_privilege('service_role',
 'public.creator_c23_commit_verified_identity(text,uuid,bigint,jsonb)','EXECUTE'),
 'only service-role caller can invoke the identity commit');

create temporary table c23_test_record as select jsonb_build_object(
 'channel_id','UCdddddddddddddddddddddd',
 'listed_name','C23 Synthetic Creator',
 'listed_handle','@c23-stale',
 'official_channel_title','C23 official synthetic',
 'uploads_playlist_id','UUdddddddddddddddddddddd',
 'locale','te','category_provisional','Education',
 'size_tier_provisional','NANO_LT10K',
 'source_url','https://example.org/c23-offline',
 'observed_at',now(),'expires_at',now()+interval '27 days',
 'review_state','REVIEW_PENDING',
 'monitoring_enabled',false,'metrics_enabled',false
) as record;

create temporary table c23_claim as select
 public.creator_c20_claim_and_reserve_identity('@c23-stale',10000,2000) as payload;
select is((select payload->>'state' from c23_claim),'CLAIMED',
 'current test creator received one precharged claim');

select ok(not public.creator_c23_commit_verified_identity(
 '@c23-stale',gen_random_uuid(),
 (select (payload->>'quotaReceiptId')::bigint from c23_claim),
 (select record from c23_test_record)),
 'wrong token cannot commit identity');
select is((select count(*) from public.creator_intelligence_identity_evidence
 where channel_id='UCdddddddddddddddddddddd'),0::bigint,
 'wrong-token attempt leaves no private identity record');

-- Force a newer claim token, simulating a slow, expired provider response.
update public.creator_intelligence_handle_claims
 set claim_token=gen_random_uuid()
 where handle_key='@c23-stale';
select ok(not public.creator_c23_commit_verified_identity(
 '@c23-stale',
 (select (payload->>'claimToken')::uuid from c23_claim),
 (select (payload->>'quotaReceiptId')::bigint from c23_claim),
 (select record from c23_test_record)),
 'stale response cannot overwrite the newer token');

select is((select count(*) from public.creator_intelligence_identity_evidence
 where channel_id='UCdddddddddddddddddddddd'),0::bigint,
 'stale token never writes an API identity');
select is((select count(*) from public.connector_quota_usage
 where method='creatorC20.oneShotIdentity' and response_status is not null),
 0::bigint,'stale response never finalizes or refunds reserved quota');

-- The new claim token may safely commit once. Both identity and receipt change.
select ok(public.creator_c23_commit_verified_identity(
 '@c23-stale',
 (select claim_token from public.creator_intelligence_handle_claims
  where handle_key='@c23-stale'),
 (select quota_receipt_id from public.creator_intelligence_handle_claims
  where handle_key='@c23-stale'),
 (select record from c23_test_record)),
 'fresh current token commits identity plus receipt atomically');
select is((select review_state from public.creator_intelligence_identity_evidence
 where channel_id='UCdddddddddddddddddddddd'),
 'REVIEW_PENDING','identity remains review-only after successful verification');
select is((select response_status from public.connector_quota_usage
 where method='creatorC20.oneShotIdentity' limit 1),200,
 'precharged quota receipt finalized in same transaction');
select is((select state from public.creator_intelligence_handle_claims
 where handle_key='@c23-stale'),'SUCCEEDED',
 'claim marked successful in same transaction');
select ok(not public.creator_c23_commit_verified_identity(
 '@c23-stale',
 (select claim_token from public.creator_intelligence_handle_claims
  where handle_key='@c23-stale'),
 (select quota_receipt_id from public.creator_intelligence_handle_claims
  where handle_key='@c23-stale'),
 (select record from c23_test_record)),
 'replay cannot commit after first success');

create temporary table c23_second_claim as select
 public.creator_c20_claim_and_reserve_identity('@c23-policy',10000,2000) as payload;
-- A second synthetic record with a forged monitoring-enabled field is prohibited.
select throws_ok(
 $$select public.creator_c23_commit_verified_identity(
    '@c23-policy',
    (select (payload->>'claimToken')::uuid from c23_second_claim),
    (select (payload->>'quotaReceiptId')::bigint from c23_second_claim),
    (select jsonb_set(jsonb_set(record,'{listed_handle}','"@c23-policy"'),
      '{monitoring_enabled}','true') from c23_test_record))$$,
 'P0001','creator_c23_handle_or_review_mismatch',
 'commit refuses to smuggle monitoring activation into review record');
select is((select count(*) from public.creator_intelligence_handle_claims
 where handle_key='@c23-policy' and state='IN_FLIGHT'),1::bigint,
 'failed policy validation leaves second claim available for fail-finalize');
select is((select count(*) from public.creator_intelligence_identity_evidence
 where channel_id='UCdddddddddddddddddddddd' and monitoring_enabled),
 0::bigint,'no monitoring data is introduced by the failed write');
select * from finish();
rollback;
