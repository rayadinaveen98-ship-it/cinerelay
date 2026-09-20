begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('26100000-0000-4000-8000-000000000001', 'OTT Promotion Official', 1, 'OTT_PLATFORM', true),
  ('26100000-0000-4000-8000-000000000002', 'OTT Promotion Trade', 3, 'TRADE_MEDIA', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '36100000-0000-4000-8000-000000000001', '26100000-0000-4000-8000-000000000001', 'YOUTUBE',
    'ott-promotion-official', 'https://youtube.example/ott-promotion-official', 'YOUTUBE_WEBSUB', 'PUSH_PRIMARY', 'API', true
  ),
  (
    '36100000-0000-4000-8000-000000000002', '26100000-0000-4000-8000-000000000002', 'RSS',
    'ott-promotion-trade', 'https://trade.example/ott-promotion.xml', 'RSS_ATOM', 'ACTIVE_15M', 'FEED', true
  );

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '56100000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000001', 'ottPromoteOfficial',
    'https://youtube.example/watch/official', now(), now(), now(), 'VIDEO',
    'Verified OTT Film Movie, Streaming from Sept 25th', 'Official OTT platform confirms the movie.',
    'verified ott film movie streaming from sept 25th official ott platform confirms the movie', '{}'::jsonb, repeat('f', 64)
  ),
  (
    '56100000-0000-4000-8000-000000000002', '36100000-0000-4000-8000-000000000002', 'ottPromoteTrade',
    'https://trade.example/verified-ott-film', now(), now(), now(), 'RSS_ITEM',
    'Verified OTT Film Movie streaming September 25', 'Trade report corroborates the official OTT date.',
    'verified ott film movie streaming september 25 trade report corroborates the official ott date', '{}'::jsonb, repeat('a', 64)
  ),
  (
    '56100000-0000-4000-8000-000000000003', '36100000-0000-4000-8000-000000000001', 'nonOttOfficial',
    'https://youtube.example/watch/non-ott', now(), now(), now(), 'VIDEO',
    'Ordinary Candidate', 'Not an OTT release signal.', 'ordinary candidate not an ott release signal', '{}'::jsonb, repeat('1', 64)
  ),
  (
    '56100000-0000-4000-8000-000000000004', '36100000-0000-4000-8000-000000000002', 'nonOttTrade',
    'https://trade.example/non-ott', now(), now(), now(), 'RSS_ITEM',
    'Ordinary Candidate', 'Still not an OTT release signal.', 'ordinary candidate still not an ott release signal', '{}'::jsonb, repeat('2', 64)
  );

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
    'Verified OTT Film','MOVIE','56100000-0000-4000-8000-000000000001'::uuid,
    0.97,'te','IN','DETERMINISTIC_TITLE',0.98,
    '{"signalType":"OTT_RELEASE","providerCode":"SONYLIV","releaseDate":"2026-09-25"}'::jsonb
  )$$,
  'first-party deterministic OTT release evidence can submit a movie candidate'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='verified ott film' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[false],
  'one source cannot auto-promote an OTT title'
);

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
    'Verified OTT Film','MOVIE','56100000-0000-4000-8000-000000000002'::uuid,
    0.92,'te','IN','DETERMINISTIC_TITLE',0.90,
    '{"signalType":"OTT_RELEASE","providerCode":"SONYLIV","releaseDate":"2026-09-25"}'::jsonb
  )$$,
  'independent trade evidence can corroborate the same deterministic OTT title candidate'
);

select results_eq(
  $$select evidence_count::text || ':' || source_count::text || ':' || first_party_source_count::text
    from public.entity_discovery_candidates
    where normalized_name='verified ott film' and proposed_entity_type='MOVIE'$$,
  array['2:2:1'::text],
  'verified OTT candidate has two independent sources including first-party evidence'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='verified ott film' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[true],
  'verified two-source OTT movie candidate is system promoted'
);

select results_eq(
  $$select count(*) from public.entities
    where entity_type='MOVIE' and status='ACTIVE'
      and public.normalize_entity_discovery_name(canonical_name)='verified ott film'$$,
  array[1::bigint],
  'system promotion creates exactly one canonical movie entity'
);

select results_eq(
  $$select status || ':' || (promoted_entity_id is not null)::text
    from public.entity_discovery_candidates
    where normalized_name='verified ott film' and proposed_entity_type='MOVIE'$$,
  array['PROMOTED:true'::text],
  'candidate records its promoted canonical entity'
);

select results_eq(
  $$select
      (select count(*) from public.operator_resolution_overrides oro
        join public.entities e on e.id=oro.entity_id
        where public.normalize_entity_discovery_name(e.canonical_name)='verified ott film'
          and oro.active=true)::text || ':' ||
      (select count(*) from public.source_entity_candidates sec
        join public.entities e on e.id=sec.entity_id
        where public.normalize_entity_discovery_name(e.canonical_name)='verified ott film'
          and sec.active=true)::text$$,
  array['2:0'::text],
  'promotion preserves both evidence items without teaching broad OTT/trade source scope'
);

select results_eq(
  $$select count(*) from public.jobs
    where idempotency_key like 'process:ott-entity-promotion:%'
      and payload->>'rawItemId' in (
        '56100000-0000-4000-8000-000000000001',
        '56100000-0000-4000-8000-000000000002'
      )$$,
  array[2::bigint],
  'promotion re-enqueues both OTT evidence items for canonical processing'
);

select results_eq(
  $$select count(*) from public.audit_actions aa
    join public.entities e on e.id=aa.target_id
    where aa.actor_type='SYSTEM'
      and aa.action_type='SYSTEM_PROMOTE_VERIFIED_OTT_CANDIDATE'
      and public.normalize_entity_discovery_name(e.canonical_name)='verified ott film'$$,
  array[1::bigint],
  'system OTT promotion is auditable as a SYSTEM action'
);

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
      'Ordinary Candidate','MOVIE','56100000-0000-4000-8000-000000000003'::uuid,
      0.97,'te','IN','DETERMINISTIC_TITLE',0.98,'{}'::jsonb
    );
    select public.submit_entity_discovery_candidate(
      'Ordinary Candidate','MOVIE','56100000-0000-4000-8000-000000000004'::uuid,
      0.92,'te','IN','DETERMINISTIC_TITLE',0.90,'{}'::jsonb
    );$$,
  'ordinary deterministic candidates can still collect evidence normally'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='ordinary candidate' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[false],
  'non-OTT candidate cannot use the OTT system promotion path'
);

select results_eq(
  $$select
      has_function_privilege('anon', 'public.system_promote_verified_ott_candidate(uuid)', 'EXECUTE')::text || ':' ||
      has_function_privilege('service_role', 'public.system_promote_verified_ott_candidate(uuid)', 'EXECUTE')::text$$,
  array['false:true'::text],
  'OTT system promotion is service-only'
);

select * from finish();
rollback;
