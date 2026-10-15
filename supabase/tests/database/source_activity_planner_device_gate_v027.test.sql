begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values
('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','v027-no-device@example.com','',now(),now()),
('f1000000-0000-4000-8000-000000000002','authenticated','authenticated','v027-active@example.com','',now(),now());

insert into public.sources(id,display_name,authority_tier,source_role,active)
values ('f2000000-0000-4000-8000-000000000001','V027 Planner Studio',1,'PRODUCTION_HOUSE',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values ('f2100000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
'YOUTUBE','UC0000000000000000000200','https://www.youtube.com/channel/UC0000000000000000000200',
'YOUTUBE_WEBSUB','PUSH','WEBHOOK',true);
insert into public.raw_items(id,source_identity_id,platform_item_id,canonical_url,item_type,raw_title,raw_text,normalized_text,metadata,content_fingerprint)
values ('f3000000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000001',
'v027-planner','https://www.youtube.com/watch?v=v027-planner','YOUTUBE_VIDEO',
'Official trailer','Official update','official trailer','{}'::jsonb,repeat('f',64));

insert into public.user_source_activity_preferences(user_id,enabled,include_videos,include_shorts,official_youtube_only,activated_at) values
('f1000000-0000-4000-8000-000000000001',true,true,false,true,now()-interval '1 hour'),
('f1000000-0000-4000-8000-000000000002',true,true,false,true,now()-interval '1 hour');
insert into public.user_source_activity_subscriptions(user_id,source_identity_id,enabled,include_videos,include_shorts,activated_at) values
('f1000000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000001',true,true,false,now()-interval '1 hour'),
('f1000000-0000-4000-8000-000000000002','f2100000-0000-4000-8000-000000000001',true,true,false,now()-interval '1 hour');

select is(public.plan_due_source_activity_notifications(200),0,'no active device means no new planned notifications');
select public.upsert_push_device_registration('f1000000-0000-4000-8000-000000000002',
'FCM','TOKEN','v027-planner-test-token-abcdefghijklmnopqrstuvwxyz','ANDROID','v027-planner-install','cinerelay.android');
select is(public.plan_due_source_activity_notifications(200),1,'active device allows exactly one new notification');
select is((select count(*)::integer from public.source_activity_deliveries where user_id='f1000000-0000-4000-8000-000000000001'::uuid),0,'no-device user receives no orphan delivery');
select is(public.plan_due_source_activity_notifications(200),0,'planning stays idempotent');
select * from finish();
rollback;
