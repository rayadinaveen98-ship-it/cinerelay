begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.entities (id, entity_type, canonical_name, slug, status)
values ('11000000-0000-4000-8000-000000000001', 'MOVIE', 'Registration Film', 'registration-film-test', 'ACTIVE');

select lives_ok(
  $$select * from public.register_youtube_source(
    'UCbbbbbbbbbbbbbbbbbbbbbb',
    'Registration Studio',
    '@registrationstudio',
    'UUbbbbbbbbbbbbbbbbbbbbbb',
    1,
    'PRODUCTION_HOUSE',
    array['11000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  'first registration atomically creates the YouTube source graph'
);

select results_eq(
  $$select count(*) from public.source_identities where platform = 'YOUTUBE' and platform_identity_id = 'UCbbbbbbbbbbbbbbbbbbbbbb'$$,
  array[1::bigint],
  'first registration creates exactly one YouTube identity'
);

select lives_ok(
  $$select * from public.register_youtube_source(
    'UCbbbbbbbbbbbbbbbbbbbbbb',
    'Registration Studio Updated',
    '@registrationstudio',
    'UUbbbbbbbbbbbbbbbbbbbbbb',
    1,
    'PRODUCTION_HOUSE',
    array['11000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  're-registration safely updates the existing source graph'
);

select results_eq(
  $$select count(*) from public.sources s join public.source_identities si on si.source_id = s.id where si.platform = 'YOUTUBE' and si.platform_identity_id = 'UCbbbbbbbbbbbbbbbbbbbbbb'$$,
  array[1::bigint],
  're-registration does not create an orphan or duplicate source parent'
);

select * from finish();
rollback;
