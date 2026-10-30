begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
select ok(to_regclass('public.creator_intelligence_identity_evidence') is not null,
 'private official identity evidence table exists');
select ok((select relrowsecurity from pg_class
 where oid='public.creator_intelligence_identity_evidence'::regclass),
 'identity evidence has RLS');
select ok(not has_table_privilege('anon','public.creator_intelligence_identity_evidence','SELECT'),
 'anon cannot view private identities');
select ok(not has_table_privilege('authenticated','public.creator_intelligence_identity_evidence','SELECT'),
 'authenticated cannot bypass operator API to inspect identities');
select ok(has_table_privilege('service_role','public.creator_intelligence_identity_evidence','SELECT'),
 'service role can fetch private official identities');
select ok(exists(select 1 from cron.job
 where jobname='cinerelay-c19-identity-evidence-ttl'),
 'identity evidence hourly expiry job installed');
select lives_ok(
 $$insert into public.creator_intelligence_identity_evidence
 (channel_id,listed_name,listed_handle,official_channel_title,uploads_playlist_id,
  locale,category_provisional,size_tier_provisional,source_url,observed_at,expires_at)
 values
 ('UCaaaaaaaaaaaaaaaaaaaaaa','Synthetic','@synthetic','Synthetic official',
  'UUaaaaaaaaaaaaaaaaaaaaaa','te','Education','MICRO_10K_100K',
  'https://example.org/research',now(),now()+interval '27 days')$$,
 'synthetic unapproved identity can be held for at most 28 days');
select is((select count(*) from public.creator_intelligence_identity_evidence),1::bigint,
 'one synthetic private identity is stored');
select throws_ok(
 $$insert into public.creator_intelligence_identity_evidence
 (channel_id,listed_name,listed_handle,official_channel_title,uploads_playlist_id,
  locale,category_provisional,size_tier_provisional,source_url,observed_at,expires_at)
 values
 ('UCbbbbbbbbbbbbbbbbbbbbbb','Synthetic B','@syntheticb','Synthetic B',
  'UUbbbbbbbbbbbbbbbbbbbbbb','te','Education','MICRO_10K_100K',
  'https://example.org/b',now(),now()+interval '30 days')$$,
 '23514',null,'30-day identity storage exceeds the 28-day hard cap');
select throws_ok(
 $$insert into public.creator_intelligence_identity_evidence
 (channel_id,listed_name,listed_handle,official_channel_title,uploads_playlist_id,
  locale,category_provisional,size_tier_provisional,source_url,observed_at,expires_at,
  monitoring_enabled)
 values
 ('UCcccccccccccccccccccccc','Synthetic C','@syntheticc','Synthetic C',
  'UUcccccccccccccccccccccc','te','Education','MICRO_10K_100K',
  'https://example.org/c',now(),now()+interval '27 days',true)$$,
 'P0001','creator_c19_review_only','identity evidence can never authorize monitoring');
select lives_ok(
 'delete from public.creator_intelligence_identity_evidence where expires_at <= now()+interval ''28 days''',
 'retention job can remove expired identity evidence');
select is((select count(*) from public.creator_intelligence_identity_evidence),0::bigint,
 'private identity evidence is deleted after expiry');
select * from finish();
rollback;
