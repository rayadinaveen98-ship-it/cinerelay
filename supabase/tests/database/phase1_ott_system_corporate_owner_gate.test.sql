begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.sources(id,display_name,authority_tier,source_role,active)
values
('cc510000-0000-4000-8000-000000000001','OTT Group Website',1,'OTT_PLATFORM',true),
('cc510000-0000-4000-8000-000000000002','OTT Group YouTube',1,'OTT_PLATFORM',true),
('cc510000-0000-4000-8000-000000000003','OTT Independent Group',3,'TRADE_MEDIA',true);
insert into public.source_identities(id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active)
values
('cc520000-0000-4000-8000-000000000001','cc510000-0000-4000-8000-000000000001','WEB','ott-creator-web','https://studio.example/ott/web','FIRST_PARTY_HTML','COLD_6H','PUBLIC_WEB',true),
('cc520000-0000-4000-8000-000000000002','cc510000-0000-4000-8000-000000000002','YOUTUBE','UCOTTSystemSameOwner','https://youtube.example/ott/group','YOUTUBE_WEBSUB','PUSH','WEBHOOK',true),
('cc520000-0000-4000-8000-000000000003','cc510000-0000-4000-8000-000000000003','RSS','ott-independent-news','https://trade.example/ott.xml','RSS_ATOM','ACTIVE_15M','FEED',true);
insert into public.source_corporate_owners(id,owner_key,display_name,verified_url,notes)
values('cc530000-0000-4000-8000-000000000001','pgtap-ott-system-group','Studio group','https://studio.example/about','CI fixture');
insert into public.source_corporate_owner_memberships(source_id,owner_id,verification_url,verification_note)
values
('cc510000-0000-4000-8000-000000000001','cc530000-0000-4000-8000-000000000001','https://studio.example/about','CI fixture'),
('cc510000-0000-4000-8000-000000000002','cc530000-0000-4000-8000-000000000001','https://studio.example/about','CI fixture');
insert into public.raw_items(id,source_identity_id,platform_item_id,canonical_url,
 published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,metadata,content_fingerprint)
values
('cc540000-0000-4000-8000-000000000001','cc520000-0000-4000-8000-000000000001','same-group-1','https://studio.example/film/first',now(),now(),now(),'WEB_ARTICLE','Corroborated Sunset Film','Film on OTT','corroborated sunset film','{}'::jsonb,repeat('a',64)),
('cc540000-0000-4000-8000-000000000002','cc520000-0000-4000-8000-000000000002','same-group-2','https://youtube.example/film/second',now(),now(),now(),'YOUTUBE_VIDEO','Corroborated Sunset Film','Film on OTT','corroborated sunset film','{}'::jsonb,repeat('b',64)),
('cc540000-0000-4000-8000-000000000003','cc520000-0000-4000-8000-000000000003','independent-3','https://trade.example/film/third',now(),now(),now(),'FEED_ENTRY','Corroborated Sunset Film','OTT Release Film','corroborated sunset film','{}'::jsonb,repeat('c',64));
select lives_ok($$select public.submit_entity_discovery_candidate('Corroborated Sunset Film','MOVIE',
 'cc540000-0000-4000-8000-000000000001'::uuid,0.96,null,null,'DETERMINISTIC_TITLE',0.90,
 '{"signalType":"OTT_RELEASE","releaseDate":"2026-09-01"}'::jsonb)$$,
 'official OTT article candidate ingested');
select lives_ok($$select public.submit_entity_discovery_candidate('Corroborated Sunset Film','MOVIE',
 'cc540000-0000-4000-8000-000000000002'::uuid,0.95,null,null,'DETERMINISTIC_TITLE',0.90,
 '{"signalType":"OTT_RELEASE","releaseDate":"2026-09-01"}'::jsonb)$$,
 'second same-owner signal ingested');
select results_eq($$select source_count from public.entity_discovery_candidates where normalized_name='corroborated sunset film' and proposed_entity_type='MOVIE'$$,
array[2::integer],'two identities recorded');
select results_eq($$select (public.system_promote_verified_ott_candidate_two_source(
  (select id from public.entity_discovery_candidates where normalized_name='corroborated sunset film' and proposed_entity_type='MOVIE')
)->>'promoted')::boolean$$,array[false],
'two sources owned by one company cannot system-promote');
select results_eq($$select status from public.entity_discovery_candidates where normalized_name='corroborated sunset film' and proposed_entity_type='MOVIE'$$,array['PENDING'::text],
'candidate stays pending when false owner corroboration found');
select lives_ok($$select public.submit_entity_discovery_candidate('Corroborated Sunset Film','MOVIE',
 'cc540000-0000-4000-8000-000000000003'::uuid,0.95,null,null,'DETERMINISTIC_TITLE',0.90,
 '{"signalType":"OTT_RELEASE","releaseDate":"2026-09-01"}'::jsonb)$$,
 'independent third source corroborates');
select results_eq($$select (public.system_promote_verified_ott_candidate_two_source(
  (select id from public.entity_discovery_candidates where normalized_name='corroborated sunset film' and proposed_entity_type='MOVIE')
)->>'promoted')::boolean$$,array[true],
'genuine independent group can promote OTT film');
select results_eq($$select country_code from public.entities where canonical_name='Corroborated Sunset Film' and entity_type='MOVIE'$$,
array[null::text],'unknown original country remains unknown');
select ok(position('coalesce(v_candidate.country_code, ''IN'')' in
 pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure))=0,
 'single first-party path also does not infer India');
select ok(not has_function_privilege('anon','public.system_promote_verified_ott_candidate_two_source(uuid)','EXECUTE'),
 'nonoperators cannot call system promotion');
select * from finish();
rollback;
