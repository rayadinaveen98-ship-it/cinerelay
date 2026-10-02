begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active)
values ('78100000-0000-4000-8000-000000000001','P75 Multi OTT',1,'OTT_PLATFORM','IN',array['en'],true);

insert into public.source_identities (
  id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,connector_config,active
) values (
  '78200000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001','YOUTUBE','UCp75MultiProposal000001',null,
  'https://www.youtube.com/channel/UCp75MultiProposal000001','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{}',true
);

insert into public.entities (id,entity_type,canonical_name,slug,primary_language,country_code,status) values
('78300000-0000-4000-8000-000000000001','SERIES','P75 Multi Alpha','p75-multi-alpha','en','IN','ACTIVE'),
('78300000-0000-4000-8000-000000000002','SERIES','P75 Multi Beta','p75-multi-beta','en','IN','ACTIVE');

insert into public.raw_items (
  id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,last_seen_at,item_type,raw_title,raw_text,normalized_text,media_type,metadata,content_fingerprint
) values
('78400000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','a1','https://www.youtube.com/watch?v=p75multia1','2026-10-01 01:00+00','2026-10-01 01:01+00','2026-10-01 01:01+00','VIDEO','P75 Multi Alpha Promo 1','P75 Multi Alpha','p75 multi alpha promo 1','VIDEO','{}','p75-multi-a1'),
('78400000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000001','a2','https://www.youtube.com/watch?v=p75multia2','2026-10-01 02:00+00','2026-10-01 02:01+00','2026-10-01 02:01+00','VIDEO','P75 Multi Alpha Promo 2','P75 Multi Alpha','p75 multi alpha promo 2','VIDEO','{}','p75-multi-a2'),
('78400000-0000-4000-8000-000000000003','78200000-0000-4000-8000-000000000001','b1','https://www.youtube.com/watch?v=p75multib1','2026-10-01 03:00+00','2026-10-01 03:01+00','2026-10-01 03:01+00','VIDEO','P75 Multi Beta Promo 1','P75 Multi Beta','p75 multi beta promo 1','VIDEO','{}','p75-multi-b1'),
('78400000-0000-4000-8000-000000000004','78200000-0000-4000-8000-000000000001','b2','https://www.youtube.com/watch?v=p75multib2','2026-10-01 04:00+00','2026-10-01 04:01+00','2026-10-01 04:01+00','VIDEO','P75 Multi Beta Promo 2','P75 Multi Beta','p75 multi beta promo 2','VIDEO','{}','p75-multi-b2');

insert into public.entity_resolution_results (
  id,raw_item_id,entity_id,score,resolution_state,methods,engine_version,created_at
) values
('78500000-0000-4000-8000-000000000001','78400000-0000-4000-8000-000000000001','78300000-0000-4000-8000-000000000001',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 01:02+00'),
('78500000-0000-4000-8000-000000000002','78400000-0000-4000-8000-000000000002','78300000-0000-4000-8000-000000000001',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 02:02+00'),
('78500000-0000-4000-8000-000000000003','78400000-0000-4000-8000-000000000003','78300000-0000-4000-8000-000000000002',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 03:02+00'),
('78500000-0000-4000-8000-000000000004','78400000-0000-4000-8000-000000000004','78300000-0000-4000-8000-000000000002',0.9800,'RESOLVED','[{"method":"CANONICAL_TITLE_ALIAS"}]','canonical-title-resolver-v1','2026-10-01 04:02+00');

select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 08:10+00',21)$$,
  'one source can refresh multiple title proposals safely'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_proposals where source_identity_id='78200000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'multi-title official source receives two independent proposals'
);
select results_eq(
  $$select evidence_count from public.source_entity_relationship_proposals where source_identity_id='78200000-0000-4000-8000-000000000001'::uuid and entity_id='78300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::integer],
  'first proposal counts two current raw items'
);
select results_eq(
  $$select evidence_count from public.source_entity_relationship_proposals where source_identity_id='78200000-0000-4000-8000-000000000001'::uuid and entity_id='78300000-0000-4000-8000-000000000002'::uuid$$,
  array[2::integer],
  'second proposal counts two current raw items'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence er join public.source_entity_relationship_proposals p on p.id=er.proposal_id where p.source_identity_id='78200000-0000-4000-8000-000000000001'::uuid and p.entity_id='78300000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'first proposal retains its full evidence ledger'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence er join public.source_entity_relationship_proposals p on p.id=er.proposal_id where p.source_identity_id='78200000-0000-4000-8000-000000000001'::uuid and p.entity_id='78300000-0000-4000-8000-000000000002'::uuid$$,
  array[2::bigint],
  'second proposal retains its full evidence ledger'
);
select lives_ok(
  $$select public.refresh_source_entity_relationship_proposals('2026-10-02 08:15+00',21)$$,
  'multi-proposal refresh remains idempotent'
);
select results_eq(
  $$select count(*) from public.source_entity_relationship_evidence er join public.source_entity_relationship_proposals p on p.id=er.proposal_id where p.source_identity_id='78200000-0000-4000-8000-000000000001'::uuid$$,
  array[4::bigint],
  'repeated refresh keeps exactly four evidence rows across two proposals'
);

select * from finish();
rollback;
