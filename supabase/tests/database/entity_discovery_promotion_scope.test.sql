begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('23000000-0000-4000-8000-000000000001', 'Scope Test Studio', 1, 'PRODUCTION_HOUSE', true),
  ('23000000-0000-4000-8000-000000000002', 'Scope Test Trade', 3, 'TRADE_MEDIA', true),
  ('23000000-0000-4000-8000-000000000003', 'Scope Test Film Official', 1, 'PROJECT_OFFICIAL', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '33000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', 'YOUTUBE',
    'UCscopeStudio000000000001', 'https://www.youtube.com/channel/UCscopeStudio000000000001',
    'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
  ),
  (
    '33000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', 'RSS',
    'scope-trade-feed', 'https://scope.example/trade.xml',
    'RSS_ATOM', 'WARM_15M', 'FEED', true
  ),
  (
    '33000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000003', 'YOUTUBE',
    'UCscopeFilm0000000000001', 'https://www.youtube.com/channel/UCscopeFilm0000000000001',
    'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
  );

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '53000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'scopeBroad1',
    'https://www.youtube.com/watch?v=scopeBroad1', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Scope Safe Film update', 'Scope Safe Film official update', 'scope safe film update scope safe film official update',
    '{}'::jsonb, repeat('1', 64)
  ),
  (
    '53000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000002', 'scopeBroad2',
    'https://scope.example/scope-safe-film', now(), now(), now(), 'RSS_ITEM',
    'Scope Safe Film report', 'Scope Safe Film trade report', 'scope safe film report scope safe film trade report',
    '{}'::jsonb, repeat('2', 64)
  ),
  (
    '53000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000003', 'scopeOfficial1',
    'https://www.youtube.com/watch?v=scopeOfficial1', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Scoped Official Film update', 'Scoped Official Film official update', 'scoped official film update scoped official film official update',
    '{}'::jsonb, repeat('3', 64)
  ),
  (
    '53000000-0000-4000-8000-000000000004', '33000000-0000-4000-8000-000000000001', 'scopeOfficial2',
    'https://www.youtube.com/watch?v=scopeOfficial2', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Scoped Official Film studio update', 'Scoped Official Film studio corroboration', 'scoped official film studio update scoped official film studio corroboration',
    '{}'::jsonb, repeat('4', 64)
  );

select public.submit_entity_discovery_candidate(
  'Scope Safe Film', 'MOVIE', '53000000-0000-4000-8000-000000000001'::uuid,
  0.95, 'te', 'IN', 'OPERATOR', 0.95, '{}'::jsonb
);
select public.submit_entity_discovery_candidate(
  'Scope Safe Film', 'MOVIE', '53000000-0000-4000-8000-000000000002'::uuid,
  0.90, 'te', 'IN', 'OPERATOR', 0.80, '{}'::jsonb
);

select results_eq(
  $$select source_count::text || ':' || first_party_source_count::text
    from public.entity_discovery_candidates
    where normalized_name='scope safe film' and proposed_entity_type='MOVIE'$$,
  array['2:1'::text],
  'broad studio plus trade evidence satisfies the independent evidence counts without implying source scope'
);

select lives_ok(
  $$select public.operator_review_entity_candidate(
    '63000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.entity_discovery_candidates where normalized_name='scope safe film' and proposed_entity_type='MOVIE'),
    'APPROVED', 'Two independent sources with one first-party studio'
  )$$,
  'broad-source candidate can pass evidence review'
);

select lives_ok(
  $$select public.operator_promote_entity_candidate(
    '63000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.entity_discovery_candidates where normalized_name='scope safe film' and proposed_entity_type='MOVIE'),
    'Promote without teaching broad source scope'
  )$$,
  'broad-source candidate can be promoted safely'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates sec
    join public.entities e on e.id=sec.entity_id
    where e.canonical_name='Scope Safe Film' and sec.active=true$$,
  array[0::bigint],
  'promotion creates no durable scope for production-house or trade identities'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides oro
    join public.entities e on e.id=oro.entity_id
    where e.canonical_name='Scope Safe Film' and oro.active=true$$,
  array[2::bigint],
  'reviewed evidence receives item-level resolution overrides'
);

select results_eq(
  $$select count(*) from public.jobs
    where idempotency_key like 'process:entity-promotion-evidence:%'$$,
  array[2::bigint],
  'promotion replays exactly the reviewed broad-source evidence items'
);

select results_eq(
  $$select status from public.entity_discovery_candidates
    where normalized_name='scope safe film' and proposed_entity_type='MOVIE'$$,
  array['PROMOTED'::text],
  'broad-source discovery candidate is marked promoted'
);

select public.submit_entity_discovery_candidate(
  'Scoped Official Film', 'MOVIE', '53000000-0000-4000-8000-000000000003'::uuid,
  0.96, 'te', 'IN', 'OPERATOR', 0.96, '{}'::jsonb
);
select public.submit_entity_discovery_candidate(
  'Scoped Official Film', 'MOVIE', '53000000-0000-4000-8000-000000000004'::uuid,
  0.90, 'te', 'IN', 'OPERATOR', 0.85, '{}'::jsonb
);

select results_eq(
  $$select source_count::text || ':' || first_party_source_count::text
    from public.entity_discovery_candidates
    where normalized_name='scoped official film' and proposed_entity_type='MOVIE'$$,
  array['2:2'::text],
  'project-official role is counted as first-party evidence'
);

select lives_ok(
  $$select public.operator_review_entity_candidate(
    '63000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.entity_discovery_candidates where normalized_name='scoped official film' and proposed_entity_type='MOVIE'),
    'APPROVED', 'Project-official plus studio evidence'
  )$$,
  'project-official candidate passes evidence review'
);

select lives_ok(
  $$select public.operator_promote_entity_candidate(
    '63000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.entity_discovery_candidates where normalized_name='scoped official film' and proposed_entity_type='MOVIE'),
    'Promote with project-specific scope'
  )$$,
  'project-official candidate can be promoted'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates sec
    join public.source_identities si on si.id=sec.source_identity_id
    join public.sources s on s.id=si.source_id
    join public.entities e on e.id=sec.entity_id
    where e.canonical_name='Scoped Official Film' and sec.active=true and s.source_role='PROJECT_OFFICIAL'$$,
  array[1::bigint],
  'project-official identity receives one durable source scope'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates sec
    join public.source_identities si on si.id=sec.source_identity_id
    join public.sources s on s.id=si.source_id
    join public.entities e on e.id=sec.entity_id
    where e.canonical_name='Scoped Official Film' and sec.active=true and s.source_role='PRODUCTION_HOUSE'$$,
  array[0::bigint],
  'corroborating broad studio identity still receives no durable source scope'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides oro
    join public.entities e on e.id=oro.entity_id
    where e.canonical_name='Scoped Official Film' and oro.active=true$$,
  array[2::bigint],
  'project-official promotion still resolves only the reviewed evidence at item level'
);

select * from finish();
rollback;
