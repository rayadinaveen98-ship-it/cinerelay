begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select ok(to_regclass('public.creator_intelligence_activity_claims') is not null,
 'private claim table exists');
select ok((select relrowsecurity from pg_class where oid=
 'public.creator_intelligence_activity_claims'::regclass),
 'claim table has RLS enabled');
select ok(not has_table_privilege('anon','public.creator_intelligence_activity_claims','SELECT'),
 'anon cannot inspect channel claims');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_activity_claims','SELECT'),
 'regular authenticated users cannot inspect claims');
select ok(not has_function_privilege('authenticated',
 'public.creator_c14_claim_and_reserve_activity(text,integer,integer)','EXECUTE'),
 'regular authenticated users cannot claim a channel');
select ok(has_function_privilege('service_role',
 'public.creator_c14_claim_and_reserve_activity(text,integer,integer)','EXECUTE'),
 'service role can atomically claim and reserve');
select throws_ok(
 $$select public.creator_c14_claim_and_reserve_activity('UCinvalid',10000,1000)$$,
 'P0001','creator_c14_invalid_claim_or_quota_config',
 'invalid target stable channel ID cannot reserve quota');

create temporary table c14_claim_test as
 select public.creator_c14_claim_and_reserve_activity(
  'UCaaaaaaaaaaaaaaaaaaaaaa',10000,2000) as result;
select is((select result->>'state' from c14_claim_test),
 'CLAIMED','first valid claim is admitted');
select is((select result->>'state' from (
 select public.creator_c14_claim_and_reserve_activity(
  'UCaaaaaaaaaaaaaaaaaaaaaa',10000,2000) as result
 ) second),
 'BLOCKED_ACTIVE_OR_COOLDOWN','immediate duplicate cannot reserve quota twice');
select is((select count(*) from public.connector_quota_usage
 where method='creatorC14.oneShotPublicActivity'),1::bigint,
 'double submission yields one persisted quota receipt');
select is((select units from public.connector_quota_usage
 where method='creatorC14.oneShotPublicActivity' limit 1),2::numeric,
 'two read units are reserved before provider calls');

select ok(not public.creator_c14_finalize_activity_claim(
 'UCaaaaaaaaaaaaaaaaaaaaaa',gen_random_uuid(),
 ((select result->>'quotaReceiptId' from c14_claim_test))::bigint,
 true,200),'a stolen or unrelated claim token cannot finalize');

select ok(public.creator_c14_finalize_activity_claim(
 'UCaaaaaaaaaaaaaaaaaaaaaa',
 ((select result->>'claimToken' from c14_claim_test))::uuid,
 ((select result->>'quotaReceiptId' from c14_claim_test))::bigint,
 true,200),'legitimate claim completes after private storage');
select is((select result->>'state' from (
 select public.creator_c14_claim_and_reserve_activity(
  'UCaaaaaaaaaaaaaaaaaaaaaa',10000,2000) as result
 ) again),
 'BLOCKED_ACTIVE_OR_COOLDOWN','successful claim cannot be re-audited for 24 hours');
select is((select response_status from public.connector_quota_usage
 where method='creatorC14.oneShotPublicActivity' limit 1),200,
 'quota audit finalized with non-sensitive provider result');
select ok(exists(select 1 from cron.job
 where jobname='cinerelay-c14-activity-claim-ttl'),
 'short-lived C14 claim purging is scheduled');
select is((select count(*) from public.creator_intelligence_activity_claims
 where expires_at<=claimed_at+interval '28 days'),1::bigint,
 'channel claim itself is TTL bounded to 28 days');

select * from finish();
rollback;
