begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active) values
('76100000-0000-4000-8000-000000000001','P75 Official Studio',1,'PRODUCTION_HOUSE','IN',array['te','en'],true),
('76100000-0000-4000-8000-000000000002','P75 Trade Media',3,'TRADE_MEDIA','IN',array['te','en'],true);

insert into public.source_identities (
  id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,connector_config,active
) values
('76200000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001','YOUTUBE','UCp75OfficialStudio00001',null,'https://www.youtube.com/channel/UCp75OfficialStudio00001','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{}',true),
('76200000-0000-4000-8000-000000000002','76100000-0000-4000-8000-000000000002','RSS',null,null,'https://p75trade.example/feed','RSS_ATOM','NORMAL_60M','FEED','{}',true);

insert into public.entities (id,entity_type,canonical_name,slug,primary_language,country_code,status) values
('76300000-0000-4000-8000-000000000001','MOVIE','P75 Alpha','p75-alpha','te','IN','ACTIVE'),
('76300000-0000-4000-8000-000000000002','MOVIE','P75 Beta','p75-beta','te','IN','ACTIVE'),
('76300000-0000-4000-8000-000000000003','MOVIE','P75 Gamma','p75-gamma','te','IN','ACTIVE'),
('76300000-0000-4000-8000-000000000004','MOVIE','P75 Delta','p75-delta','te','IN','ACTIVE');

insert into public.raw_items (
  id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,media_type,metadata,content_fingerprint
) values
('76400000-0000-4000-8000-000000000001','76200000-0000-4000-8000-000000000001','alpha-1','https://www.youtube.com/watch?v=p75alpha1','2026-10-01 06:00+00','2026-10-01 06:01+00','2026-10-01 06:01+00','VIDEO','P75 Alpha Teaser','P75 Alpha','p75 alpha teaser','VIDEO','{}','p75-alpha-1'),
('76400000-0000-4000-8000-000000000002','76200000-0000-4000-8000-000000000001','alpha-2','https://www.youtube.com/watch?v=p75alpha2','2026-10-02 06:00+00','2026-10-02 06:01+00','2026-10-02 06:01+00','VIDEO','P75 Alpha Song','P75 Alpha','p75 alpha song','VIDEO','{}','p75-alpha-2'),
('76400000-0000-4000-8000-000000000003','76200000-0000-4000-8000-000000000001','beta-1','https://www.youtube.com/watch?v=p75beta1','2026-10-02 05:00+00','2026-10-02 05:01+00','2026-10-02 05:01+00','VIDEO','P75 Beta First Look','P75 Beta','p75 beta first look','VIDEO','{}','p75-beta-1'),
('76400000-0000-4000-8000-000000000004','76200000-0000-4000-8000-000000000001','gamma-1','https://www.youtube.com/watch?v=p75gamma1','2026-10-02 04:00+00','2026-10-02 04:01+00','2026-10-02 04:01+00','VIDEO','P75 Gamma Update','P75 Gamma','p75 gamma update','VIDEO','{}','p75-gamma-1'),
('76400000-0000-4000-8000-000000000005','76200000-0000-4000-8000-000000000002','trade-alpha-1','https://p75trade.example/alpha-1','2026-10-02 03:00+00','2026-10-02 03:01+00','2026-10-02 03:01+00','ARTICLE','P75 Alpha update','P75 Alpha','p75 alpha update','TEXT','{}','p75-trade-alpha-1'),
('76400000-0000-4000-8000-000000000006','76200000-0000-4000-8000-000000000002','trade-alpha-2','https://p75trade.example/alpha-2','2026-10-02 03:30+00','2026-10-02 03:31+00','2026-10-02 03:31+00','ARTICLE','P75 Alpha report','P75 Alpha','p75 alpha report','TEXT','{}','p75-trade-alpha-2'),
('76400000-0000-4000-8000-000000000007','76200000-0000-4000-8000-000000000001','delta-1','https://www.youtube.com/watch?v=p75delta1','2026-10-02 02:00+00','2026-10-02 02:01+00','2026-10-02 02:01+00','VIDEO','P75 Delta Promo','P75 Delta','p75 delta promo','VIDEO','{}','p75-delta-1');

insert into public.entity_resolution_results (
  id,raw_item_id,entity_id,score,resolution_state,methods,engine_version,created_at
) values
('76500000-0000-4000-8000-000000000001','76400000-0000-4000-8000-000000000001','76300000-0000-4000-8000-000000000001',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 06:02+00'),
('76500000-0000-4000-8000-000000000002','76400000-0000-4000-8000-000000000002','76300000-0000-4000-8000-000000000001',0.9700,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 06:02+00'),
('76500000-0000-4000-8000-000000000003','76400000-0000-4000-8000-000000000003','76300000-0000-4000-8000-000000000002',0.9900,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 05:02+00'),
('76500000-0000-4000-8000-000000000004','76400000-0000-4000-8000-000000000004','76300000-0000-4000-8000-000000000003',1.0000,'RESOLVED','[{"method":"SOURCE_ENTITY_SCOPE"}]','source-scope-resolver-v1','2026-10-02 04:02+00'),
('76500000-0000-4000-8000-000000000005','76400000-0000-4000-8000-000000000005','76300000-0000-4000-8000-000000000001',1.0000,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 03:02+00'),
('76500000-0000-4000-8000-000000000006','76400000-0000-4000-8000-000000000006','76300000-0000-4000-8000-000000000001',1.0000,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 03:32+00'),
('76500000-0000-4000-8000-000000000007','76400000-0000-4000-8000-000000000007','76300000-0000-4000-8000-000000000004',1.0000,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-02 02:02+00');

insert into public.source_entity_candidates (
  source_identity_id,entity_id,relationship,confidence,priority,valid_from,valid_to,active
) values (
  '76200000-0000-4000-8000-000000000001','76300000-0000-4000-8000-000000000004','PROJECT_COVERAGE',0.9500,100,'2026-09-01 00:00+00','2026-12-01 00:00+00',true
);

select ok(
  not has_function_privilege('authenticated','public.source_entity_relationship_proposal_candidates(timestamptz,integer)','EXECUTE'),
  'authenticated clients cannot enumerate relationship proposal candidates directly'
);
select ok(
  not has_function_privilege('authenticated','public.refresh_source_entity_relationship_proposals(timestamptz,integer)','EXECUTE'),
  'authenticated clients cannot refresh relationship proposals directly'
);
select ok(
  not has_function_privilege('authenticated','public.operator_review_source_entity_relationship(uuid,uuid,text,text,integer)','EXECUTE'),
  'authenticated clients cannot approve or reject relationship proposals directly'
);
select ok(
  has_function_privilege('service_role','public.operator_review_source_entity_relationship(uuid,uuid,text,text,integer)','EXECUTE'),
  'service role can invoke the audited operator relationship RPC'
);

select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:00+00',21)$$,
  'relationship proposal refresh runs successfully'
);
select ok(
  exists(select 1 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid and status='OPEN'),
  'two independent canonical-title resolutions create an official-source relationship proposal'
);
select results_eq(
  $$select evidence_count from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::integer],
  'proposal records distinct supporting raw items'
);
select ok(
  (select confidence >= 0.9750 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid),
  'proposal confidence reflects strong independent canonical-title evidence'
);
select ok(
  exists(select 1 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000002'::uuid and status='OPEN'),
  'one near-certain canonical-title resolution can create a reviewable proposal'
);
select ok(
  not exists(select 1 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000002'::uuid),
  'Tier-3 trade-media mentions do not create resolver-prior relationship proposals'
);
select ok(
  not exists(select 1 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000003'::uuid),
  'source-scope resolutions cannot feed back into new relationship proposals'
);
select ok(
  not exists(select 1 from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000004'::uuid),
  'an already-active source/entity resolver prior suppresses duplicate proposals'
);
select ok(
  not exists(select 1 from public.source_entity_candidates where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid),
  'automatic refresh never activates a resolver prior'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence e join public.source_entity_relationship_proposals p on p.id=e.proposal_id where p.source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and p.entity_id='76300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'proposal retains two raw-item evidence records'
);

select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:05+00',21)$$,
  'repeated refresh is idempotent'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence e join public.source_entity_relationship_proposals p on p.id=e.proposal_id where p.source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and p.entity_id='76300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'repeated refresh does not duplicate evidence'
);

select lives_ok(
  $$select public.operator_review_source_entity_relationship('76600000-0000-4000-8000-000000000001', (select id from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid), 'APPROVE', 'Verified official project coverage from retained evidence', 30)$$,
  'operator can explicitly approve a relationship proposal'
);
select ok(
  exists(select 1 from public.source_entity_candidates where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid and relationship='PROJECT_COVERAGE' and active=true),
  'approval activates the existing resolver-prior contract'
);
select ok(
  (select valid_to > valid_from + interval '29 days' and valid_to <= valid_from + interval '31 days' from public.source_entity_candidates where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid),
  'operator-selected validity window is time bounded'
);
select results_eq(
  $$select status from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid$$,
  array['APPROVED'::text],
  'approved proposal records final operator decision'
);
select ok(
  exists(select 1 from public.audit_actions where action_type='APPROVE_SOURCE_ENTITY_RELATIONSHIP' and actor_id='76600000-0000-4000-8000-000000000001'::uuid),
  'relationship approval is audited'
);
select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:10+00',21)$$,
  'refresh after approval remains safe'
);
select results_eq(
  $$select status from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000001'::uuid$$,
  array['APPROVED'::text],
  'automatic refresh never reopens an approved proposal'
);

select lives_ok(
  $$select public.operator_review_source_entity_relationship('76600000-0000-4000-8000-000000000001', (select id from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000002'::uuid), 'REJECT', 'Single title match reviewed and not suitable as a durable source prior', null)$$,
  'operator can explicitly reject a relationship proposal'
);
select ok(
  not exists(select 1 from public.source_entity_candidates where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000002'::uuid),
  'rejection does not activate a resolver prior'
);
select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 07:15+00',21)$$,
  'refresh after rejection remains safe'
);
select results_eq(
  $$select status from public.source_entity_relationship_proposals where source_identity_id='76200000-0000-4000-8000-000000000001'::uuid and entity_id='76300000-0000-4000-8000-000000000002'::uuid$$,
  array['REJECTED'::text],
  'automatic refresh never reopens a rejected proposal'
);
select ok(
  exists(select 1 from public.audit_actions where action_type='REJECT_SOURCE_ENTITY_RELATIONSHIP' and actor_id='76600000-0000-4000-8000-000000000001'::uuid),
  'relationship rejection is audited'
);

select * from finish();
rollback;
