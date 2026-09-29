begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('26300000-0000-4000-8000-000000000001', 'Direct OTT Headline Test', 1, 'OTT_PLATFORM', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values (
  '36300000-0000-4000-8000-000000000001', '26300000-0000-4000-8000-000000000001', 'YOUTUBE',
  'direct-ott-headline-test', 'https://youtube.example/direct-ott-headline-test', 'YOUTUBE_WEBSUB', 'PUSH', 'WEBHOOK', true
);

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values (
  '56300000-0000-4000-8000-000000000001', '36300000-0000-4000-8000-000000000001', 'directHeadline',
  'https://youtube.example/watch/direct-headline', now(), now(), now(), 'VIDEO',
  'Ambiguous Title | Streaming Now on JioHotstar', '#AmbiguousTitleOnJioHotstar',
  'ambiguous title streaming now on jiohotstar ambiguous title on jiohotstar', '{}'::jsonb, repeat('5', 64)
);

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
    'Ambiguous Title','MOVIE','56300000-0000-4000-8000-000000000001'::uuid,
    0.97,'ta','IN','DETERMINISTIC_TITLE',0.98,
    '{"signalType":"OTT_RELEASE","providerCode":"JIOHOTSTAR","datePrecision":"TBA","state":"RELEASED","evidenceStatus":"CONFIRMED","releaseType":"POST_THEATRICAL"}'::jsonb
  )$$,
  'clean direct OTT headline can be retained as discovery evidence'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='ambiguous title' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[false],
  'one direct provider headline without an explicit movie or film marker cannot auto-create a movie'
);

select results_eq(
  $$select
      (select count(*) from public.entities where public.normalize_entity_discovery_name(canonical_name)='ambiguous title')::text || ':' ||
      (select count(*) from public.source_entity_candidates sec where sec.source_identity_id='36300000-0000-4000-8000-000000000001' and sec.active=true)::text$$,
  array['0:0'::text],
  'ambiguous direct headline creates neither a canonical movie nor provider-wide film scope'
);

select * from finish();
rollback;
