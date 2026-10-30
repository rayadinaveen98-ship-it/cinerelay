-- C12 DB tests: executed only against ephemeral CI database (ROLLBACK).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(to_regclass('public.creator_intelligence_activity_observations') is not null,'C12 private activity table exists');
select ok(to_regclass('public.creator_intelligence_activity_text') is not null,'C12 exact-counter invoker view exists');
select ok((select relrowsecurity from pg_class where oid='public.creator_intelligence_activity_observations'::regclass),'activity table RLS enabled');
select ok(not has_table_privilege('anon','public.creator_intelligence_activity_observations','SELECT'),'anon cannot query activity');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_activity_observations','SELECT'),'authenticated cannot directly query activity');
select ok(not has_table_privilege('anon','public.creator_intelligence_activity_text','SELECT'),'anon cannot query activity text view');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_activity_text','SELECT'),'authenticated cannot query activity text view');
select ok(has_table_privilege('service_role','public.creator_intelligence_activity_text','SELECT'),'service role can query exact public counts');
select ok(exists(select 1 from cron.job where jobname='cinerelay-c12-public-activity-ttl'),'hourly activity TTL job installed');

select lives_ok(
 $$insert into public.creator_intelligence_activity_observations
   (channel_id,observed_at,expires_at,subscriber_count,subscribers_hidden,public_video_count,recent_public_uploads)
   values ('UCaaaaaaaaaaaaaaaaaaaaaa',now(),now()+interval '28 days',7040,false,81,
   '[{"videoId":"aaaaaaaaaaa","publishedAt":"2026-10-29T12:00:00.000Z"}]'::jsonb)$$,
 'bounded fresh public evidence may be written by a privileged source');
select is((select count(*) from public.creator_intelligence_activity_text),1::bigint,
 'service-only exact-counter view represents the fresh record');
select throws_ok(
 $$insert into public.creator_intelligence_activity_observations
  (channel_id,observed_at,expires_at,subscriber_count,subscribers_hidden)
  values ('UCbbbbbbbbbbbbbbbbbbbbbb',now(),now()+interval '30 days',100,false)$$,
 'P0001','creator_c12_invalid_retention','30 day expiry is disallowed to allow hourly deletion before day 30');
select throws_ok(
 $$insert into public.creator_intelligence_activity_observations
  (channel_id,observed_at,expires_at,subscriber_count,subscribers_hidden)
  values ('UCcccccccccccccccccccccc',now(),now()+interval '10 days',100,true)$$,
 '23514',null,'hidden subscriber counts must not be persisted');
select lives_ok(
 $delete from public.creator_intelligence_activity_observations
 where expires_at <= now()+interval '29 days'$,
 'retention DELETE removes expired public evidence');
select is((select count(*) from public.creator_intelligence_activity_observations),0::bigint,'expired private public evidence is absent');

select * from finish();
rollback;
