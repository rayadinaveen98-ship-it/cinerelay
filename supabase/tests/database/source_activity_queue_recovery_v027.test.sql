begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select is(
  (select count(*)::integer from cron.job where jobname='cinerelay-source-activity-expiry' and active),
  1,
  'bounded expiry cron is active'
);
select is(
  (select count(*)::integer from cron.job where jobname='cinerelay-source-maintenance-refresh' and active),
  1,
  'source-health findings refresh cron is active'
);

insert into auth.users (id,aud,role,email,encrypted_password,created_at,updated_at)
values
('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','v027-no-device@example.com','',now(),now()),
('e1000000-0000-4000-8000-000000000002','authenticated','authenticated','v027-active-device@example.com','',now(),now());

insert into public.sources (id,display_name,authority_tier,source_role,active)
values ('e2000000-0000-4000-8000-000000000001','V027 official test source',1,'PRODUCTION_HOUSE',true);

insert into public.source_identities
(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values
('e2100000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',
 'YOUTUBE','UC0000000000000000000027','https://www.youtube.com/channel/UC0000000000000000000027',
 'YOUTUBE_WEBSUB','PUSH','WEBHOOK',true);

insert into public.raw_items
(id,source_identity_id,platform_item_id,canonical_url,item_type,raw_title,
 raw_text,normalized_text,metadata,content_fingerprint)
select
format('e3000000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,
'e2100000-0000-4000-8000-000000000001'::uuid,
'v027-video-'||i::text,
'https://www.youtube.com/watch?v=v027-'||i::text,
'YOUTUBE_VIDEO','V027 test video '||i::text,
'Test video','test video','{}'::jsonb,
md5(i::text)||md5(i::text)
from generate_series(1,107) g(i);

insert into public.source_activity_deliveries
(id,user_id,raw_item_id,source_identity_id,dedupe_key,status,scheduled_for,created_at)
select
format('e4000000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,
case when i<=105 then 'e1000000-0000-4000-8000-000000000001'::uuid
else 'e1000000-0000-4000-8000-000000000002'::uuid end,
format('e3000000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,
'e2100000-0000-4000-8000-000000000001'::uuid,
'v027-delivery-'||i::text,
'PENDING',
case when i=107 then now()-interval '26 hours'
when i=106 then now()-interval '3 minutes'
else now()-interval '5 minutes' end,
case when i=107 then now()-interval '26 hours'
when i=106 then now()-interval '3 minutes'
else now()-interval '5 minutes' end
from generate_series(1,107) g(i);

select public.upsert_push_device_registration(
  'e1000000-0000-4000-8000-000000000002',
  'FCM','TOKEN','v027-test-device-token-for-active-user-12345678','ANDROID',
  'v027-device-install','cinerelay.android'
);

select is(
  public.materialize_due_source_activity_targets(100), 1,
  'device-first LIMIT skips oldest 105 ineligible deliveries and materializes the newer eligible one'
);
select is(
  (select count(*)::integer from public.source_activity_delivery_targets t
   join public.source_activity_deliveries d on d.id=t.source_activity_delivery_id
   where d.user_id='e1000000-0000-4000-8000-000000000002'::uuid),
  1,
  'only the active-device user receives a fresh target'
);
select is(
  (select count(*)::integer from public.source_activity_delivery_targets t
   join public.source_activity_deliveries d on d.id=t.source_activity_delivery_id
   where d.user_id='e1000000-0000-4000-8000-000000000001'::uuid),
  0,
  'inactive-device user cannot take delivery slots'
);
select is(public.materialize_due_source_activity_targets(100),0,
  'repeat materialization is idempotent and skips already materialized targets');
select is(
  (select count(*)::integer from public.source_activity_delivery_targets
   where source_activity_delivery_id='e4000000-0000-4000-8000-000000000107'::uuid),
  0,'old delivery is never turned into a new push target'
);
select is(public.expire_stale_source_activity_deliveries(500),1,
  'TTL cleanup suppresses old notification but leaves its evidence row');
select is(
  (select status from public.source_activity_deliveries
   where id='e4000000-0000-4000-8000-000000000107'::uuid),
  'SUPPRESSED','stale notification is suppressed instead of sent');
select ok(
  not has_function_privilege('authenticated','public.expire_stale_source_activity_deliveries(integer)','EXECUTE'),
  'expiry RPC cannot be invoked by mobile-authenticated users'
);
select ok(
  not has_function_privilege('authenticated','public.materialize_due_source_activity_targets(integer)','EXECUTE'),
  'materialization remains service-only'
);

select * from finish();
rollback;
