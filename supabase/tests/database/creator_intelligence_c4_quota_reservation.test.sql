begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select ok(to_regprocedure('public.creator_intelligence_reserve_stats_quota(integer,integer,integer)') is not null,
  'atomic creator stats reservation exists');
select ok(to_regprocedure('public.creator_intelligence_metric_candidates(integer)') is not null,
  'approved creator candidate RPC exists');
select ok(not has_function_privilege('anon',
  'public.creator_intelligence_reserve_stats_quota(integer,integer,integer)','EXECUTE'),
  'anon cannot reserve YouTube quota');
select ok(not has_function_privilege('authenticated',
  'public.creator_intelligence_reserve_stats_quota(integer,integer,integer)','EXECUTE'),
  'authenticated users cannot reserve quota');
select ok(not has_function_privilege('authenticated',
  'public.creator_intelligence_metric_candidates(integer)','EXECUTE'),
  'authenticated users cannot directly enumerate creator candidates');
select ok(has_function_privilege('service_role',
  'public.creator_intelligence_reserve_stats_quota(integer,integer,integer)','EXECUTE'),
  'service worker may reserve public video-stat requests');

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values
('c4400000-0000-4000-8000-000000000001','authenticated','authenticated','c4-active@example.com','',now(),now()),
('c4400000-0000-4000-8000-000000000002','authenticated','authenticated','c4-inactive@example.com','',now(),now());
insert into public.operator_users(user_id,display_name,active)
values
('c4400000-0000-4000-8000-000000000001','C4 active operator',true),
('c4400000-0000-4000-8000-000000000002','C4 inactive operator',false);

insert into public.creator_intelligence_channels(
 channel_id,canonical_title,language_code,niche,verified_at,
 review_state,approved_by,approved_at,monitoring_enabled)
values
('UCaaaaaaaaaaaaaaaaaaaaaa','C4 approved channel','te','Gaming',now(),
 'APPROVED','c4400000-0000-4000-8000-000000000001',now(),true),
('UCbbbbbbbbbbbbbbbbbbbbbb','C4 inactive operator','kn','Travel',now(),
 'APPROVED','c4400000-0000-4000-8000-000000000002',now(),true);
insert into public.creator_intelligence_channels(
 channel_id,canonical_title,language_code,niche,verified_at
) values('UCcccccccccccccccccccccc','C4 unreviewed','mr','Food',now());

insert into public.creator_intelligence_videos(video_id,channel_id,published_at)
values
('aaaaaaaaaaa','UCaaaaaaaaaaaaaaaaaaaaaa',now()-interval '2 hours'),
('bbbbbbbbbbb','UCbbbbbbbbbbbbbbbbbbbbbb',now()-interval '2 hours'),
('ccccccccccc','UCcccccccccccccccccccccc',now()-interval '2 hours');

select is((select count(*) from public.creator_intelligence_metric_candidates(500)),1::bigint,
  'only active-operator-approved channel is enumerated');
select results_eq(
 $$select video_id from public.creator_intelligence_metric_candidates(500)$$,
 array['aaaaaaaaaaa'::text],
 'known unapproved and inactive-operator video excluded');
select is((select last_observed_at from public.creator_intelligence_metric_candidates(500)),null::timestamptz,
  'new video without prior samples has NULL last observation');

select lives_ok(
 $$insert into public.creator_intelligence_metric_samples(
 video_id,observed_at,view_count,expires_at
 ) values('aaaaaaaaaaa',now()-interval '5 minutes',1200,now()+interval '29 days')$$,
 'sample fixture allowed on actively approved creator');
select ok((select last_observed_at is not null from public.creator_intelligence_metric_candidates(500)),
  'candidate RPC sees true most recent observation');
update public.operator_users set active=false where user_id='c4400000-0000-4000-8000-000000000001';
select is((select count(*) from public.creator_intelligence_metric_candidates(500)),0::bigint,
  'revoked operator blocks creator metric candidates immediately');
update public.operator_users set active=true where user_id='c4400000-0000-4000-8000-000000000001';
update public.creator_intelligence_channels set monitoring_enabled=false where channel_id='UCaaaaaaaaaaaaaaaaaaaaaa';
select is((select count(*) from public.creator_intelligence_metric_candidates(500)),0::bigint,
  'switching off monitoring excludes video immediately');
update public.creator_intelligence_channels set monitoring_enabled=true,
metadata_refreshed_at=now()-interval '31 days' where channel_id='UCaaaaaaaaaaaaaaaaaaaaaa';
select is((select count(*) from public.creator_intelligence_metric_candidates(500)),0::bigint,
  'stale 30-day channel public metadata excludes video');

select throws_ok(
 $$select public.creator_intelligence_reserve_stats_quota(10001,100,1)$$,
 'P0001','invalid_creator_metrics_quota_parameters',
 'caller cannot claim higher than default 10K verified cap');
select throws_ok(
 $$select public.creator_intelligence_reserve_stats_quota(10000,100,51)$$,
 'P0001','invalid_creator_metrics_quota_parameters',
 'single reservation cannot exceed 50 IDs');
select ok(public.creator_intelligence_reserve_stats_quota(2,1,2) is not null,
  'first request reserves one unit before provider call');
select is(public.creator_intelligence_reserve_stats_quota(2,1,2),null::bigint,
  'second request cannot spend protected remaining unit');
select is((select count(*) from public.connector_quota_usage
  where provider='YOUTUBE_DATA_API' and quota_bucket='VIDEO_BATCH_STATS'
    and method='videos.batchGetStats'
    and metadata->>'state'='RESERVED_BEFORE_REQUEST'),1::bigint,
  'reservation creates durable ledger entry even without HTTP response');
select is((select count(*) from public.connector_quota_usage
  where provider='YOUTUBE_DATA_API' and quota_bucket='GENERAL_READ'
    and metadata->>'purpose'='CREATOR_INTELLIGENCE_C4'),0::bigint,
  'creator public stats do not charge cinema general-read quota');

select * from finish();
rollback;
