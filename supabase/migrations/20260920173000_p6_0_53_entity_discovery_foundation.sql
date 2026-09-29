begin;

create table if not exists public.entity_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  proposed_entity_type text not null check (proposed_entity_type in ('MOVIE','SERIES','SEASON')),
  proposed_name text not null,
  normalized_name text not null,
  primary_language text,
  country_code text,
  confidence numeric(5,4) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'PENDING' check (status in (
    'PENDING','REVIEWING','APPROVED','REJECTED','DUPLICATE','PROMOTED'
  )),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  source_count integer not null default 0 check (source_count >= 0),
  first_party_source_count integer not null default 0 check (first_party_source_count >= 0),
  duplicate_entity_id uuid references public.entities(id) on delete set null,
  promoted_entity_id uuid references public.entities(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(proposed_name)) >= 2),
  check (char_length(btrim(normalized_name)) >= 2),
  check (status <> 'DUPLICATE' or duplicate_entity_id is not null),
  check (status <> 'PROMOTED' or promoted_entity_id is not null)
);

create unique index if not exists entity_discovery_candidates_identity_uq
  on public.entity_discovery_candidates (proposed_entity_type, normalized_name);
create index if not exists entity_discovery_candidates_status_idx
  on public.entity_discovery_candidates (status, confidence desc, source_count desc, last_seen_at desc);
create index if not exists entity_discovery_candidates_name_trgm_idx
  on public.entity_discovery_candidates using gin (normalized_name extensions.gin_trgm_ops);

create trigger entity_discovery_candidates_set_updated_at
before update on public.entity_discovery_candidates
for each row execute function public.set_updated_at();

create table if not exists public.entity_discovery_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.entity_discovery_candidates(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  evidence_role text not null check (evidence_role in ('PRIMARY','CORROBORATING','SUPPORTING')),
  extracted_label text not null,
  match_method text not null check (match_method in ('OPERATOR','DETERMINISTIC_TITLE','DETERMINISTIC_HASHTAG','IMPORT')),
  weight numeric(5,4) not null default 0.5 check (weight >= 0 and weight <= 1),
  is_first_party boolean not null default false,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(candidate_id, raw_item_id)
);

create index if not exists entity_discovery_evidence_candidate_idx
  on public.entity_discovery_evidence (candidate_id, observed_at desc);
create index if not exists entity_discovery_evidence_source_idx
  on public.entity_discovery_evidence (source_identity_id, candidate_id);

alter table public.entity_discovery_candidates enable row level security;
alter table public.entity_discovery_evidence enable row level security;

revoke all on table public.entity_discovery_candidates from public, anon, authenticated;
revoke all on table public.entity_discovery_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.entity_discovery_candidates to service_role;
grant select, insert, update, delete on table public.entity_discovery_evidence to service_role;

create index if not exists entities_canonical_name_trgm_idx
  on public.entities using gin (canonical_name extensions.gin_trgm_ops);
create index if not exists entity_aliases_normalized_alias_trgm_idx
  on public.entity_aliases using gin (normalized_alias extensions.gin_trgm_ops);

create or replace function public.normalize_entity_discovery_name(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(btrim(coalesce(p_value, ''))), '[^[:alnum:]]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.submit_entity_discovery_candidate(
  p_proposed_name text,
  p_proposed_entity_type text,
  p_raw_item_id uuid,
  p_confidence numeric default 0.5,
  p_primary_language text default null,
  p_country_code text default 'IN',
  p_match_method text default 'OPERATOR',
  p_weight numeric default 0.5,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_name text := btrim(coalesce(p_proposed_name, ''));
  v_normalized text := public.normalize_entity_discovery_name(p_proposed_name);
  v_type text := upper(btrim(coalesce(p_proposed_entity_type, '')));
  v_method text := upper(btrim(coalesce(p_match_method, '')));
  v_candidate_id uuid;
  v_source_identity_id uuid;
  v_source_role text;
  v_authority_tier smallint;
  v_is_first_party boolean;
  v_evidence_count integer;
  v_source_count integer;
  v_first_party_count integer;
  v_role text;
begin
  if char_length(v_name) < 2 or char_length(v_normalized) < 2 then
    raise exception 'entity_candidate_name_too_short';
  end if;
  if v_type not in ('MOVIE','SERIES','SEASON') then
    raise exception 'invalid_entity_candidate_type';
  end if;
  if v_method not in ('OPERATOR','DETERMINISTIC_TITLE','DETERMINISTIC_HASHTAG','IMPORT') then
    raise exception 'invalid_entity_candidate_match_method';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'invalid_entity_candidate_confidence';
  end if;
  if p_weight is null or p_weight < 0 or p_weight > 1 then
    raise exception 'invalid_entity_candidate_weight';
  end if;

  select r.source_identity_id, s.source_role, s.authority_tier
  into v_source_identity_id, v_source_role, v_authority_tier
  from public.raw_items r
  join public.source_identities si on si.id = r.source_identity_id
  join public.sources s on s.id = si.source_id
  where r.id = p_raw_item_id;

  if v_source_identity_id is null then
    raise exception 'entity_candidate_raw_item_not_found';
  end if;

  v_is_first_party := coalesce(v_authority_tier <= 2 and v_source_role in (
    'PRODUCTION_HOUSE','OTT_PLATFORM','MUSIC_LABEL','CAST_CREW_OFFICIAL','FILM_OFFICIAL'
  ), false);
  v_role := case when v_is_first_party then 'PRIMARY' else 'CORROBORATING' end;

  insert into public.entity_discovery_candidates (
    proposed_entity_type, proposed_name, normalized_name, primary_language, country_code,
    confidence, metadata, first_seen_at, last_seen_at
  ) values (
    v_type, v_name, v_normalized,
    nullif(lower(btrim(coalesce(p_primary_language, ''))), ''),
    nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
    p_confidence, coalesce(p_metadata, '{}'::jsonb), now(), now()
  )
  on conflict (proposed_entity_type, normalized_name) do update
    set proposed_name = case
          when excluded.confidence >= public.entity_discovery_candidates.confidence then excluded.proposed_name
          else public.entity_discovery_candidates.proposed_name
        end,
        primary_language = coalesce(excluded.primary_language, public.entity_discovery_candidates.primary_language),
        country_code = coalesce(excluded.country_code, public.entity_discovery_candidates.country_code),
        confidence = greatest(public.entity_discovery_candidates.confidence, excluded.confidence),
        metadata = public.entity_discovery_candidates.metadata || excluded.metadata,
        last_seen_at = now(),
        updated_at = now()
  returning id into v_candidate_id;

  insert into public.entity_discovery_evidence (
    candidate_id, raw_item_id, source_identity_id, evidence_role, extracted_label,
    match_method, weight, is_first_party, observed_at, metadata
  ) values (
    v_candidate_id, p_raw_item_id, v_source_identity_id, v_role, v_name,
    v_method, p_weight, v_is_first_party, now(), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (candidate_id, raw_item_id) do update
    set extracted_label = excluded.extracted_label,
        match_method = excluded.match_method,
        weight = greatest(public.entity_discovery_evidence.weight, excluded.weight),
        is_first_party = public.entity_discovery_evidence.is_first_party or excluded.is_first_party,
        evidence_role = case
          when public.entity_discovery_evidence.is_first_party or excluded.is_first_party then 'PRIMARY'
          else 'CORROBORATING'
        end,
        observed_at = greatest(public.entity_discovery_evidence.observed_at, excluded.observed_at),
        metadata = public.entity_discovery_evidence.metadata || excluded.metadata;

  select count(*)::integer,
         count(distinct source_identity_id)::integer,
         count(distinct source_identity_id) filter (where is_first_party)::integer
  into v_evidence_count, v_source_count, v_first_party_count
  from public.entity_discovery_evidence
  where candidate_id = v_candidate_id;

  update public.entity_discovery_candidates
  set evidence_count = v_evidence_count,
      source_count = v_source_count,
      first_party_source_count = v_first_party_count,
      last_seen_at = now(),
      updated_at = now()
  where id = v_candidate_id;

  return v_candidate_id;
end;
$$;

create or replace function public.operator_review_entity_candidate(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_status text,
  p_reason text,
  p_duplicate_entity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_before public.entity_discovery_candidates%rowtype;
  v_after public.entity_discovery_candidates%rowtype;
  v_status text := upper(btrim(coalesce(p_status, '')));
  v_action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if v_status not in ('REVIEWING','APPROVED','REJECTED','DUPLICATE') then
    raise exception 'invalid_entity_candidate_review_status';
  end if;

  select * into v_before
  from public.entity_discovery_candidates
  where id = p_candidate_id
  for update;
  if v_before.id is null then raise exception 'entity_candidate_not_found'; end if;
  if v_before.status = 'PROMOTED' then raise exception 'promoted_entity_candidate_is_immutable_here'; end if;

  if v_status = 'APPROVED' then
    if v_before.confidence < 0.85 then raise exception 'entity_candidate_confidence_below_approval_gate'; end if;
    if v_before.source_count < 2 then raise exception 'entity_candidate_requires_two_independent_sources'; end if;
    if v_before.first_party_source_count < 1 and v_before.source_count < 3 then
      raise exception 'entity_candidate_requires_first_party_or_three_sources';
    end if;
  end if;

  if v_status = 'DUPLICATE' then
    if p_duplicate_entity_id is null or not exists (
      select 1 from public.entities where id = p_duplicate_entity_id
    ) then
      raise exception 'duplicate_entity_required';
    end if;
  elsif p_duplicate_entity_id is not null then
    raise exception 'duplicate_entity_only_valid_for_duplicate_status';
  end if;

  update public.entity_discovery_candidates
  set status = v_status,
      duplicate_entity_id = case when v_status = 'DUPLICATE' then p_duplicate_entity_id else null end,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_reason = btrim(p_reason),
      updated_at = now()
  where id = p_candidate_id
  returning * into v_after;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id, 'ADMIN', p_actor_id, 'REVIEW_ENTITY_CANDIDATE', 'ENTITY_CANDIDATE', p_candidate_id,
    to_jsonb(v_before), to_jsonb(v_after), btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', p_candidate_id,
    'status', v_after.status,
    'readyForPromotion', v_after.status = 'APPROVED'
  );
end;
$$;

create or replace function public.operator_promote_entity_candidate(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_reason text,
  p_aliases text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_candidate public.entity_discovery_candidates%rowtype;
  v_entity_id uuid;
  v_slug text;
  v_base_slug text;
  v_alias text;
  v_normalized_alias text;
  v_evidence record;
  v_raw record;
  v_enqueued integer := 0;
  v_action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;

  select * into v_candidate
  from public.entity_discovery_candidates
  where id = p_candidate_id
  for update;

  if v_candidate.id is null then raise exception 'entity_candidate_not_found'; end if;
  if v_candidate.status <> 'APPROVED' then raise exception 'entity_candidate_must_be_approved'; end if;
  if v_candidate.confidence < 0.85 or v_candidate.source_count < 2 then
    raise exception 'entity_candidate_evidence_gate_failed';
  end if;
  if v_candidate.first_party_source_count < 1 and v_candidate.source_count < 3 then
    raise exception 'entity_candidate_authority_gate_failed';
  end if;

  if exists (
    select 1 from public.entities e
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and public.normalize_entity_discovery_name(e.canonical_name) = v_candidate.normalized_name
  ) or exists (
    select 1
    from public.entity_aliases ea
    join public.entities e on e.id = ea.entity_id
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and public.normalize_entity_discovery_name(ea.alias) = v_candidate.normalized_name
  ) then
    raise exception 'entity_candidate_matches_existing_entity';
  end if;

  v_base_slug := regexp_replace(v_candidate.normalized_name, '[^a-z0-9]+', '-', 'g');
  v_base_slug := btrim(v_base_slug, '-');
  if v_base_slug = '' then v_base_slug := 'title'; end if;
  v_slug := v_base_slug;
  if exists(select 1 from public.entities where slug = v_slug) then
    v_slug := v_base_slug || '-' || substring(replace(v_candidate.id::text, '-', '') from 1 for 8);
  end if;

  insert into public.entities (
    entity_type, canonical_name, slug, primary_language, country_code, status
  ) values (
    v_candidate.proposed_entity_type,
    v_candidate.proposed_name,
    v_slug,
    v_candidate.primary_language,
    coalesce(v_candidate.country_code, 'IN'),
    'ACTIVE'
  ) returning id into v_entity_id;

  insert into public.entity_aliases (
    entity_id, alias, normalized_alias, language_code, alias_type
  ) values (
    v_entity_id, v_candidate.proposed_name, v_candidate.normalized_name,
    v_candidate.primary_language, 'OFFICIAL'
  );

  foreach v_alias in array coalesce(p_aliases, '{}'::text[]) loop
    v_alias := btrim(coalesce(v_alias, ''));
    v_normalized_alias := public.normalize_entity_discovery_name(v_alias);
    if char_length(v_alias) >= 2 and char_length(v_normalized_alias) >= 2
       and not exists (
         select 1 from public.entity_aliases
         where entity_id = v_entity_id and normalized_alias = v_normalized_alias
       ) then
      insert into public.entity_aliases (
        entity_id, alias, normalized_alias, language_code, alias_type
      ) values (
        v_entity_id, v_alias, v_normalized_alias, v_candidate.primary_language,
        case when left(v_alias, 1) = '#' then 'HASHTAG' else 'OTHER' end
      );
    end if;
  end loop;

  for v_evidence in
    select source_identity_id,
           bool_or(is_first_party) as has_first_party,
           max(weight) as max_weight
    from public.entity_discovery_evidence
    where candidate_id = v_candidate.id
    group by source_identity_id
  loop
    insert into public.source_entity_candidates (
      source_identity_id, entity_id, relationship, confidence, priority, active, valid_from
    ) values (
      v_evidence.source_identity_id,
      v_entity_id,
      'PROJECT_COVERAGE',
      greatest(v_candidate.confidence, coalesce(v_evidence.max_weight, 0.5)),
      case when v_evidence.has_first_party then 10 else 50 end,
      true,
      now()
    )
    on conflict (source_identity_id, entity_id) do update
      set relationship = excluded.relationship,
          confidence = greatest(public.source_entity_candidates.confidence, excluded.confidence),
          priority = least(public.source_entity_candidates.priority, excluded.priority),
          active = true,
          valid_to = null,
          updated_at = now();
  end loop;

  update public.entity_discovery_candidates
  set status = 'PROMOTED',
      promoted_entity_id = v_entity_id,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_reason = btrim(p_reason),
      updated_at = now()
  where id = v_candidate.id;

  for v_raw in
    select distinct r.id, r.source_identity_id
    from public.raw_items r
    join public.entity_discovery_evidence ede
      on ede.candidate_id = v_candidate.id
     and ede.source_identity_id = r.source_identity_id
    left join public.current_entity_resolution_results rr on rr.raw_item_id = r.id
    where r.deleted_or_unavailable_at is null
      and coalesce(rr.resolution_state, 'UNRESOLVED') <> 'RESOLVED'
      and lower(coalesce(r.normalized_text, '') || ' ' || coalesce(r.raw_title, '') || ' ' || coalesce(r.raw_text, ''))
          like '%' || v_candidate.normalized_name || '%'
    order by r.id
    limit 500
  loop
    perform public.enqueue_job(
      'PROCESS_RAW_ITEM',
      'process:entity-promotion:' || v_candidate.id::text || ':' || v_raw.id::text,
      jsonb_build_object(
        'rawItemId', v_raw.id,
        'sourceIdentityId', v_raw.source_identity_id,
        'promotionCandidateId', v_candidate.id
      ),
      25,
      now()
    );
    v_enqueued := v_enqueued + 1;
  end loop;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id,
    'ADMIN',
    p_actor_id,
    'PROMOTE_ENTITY_CANDIDATE',
    'ENTITY',
    v_entity_id,
    to_jsonb(v_candidate),
    jsonb_build_object(
      'entityId', v_entity_id,
      'slug', v_slug,
      'candidateId', v_candidate.id,
      'reprocessJobsEnqueued', v_enqueued
    ),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', v_candidate.id,
    'entityId', v_entity_id,
    'slug', v_slug,
    'reprocessJobsEnqueued', v_enqueued
  );
end;
$$;

revoke all on function public.normalize_entity_discovery_name(text) from public, anon, authenticated;
grant execute on function public.normalize_entity_discovery_name(text) to service_role;

revoke all on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb)
  to service_role;

revoke all on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid)
  to service_role;

revoke all on function public.operator_promote_entity_candidate(uuid,uuid,text,text[])
  from public, anon, authenticated;
grant execute on function public.operator_promote_entity_candidate(uuid,uuid,text,text[])
  to service_role;

commit;
