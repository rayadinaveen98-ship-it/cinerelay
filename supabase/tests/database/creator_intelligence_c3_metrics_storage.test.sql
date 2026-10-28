begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values ('c3300000-0000-4000-8000-000000000001','authenticated','authenticated','c3-operator@example.com','',now(),now());
insert into public.operator_users(user_id,display_name,active)
values ('c3300000-0000-4000-8000-000000000001','Creator C3 operator fixture',true);

select ok(to_regclass('public.creator_intelligence_channels') is not null, 'creator channel registry exists');
select ok(to_regclass('public.creator_intelligence_videos') is not null, 'creator video registry exists');
select ok(to_regclass('public.creator_intelligence_metric_samples') is not null, 'creator metric storage exists');
select ok((select relrowsecurity from pg_class where oid='public.creator_intelligence_channels'::regclass),'RLS channels');
select ok((select relrowsecurity from pg_class where oid='public.creator_intelligence_videos'::regclass),'RLS videos');
select ok((select relrowsecurity from pg_class where oid='public.creator_intelligence_metric_samples'::regclass),'RLS metrics');
select ok(not has_table_privilege('anon','public.creator_intelligence_channels','SELECT'),'no anon channel data');
select ok(not has_table_privilege('anon','public.creator_intelligence_videos','SELECT'),'no anon video data');
select ok(not has_table_privilege('anon','public.creator_intelligence_metric_samples','SELECT'),'no anon metrics');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_channels','SELECT'),'no direct authenticated channel data');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_videos','SELECT'),'no direct authenticated video data');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_metric_samples','SELECT'),'no direct authenticated metrics');
select ok(not has_function_privilege('authenticated','public.creator_intelligence_purge_expired(timestamptz)','EXECUTE'),'no public purge');
select ok(exists(select 1 from cron.job where jobname='cinerelay-creator-metric-retention-30d'),'daily purge cron exists');

insert into public.creator_intelligence_channels
(channel_id,canonical_title,language_code,niche,verified_at,review_state,approved_by,approved_at,monitoring_enabled)
values ('UCaaaaaaaaaaaaaaaaaaaaaa','Approved Test Creator','te','Education',now(),'APPROVED',
'c3300000-0000-4000-8000-000000000001',now(),true);
insert into public.creator_intelligence_channels
(channel_id,canonical_title,language_code,niche,verified_at)
values ('UCbbbbbbbbbbbbbbbbbbbbbb','Unreviewed Test Creator','kn','Gaming',now());

select is((select count(*) from public.creator_intelligence_channels where monitoring_enabled),1::bigint,'only approved channel enabled');
select throws_ok(
 $$update public.creator_intelligence_channels set monitoring_enabled=true where channel_id='UCbbbbbbbbbbbbbbbbbbbbbb'$$,
 '23514',null,'no implicit approval');

insert into public.creator_intelligence_videos(video_id,channel_id,published_at,content_format)
values ('aaaaaaaaaaa','UCaaaaaaaaaaaaaaaaaaaaaa',now()-interval '2 hours','LONG'),
('bbbbbbbbbbb','UCbbbbbbbbbbbbbbbbbbbbbb',now()-interval '2 hours','SHORT');

select lives_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('aaaaaaaaaaa',now()-interval '20 minutes',1000,now()+interval '29 days')$$,
 'approved channel supports a prospective public view snapshot');
select is((select count(*) from public.creator_intelligence_metric_samples where like_count is null and comment_count is null),1::bigint,
 'unavailable likes/comments are NULL');
select throws_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('bbbbbbbbbbb',now(),200,now()+interval '29 days')$$,
 'P0001','creator_metric_channel_not_operator_approved','unreviewed channel metrics prohibited');
select throws_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('aaaaaaaaaaa',now()+interval '1 hour',200,now()+interval '30 days')$$,
 'P0001','creator_metric_observed_at_out_of_range','future observations prohibited');
select throws_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('aaaaaaaaaaa',now()-interval '3 hours',200,now()+interval '29 days')$$,
 'P0001','creator_metric_observed_at_out_of_range','observation cannot predate video');
select throws_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('aaaaaaaaaaa',now()-interval '2 minutes',200,now()+interval '31 days')$$,
 'P0001','creator_metric_retention_out_of_range','snapshot cannot exceed 30-day retention');
select throws_ok(
 $$insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,expires_at)
 values ('aaaaaaaaaaa',now()-interval '2 minutes',null,now()+interval '29 days')$$,
 '23514',null,'missing all counters does not fabricate a sample');

select lives_ok(
 $$select public.creator_intelligence_purge_expired(now()+interval '40 days')$$,
 'service-only purge works under a simulated future date');
select is((select count(*) from public.creator_intelligence_metric_samples),0::bigint,'expired samples deleted');
select is((select count(*) from public.creator_intelligence_videos),0::bigint,'old video metadata deleted');
select * from finish();
rollback;
