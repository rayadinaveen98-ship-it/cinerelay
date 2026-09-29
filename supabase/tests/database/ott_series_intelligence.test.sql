begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  to_regclass('public.ott_series_processing_state') is not null,
  'OTT series processing state table exists'
);

select ok(
  position('proposed_entity_type not in (''MOVIE'',''SERIES'')' in pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure)) > 0,
  'first-party OTT promotion accepts MOVIE and SERIES only'
);

select ok(
  position('e.entity_type = v_candidate.proposed_entity_type' in pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure)) > 0,
  'first-party OTT promotion only binds to the same canonical entity type'
);

select ok(
  position(E'v_candidate.proposed_entity_type,\n      v_candidate.proposed_name' in pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure)) > 0,
  'new first-party OTT entities use the candidate entity type instead of hard-coded MOVIE'
);

select * from finish();
rollback;
