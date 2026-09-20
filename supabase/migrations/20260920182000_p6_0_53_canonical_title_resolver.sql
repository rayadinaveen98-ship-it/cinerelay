begin;

-- Broad sources cover many projects, so source scope alone cannot safely resolve
-- title identity. This helper returns canonical title candidates only when the
-- item's own headline/title explicitly contains a sufficiently distinctive
-- canonical name or alias. The worker still runs the shared deterministic
-- resolver across the returned candidates so collisions remain AMBIGUOUS.
create or replace function public.find_entity_candidates_for_title(
  p_title text,
  p_limit integer default 12
)
returns table (
  entity_id uuid,
  matched_value text,
  match_kind text,
  compact_length integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with input as (
    select
      public.normalize_entity_discovery_name(coalesce(p_title, '')) as normalized_title,
      replace(public.normalize_entity_discovery_name(coalesce(p_title, '')), ' ', '') as compact_title
  ),
  candidate_values as (
    select
      e.id as entity_id,
      public.normalize_entity_discovery_name(e.canonical_name) as normalized_value,
      e.canonical_name as display_value,
      'CANONICAL_NAME'::text as match_kind
    from public.entities e
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')

    union all

    select
      ea.entity_id,
      public.normalize_entity_discovery_name(ea.alias) as normalized_value,
      ea.alias as display_value,
      'ALIAS'::text as match_kind
    from public.entity_aliases ea
    join public.entities e on e.id = ea.entity_id
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and ea.valid_to is null
  ),
  matched as (
    select
      cv.entity_id,
      cv.display_value,
      cv.match_kind,
      char_length(replace(cv.normalized_value, ' ', '')) as compact_length
    from candidate_values cv
    cross join input i
    where char_length(i.compact_title) > 0
      and char_length(replace(cv.normalized_value, ' ', '')) >= 6
      and i.compact_title like '%' || replace(cv.normalized_value, ' ', '') || '%'
  ),
  ranked as (
    select distinct on (m.entity_id)
      m.entity_id,
      m.display_value,
      m.match_kind,
      m.compact_length
    from matched m
    order by m.entity_id, m.compact_length desc, m.match_kind asc
  )
  select r.entity_id, r.display_value, r.match_kind, r.compact_length
  from ranked r
  order by r.compact_length desc, r.entity_id
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

revoke all on function public.find_entity_candidates_for_title(text,integer)
  from public, anon, authenticated;
grant execute on function public.find_entity_candidates_for_title(text,integer)
  to service_role;

commit;
