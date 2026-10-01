begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.sources (id,display_name,authority_tier,source_role,territory,languages,active) values
('75100000-0000-4000-8000-000000000001','P74 Studio',1,'PRODUCTION_HOUSE','IN',array['te','en'],true),
('75100000-0000-4000-8000-000000000002','Other Studio',1,'PRODUCTION_HOUSE','IN',array['te','en'],true);

insert into public.source_identities (
  id,source_id,platform,platform_identity_id,handle,canonical_url,connector_type,poll_class,access_mode,connector_config,active
) values
('75200000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','WEB',null,null,'https://p74studio.example/news','FIRST_PARTY_HTML','NORMAL_60M','PUBLIC_WEB','{}',true),
('75200000-0000-4000-8000-000000000002','75100000-0000-4000-8000-000000000002','WEB',null,null,'https://other-studio.example/news','FIRST_PARTY_HTML','NORMAL_60M','PUBLIC_WEB','{}',true);

select ok(
  not has_function_privilege('authenticated','public.operator_attach_discovered_identity(uuid,uuid,text)','EXECUTE'),
  'authenticated clients cannot attach discovered identities directly'
);
select ok(
  not has_function_privilege('authenticated','public.operator_activate_discovered_identity(uuid,uuid,text)','EXECUTE'),
  'authenticated clients cannot activate discovered identities directly'
);

select public.submit_source_discovery_candidate(
  'https://www.instagram.com/p74studio','https://www.instagram.com/p74studio','INSTAGRAM_PROFILE','OFFICIAL_LINK','@p74studio',
  '75200000-0000-4000-8000-000000000001'::uuid,'PRODUCTION_HOUSE','IN',array['te','en'],0.92,
  '{"platformIdentityKey":"p74studio","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}',
  'OFFICIAL_LINK','https://p74studio.example/news/ig','Official Instagram',
  '{"originSourceId":"75100000-0000-4000-8000-000000000001","originAuthorityTier":1}'
);
select public.refresh_source_officiality_proposals('2026-10-01 16:30+00');

select results_eq(
  $$select proposal_type from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p74studio'$$,
  array['ADD_IDENTITY_TO_EXISTING_SOURCE'::text],
  'self-matching official link produces an attachable proposal'
);
select throws_ok(
  $$select public.operator_attach_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p74studio'), 'Verified ownership')$$,
  'candidate_must_be_approved_before_attachment',
  'candidate must be separately approved before attachment'
);
select lives_ok(
  $$select public.operator_review_source_candidate('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p74studio'), 'APPROVED', 'Verified profile ownership independently', null)$$,
  'operator can approve candidate before attachment'
);
select lives_ok(
  $$select public.operator_attach_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p74studio'), 'Attach verified official Instagram as an inactive identity')$$,
  'approved self-link can be attached to existing source'
);
select ok(
  (select si.source_id='75100000-0000-4000-8000-000000000001'::uuid
      and si.platform='INSTAGRAM'
      and si.connector_type='INSTAGRAM_BUSINESS_DISCOVERY'
      and si.access_mode='API'
      and si.active=false
   from public.source_identities si
   join public.source_discovery_candidates c on c.promoted_source_identity_id=si.id
   where c.normalized_url='https://www.instagram.com/p74studio'),
  'attachment creates the expected inactive Instagram identity under the matched source'
);
select results_eq(
  $$select status from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p74studio'$$,
  array['PROMOTED'::text],
  'attached candidate becomes promoted only after explicit operator attachment'
);
select results_eq(
  $$select p.status from public.source_officiality_proposals p join public.source_discovery_candidates c on c.id=p.candidate_id where c.normalized_url='https://www.instagram.com/p74studio'$$,
  array['RESOLVED'::text],
  'attachment resolves the officiality proposal'
);
select ok(
  exists(select 1 from public.audit_actions where action_type='ATTACH_DISCOVERED_SOURCE_IDENTITY' and actor_id='75300000-0000-4000-8000-000000000001'::uuid),
  'attachment writes an audit action'
);
select lives_ok(
  $$select public.operator_activate_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/p74studio'), 'Explicitly enable verified Instagram connector')$$,
  'Instagram activation is a separate explicit action'
);
select ok(
  (select si.active from public.source_identities si join public.source_discovery_candidates c on c.promoted_source_identity_id=si.id where c.normalized_url='https://www.instagram.com/p74studio'),
  'explicit activation changes the identity to active'
);
select ok(
  exists(select 1 from public.instagram_business_source_state st join public.source_discovery_candidates c on c.promoted_source_identity_id=st.source_identity_id where c.normalized_url='https://www.instagram.com/p74studio'),
  'Instagram activation seeds connector runtime state'
);
select ok(
  exists(select 1 from public.audit_actions where action_type='ACTIVATE_DISCOVERED_SOURCE_IDENTITY' and actor_id='75300000-0000-4000-8000-000000000001'::uuid),
  'activation writes a separate audit action'
);

select public.submit_source_discovery_candidate(
  'https://x.com/p74studio','https://x.com/p74studio','X_PROFILE','OFFICIAL_LINK','@p74studio',
  '75200000-0000-4000-8000-000000000001'::uuid,'PRODUCTION_HOUSE','IN',array['te','en'],0.92,
  '{"platformIdentityKey":"p74studio","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}',
  'OFFICIAL_LINK','https://p74studio.example/news/x','Official X profile',
  '{"originSourceId":"75100000-0000-4000-8000-000000000001","originAuthorityTier":1}'
);
select public.refresh_source_officiality_proposals('2026-10-01 16:31+00');
select public.operator_review_source_candidate(
  '75300000-0000-4000-8000-000000000001',
  (select id from public.source_discovery_candidates where normalized_url='https://x.com/p74studio'),
  'APPROVED','Verified X profile ownership independently',null
);
select lives_ok(
  $$select public.operator_attach_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://x.com/p74studio'), 'Attach X identity without starting provider calls')$$,
  'X identity can be attached while provider polling stays off'
);
select ok(
  not (select si.active from public.source_identities si join public.source_discovery_candidates c on c.promoted_source_identity_id=si.id where c.normalized_url='https://x.com/p74studio'),
  'new X identity stays inactive'
);
select throws_ok(
  $$select public.operator_activate_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://x.com/p74studio'), 'Try X activation')$$,
  'x_activation_requires_provider_reenable',
  'X activation remains hard-blocked while provider is intentionally paused'
);
select ok(
  not (select si.active from public.source_identities si join public.source_discovery_candidates c on c.promoted_source_identity_id=si.id where c.normalized_url='https://x.com/p74studio'),
  'blocked X activation leaves identity inactive'
);

select public.submit_source_discovery_candidate(
  'https://www.youtube.com/@p74studio','https://www.youtube.com/@p74studio','YOUTUBE_CHANNEL','OFFICIAL_LINK','@p74studio',
  '75200000-0000-4000-8000-000000000001'::uuid,'PRODUCTION_HOUSE','IN',array['te','en'],0.92,
  '{"platformIdentityKey":"@p74studio","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}',
  'OFFICIAL_LINK','https://p74studio.example/news/youtube','Official YouTube handle',
  '{"originSourceId":"75100000-0000-4000-8000-000000000001","originAuthorityTier":1}'
);
select public.refresh_source_officiality_proposals('2026-10-01 16:32+00');
select public.operator_review_source_candidate(
  '75300000-0000-4000-8000-000000000001',
  (select id from public.source_discovery_candidates where normalized_url='https://www.youtube.com/@p74studio'),
  'APPROVED','Verified channel ownership but channel ID still needs resolution',null
);
select throws_ok(
  $$select public.operator_attach_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.youtube.com/@p74studio'), 'Attach YouTube handle')$$,
  'youtube_channel_id_resolution_required',
  'YouTube handle aliases cannot enter trusted registry without a canonical channel ID'
);
select results_eq(
  $$select status from public.source_discovery_candidates where normalized_url='https://www.youtube.com/@p74studio'$$,
  array['APPROVED'::text],
  'failed YouTube attachment leaves approved candidate unchanged'
);

select public.submit_source_discovery_candidate(
  'https://www.instagram.com/unrelatedp74','https://www.instagram.com/unrelatedp74','INSTAGRAM_PROFILE','OFFICIAL_LINK','@unrelatedp74',
  '75200000-0000-4000-8000-000000000001'::uuid,'PRODUCTION_HOUSE','IN',array['te','en'],0.92,
  '{"platformIdentityKey":"unrelatedp74","originLinkOnly":true,"trustMutation":"PROPOSAL_ONLY","discoveryVersion":"p7.2-direct-link-v2"}',
  'OFFICIAL_LINK','https://p74studio.example/news/partner','Partner profile',
  '{"originSourceId":"75100000-0000-4000-8000-000000000001","originAuthorityTier":1}'
);
select public.refresh_source_officiality_proposals('2026-10-01 16:33+00');
select public.operator_review_source_candidate(
  '75300000-0000-4000-8000-000000000001',
  (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/unrelatedp74'),
  'APPROVED','Relevant but ownership is not established',null
);
select throws_ok(
  $$select public.operator_attach_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://www.instagram.com/unrelatedp74'), 'Attempt unsafe ownership assignment')$$,
  'proposal_not_eligible_for_identity_attachment',
  'ownership-review proposals cannot use the fast attachment lane'
);

insert into public.source_discovery_candidates (
  candidate_url, normalized_url, candidate_kind, discovery_method,
  status, promoted_source_identity_id, metadata
) values (
  'https://legacy-promotion.example.test/profile',
  'https://legacy-promotion.example.test/profile',
  'PUBLIC_WEB', 'OPERATOR', 'PROMOTED',
  '75200000-0000-4000-8000-000000000002'::uuid,
  '{}'::jsonb
);
select throws_ok(
  $$select public.operator_activate_discovered_identity('75300000-0000-4000-8000-000000000001', (select id from public.source_discovery_candidates where normalized_url='https://legacy-promotion.example.test/profile'), 'Attempt legacy activation')$$,
  'candidate_identity_not_p7_attached',
  'legacy promoted candidates cannot enter the P7.4 activation lane'
);

select results_eq(
  $$select count(*) from public.sources where id in ('75100000-0000-4000-8000-000000000001'::uuid,'75100000-0000-4000-8000-000000000002'::uuid)$$,
  array[2::bigint],
  'P7.4 attachment never creates a new source or changes authority scope'
);
select ok(
  (select authority_tier=1 from public.sources where id='75100000-0000-4000-8000-000000000001'::uuid),
  'identity attachment does not mutate source authority'
);

select * from finish();
rollback;
