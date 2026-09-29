begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('25000000-0000-4000-8000-000000000001', 'Operator Broad Studio', 1, 'PRODUCTION_HOUSE', true),
  ('25000000-0000-4000-8000-000000000002', 'Operator Film Official', 1, 'PROJECT_OFFICIAL', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '35000000-0000-4000-8000-000000000001', '25000000-0000-4000-8000-000000000001', 'YOUTUBE',
    'UCoperatorBroad000000001', 'https://www.youtube.com/channel/UCOperatorBroad000000001',
    'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
  ),
  (
    '35000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000002', 'YOUTUBE',
    'UCOperatorFilm0000000001', 'https://www.youtube.com/channel/UCOperatorFilm0000000001',
    'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
  );

insert into public.entities (id, entity_type, canonical_name, slug, primary_language, country_code, status)
values ('45000000-0000-4000-8000-000000000010', 'MOVIE', 'Operator Scope Film', 'operator-scope-film', 'te', 'IN', 'ACTIVE');

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '55000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', 'operatorBroad1',
    'https://www.youtube.com/watch?v=operatorBroad1', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Broad studio ambiguous post', 'Reviewed item belongs to Operator Scope Film',
    'broad studio ambiguous post reviewed item belongs to operator scope film',
    '{}'::jsonb, repeat('9', 64)
  ),
  (
    '55000000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000002', 'operatorOfficial1',
    'https://www.youtube.com/watch?v=operatorOfficial1', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Operator Scope Film official update', 'Official project channel update',
    'operator scope film official update official project channel update',
    '{}'::jsonb, repeat('a', 64)
  );

select results_eq(
  $$select (public.operator_resolve_raw_item(
    '65000000-0000-4000-8000-000000000001'::uuid,
    '55000000-0000-4000-8000-000000000001'::uuid,
    'Reviewed broad-source item only',
    '45000000-0000-4000-8000-000000000010'::uuid
  )->>'sourceScopeApplied')::boolean$$,
  array[false],
  'broad-source operator resolution remains item-level'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides
    where raw_item_id='55000000-0000-4000-8000-000000000001'::uuid and active=true$$,
  array[1::bigint],
  'broad-source operator resolution creates one active item override'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates
    where source_identity_id='35000000-0000-4000-8000-000000000001'::uuid and active=true$$,
  array[0::bigint],
  'broad source receives no durable entity scope'
);

select results_eq(
  $$select (public.operator_resolve_raw_item(
    '65000000-0000-4000-8000-000000000001'::uuid,
    '55000000-0000-4000-8000-000000000002'::uuid,
    'Reviewed project-official item',
    '45000000-0000-4000-8000-000000000010'::uuid
  )->>'sourceScopeApplied')::boolean$$,
  array[true],
  'project-official operator resolution may teach durable source scope'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides
    where raw_item_id='55000000-0000-4000-8000-000000000002'::uuid and active=true$$,
  array[1::bigint],
  'project-official resolution still creates its item override'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates
    where source_identity_id='35000000-0000-4000-8000-000000000002'::uuid
      and entity_id='45000000-0000-4000-8000-000000000010'::uuid
      and relationship='OPERATOR_REVIEW' and active=true$$,
  array[1::bigint],
  'project-official identity receives one durable operator scope'
);

select results_eq(
  $$select count(*) from public.audit_actions
    where action_type='RESOLVE_RAW_ITEM'
      and target_id='55000000-0000-4000-8000-000000000001'::uuid
      and after_json->>'sourceScopeApplied'='false'$$,
  array[1::bigint],
  'broad-source audit records that source scope was not applied'
);

select results_eq(
  $$select count(*) from public.jobs
    where idempotency_key like 'operator-resolution:%'
      and payload->>'rawItemId' in (
        '55000000-0000-4000-8000-000000000001',
        '55000000-0000-4000-8000-000000000002'
      )$$,
  array[2::bigint],
  'both operator resolutions enqueue normal raw-item replay jobs'
);

select * from finish();
rollback;
