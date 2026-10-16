begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.sources(id,display_name,authority_tier,source_role,active)
values
('ab410000-0000-4000-8000-000000000001','Phase1 Corporate Studio A',1,'OTT_PLATFORM',true),
('ab410000-0000-4000-8000-000000000002','Phase1 Corporate Studio B website',1,'OTT_PLATFORM',true),
('ab410000-0000-4000-8000-000000000003','Phase1 truly independent critic',3,'TRADE_MEDIA',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values
('ab420000-0000-4000-8000-000000000001','ab410000-0000-4000-8000-000000000001','YOUTUBE','UCPhase1CorpYT','https://yt.example/phase1corpA','YOUTUBE_WEBSUB','PUSH','WEBHOOK',true),
('ab420000-0000-4000-8000-000000000002','ab410000-0000-4000-8000-000000000002','WEB','corpwebsite','https://studio.example/phase1corpB','FIRST_PARTY_HTML','COLD_6H','PUBLIC_WEB',true),
('ab420000-0000-4000-8000-000000000003','ab410000-0000-4000-8000-000000000003','RSS','independentcritic','https://independent.example/phase1critic','RSS_ATOM','ACTIVE_15M','FEED',true);

insert into public.source_corporate_owners(id,owner_key,display_name,verified_url,notes)
values('ab430000-0000-4000-8000-000000000001','pgtap-example-corporate-owner',
       'Pgtap corporate group','https://studio.example/about','Pgtap transaction-only fixture');
insert into public.source_corporate_owner_memberships(source_id,owner_id,verification_url,verification_note)
values
('ab410000-0000-4000-8000-000000000001','ab430000-0000-4000-8000-000000000001','https://studio.example/about','Test only'),
('ab410000-0000-4000-8000-000000000002','ab430000-0000-4000-8000-000000000001','https://studio.example/about','Test only');

insert into public.raw_items(id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,metadata,content_fingerprint)
values
('ab440000-0000-4000-8000-000000000001','ab420000-0000-4000-8000-000000000001','c1','https://yt.example/corp1',now(),now(),now(),'YOUTUBE_VIDEO','Lighthouse Echo series','Lighthouse Echo','lighthouse echo', '{}'::jsonb,repeat('a',64)),
('ab440000-0000-4000-8000-000000000002','ab420000-0000-4000-8000-000000000002','c2','https://studio.example/corp2',now(),now(),now(),'WEB_ARTICLE','Lighthouse Echo series','Lighthouse Echo','lighthouse echo', '{}'::jsonb,repeat('b',64)),
('ab440000-0000-4000-8000-000000000003','ab420000-0000-4000-8000-000000000003','c3','https://independent.example/corp3',now(),now(),now(),'FEED_ENTRY','Lighthouse Echo series','Lighthouse Echo','lighthouse echo', '{}'::jsonb,repeat('c',64));

select lives_ok($$select public.submit_entity_discovery_candidate('Lighthouse Echo','SERIES',
 'ab440000-0000-4000-8000-000000000001'::uuid,0.96,null,null,'DETERMINISTIC_TITLE',0.9,'{}'::jsonb)$$,'first mapped source submits');
select lives_ok($$select public.submit_entity_discovery_candidate('Lighthouse Echo','SERIES',
 'ab440000-0000-4000-8000-000000000002'::uuid,0.95,null,null,'DETERMINISTIC_TITLE',0.9,'{}'::jsonb)$$,'second logical source submits');
select results_eq($$select source_count from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'$$,
 array[2::integer],'recorded source identity count is 2');
select results_eq($$select public.catalogue_independent_owner_count(id) from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'$$,
 array[1::integer],'two different logical source records with same corporate owner count as one');
select throws_ok($$select public.operator_review_entity_candidate(
 'ab450000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'),
 'APPROVED','Same company, different source records: must deny')$$,
 'entity_candidate_requires_two_independent_source_owners',
 'same-corporate-parent signals cannot approve a candidate');
select lives_ok($$select public.submit_entity_discovery_candidate('Lighthouse Echo','SERIES',
 'ab440000-0000-4000-8000-000000000003'::uuid,0.95,null,null,'DETERMINISTIC_TITLE',0.86,'{}'::jsonb)$$,
 'unmapped genuinely separate source adds evidence');
select results_eq($$select public.catalogue_independent_owner_count(id) from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'$$,
 array[2::integer],'independent third source increases corporate-owner count to two');
select lives_ok($$select public.operator_review_entity_candidate(
 'ab450000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'),
 'APPROVED','Publisher plus independent editorial owner')$$,
 'review permits two owners once all other gates pass');
select lives_ok($$select public.operator_promote_entity_candidate(
 'ab450000-0000-4000-8000-000000000001'::uuid,
 (select id from public.entity_discovery_candidates where normalized_name='lighthouse echo' and proposed_entity_type='SERIES'),
 'Promote after genuine independent corroboration')$$,
 'promote uses owner registry and preserves other gates');
select results_eq($$select country_code from public.entities where canonical_name='Lighthouse Echo' and entity_type='SERIES'$$,
 array[null::text],'unknown country remains unknown after promotion');
select results_eq($$select count(*) from public.event_evidence e join public.raw_items r on r.id=e.raw_item_id where r.raw_title='Lighthouse Echo series'$$,
 array[0::bigint],'catalogue promotion does not immediately create news');
select ok(not has_table_privilege('anon','public.source_corporate_owner_memberships','SELECT'),'anonymous cannot read corporate ownership');
select ok(not has_table_privilege('authenticated','public.source_corporate_owner_memberships','SELECT'),'signed-in app users cannot read internal mapping');
select * from finish();
rollback;
