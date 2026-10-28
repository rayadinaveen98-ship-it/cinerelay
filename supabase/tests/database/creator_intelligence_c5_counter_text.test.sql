begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
select ok(to_regclass('public.creator_intelligence_counter_text') is not null,'exact-counter view exists');
select ok(not has_table_privilege('anon','public.creator_intelligence_counter_text','SELECT'),'anon cannot read counter view');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_counter_text','SELECT'),'authenticated cannot directly read counter view');
select ok(has_table_privilege('service_role','public.creator_intelligence_counter_text','SELECT'),'service can read counter view');
select is((select reloptions @> array['security_invoker=true']::text[]
           from pg_class where oid='public.creator_intelligence_counter_text'::regclass),
  true,'view honors invoker RLS privileges');

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values('c5500000-0000-4000-8000-000000000001','authenticated','authenticated','c5-view-test@example.com','',now(),now());
insert into public.operator_users(user_id,display_name,active)
values('c5500000-0000-4000-8000-000000000001','C5 View fixture',true);
insert into public.creator_intelligence_channels(
  channel_id,canonical_title,language_code,niche,verified_at,
  review_state,approved_by,approved_at,monitoring_enabled
) values (
  'UCdddddddddddddddddddddd','C5 Exact Counter fixture','te','Education',now(),
  'APPROVED','c5500000-0000-4000-8000-000000000001',now(),true
);
insert into public.creator_intelligence_videos(video_id,channel_id,published_at)
values('ddddddddddd','UCdddddddddddddddddddddd',now()-interval '2 hours');
insert into public.creator_intelligence_metric_samples(video_id,observed_at,view_count,like_count,comment_count,expires_at)
values('ddddddddddd',now()-interval '2 minutes',18446744073709551615,null,0,now()+interval '29 days');
select results_eq(
 $$select view_count from public.creator_intelligence_counter_text where video_id='ddddddddddd'$$,
 array['18446744073709551615'::text],'64-bit public counters emitted as exact decimal strings');
select results_eq(
 $$select comment_count from public.creator_intelligence_counter_text where video_id='ddddddddddd'$$,
 array['0'::text],'true reported zero comments preserved as 0 text');
select results_eq(
 $$select like_count from public.creator_intelligence_counter_text where video_id='ddddddddddd'$$,
 array[null::text],'hidden public likes remain NULL, not 0');
select is((select count(*) from public.creator_intelligence_counter_text where video_id='ddddddddddd'),1::bigint,
 'current unexpired sample visible to operator service');
select * from finish();
rollback;
