begin;

-- Manual review resolves one raw item. It must not implicitly teach an entire
-- broad studio/trade/OTT/music identity that every future item belongs to the
-- same title. Durable source scope is allowed only for genuinely title-specific
-- PROJECT_OFFICIAL / FILM_OFFICIAL identities.
create or replace function public.operator_resolve_raw_item(
  p_actor_id uuid,
  p_raw_item_id uuid,
  p_reason text,
  p_entity_id uuid default null,
  p_new_entity_name text default null,
  p_new_entity_type text default 'MOVIE',
  p_primary_language text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  source_identity uuid;
  source_role text;
  chosen_entity uuid;
  override_id uuid;
  action_id uuid := gen_random_uuid();
  job_id uuid;
  created_entity boolean := false;
  source_scope_applied boolean := false;
  before_state jsonb;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select r.source_identity_id, s.source_role
  into source_identity, source_role
  from public.raw_items r
  join public.source_identities si on si.id = r.source_identity_id
  join public.sources s on s.id = si.source_id
  where r.id = p_raw_item_id;

  if source_identity is null then raise exception 'raw item not found'; end if;

  if p_entity_id is not null then
    select id into chosen_entity
    from public.entities
    where id = p_entity_id and status = 'ACTIVE' and entity_type in ('MOVIE','SERIES','SEASON');
    if chosen_entity is null then raise exception 'eligible entity not found'; end if;
  else
    if nullif(btrim(coalesce(p_new_entity_name, '')), '') is null then raise exception 'entity id or new entity name required'; end if;
    if p_new_entity_type not in ('MOVIE','SERIES','SEASON') then raise exception 'invalid new entity type'; end if;

    select id into chosen_entity
    from public.entities
    where lower(canonical_name) = lower(btrim(p_new_entity_name))
      and entity_type = p_new_entity_type
      and status = 'ACTIVE'
    order by created_at asc
    limit 1;

    if chosen_entity is null then
      insert into public.entities (entity_type, canonical_name, primary_language, country_code, status)
      values (
        p_new_entity_type,
        btrim(p_new_entity_name),
        nullif(btrim(coalesce(p_primary_language,'')), ''),
        nullif(upper(btrim(coalesce(p_country_code,''))), ''),
        'ACTIVE'
      )
      returning id into chosen_entity;
      created_entity := true;
    end if;
  end if;

  select to_jsonb(o) into before_state
  from public.operator_resolution_overrides o
  where o.raw_item_id = p_raw_item_id;

  insert into public.operator_resolution_overrides (raw_item_id, entity_id, active, reason, created_by)
  values (p_raw_item_id, chosen_entity, true, btrim(p_reason), p_actor_id)
  on conflict (raw_item_id) do update
    set entity_id = excluded.entity_id,
        active = true,
        reason = excluded.reason,
        created_by = excluded.created_by,
        updated_at = now()
  returning id into override_id;

  if source_role in ('PROJECT_OFFICIAL','FILM_OFFICIAL') then
    insert into public.source_entity_candidates (
      source_identity_id, entity_id, relationship, confidence, priority, active, valid_from, valid_to
    ) values (
      source_identity, chosen_entity, 'OPERATOR_REVIEW', 1, 0, true, now(), null
    )
    on conflict (source_identity_id, entity_id) do update
      set relationship = 'OPERATOR_REVIEW',
          confidence = 1,
          priority = least(public.source_entity_candidates.priority, 0),
          active = true,
          valid_to = null,
          updated_at = now();
    source_scope_applied := true;
  end if;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason
  ) values (
    action_id,
    'ADMIN',
    p_actor_id,
    'RESOLVE_RAW_ITEM',
    'RAW_ITEM',
    p_raw_item_id,
    before_state,
    jsonb_build_object(
      'overrideId', override_id,
      'entityId', chosen_entity,
      'createdEntity', created_entity,
      'sourceIdentityId', source_identity,
      'sourceRole', source_role,
      'sourceScopeApplied', source_scope_applied
    ),
    btrim(p_reason)
  );

  job_id := public.enqueue_job(
    'PROCESS_RAW_ITEM',
    'operator-resolution:' || action_id::text,
    jsonb_build_object(
      'rawItemId', p_raw_item_id,
      'sourceIdentityId', source_identity,
      'operatorActionId', action_id
    ),
    5,
    now()
  );

  return jsonb_build_object(
    'actionId', action_id,
    'overrideId', override_id,
    'entityId', chosen_entity,
    'createdEntity', created_entity,
    'sourceScopeApplied', source_scope_applied,
    'jobId', job_id
  );
end;
$$;

revoke all on function public.operator_resolve_raw_item(uuid,uuid,text,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.operator_resolve_raw_item(uuid,uuid,text,uuid,text,text,text,text)
  to service_role;

commit;
