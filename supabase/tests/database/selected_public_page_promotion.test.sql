begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.source_discovery_candidates (
  id, candidate_url, normalized_url, display_name, candidate_kind,
  discovery_method, proposed_source_role, territory, languages, confidence, status
) values (
  'b1000000-0000-4000-8000-000000000001',
  'https://pages.example.com/cinema/news',
  'https://pages.example.com/cinema/news',
  'Selected Cinema Page',
  'PUBLIC_WEB',
  'OPERATOR',
  'DISCOVERY_ONLY',
  'IN',
  array['en'],
  0.80,
  'APPROVED'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.operator_promote_selected_public_page_candidate(uuid,uuid,integer,text,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke selected-public-page promotion RPC directly'
);

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    2,
    'NORMAL_60M',
    '{"profileVersion":"selected-v1","itemSelector":"article","linkSelector":"a"}'::jsonb,
    'Tier 2 must remain reserved for stronger direct-source trust'
  )$$,
  'P0001',
  'public_page_authority_tier_must_be_3_4_or_5',
  'selected public pages cannot assign Tier 1/2 authority'
);

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'ACTIVE_15M',
    '{"profileVersion":"selected-v1","itemSelector":"article","linkSelector":"a"}'::jsonb,
    'Selected pages must use slow polling'
  )$$,
  'P0001',
  'invalid_public_page_poll_class',
  'selected public pages reject 15-minute polling'
);

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'NORMAL_60M',
    '{"profileVersion":"selected-v1","linkSelector":"a"}'::jsonb,
    'Bad parser profiles must fail before trust is created'
  )$$,
  'P0001',
  'public_page_item_selector_invalid',
  'selected public page requires a valid parser profile'
);

select lives_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'NORMAL_60M',
    '{"profileVersion":"selected-public-v1","itemSelector":"article","linkSelector":"a","titleSelector":"h2","summarySelector":"p","maxItems":25,"minItems":1,"order":"NEWEST_FIRST"}'::jsonb,
    'Reviewed public page with a bounded deterministic parser profile'
  )$$,
  'approved PUBLIC_WEB candidate can be explicitly promoted as Tier 5 discovery-only page'
);

select results_eq(
  $$select status from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid$$,
  array['PROMOTED'::text],
  'candidate becomes PROMOTED only after explicit page promotion'
);

select results_eq(
  $$select authority_tier from public.sources where display_name='Selected Cinema Page'$$,
  array[5::smallint],
  'selected discovery-only page receives exactly Tier 5 authority'
);

select results_eq(
  $$select source_role from public.sources where display_name='Selected Cinema Page'$$,
  array['DISCOVERY_ONLY'::text],
  'Tier 5 selected page receives DISCOVERY_ONLY role'
);

select results_eq(
  $$select platform || ':' || connector_type || ':' || access_mode || ':' || poll_class
    from public.source_identities
    where id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid)$$,
  array['WEB:FIRST_PARTY_HTML:PUBLIC_WEB:NORMAL_60M'::text],
  'promotion reuses the hardened page connector contract'
);

select results_eq(
  $$select connector_config ->> 'sourceClass'
    from public.source_identities
    where id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid)$$,
  array['SELECTED_PUBLIC_PAGE'::text],
  'identity records selected-public-page provenance explicitly'
);

select results_eq(
  $$select connector_config #>> '{parserProfile,profileVersion}'
    from public.source_identities
    where id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid)$$,
  array['selected-public-v1'::text],
  'parser profile is persisted on the promoted identity'
);

select results_eq(
  $$select count(*) from public.page_source_state
    where source_identity_id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::bigint],
  'promotion atomically registers page runtime state'
);

select results_eq(
  $$select count(*) from public.source_health
    where source_identity_id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::bigint],
  'promotion creates connector health state through page registration'
);

select results_eq(
  $$select count(*) from public.audit_actions
    where action_type='PROMOTE_PUBLIC_PAGE_CANDIDATE'
      and target_type='SOURCE_CANDIDATE'
      and target_id='b1000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'selected public page promotion is audited'
);

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'NORMAL_60M',
    '{"profileVersion":"selected-public-v1","itemSelector":"article","linkSelector":"a"}'::jsonb,
    'Cannot promote twice'
  )$$,
  'P0001',
  'source_candidate_already_promoted',
  'promoted selected page cannot be promoted twice'
);

insert into public.source_discovery_candidates (
  id, candidate_url, normalized_url, display_name, candidate_kind,
  discovery_method, territory, languages, confidence, status
) values (
  'b1000000-0000-4000-8000-000000000002',
  'https://pages.example.com/unreviewed',
  'https://pages.example.com/unreviewed',
  'Unreviewed Public Page',
  'PUBLIC_WEB',
  'OPERATOR',
  'IN',
  array['en'],
  0.60,
  'PENDING'
);

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    4,
    'COLD_6H',
    '{"profileVersion":"selected-v1","itemSelector":"article","linkSelector":"a"}'::jsonb,
    'Review cannot be skipped'
  )$$,
  'P0001',
  'source_candidate_must_be_approved',
  'selected page promotion cannot bypass candidate approval'
);

update public.source_discovery_candidates
set status='APPROVED', candidate_kind='RSS_ATOM'
where id='b1000000-0000-4000-8000-000000000002'::uuid;

select throws_ok(
  $$select public.operator_promote_selected_public_page_candidate(
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    4,
    'COLD_6H',
    '{"profileVersion":"selected-v1","itemSelector":"article","linkSelector":"a"}'::jsonb,
    'RSS sources use the feed onboarding path instead'
  )$$,
  'P0001',
  'selected_public_page_promotion_requires_public_web_candidate',
  'selected page promotion refuses RSS candidates'
);

select results_eq(
  $$select count(*) from public.sources where display_name='Unreviewed Public Page'$$,
  array[0::bigint],
  'failed selected-page promotion paths create no source'
);

select results_eq(
  $$select count(*) from public.page_source_state
    where source_identity_id=(select promoted_source_identity_id from public.source_discovery_candidates where id='b1000000-0000-4000-8000-000000000002'::uuid)$$,
  array[0::bigint],
  'failed selected-page promotion paths create no runtime state'
);

select results_eq(
  $$select count(*) from public.audit_actions
    where action_type='PROMOTE_PUBLIC_PAGE_CANDIDATE'
      and target_id='b1000000-0000-4000-8000-000000000002'::uuid$$,
  array[0::bigint],
  'failed selected-page promotion paths create no promotion audit'
);

select * from finish();
rollback;
