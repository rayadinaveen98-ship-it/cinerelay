begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.entities (id, entity_type, canonical_name, slug, primary_language, country_code, status)
values
  ('45000000-0000-4000-8000-000000000001', 'MOVIE', 'Title Resolver Film', 'title-resolver-film', 'te', 'IN', 'ACTIVE'),
  ('45000000-0000-4000-8000-000000000002', 'MOVIE', 'OG', 'og-title-resolver-test', 'te', 'IN', 'ACTIVE'),
  ('45000000-0000-4000-8000-000000000003', 'MOVIE', 'Dormant Resolver Film', 'dormant-resolver-film', 'te', 'IN', 'INACTIVE');

insert into public.entity_aliases (entity_id, alias, normalized_alias, language_code, alias_type)
values
  ('45000000-0000-4000-8000-000000000001', '#TitleResolverFilm', 'titleresolverfilm', 'te', 'HASHTAG'),
  ('45000000-0000-4000-8000-000000000002', 'OG', 'og', 'te', 'OFFICIAL'),
  ('45000000-0000-4000-8000-000000000003', 'Dormant Resolver Film', 'dormant resolver film', 'te', 'OFFICIAL');

select results_eq(
  $$select entity_id from public.find_entity_candidates_for_title('Title Resolver Film official update', 12)$$,
  array['45000000-0000-4000-8000-000000000001'::uuid],
  'canonical title mention returns the active movie candidate'
);

select results_eq(
  $$select entity_id from public.find_entity_candidates_for_title('New update from #TitleResolverFilm team', 12)$$,
  array['45000000-0000-4000-8000-000000000001'::uuid],
  'compact hashtag alias resolves to the same movie candidate'
);

select results_eq(
  $$select count(*) from public.find_entity_candidates_for_title('Unrelated studio announcement', 12)$$,
  array[0::bigint],
  'unrelated title returns no canonical candidate'
);

select results_eq(
  $$select count(*) from public.find_entity_candidates_for_title('OG official update', 12)$$,
  array[0::bigint],
  'very short titles are not globally auto-resolved'
);

select results_eq(
  $$select count(*) from public.find_entity_candidates_for_title('Dormant Resolver Film update', 12)$$,
  array[0::bigint],
  'inactive title entities are excluded from automatic resolution'
);

select results_eq(
  $$select match_kind || ':' || compact_length::text from public.find_entity_candidates_for_title('Watch #TitleResolverFilm now', 12)$$,
  array['ALIAS:17'::text],
  'resolver reports the strongest distinctive alias match used for candidate discovery'
);

select * from finish();
rollback;
