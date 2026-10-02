begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active)
values ('77100000-0000-4000-8000-000000000001','P75 Dedupe Studio',1,'PRODUCTION_HOUSE','IN',array['te','en'],true);

insert into public.source_identities (
  id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,connector_config,active
) values (
  '77200000-0000-4000-8000-000000000001','77100000-0000-4000-8000-000000000001','YOUTUBE','UCp75DedupeStudio000001',null,
  'https://www.youtube.com/channel/UCp75DedupeStudio000001','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{}',true
);

insert into public.entities (id,entity_type,canonical_name,slug,primary_language,country_code,status)
values ('77300000-0000-4000-8000-000000000001','MOVIE','P75 Dedupe Film','p75-dedupe-film','te','IN','ACTIVE');

insert into public.raw_items (
  id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,media_type,metadata,content_fingerprint
) values
('77400000-0000-4000-8000-000000000001','77200000-0000-4000-8000-000000000001','dedupe-1','https://www.youtube.com/watch?v=p75dedupe1','2026-10-01 06:00+00','2026-10-01 06:01+00','2026-10-01 06:01+00','VIDEO','P75 Dedupe Film Teaser','P75 Dedupe Film','p75 dedupe film teaser','VIDEO','{}','p75-dedupe-1'),
('77400000-0000-4000-8000-000000000002','77200000-0000-4000-8000-000000000001','dedupe-2','https://www.youtube.com/watch?v=p75dedupe2','2026-10-02 06:00+00','2026-10-02 06:01+00','2026-10-02 06:01+00','VIDEO','P75 Dedupe Film Song','P75 Dedupe Film','p75 dedupe film song','VIDEO','{}','p75-dedupe-2');

insert into public.entity_resolution_results (
  id,raw_item_id,entity_id,score,resolution_state,methods,engine_version,created_at
) values
('77500000-0000-4000-8000-000000000001','77400000-0000-4000-8000-000000000001','77300000-0000-4000-8000-000000000001',0.9600,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 06:02+00'),
('77500000-0000-4000-8000-000000000002','77400000-0000-4000-8000-000000000001','77300000-0000-4000-8000-000000000001',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 06:03+00'),
('77500000-0000-4000-8000-000000000003','77400000-0000-4000-8000-000000000002','77300000-0000-4000-8000-000000000001',0.9700,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 06:02+00');

select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:00+00',21)$$,
  'duplicate canonical resolution rows do not break relationship refresh'
);
select results_eq(
  $$select evidence_count from public.source_entity_relationship_proposals where source_identity_id='77200000-0000-4000-8000-000000000001'::uuid and entity_id='77300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::integer],
  'proposal counts distinct raw items rather than duplicate resolution rows'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence e join public.source_entity_relationship_proposals p on p.id=e.proposal_id where p.source_identity_id='77200000-0000-4000-8000-000000000001'::uuid and p.entity_id='77300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'evidence ledger stores one row per raw item'
);
select results_eq(
  $$select resolution_result_id from public.source_entity_relationship_evidence e join public.source_entity_relationship_proposals p on p.id=e.proposal_id where p.source_identity_id='77200000-0000-4000-8000-000000000001'::uuid and e.raw_item_id='77400000-0000-4000-8000-000000000001'::uuid$$,
  array['77500000-0000-4000-8000-000000000002'::uuid],
  'latest canonical resolution row is retained for a duplicated raw item'
);
select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:05+00',21)$$,
  'deduped relationship refresh remains idempotent'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence e join public.source_entity_relationship_proposals p on p.id=e.proposal_id where p.source_identity_id='77200000-0000-4000-8000-000000000001'::uuid and p.entity_id='77300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'repeated refresh keeps one evidence row per raw item'
);

select * from finish();
rollback;
