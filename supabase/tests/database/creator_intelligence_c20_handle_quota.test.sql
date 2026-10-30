begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
select ok(to_regclass('public.creator_intelligence_handle_claims') is not null,
 'C20 private handle-claim table exists');
select ok((select relrowsecurity from pg_class where oid=
 'public.creator_intelligence_handle_claims'::regclass),'C20 claim table RLS enabled');
select ok(not has_table_privilege('anon','public.creator_intelligence_handle_claims','SELECT'),
 'anon cannot inspect handle claims');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_handle_claims','SELECT'),
 'authenticated cannot inspect handle claims');
select ok(not has_function_privilege('authenticated',
 'public.creator_c20_claim_and_reserve_identity(text,integer,integer)','EXECUTE'),
 'ordinary authenticated user cannot charge quota');
select ok(has_function_privilege('service_role',
 'public.creator_c20_claim_and_reserve_identity(text,integer,integer)','EXECUTE'),
 'service role can atomically charge quota');
select throws_ok(
 $$select public.creator_c20_claim_and_reserve_identity('@broken/name',10000,2000)$$,
 'P0001','creator_c20_invalid_claim_or_budget','invalid handle never reserves quota');
select throws_ok(
 $$select public.creator_c20_claim_and_reserve_identity('@synthetic',10000,999)$$,
 'P0001','creator_c20_invalid_claim_or_budget','existing sources receive mandatory quota reserve');

create temporary table c20_claim as select
 public.creator_c20_claim_and_reserve_identity('@Synthetic',10000,2000) result;
select is((select result->>'state' from c20_claim),'CLAIMED',
 'first reviewed synthetic handle gets claim');
select is((select (public.creator_c20_claim_and_reserve_identity('@synthetic',10000,2000))->>'state'),
 'BLOCKED_ACTIVE_OR_COOLDOWN','case-insensitive duplicate cannot spend again');
select is((select count(*) from public.connector_quota_usage
 where method='creatorC20.oneShotIdentity'),1::bigint,
 'single identity lookup reserves only one ledger row');
select is((select units from public.connector_quota_usage
 where method='creatorC20.oneShotIdentity' limit 1),1::numeric,
 'official channels.list forHandle costs one precharged quota unit');
select ok(not public.creator_c20_finalize_identity(
 '@synthetic',gen_random_uuid(),((select result->>'quotaReceiptId' from c20_claim))::bigint,
 true,200),'wrong claim token cannot finalize');
select ok(public.creator_c20_finalize_identity(
 '@synthetic',((select result->>'claimToken' from c20_claim))::uuid,
 ((select result->>'quotaReceiptId' from c20_claim))::bigint,true,200),
 'matching claim token finishes once');
select is((select (public.creator_c20_claim_and_reserve_identity('@synthetic',10000,2000))->>'state'),
 'BLOCKED_ACTIVE_OR_COOLDOWN','successful identity check cools down 24h');
select ok(exists(select 1 from cron.job
 where jobname='cinerelay-c20-handle-claim-ttl'),
 'C20 short-lived handle claims receive hourly TTL purge');
select is((select count(*) from public.creator_intelligence_handle_claims
 where expires_at<=claimed_at+interval '28 days'),1::bigint,
 'identity claim has 28-day maximum expiry');
select * from finish();
rollback;
