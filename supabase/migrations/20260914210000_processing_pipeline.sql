begin;

-- An unresolved raw item is still a valid resolution result and must be auditable.
alter table public.entity_resolution_results
  alter column entity_id drop not null;

create table if not exists public.source_entity_candidates (
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  relationship text not null default 'PROJECT_COVERAGE',
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  priority smallint not null default 100,
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_identity_id, entity_id)
);

create index if not exists source_entity_candidates_active_idx
  on public.source_entity_candidates (source_identity_id, priority, confidence desc)
  where active = true;

create trigger source_entity_candidates_set_updated_at
before update on public.source_entity_candidates
for each row execute function public.set_updated_at();

alter table public.source_entity_candidates enable row level security;

create or replace function public.verification_rank(p_state text)
returns integer
language sql
immutable
as $$
  select case p_state
    when 'OFFICIAL' then 0
    when 'CONFIRMED' then 1
    when 'RELIABLE_REPORT' then 2
    when 'DEVELOPING' then 3
    when 'RUMOR' then 4
    else 99
  end;
$$;

create or replace function public.record_entity_resolution(
  p_raw_item_id uuid,
  p_entity_id uuid,
  p_score numeric,
  p_resolution_state text,
  p_methods jsonb,
  p_engine_version text
)
returns uuid
language plpgsql
as $$
declare
  result_id uuid;
begin
  if p_resolution_state not in ('RESOLVED','AMBIGUOUS','UNRESOLVED') then
    raise exception 'invalid resolution state';
  end if;
  if p_resolution_state = 'RESOLVED' and p_entity_id is null then
    raise exception 'resolved result requires entity id';
  end if;

  insert into public.entity_resolution_results (
    raw_item_id,
    entity_id,
    score,
    resolution_state,
    methods,
    engine_version
  ) values (
    p_raw_item_id,
    p_entity_id,
    p_score,
    p_resolution_state,
    coalesce(p_methods, '[]'::jsonb),
    p_engine_version
  )
  returning id into result_id;

  return result_id;
end;
$$;

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
  if p_verification_state not in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR') then
    raise exception 'invalid verification state';
  end if;
  if p_priority_band not in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED') then
    raise exception 'invalid priority band';
  end if;

  insert into public.events (
    id,
    primary_entity_id,
    event_type,
    event_schema_version,
    detected_at,
    verification_state,
    priority_band,
    headline,
    structured_data,
    dedupe_key,
    status,
    classifier_version
  ) values (
    p_event_id,
    p_primary_entity_id,
    p_event_type,
    1,
    now(),
    p_verification_state,
    p_priority_band,
    p_headline,
    coalesce(p_structured_data, '{}'::jsonb),
    p_dedupe_key,
    'ACTIVE',
    p_classifier_version
  )
  on conflict (dedupe_key) do update
    set verification_state = case
          when public.verification_rank(excluded.verification_state) < public.verification_rank(public.events.verification_state)
            then excluded.verification_state
          else public.events.verification_state
        end,
        priority_band = case
          when excluded.priority_band = 'CRITICAL' then 'CRITICAL'
          when public.events.priority_band = 'CRITICAL' then public.events.priority_band
          when excluded.priority_band = 'HIGH' then 'HIGH'
          when public.events.priority_band = 'HIGH' then public.events.priority_band
          when excluded.priority_band = 'NORMAL' then 'NORMAL'
          else public.events.priority_band
        end,
        headline = excluded.headline,
        structured_data = excluded.structured_data,
        classifier_version = excluded.classifier_version,
        updated_at = now()
  returning id into result_id;

  select exists(
    select 1 from public.event_evidence where event_id = result_id
  ) into had_evidence;

  insert into public.event_evidence (
    event_id,
    raw_item_id,
    evidence_role,
    weight
  ) values (
    result_id,
    p_raw_item_id,
    case when had_evidence then 'REPEAT' else 'PRIMARY' end,
    1
  )
  on conflict (event_id, raw_item_id) do nothing;

  return result_id;
end;
$$;

comment on table public.source_entity_candidates is 'Bounded candidate title scope used by source-specific entity resolution; avoids global-catalog matching for every raw item.';
comment on function public.record_entity_resolution is 'Persists resolved, ambiguous, and unresolved outcomes without hiding failed matches.';
comment on function public.upsert_canonical_event_with_evidence is 'Atomically deduplicates canonical events and attaches raw-item evidence while preserving the strongest verification state.';

commit;
