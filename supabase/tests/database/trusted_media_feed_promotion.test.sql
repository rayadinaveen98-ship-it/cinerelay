begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.source_discovery_candidates (
  id, candidate_url, normalized_url, display_name, candidate_kind,
  discovery_method, proposed_source_role, territory, languages, confidence, status
) values (
  'a1000000-0000-4000-8000-000000000001',
  'https://media.example.com/cinema/feed/',
  'https://media.example.com/cinema/feed/',
  'Trusted Cinema Desk',
  'RSS_ATOM',
  'OPERATOR',
  'TRADE_MEDIA',
  'IN',
  array['en'],
  0.90,
  'APPROVED'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.operator_promote_media_feed_candidate(uuid,uuid,smallint,text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke media-feed promotion RPC directly'
);

select throws_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    1,
    'NORMAL_60M',
    'Should not allow direct-source authority'
  )$$,
  'P0001',
  'media_authority_tier_must_be_3_or_4',
  'media promotion cannot assign Tier 1 authority'
);

select throws_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    3,
    'HOT_5M',
    'Should not use hot cadence for media feeds'
  )$$,
  'P0001',
  'invalid_media_feed_poll_class',
  'media promotion rejects HOT_5M cadence'
);

select lives_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    3,
    'NORMAL_60M',
    'Reviewed cinema publication with a publisher-owned RSS feed'
  )$$,
  'approved RSS candidate can be explicitly promoted as Tier 3 trade media'
);

select results_eq(
  $$select status from public.source_discovery_candidates where id='a1000000-0000-4000-8000-000000000001'::uuid$$,
  array['PROMOTED'::text],
  'candidate becomes PROMOTED only after explicit promotion action'
);

select results_eq(
  $$select authority_tier from public.sources where display_name='Trusted Cinema Desk'$$,
  array[3::smallint],
  'promoted trade-media source receives exactly Tier 3 authority'
);

select results_eq(
  $$select source_role from public.sources where display_name='Trusted Cinema Desk'$$,
  array['TRADE_MEDIA'::text],
  'Tier 3 media promotion receives TRADE_MEDIA role'
);

select results_eq(
  $$select platform || ':' || connector_type || ':' || access_mode || ':' || poll_class
    from public.source_identities
    where id=(select promoted_source_identity_id from public.source_discovery_candidates where id='a1000000-0000-4000-8000-000000000001'::uuid)$$,
  array['RSS:RSS_ATOM:FEED:NORMAL_60M'::text],
  'promotion creates an RSS identity on the existing feed connector contract'
);

select results_eq(
  $$select count(*) from public.feed_source_state
    where source_identity_id=(select promoted_source_identity_id from public.source_discovery_candidates where id='a1000000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::bigint],
  'promotion atomically registers feed runtime state'
);

select results_eq(
  $$select count(*) from public.source_health
    where source_identity_id=(select promoted_source_identity_id from public.source_discovery_candidates where id='a1000000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::bigint],
  'promotion creates connector health state through feed registration'
);

select results_eq(
  $$select count(*) from public.audit_actions
    where action_type='PROMOTE_SOURCE_CANDIDATE'
      and target_type='SOURCE_CANDIDATE'
      and target_id='a1000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'promotion is audited'
);

select throws_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    3,
    'NORMAL_60M',
    'Cannot promote twice'
  )$$,
  'P0001',
  'source_candidate_already_promoted',
  'promoted candidate cannot be promoted twice'
);

insert into public.source_discovery_candidates (
  id, candidate_url, normalized_url, display_name, candidate_kind,
  discovery_method, territory, languages, confidence, status
) values (
  'a1000000-0000-4000-8000-000000000002',
  'https://media.example.com/unreviewed/feed/',
  'https://media.example.com/unreviewed/feed/',
  'Unreviewed Media',
  'RSS_ATOM',
  'OPERATOR',
  'IN',
  array['en'],
  0.70,
  'PENDING'
);

select throws_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000002'::uuid,
    4,
    'COLD_6H',
    'Cannot skip review'
  )$$,
  'P0001',
  'source_candidate_must_be_approved',
  'promotion cannot bypass candidate approval'
);

update public.source_discovery_candidates
set status='APPROVED', candidate_kind='PUBLIC_WEB'
where id='a1000000-0000-4000-8000-000000000002'::uuid;

select throws_ok(
  $$select public.operator_promote_media_feed_candidate(
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000002'::uuid,
    4,
    'COLD_6H',
    'Pages need their own parser onboarding path'
  )$$,
  'P0001',
  'media_feed_promotion_requires_rss_atom_candidate',
  'RSS promotion path refuses public-page candidates'
);

select results_eq(
  $$select count(*) from public.sources where display_name='Unreviewed Media'$$,
  array[0::bigint],
  'failed promotion paths create no source'
);

select * from finish();
rollback;
