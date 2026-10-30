begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select ok(to_regprocedure('public.creator_c13_reserve_public_activity_quota(integer,integer)') is not null,
 'C13 atomic quota reservation RPC exists');
select ok(not has_function_privilege('anon',
 'public.creator_c13_reserve_public_activity_quota(integer,integer)','EXECUTE'),
 'anon cannot reserve provider quota');
select ok(not has_function_privilege('authenticated',
 'public.creator_c13_reserve_public_activity_quota(integer,integer)','EXECUTE'),
 'authenticated cannot reserve provider quota');
select ok(has_function_privilege('service_role',
 'public.creator_c13_reserve_public_activity_quota(integer,integer)','EXECUTE'),
 'service_role can reserve quota');

select throws_ok(
 $$select public.creator_c13_reserve_public_activity_quota(10000,999)$$,
 'P0001','creator_c13_quota_configuration_invalid',
 'must reserve at least 1000 general-read units for existing app');
select throws_ok(
 $$select public.creator_c13_reserve_public_activity_quota(10001,1500)$$,
 'P0001','creator_c13_quota_configuration_invalid',
 'unverified over-10000 daily budget fails closed');
select throws_ok(
 $$select public.creator_c13_reserve_public_activity_quota(10000,10000)$$,
 'P0001','creator_c13_quota_configuration_invalid',
 'reserve may not consume all quota');

select ok(public.creator_c13_reserve_public_activity_quota(10000,2000) is not null,
 'one two-call reservation is inserted before any provider request');
select is((select count(*) from public.connector_quota_usage
 where method='creatorC13.oneShotPublicActivity'),1::bigint,
 'one request pair produces one quota ledger row');
select is((select units from public.connector_quota_usage
 where method='creatorC13.oneShotPublicActivity' limit 1),2::numeric,
 'the full two-unit budget is charged before calls');
select ok(public.creator_c13_reserve_public_activity_quota(2000,1999) is null,
 'no reserve possible when headroom is smaller than a two-call pair');

select * from finish();
rollback;
