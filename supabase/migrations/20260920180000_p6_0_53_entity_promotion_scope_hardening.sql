begin;

-- P6.0.53 hardening: broad studio/trade/OTT/music identities are not one-title
-- identities. Discovery promotion therefore resolves reviewed evidence at the
-- raw-item level and only teaches durable source scope to project-specific
-- identities.

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
    'PRODUCTION_HOUSE','OTT_PLATFORM','MUSIC_LABEL','CAST_CREW_OFFICIAL',
    'FILM_OFFICIAL','PROJECT_OFFICIAL'
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
  v_evidence_jobs integer := 0;
  v_backfill_jobs integer := 0;
  v_scoped_sources integer := 0;
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
    select 1
    from public.entity_discovery_evidence ede
    join public.operator_resolution_overrides oro
      on oro.raw_item_id = ede.raw_item_id
     and oro.active = true
    where ede.candidate_id = v_candidate.id
  ) then
    raise exception 'entity_candidate_evidence_has_active_override';
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

  -- Reviewed discovery evidence is an item-level assertion. Persist it as such;
  -- do not teach a broad channel/feed that every item belongs to this title.
  insert into public.operator_resolution_overrides (
    raw_item_id, entity_id, active, reason, created_by
  )
  select distinct
    ede.raw_item_id,
    v_entity_id,
    true,
    'ENTITY_DISCOVERY_PROMOTION: ' || btrim(p_reason),
    p_actor_id
  from public.entity_discovery_evidence ede
  where ede.candidate_id = v_candidate.id
  on conflict (raw_item_id) do update
    set entity_id = excluded.entity_id,
        active = true,
        reason = excluded.reason,
        created_by = excluded.created_by,
        updated_at = now();

  -- Only a genuinely project/film-specific identity may provide durable source
  -- scope. Production houses, trade feeds, OTT services and music labels are
  -- intentionally excluded because they cover many titles.
  for v_evidence in
    select ede.source_identity_id,
           bool_or(ede.is_first_party) as has_first_party,
           max(ede.weight) as max_weight,
           s.source_role
    from public.entity_discovery_evidence ede
    join public.source_identities si on si.id = ede.source_identity_id
    join public.sources s on s.id = si.source_id
    where ede.candidate_id = v_candidate.id
    group by ede.source_identity_id, s.source_role
  loop
    if v_evidence.source_role in ('PROJECT_OFFICIAL','FILM_OFFICIAL') then
      insert into public.source_entity_candidates (
        source_identity_id, entity_id, relationship, confidence, priority, active, valid_from
      ) values (
        v_evidence.source_identity_id,
        v_entity_id,
        'PROJECT_COVERAGE',
        greatest(v_candidate.confidence, coalesce(v_evidence.max_weight, 0.5)),
        case when v_evidence.has_first_party then 10 else 25 end,
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
      v_scoped_sources := v_scoped_sources + 1;
    end if;
  end loop;

  update public.entity_discovery_candidates
  set status = 'PROMOTED',
      promoted_entity_id = v_entity_id,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_reason = btrim(p_reason),
      updated_at = now()
  where id = v_candidate.id;

  -- Always replay the exact reviewed evidence through the normal worker. The
  -- item-level override above makes the resolution deterministic without
  -- widening source scope.
  for v_raw in
    select distinct ede.raw_item_id as id, ede.source_identity_id
    from public.entity_discovery_evidence ede
    where ede.candidate_id = v_candidate.id
    order by ede.raw_item_id
  loop
    perform public.enqueue_job(
      'PROCESS_RAW_ITEM',
      'process:entity-promotion-evidence:' || v_candidate.id::text || ':' || v_raw.id::text,
      jsonb_build_object(
        'rawItemId', v_raw.id,
        'sourceIdentityId', v_raw.source_identity_id,
        'promotionCandidateId', v_candidate.id
      ),
      20,
      now()
    );
    v_evidence_jobs := v_evidence_jobs + 1;
  end loop;

  -- Additional title backfill is allowed only for project-specific identities,
  -- where durable source scope is semantically safe.
  for v_raw in
    select distinct r.id, r.source_identity_id
    from public.raw_items r
    join public.source_identities si on si.id = r.source_identity_id
    join public.sources s on s.id = si.source_id
    join public.entity_discovery_evidence ede
      on ede.candidate_id = v_candidate.id
     and ede.source_identity_id = r.source_identity_id
    left join public.current_entity_resolution_results rr on rr.raw_item_id = r.id
    where s.source_role in ('PROJECT_OFFICIAL','FILM_OFFICIAL')
      and r.deleted_or_unavailable_at is null
      and not exists (
        select 1 from public.entity_discovery_evidence exact_evidence
        where exact_evidence.candidate_id = v_candidate.id
          and exact_evidence.raw_item_id = r.id
      )
      and coalesce(rr.resolution_state, 'UNRESOLVED') <> 'RESOLVED'
      and lower(coalesce(r.normalized_text, '') || ' ' || coalesce(r.raw_title, '') || ' ' || coalesce(r.raw_text, ''))
          like '%' || v_candidate.normalized_name || '%'
    order by r.id
    limit 500
  loop
    perform public.enqueue_job(
      'PROCESS_RAW_ITEM',
      'process:entity-promotion-backfill:' || v_candidate.id::text || ':' || v_raw.id::text,
      jsonb_build_object(
        'rawItemId', v_raw.id,
        'sourceIdentityId', v_raw.source_identity_id,
        'promotionCandidateId', v_candidate.id
      ),
      25,
      now()
    );
    v_backfill_jobs := v_backfill_jobs + 1;
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
      'evidenceJobsEnqueued', v_evidence_jobs,
      'backfillJobsEnqueued', v_backfill_jobs,
      'scopedSourceCount', v_scoped_sources
    ),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', v_candidate.id,
    'entityId', v_entity_id,
    'slug', v_slug,
    'evidenceJobsEnqueued', v_evidence_jobs,
    'backfillJobsEnqueued', v_backfill_jobs,
    'scopedSourceCount', v_scoped_sources
  );
end;
$$;

-- Invalidate legacy broad-source project scopes. A broad source may still be
-- used as discovery evidence, but it cannot be a durable one-title resolver.
update public.source_entity_candidates sec
set active = false,
    valid_to = coalesce(sec.valid_to, now()),
    updated_at = now()
from public.source_identities si
join public.sources s on s.id = si.source_id
where sec.source_identity_id = si.id
  and sec.active = true
  and sec.relationship = 'PROJECT_COVERAGE'
  and s.source_role not in ('PROJECT_OFFICIAL','FILM_OFFICIAL');

revoke all on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb)
  to service_role;

revoke all on function public.operator_promote_entity_candidate(uuid,uuid,text,text[])
  from public, anon, authenticated;
grant execute on function public.operator_promote_entity_candidate(uuid,uuid,text,text[])
  to service_role;

commit;
