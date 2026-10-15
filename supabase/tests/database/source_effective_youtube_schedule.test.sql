begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into public.sources(id,display_name,authority_tier,source_role,active)
values('81000000-0000-4000-8000-000000000001','Scheduler Source',1,'PRODUCTION_HOUSE',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values('81100000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',
'YOUTUBE','UC4444444444444444444444','https://www.youtube.com/channel/UC4444444444444444444444','YOUTUBE_WEBSUB','PUSH','WEBHOOK',true);
insert into public.source_health(source_identity_id,health_state,last_attempt_at,last_success_at,next_due_at,consecutive_failures,last_error_code,updated_at)
values('81100000-0000-4000-8000-000000000001','DEGRADED','2026-10-15 12:58+00','2026-10-15 12:58+00','2026-09-30 01:00+00',0,'WEBSUB_MISSED_DELIVERY','2026-10-15 12:58+00');
insert into public.youtube_channel_state(source_identity_id,channel_id,uploads_playlist_id,last_fallback_check_at,next_fallback_check_at)
values('81100000-0000-4000-8000-000000000001','UC4444444444444444444444','UU4444444444444444444444','2026-10-15 12:58+00','2026-10-15 13:50+00');

select is(public.source_effective_health('81100000-0000-4000-8000-000000000001','2026-10-15 13:00+00')->>'effectiveState','HEALTHY',
'healthy fallback makes the YouTube channel effectively healthy');
select is(public.source_effective_health('81100000-0000-4000-8000-000000000001','2026-10-15 13:00+00')->>'scheduleDrift','false',
'obsolete next_due_at never flags a healthy YouTube fallback as drifting');
select is(public.source_effective_health('81100000-0000-4000-8000-000000000001','2026-10-15 13:00+00')->>'nextDueAt','2026-10-15T13:50:00+00:00',
'next due metadata surfaces the real fallback schedule for YouTube');
select lives_ok($$select public.refresh_source_maintenance_findings('2026-10-15 13:00+00')$$,
'maintenance refresh uses effective YouTube schedule');
select is((select count(*)::integer from public.source_maintenance_findings
where finding_key='schedule:81100000-0000-4000-8000-000000000001' and status='OPEN'),0,
'healthy fallback source has no open schedule drift finding');
update public.youtube_channel_state set next_fallback_check_at='2026-09-30 12:00+00'
where source_identity_id='81100000-0000-4000-8000-000000000001';
select is(public.source_effective_health('81100000-0000-4000-8000-000000000001','2026-10-15 13:00+00')->>'scheduleDrift','true',
'outdated fallback bookkeeping remains separately visible');
select * from finish();
rollback;
