begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active) values
('74100000-0000-4000-8000-000000000001','P7.2 Origin A',1,'PRODUCTION_HOUSE','IN',array['te','en'],true),
('74100000-0000-4000-8000-000000000002','P7.2 Origin B',1,'MUSIC_LABEL','IN',array['te','en'],true),
('74100000-0000-4000-8000-000000000003','P7.2 Existing Registry Source',3,'TRADE_MEDIA','IN',array['en'],true);

insert into public.source_identities (
  id,source_id,platform,platform_identity_id,canonical_url,connector_type,poll_class,access_mode,active
) values
('74200000-0000-4000-8000-000000000001','74100000-0000-4000-8000-000000000001','WEB',null,'https://origin-a.example/news','FIRST_PARTY_HTML','NORMAL_60M','PUBLIC_WEB',true),
('74200000-0000-4000-8000-000000000002','74100000-0000-4000-8000-000000000002','WEB',null,'https://origin-b.example/news','FIRST_PARTY_HTML','NORMAL_60M','PUBLIC_WEB',true),
('74200000-0000-4000-8000-000000000003','74100000-0000-4000-8000-000000000003','X','existinghandle','https://x.com/existinghandle','X_PROFILE','MANUAL','MANUAL',true);

select ok(
  (select relrowsecurity from pg_class where oid='public.source_officiality_proposals'::regclass),
  'officiality proposals have RLS enabled'
);

select ok(
  not has_table_privilege('authenticated','public.source_officiality_proposals','SELECT'),
  'authenticated clients cannot directly read service-owned officiality proposals'
);

select ok(
  not has_function_privilege('authenticated','public.refresh_source_officiality_proposals(timestamptz)','EXECUTE'),
  'authenticated clients cannot invoke the proposal refresh function'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://www.instagram.com/p72origin',
    'https://www.instagram.com/p72origin',
    'INSTAGRAM_PROFILE',
    'OFFICIAL_LINK',
    '@p72origin',
    '74200000-0000-4000-8000-000000000001'::uuid,
    'PRODUCTION_HOUSE',
    'IN',
    array['te','en']::text[],
    0.92,
    '{"platformIdentityKey":"p72origin","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}'::jsonb,
    'OFFICIAL_LINK',
    'https://origin-a.example/news/item-1',
    'Tier-A source linked this profile',
    '{"originSourceId":"74100000-0000-4000-8000-000000000001","originSourceIdentityId":"74200000-0000-4000-8000-000000000001","originAuthorityTier":1}'::jsonb
  )$$,
  'Tier-A official self-link can submit a candidate without activating it'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:00+00')$$,
  'officiality proposal refresh completes'
);

select results_eq(
  $$select proposal_type from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p72origin'$$,
  array['ADD_IDENTITY_TO_EXISTING_SOURCE'::text],
  'one Tier-A self-matching origin proposes another identity for that existing source'
);

select results_eq(
  $$select matched_source_id from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p72origin'$$,
  array['74100000-0000-4000-8000-000000000001'::uuid],
  'self-matching proposal points to the Tier-A owner source'
);

select results_eq(
  $$select proposed_authority_tier from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p72origin'$$,
  array[1::smallint],
  'self-matching proposal inherits authority only as an operator-reviewed suggestion'
);

select ok(
  (select officiality_score >= 0.9000 and coalesce((rationale->>'ownershipSelfMatch')::boolean,false)
   from public.source_officiality_proposals p
   join public.source_discovery_candidates c on c.id=p.candidate_id
   where c.normalized_url='https://www.instagram.com/p72origin'),
  'direct Tier-A self-link receives high proposal confidence and explicit self-match evidence'
);

select results_eq(
  $$select status from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p72origin'$$,
  array['PENDING'::text],
  'proposal refresh never auto-approves the candidate'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://www.instagram.com/unrelatedpartner',
    'https://www.instagram.com/unrelatedpartner',
    'INSTAGRAM_PROFILE',
    'OFFICIAL_LINK',
    '@unrelatedpartner',
    '74200000-0000-4000-8000-000000000001'::uuid,
    'PRODUCTION_HOUSE',
    'IN',
    array['te','en']::text[],
    0.92,
    '{"platformIdentityKey":"unrelatedpartner","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}'::jsonb,
    'OFFICIAL_LINK',
    'https://origin-a.example/news/item-partner',
    'Tier-A source linked a partner profile',
    '{"originSourceId":"74100000-0000-4000-8000-000000000001","originSourceIdentityId":"74200000-0000-4000-8000-000000000001","originAuthorityTier":1}'::jsonb
  )$$,
  'Tier-A cross-link can be retained as relevance evidence'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:02+00')$$,
  'officiality refresh safely handles a single-origin partner cross-link'
);

select ok(
  (select proposal_type='REVIEW_OWNERSHIP'
      and matched_source_id is null
      and proposed_authority_tier is null
      and not coalesce((rationale->>'ownershipSelfMatch')::boolean,false)
   from public.source_officiality_proposals p
   join public.source_discovery_candidates c on c.id=p.candidate_id
   where c.normalized_url='https://www.instagram.com/unrelatedpartner'),
  'one Tier-A link never assigns ownership or authority without a self-match'
);

select ok(
  (select officiality_score <= 0.8000
   from public.source_officiality_proposals p
   join public.source_discovery_candidates c on c.id=p.candidate_id
   where c.normalized_url='https://www.instagram.com/unrelatedpartner'),
  'partner cross-link confidence is capped below self-link confidence'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://www.instagram.com/p72origin',
    'https://www.instagram.com/p72origin',
    'INSTAGRAM_PROFILE',
    'OFFICIAL_LINK',
    '@p72origin',
    '74200000-0000-4000-8000-000000000002'::uuid,
    'MUSIC_LABEL',
    'IN',
    array['te','en']::text[],
    0.92,
    '{"platformIdentityKey":"p72origin","originLinkOnly":true}'::jsonb,
    'OFFICIAL_LINK',
    'https://origin-b.example/news/item-2',
    'A second Tier-A source linked the same profile',
    '{"originSourceId":"74100000-0000-4000-8000-000000000002","originSourceIdentityId":"74200000-0000-4000-8000-000000000002","originAuthorityTier":1}'::jsonb
  )$$,
  'a second independent Tier-A observation is retained as evidence'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:05+00')$$,
  'proposal refresh handles ownership ambiguity'
);

select ok(
  (select proposal_type='REVIEW_OWNERSHIP' and matched_source_id is null and distinct_origin_sources=2
   from public.source_officiality_proposals p
   join public.source_discovery_candidates c on c.id=p.candidate_id
   where c.normalized_url='https://www.instagram.com/p72origin'),
  'multiple Tier-A origins downgrade the candidate to explicit ownership review'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://x.com/existinghandle',
    'https://x.com/existinghandle',
    'X_PROFILE',
    'OFFICIAL_LINK',
    '@existinghandle',
    '74200000-0000-4000-8000-000000000001'::uuid,
    'TRADE_MEDIA',
    'IN',
    array['en']::text[],
    0.92,
    '{"platformIdentityKey":"existinghandle","originLinkOnly":true}'::jsonb,
    'OFFICIAL_LINK',
    'https://origin-a.example/news/item-3',
    'Tier-A source linked an identity already in the registry',
    '{"originSourceId":"74100000-0000-4000-8000-000000000001","originAuthorityTier":1}'::jsonb
  )$$,
  'exact-registry candidate can be recorded for deterministic matching'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:10+00')$$,
  'proposal refresh resolves exact registry identity matches'
);

select ok(
  (select proposal_type='EXACT_IDENTITY'
      and matched_source_identity_id='74200000-0000-4000-8000-000000000003'::uuid
      and matched_source_id='74100000-0000-4000-8000-000000000003'::uuid
      and officiality_score=1.0000
   from public.source_officiality_proposals p
   join public.source_discovery_candidates c on c.id=p.candidate_id
   where c.normalized_url='https://x.com/existinghandle'),
  'exact canonical URL produces a 1.0 duplicate proposal without mutating registry state'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://manual.example.com',
    'https://manual.example.com',
    'PUBLIC_WEB',
    'OPERATOR',
    'Manual candidate',
    null,
    null,
    'IN',
    array['en']::text[],
    0.7,
    '{}'::jsonb,
    'OPERATOR_NOTE',
    null,
    'Manual candidate should stay outside automatic officiality scoring',
    '{}'::jsonb
  )$$,
  'manual candidates remain supported'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:15+00')$$,
  'automatic proposal refresh remains deterministic with manual candidates present'
);

select results_eq(
  $$select count(*) from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://manual.example.com'$$,
  array[0::bigint],
  'manual candidates are not assigned automated officiality proposals'
);

select lives_ok(
  $$select public.operator_review_source_candidate(
    '74300000-0000-4000-8000-000000000001'::uuid,
    (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p72origin'),
    'REJECTED',
    'Cross-source ownership is ambiguous; do not activate this identity',
    null
  )$$,
  'operator can reject an automatic proposal candidate'
);

select lives_ok(
  $$select public.refresh_source_officiality_proposals('2026-10-01 14:20+00')$$,
  'terminal candidate review resolves its automatic proposal'
);

select results_eq(
  $$select p.status from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p72origin'$$,
  array['RESOLVED'::text],
  'rejected candidates resolve rather than being re-opened by automation'
);

select results_eq(
  $$select count(*) from public.source_identities where source_id='74100000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'automatic discovery never creates a trusted identity by itself'
);

select * from finish();
rollback;
