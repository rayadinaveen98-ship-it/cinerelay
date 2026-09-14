begin;

create or replace function public.replace_source_entity_candidates(
  p_source_identity_id uuid,
  p_entity_ids uuid[]
)
returns integer
language plpgsql
as $$
declare
  normalized_ids uuid[] := coalesce(p_entity_ids, '{}'::uuid[]);
  invalid_count integer;
  final_count integer;
begin
  if not exists (
    select 1 from public.source_identities where id = p_source_identity_id
  ) then
    raise exception 'source identity not found';
  end if;

  select count(*) into invalid_count
  from unnest(normalized_ids) requested(id)
  left join public.entities e on e.id = requested.id
  where e.id is null
     or e.status <> 'ACTIVE'
     or e.entity_type not in ('MOVIE','SERIES','SEASON');

  if invalid_count > 0 then
    raise exception 'candidate scope contains invalid or inactive title entities';
  end if;

  delete from public.source_entity_candidates
  where source_identity_id = p_source_identity_id
    and not (entity_id = any(normalized_ids));

  insert into public.source_entity_candidates (
    source_identity_id,
    entity_id,
    relationship,
    confidence,
    priority,
    active
  )
  select p_source_identity_id, entity_id, 'PROJECT_COVERAGE', 1, 100, true
  from unnest(normalized_ids) entity_id
  on conflict (source_identity_id, entity_id) do update
    set active = true,
        relationship = excluded.relationship,
        confidence = excluded.confidence,
        priority = excluded.priority,
        valid_to = null,
        updated_at = now();

  select count(*) into final_count
  from public.source_entity_candidates
  where source_identity_id = p_source_identity_id and active = true;

  return final_count;
end;
$$;

comment on function public.replace_source_entity_candidates is 'Atomically replaces the bounded movie/series candidate scope for one source identity after validating all requested entities.';

commit;
