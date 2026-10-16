begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.sources(id,display_name,authority_tier,source_role,active)
values
('8a710000-0000-4000-8000-000000000001','Phase1 Netflix-style owner',1,'OTT_PLATFORM',true),
('8a710000-0000-4000-8000-000000000002','Phase1 Independent trade',3,'TRADE_MEDIA',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values
('8a720000-0000-4000-8000-000000000001','8a710000-0000-4000-8000-000000000001','YOUTUBE','UCphase1NetflixA','https://youtube.example/phase1a','YOUTUBE_WEBSUB','PUSH','WEBHOOK',true),
('8a720000-0000-4000-8000-000000000002','8a710000-0000-4000-8000-000000000001','WEB','phase1-netflix-news','https://netflix.example/news','FIRST_PARTY_HTML','COLD_6H','PUBLIC_WEB',true),
('8a720000-0000-4000-8000-000000000003','8a710000-0000-4000-8000-000000000002','RSS','phase1-thirdparty-news','https://trade.example/feed','RSS_ATOM','ACTIVE_15M','FEED',true);
insert into public.raw_items(id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,metadata,content_fingerprint)
values
('8a730000-0000-4000-8000-000000000001','8a720000-0000-4000-8000-000000000001','phase1-r1','https://youtube.example/phase1r1',now(),now(),now(),'YOUTUBE_VIDEO','Global River series','Official Global River','global river series official', '{}'::jsonb,repeat('a',64)),
('8a730000-0000-4000-8000-000000000002','8a720000-0000-4000-8000-000000000002','phase1-r2','https://netflix.example/phase1r2',now(),now(),now(),'WEB_ARTICLE','Global River season 2','Official Global River','global river season 2', '{}'::jsonb,repeat('b',64)),
('8a730000-0000-4000-8000-000000000003','8a720000-0000-4000-8000-000000000003','phase1-r3','https://trade.example/phase1r3',now(),now(),now(),'FEED_ENTRY','Global River TV series','Global River trade corroboration','global river tv series', '{}'::jsonb,repeat('c',64));

select public.submit_entity_discovery_candidate('Global River','SERIES','8a730000-0000-4000-8000-000000000001'::uuid,0.97,null,null,'DETERMINISTIC_TITLE',0.9,'{}'::jsonb);
select public.submit_entity_discovery_candidate('Global River','SERIES','8a730000-0000-4000-8000-000000000002'::uuid,0.96,null,null,'DETERMINISTIC_TITLE',0.9,'{}'::jsonb);

select results_eq($$select source_count from public.entity_discovery_candidates where normalized_name='global river' and proposed_entity_type='SERIES'$$,
array[2::integer],'two connector identities are recorded as two identities');

select throws_ok($$select public.operator_review_entity_candidate(
'8a740000-0000-4000-8000-000000000001'::uuid,
(select id from public.entity_discovery_candidates where normalized_name='global river' and proposed_entity_type='SERIES'),
'APPROVED','Two identities are the same owner, so deny')$$,
'entity_candidate_requires_two_independent_source_owners',
'approval blocks multiple connector identities owned by the same provider');

select lives_ok($$select public.submit_entity_discovery_candidate('Global River','SERIES','8a730000-0000-4000-8000-000000000003'::uuid,0.95,null,null,'DETERMINISTIC_TITLE',0.88,'{}'::jsonb)$$,
'independent third-party coverage adds another owner');

select lives_ok($$select public.operator_review_entity_candidate(
'8a740000-0000-4000-8000-000000000001'::uuid,
(select id from public.entity_discovery_candidates where normalized_name='global river' and proposed_entity_type='SERIES'),
'APPROVED','One studio and an independent news owner')$$,
'approval succeeds only after an independent owner adds evidence');

select lives_ok($$select public.operator_promote_entity_candidate(
'8a740000-0000-4000-8000-000000000001'::uuid,
(select id from public.entity_discovery_candidates where normalized_name='global river' and proposed_entity_type='SERIES'),
'Create entity with unknown country, and keep evidence scoped')$$,
'operator promotion can create verified title without inventing a country');

select results_eq($$select country_code from public.entities where canonical_name='Global River' and entity_type='SERIES'$$,
array[null::text],'null country stays null for a global TV series');

select results_eq($$select count(*) from public.event_evidence e join public.raw_items r on r.id=e.raw_item_id where r.raw_title like 'Global River%'$$,
array[0::bigint],'catalogue promotion does not publish breaking news immediately');

select * from finish();
rollback;
