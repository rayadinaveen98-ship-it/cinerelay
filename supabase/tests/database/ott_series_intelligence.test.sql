begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  to_regclass('public.ott_series_processing_state') is not null,
  'OTT series processing state table exists'
);

select like(
  pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure),
  '%proposed_entity_type not in (''MOVIE'',''SERIES'')%',
  'first-party OTT promotion accepts MOVIE and SERIES only'
);

select like(
  pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure),
  '%e.entity_type = v_candidate.proposed_entity_type%',
  'first-party OTT promotion only binds to the same canonical entity type'
);

select like(
  pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure),
  '%v_candidate.proposed_entity_type,%v_candidate.proposed_name%',
  'new first-party OTT entities use the candidate entity type instead of hard-coded MOVIE'
);

select * from finish();
rollback;
