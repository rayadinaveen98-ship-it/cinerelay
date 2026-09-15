begin;

create table if not exists public.operator_resolution_overrides (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null unique references public.raw_items(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  active boolean not null default true,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger operator_resolution_overrides_set_updated_at
before update on public.operator_resolution_overrides
for each row execute function public.set_updated_at();

alter table public.operator_resolution_overrides enable row level security;
revoke all on table public.operator_resolution_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.operator_resolution_overrides to service_role;

create or replace view public.current_entity_resolution_results
with (security_invoker = true)
as
select distinct on (raw_item_id)
  id,
  raw_item_id,
  entity_id,
  score,
  resolution_state,
  methods,
  engine_version,
  created_at
from public.entity_resolution_results
order by raw_item_id, created_at desc, id desc;

revoke all on public.current_entity_resolution_results from public, anon, authenticated;
grant select on public.current_entity_resolution_results to service_role;

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
  chosen_entity uuid;
  override_id uuid;
  action_id uuid := gen_random_uuid();
  job_id uuid;
  created_entity boolean := false;
  before_state jsonb;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select source_identity_id into source_identity from public.raw_items where id = p_raw_item_id;
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
      values (p_new_entity_type, btrim(p_new_entity_name), nullif(btrim(coalesce(p_primary_language,'')), ''), nullif(upper(btrim(coalesce(p_country_code,''))), ''), 'ACTIVE')
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

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason
  ) values (
    action_id, 'ADMIN', p_actor_id, 'RESOLVE_RAW_ITEM', 'RAW_ITEM', p_raw_item_id,
    before_state,
    jsonb_build_object('overrideId', override_id, 'entityId', chosen_entity, 'createdEntity', created_entity, 'sourceIdentityId', source_identity),
    btrim(p_reason)
  );

  job_id := public.enqueue_job(
    'PROCESS_RAW_ITEM',
    'operator-resolution:' || action_id::text,
    jsonb_build_object('rawItemId', p_raw_item_id, 'sourceIdentityId', source_identity, 'operatorActionId', action_id),
    5,
    now()
  );

  return jsonb_build_object('actionId', action_id, 'overrideId', override_id, 'entityId', chosen_entity, 'createdEntity', created_entity, 'jobId', job_id);
end;
$$;

create or replace function public.operator_clear_resolution_override(
  p_actor_id uuid,
  p_raw_item_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  source_identity uuid;
  override_row public.operator_resolution_overrides%rowtype;
  action_id uuid := gen_random_uuid();
  job_id uuid;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select * into override_row from public.operator_resolution_overrides where raw_item_id = p_raw_item_id;
  if override_row.id is null then raise exception 'override not found'; end if;
  select source_identity_id into source_identity from public.raw_items where id = p_raw_item_id;
  if source_identity is null then raise exception 'raw item not found'; end if;

  update public.operator_resolution_overrides
  set active = false, reason = btrim(p_reason), created_by = p_actor_id, updated_at = now()
  where id = override_row.id;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason
  ) values (
    action_id, 'ADMIN', p_actor_id, 'CLEAR_RESOLUTION_OVERRIDE', 'RAW_ITEM', p_raw_item_id,
    to_jsonb(override_row),
    jsonb_build_object('overrideId', override_row.id, 'active', false),
    btrim(p_reason)
  );

  job_id := public.enqueue_job(
    'PROCESS_RAW_ITEM',
    'operator-clear-resolution:' || action_id::text,
    jsonb_build_object('rawItemId', p_raw_item_id, 'sourceIdentityId', source_identity, 'operatorActionId', action_id),
    5,
    now()
  );

  return jsonb_build_object('actionId', action_id, 'overrideId', override_row.id, 'jobId', job_id);
end;
$$;

create or replace function public.operator_suppress_event(
  p_actor_id uuid,
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  before_row public.events%rowtype;
  after_row public.events%rowtype;
  action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  select * into before_row from public.events where id = p_event_id for update;
  if before_row.id is null then raise exception 'event not found'; end if;

  update public.events
  set status = 'SUPPRESSED', priority_band = 'SUPPRESSED', updated_at = now()
  where id = p_event_id
  returning * into after_row;

  insert into public.audit_actions (id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason)
  values (action_id, 'ADMIN', p_actor_id, 'SUPPRESS_EVENT', 'EVENT', p_event_id, to_jsonb(before_row), to_jsonb(after_row), btrim(p_reason));

  return jsonb_build_object('actionId', action_id, 'eventId', p_event_id, 'status', after_row.status);
end;
$$;

create or replace function public.operator_reclassify_event(
  p_actor_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  before_row public.events%rowtype;
  after_row public.events%rowtype;
  action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if not exists(select 1 from public.event_types where code = p_event_type and active = true) then raise exception 'invalid event type'; end if;
  select * into before_row from public.events where id = p_event_id for update;
  if before_row.id is null then raise exception 'event not found'; end if;
  if before_row.status = 'SUPPRESSED' then raise exception 'suppressed event must be reviewed before reclassification'; end if;

  update public.events
  set event_type = p_event_type,
      classifier_version = 'operator-review-v1',
      status = case when status = 'NEEDS_REVIEW' then 'ACTIVE' else status end,
      updated_at = now()
  where id = p_event_id
  returning * into after_row;

  insert into public.audit_actions (id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason)
  values (action_id, 'ADMIN', p_actor_id, 'RECLASSIFY_EVENT', 'EVENT', p_event_id, to_jsonb(before_row), to_jsonb(after_row), btrim(p_reason));

  return jsonb_build_object('actionId', action_id, 'eventId', p_event_id, 'eventType', after_row.event_type);
end;
$$;

create or replace function public.operator_merge_events(
  p_actor_id uuid,
  p_from_event_id uuid,
  p_into_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  from_row public.events%rowtype;
  into_row public.events%rowtype;
  action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if p_from_event_id = p_into_event_id then raise exception 'cannot merge event into itself'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select * into from_row from public.events where id = p_from_event_id for update;
  select * into into_row from public.events where id = p_into_event_id for update;
  if from_row.id is null or into_row.id is null then raise exception 'event not found'; end if;
  if from_row.primary_entity_id <> into_row.primary_entity_id then raise exception 'events must belong to the same entity'; end if;
  if from_row.status in ('SUPERSEDED','RETRACTED') then raise exception 'source event is not mergeable'; end if;
  if into_row.status in ('SUPERSEDED','RETRACTED','SUPPRESSED') then raise exception 'target event is not mergeable'; end if;

  insert into public.event_evidence (event_id, raw_item_id, claim_id, evidence_role, weight, added_at)
  select p_into_event_id, ee.raw_item_id, ee.claim_id,
         case when exists(select 1 from public.event_evidence existing where existing.event_id = p_into_event_id) then 'REPEAT' else ee.evidence_role end,
         ee.weight, now()
  from public.event_evidence ee
  where ee.event_id = p_from_event_id
  on conflict (event_id, raw_item_id) do nothing;

  update public.events set status = 'SUPERSEDED', updated_at = now() where id = p_from_event_id;

  insert into public.audit_actions (id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason)
  values (
    action_id, 'ADMIN', p_actor_id, 'MERGE_EVENT', 'EVENT', p_from_event_id,
    jsonb_build_object('from', to_jsonb(from_row), 'into', to_jsonb(into_row)),
    jsonb_build_object('fromEventId', p_from_event_id, 'intoEventId', p_into_event_id, 'fromStatus', 'SUPERSEDED'),
    btrim(p_reason)
  );

  return jsonb_build_object('actionId', action_id, 'fromEventId', p_from_event_id, 'intoEventId', p_into_event_id);
end;
$$;

-- Operator suppression must survive future deterministic upserts for the same dedupe key.
create or replace function public.upsert_canonical_event_with_evidence(
  p_event_id uuid,
  p_primary_entity_id uuid,
  p_event_type text,
  p_verification_state text,
  p_priority_band text,
  p_headline text,
  p_structured_data jsonb,
  p_dedupe_key text,
  p_classifier_version text,
  p_raw_item_id uuid
)
returns uuid
language plpgsql
as $$
declare
  result_id uuid;
  had_evidence boolean;
begin
  if p_verification_state not in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR') then raise exception 'invalid verification state'; end if;
  if p_priority_band not in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED') then raise exception 'invalid priority band'; end if;

  insert into public.events (
    id, primary_entity_id, event_type, event_schema_version, detected_at, verification_state,
    priority_band, headline, structured_data, dedupe_key, status, classifier_version
  ) values (
    p_event_id, p_primary_entity_id, p_event_type, 1, now(), p_verification_state,
    p_priority_band, p_headline, coalesce(p_structured_data, '{}'::jsonb), p_dedupe_key, 'ACTIVE', p_classifier_version
  )
  on conflict (dedupe_key) do update
    set verification_state = case
          when public.verification_rank(excluded.verification_state) < public.verification_rank(public.events.verification_state)
            then excluded.verification_state else public.events.verification_state end,
        priority_band = case
          when public.events.status = 'SUPPRESSED' then 'SUPPRESSED'
          when excluded.priority_band = 'CRITICAL' then 'CRITICAL'
          when public.events.priority_band = 'CRITICAL' then public.events.priority_band
          when excluded.priority_band = 'HIGH' then 'HIGH'
          when public.events.priority_band = 'HIGH' then public.events.priority_band
          when excluded.priority_band = 'NORMAL' then 'NORMAL'
          else public.events.priority_band end,
        headline = excluded.headline,
        structured_data = excluded.structured_data,
        classifier_version = case
          when public.events.classifier_version = 'operator-review-v1' then public.events.classifier_version
          else excluded.classifier_version end,
        updated_at = now()
  returning id into result_id;

  select exists(select 1 from public.event_evidence where event_id = result_id) into had_evidence;
  insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight)
  values (result_id, p_raw_item_id, case when had_evidence then 'REPEAT' else 'PRIMARY' end, 1)
  on conflict (event_id, raw_item_id) do nothing;
  return result_id;
end;
$$;

revoke execute on function public.operator_resolve_raw_item(uuid,uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.operator_clear_resolution_override(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.operator_suppress_event(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.operator_reclassify_event(uuid,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.operator_merge_events(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.operator_resolve_raw_item(uuid,uuid,text,uuid,text,text,text,text) to service_role;
grant execute on function public.operator_clear_resolution_override(uuid,uuid,text) to service_role;
grant execute on function public.operator_suppress_event(uuid,uuid,text) to service_role;
grant execute on function public.operator_reclassify_event(uuid,uuid,text,text) to service_role;
grant execute on function public.operator_merge_events(uuid,uuid,uuid,text) to service_role;

comment on table public.operator_resolution_overrides is 'Durable operator-reviewed raw-item entity overrides consumed by PROCESS_RAW_ITEM before automatic resolution.';
comment on view public.current_entity_resolution_results is 'Latest entity-resolution result per raw item; prevents historical unresolved rows from inflating current review counts.';

commit;
