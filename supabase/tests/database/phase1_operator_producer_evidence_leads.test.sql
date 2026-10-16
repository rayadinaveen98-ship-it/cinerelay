begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.sources(id,display_name,authority_tier,source_role,active)
values('cc110000-0000-4000-8000-000000000001','Evidence Lead Fixture',1,'OTT_PLATFORM',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values('cc120000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000001',
'WEB','lead-fixture','https://example.org/studio','FIRST_PARTY_HTML','COLD_6H','PUBLIC_WEB',true);
insert into public.raw_items(id,source_identity_id,platform_item_id,canonical_url,
published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,metadata,content_fingerprint)
values('cc130000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000001','test-evidence-lead',
'https://example.org/studio/show',null,now(),now(),'WEB_ARTICLE','Cloud Harbour Season 3',
'Cloud Harbour series','cloud harbour series','{}'::jsonb,repeat('e',64));
select public.submit_entity_discovery_candidate('Cloud Harbour','SERIES',
 'cc130000-0000-4000-8000-000000000001'::uuid,0.89,null,null,'DETERMINISTIC_TITLE',0.87,'{}'::jsonb);

select lives_ok($$select public.operator_submit_producer_evidence_lead(
 'cc140000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='cloud harbour' and proposed_entity_type='SERIES'),
 'https://www.linkedin.com/posts/hrxfilms_prime-video-hrx-films-a-powerful-creative-activity-7382342199146999809-dSFV',
 'HRX Films','Direct first-party producer post submitted for primary-source human verification only.')$$,
 'submission permits an authentic-looking direct company post for human verification');

select results_eq($$select count(*) from public.operator_producer_evidence_leads
  where claimed_owner_name='HRX Films'$$,array[1::bigint],'one lead captured');

select results_eq($$select count(*) from public.entity_discovery_evidence
 where candidate_id=(select id from public.entity_discovery_candidates
 where normalized_name='cloud harbour' and proposed_entity_type='SERIES')$$,array[1::bigint],
 'external lead does not create a second ingested evidence row');

select results_eq($$select public.catalogue_independent_owner_count(id)
 from public.entity_discovery_candidates where normalized_name='cloud harbour' and proposed_entity_type='SERIES'$$,
 array[1::integer],'lead does not increase independent-owner count');

select results_eq($$select count(*) from public.event_evidence ev
 join public.raw_items r on r.id=ev.raw_item_id where r.id='cc130000-0000-4000-8000-000000000001'$$,
 array[0::bigint],'lead does not publish an event');

select lives_ok($$select public.operator_submit_producer_evidence_lead(
 'cc140000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='cloud harbour' and proposed_entity_type='SERIES'),
 'https://www.linkedin.com/posts/hrxfilms_prime-video-hrx-films-a-powerful-creative-activity-7382342199146999809-dSFV?utm_tracking=123',
 'HRX Films','Duplicated original producer post link must not create another record.')$$,
 'tracking query is normalized before duplicate detection');
select results_eq($$select count(*) from public.operator_producer_evidence_leads
 where claimed_owner_name='HRX Films'$$,array[1::bigint],
 'duplicate lead did not inflate records');
select throws_ok($$select public.operator_submit_producer_evidence_lead(
 'cc140000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='cloud harbour' and proposed_entity_type='SERIES'),
 'https://www.linkedin.com/company/theviralfever',
 'The Viral Fever','Company profile is not a direct producer announcement post; it must be rejected')$$,
 'direct_producer_linkedin_post_required','company profile cannot stand in for original producer post');
select ok(not has_table_privilege('anon','public.operator_producer_evidence_leads','SELECT'),
 'anonymous clients cannot read submitted leads');
select ok(not has_function_privilege('authenticated',
 'public.operator_submit_producer_evidence_lead(uuid,uuid,text,text,text)','EXECUTE'),
 'signed-in non-service database clients cannot submit leads directly');
select * from finish();
rollback;
