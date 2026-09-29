begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('71000000-0000-4000-8000-000000000001', 'Existing Discovery Source', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values (
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'WEB', null, 'https://existing.example.com/news', 'FIRST_PARTY_HTML', 'NORMAL_60M', 'PUBLIC_WEB', true
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://candidate.example.com/news?utm_source=test',
    'https://candidate.example.com/news',
    'PUBLIC_WEB',
    'OFFICIAL_LINK',
    'Candidate Studio News',
    null,
    'PRODUCTION_HOUSE',
    'IN',
    array['te','en']::text[],
    0.72,
    '{"seed":"test"}'::jsonb,
    'OFFICIAL_LINK',
    'https://candidate.example.com/about',
    'Official site links to the newsroom',
    '{"relation":"official-news"}'::jsonb
  )$$,
  'service path can submit a discovery candidate with evidence'
);

select results_eq(
  $$select count(*) from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'$$,
  array[1::bigint],
  'one candidate is stored by normalized URL'
);

select results_eq(
  $$select status from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'$$,
  array['PENDING'::text],
  'new candidate starts pending review'
);

select results_eq(
  $$select count(*) from public.source_discovery_evidence e join public.source_discovery_candidates c on c.id=e.candidate_id where c.normalized_url='https://candidate.example.com/news'$$,
  array[1::bigint],
  'candidate evidence is stored'
);

select lives_ok(
  $$select public.submit_source_discovery_candidate(
    'https://candidate.example.com/news?utm_source=again',
    'https://candidate.example.com/news',
    'PUBLIC_WEB',
    'CONNECTOR_HINT',
    'Candidate Studio News',
    null,
    'PRODUCTION_HOUSE',
    'IN',
    array['te','en']::text[],
    0.91,
    '{"secondObservation":true}'::jsonb,
    'OFFICIAL_LINK',
    'https://candidate.example.com/about',
    'Official site links to the newsroom',
    '{"relation":"official-news"}'::jsonb
  )$$,
  'resubmitting the same normalized URL is idempotent'
);

select results_eq(
  $$select count(*) from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'$$,
  array[1::bigint],
  'resubmission does not duplicate the candidate'
);

select results_eq(
  $$select count(*) from public.source_discovery_evidence e join public.source_discovery_candidates c on c.id=e.candidate_id where c.normalized_url='https://candidate.example.com/news'$$,
  array[1::bigint],
  'identical evidence is deduplicated'
);

select results_eq(
  $$select confidence from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'$$,
  array[0.9100::numeric],
  're-observation keeps the strongest discovery confidence without assigning authority'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.source_discovery_candidates'::regclass),
  'candidate registry has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.source_discovery_evidence'::regclass),
  'candidate evidence has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.source_discovery_candidates', 'SELECT'),
  'authenticated users cannot directly read source candidates'
);

select ok(
  not has_table_privilege('authenticated', 'public.source_discovery_evidence', 'SELECT'),
  'authenticated users cannot directly read source candidate evidence'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_source_discovery_candidate(text,text,text,text,text,uuid,text,text,text[],numeric,jsonb,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated users cannot submit candidates through the privileged RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.operator_review_source_candidate(uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke candidate review RPC directly'
);

select lives_ok(
  $$select public.operator_review_source_candidate(
    '73000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'),
    'APPROVED',
    'Official evidence is sufficient for a future onboarding decision',
    null
  )$$,
  'operator can approve a candidate for future onboarding'
);

select results_eq(
  $$select status from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'$$,
  array['APPROVED'::text],
  'candidate review status is persisted'
);

select results_eq(
  $$select count(*) from public.audit_actions where action_type='REVIEW_SOURCE_CANDIDATE' and target_type='SOURCE_CANDIDATE'$$,
  array[1::bigint],
  'candidate review is audited'
);

select results_eq(
  $$select count(*) from public.sources where display_name='Candidate Studio News'$$,
  array[0::bigint],
  'approval does not create a real source for the candidate'
);

select results_eq(
  $$select count(*) from public.source_identities where canonical_url in ('https://candidate.example.com/news','https://candidate.example.com/news?utm_source=test','https://candidate.example.com/news?utm_source=again')$$,
  array[0::bigint],
  'approval does not create or promote a source identity for the candidate'
);

select lives_ok(
  $$select public.operator_review_source_candidate(
    '73000000-0000-4000-8000-000000000001'::uuid,
    (select id from public.source_discovery_candidates where normalized_url='https://candidate.example.com/news'),
    'DUPLICATE',
    'Candidate resolves to the existing source identity',
    '72000000-0000-4000-8000-000000000001'::uuid
  )$$,
  'operator can explicitly mark a reviewed candidate as duplicate of a real identity'
);

select * from finish();
rollback;
