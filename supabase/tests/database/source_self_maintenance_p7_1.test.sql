begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select ok((select relrowsecurity from pg_class where oid = 'public.source_maintenance_findings'::regclass),'maintenance findings table has RLS enabled');
select ok(not has_table_privilege('anon','public.source_maintenance_findings','SELECT'),'anonymous clients cannot read service-owned maintenance findings');
select ok((select relrowsecurity from pg_class where oid = 'public.event_types'::regclass),'event_types reference table has RLS enabled');
select ok(has_table_privilege('anon','public.event_types','SELECT') and not has_table_privilege('anon','public.event_types','INSERT') and not has_table_privilege('authenticated','public.event_types','UPDATE'),'event_types stays publicly readable but client-nonwritable');
select ok(coalesce((select 'search_path=pg_catalog, public' = any(proconfig) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_youtube_websub_delivery'),false),'WebSub delivery function has a fixed search_path');

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active) values
('71000000-0000-4000-8000-000000000001','P7 YouTube Source',1,'PRODUCTION_HOUSE','IN',array['te'],true),
('71000000-0000-4000-8000-000000000002','P7 Feed Source',3,'TRADE_MEDIA','IN',array['en'],true),
('71000000-0000-4000-8000-000000000003','P7 Quiet Feed',3,'TRADE_MEDIA','IN',array['en'],true);

insert into public.source_identities (id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,connector_config,active) values
('71100000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','YOUTUBE','UC1234567890123456789012','@p7health','https://www.youtube.com/@p7health','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{}',true),
('71100000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','WEB',null,null,'https://example.com/p7-feed.xml','RSS_ATOM','HOT_5M','FEED','{}',true),
('71100000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000003','WEB',null,null,'https://example.com/p7-quiet.xml','RSS_ATOM','HOT_5M','FEED','{}',true);

insert into public.source_health (source_identity_id,health_state,last_attempt_at,last_success_at,last_item_at,next_due_at,consecutive_failures,last_http_status,last_error_code,last_error_message,subscription_expires_at,parser_version,updated_at) values
('71100000-0000-4000-8000-000000000001','DEGRADED','2026-10-01 12:55+00','2026-10-01 12:55+00','2026-10-01 12:40+00','2026-09-30 12:00+00',0,200,'WEBSUB_MISSED_DELIVERY','accelerator miss','2026-10-01 20:00+00',null,'2026-10-01 12:55+00'),
('71100000-0000-4000-8000-000000000002','DEGRADED','2026-10-01 12:00+00','2026-09-27 12:00+00','2026-09-27 12:00+00','2026-10-01 12:05+00',5,500,'PARSER_EXTRACT_FAILED','selector returned no bounded items',null,'p7-test-v1','2026-10-01 12:00+00'),
('71100000-0000-4000-8000-000000000003','HEALTHY','2026-10-01 12:50+00','2026-10-01 12:50+00',null,'2026-10-01 13:30+00',0,200,null,null,null,'p7-test-v1','2026-10-01 12:50+00');

insert into public.youtube_channel_state (source_identity_id,channel_id,uploads_playlist_id,latest_known_video_id,last_websub_at,last_enriched_at,last_fallback_check_at,next_fallback_check_at,fallback_gap_count,consecutive_websub_events,created_at,updated_at) values
('71100000-0000-4000-8000-000000000001','UC1234567890123456789012','UU1234567890123456789012','abcDEF12345','2026-09-30 10:00+00','2026-10-01 12:40+00','2026-10-01 12:55+00','2026-09-30 12:00+00',0,0,'2026-10-01 12:00+00','2026-10-01 12:55+00');

insert into public.jobs (id,job_type,idempotency_key,payload,state,attempt_count,max_attempts,run_after,last_error) values
('71200000-0000-4000-8000-000000000001','PROCESS_RAW_ITEM','p7-poison-job','{}','RETRY_WAIT',5,5,'2026-09-20 12:00+00','legacy type error');

select is(public.source_effective_health('71100000-0000-4000-8000-000000000001','2026-10-01 13:00+00')->>'effectiveState','HEALTHY','fresh YouTube fallback makes a WebSub-only degradation effectively healthy');
select is(public.source_effective_health('71100000-0000-4000-8000-000000000001','2026-10-01 13:00+00')->>'webSubAcceleratorOnly','true','effective health explicitly marks WebSub as accelerator-only');
select is(public.source_effective_health('71100000-0000-4000-8000-000000000001','2026-10-01 13:00+00')->>'scheduleDrift','true','stale scheduler timestamps are separated from connector health');
select is(public.source_effective_health('71100000-0000-4000-8000-000000000002','2026-10-01 13:00+00')->>'effectiveState','DEAD','repeated failures plus prolonged lack of success is classified DEAD');
select lives_ok($$select public.refresh_source_maintenance_findings('2026-10-01 13:00+00')$$,'maintenance refresh completes deterministically');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='websub:71100000-0000-4000-8000-000000000001' and finding_type='WEBSUB_ACCELERATOR_MISS' and status='OPEN'),'WebSub accelerator finding is created');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='schedule:71100000-0000-4000-8000-000000000001' and finding_type='SCHEDULE_DRIFT' and status='OPEN'),'scheduler bookkeeping drift is created as a separate finding');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='stale:71100000-0000-4000-8000-000000000002' and finding_type='SOURCE_DEAD' and severity='CRITICAL'),'dead-source finding is created without auto-retirement');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='parser:71100000-0000-4000-8000-000000000002' and finding_type='PARSER_DRIFT'),'parser drift is surfaced from repeated bounded-parser failures');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='job:71200000-0000-4000-8000-000000000001' and finding_type='POISON_JOB'),'max-attempt processing jobs become poison-job findings');
select ok(exists(select 1 from public.source_maintenance_findings where finding_key='poll:71100000-0000-4000-8000-000000000003' and finding_type='POLL_CLASS_RECOMMENDATION' and details->>'recommendedPollClass'='DAILY'),'inactive polled sources receive a lower-frequency recommendation rather than an automatic mutation');
select ok(not exists(select 1 from public.source_maintenance_findings where finding_key='poll:71100000-0000-4000-8000-000000000001'),'YouTube PUSH identities are excluded from poll-class tuning');

update public.source_health set health_state='HEALTHY',last_success_at='2026-10-01 12:59+00',consecutive_failures=0,last_error_code=null,last_error_message=null,next_due_at='2026-10-01 13:30+00' where source_identity_id='71100000-0000-4000-8000-000000000002';
update public.jobs set state='SUCCEEDED',completed_at='2026-10-01 13:01+00' where id='71200000-0000-4000-8000-000000000001';
select lives_ok($$select public.refresh_source_maintenance_findings('2026-10-01 13:02+00')$$,'second refresh resolves findings that are no longer current');
select ok((select status='RESOLVED' from public.source_maintenance_findings where finding_key='job:71200000-0000-4000-8000-000000000001'),'poison-job finding resolves when the underlying job becomes terminal');

select * from finish();
rollback;
