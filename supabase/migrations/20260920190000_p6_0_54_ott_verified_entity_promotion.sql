begin;

create or replace function public.system_promote_verified_ott_candidate(
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_candidate public.entity_discovery_candidates%rowtype;
  v_entity_id uuid;
  v_existing_entity_id uuid;
  v_slug text;
  v_base_slug text;
  v_signal_evidence_count integer := 0;
  v_signal_source_count integer := 0;
  v_signal_first_party_count integer := 0;
  v_evidence record;
  v_raw record;
  v_enqueued integer := 0;
  v_scoped_sources integer := 0;
  v_item_overrides integer := 0;
  v_action_id uuid := gen_random_uuid();
  v_created boolean := false;
begin
  select * into v_candidate
  from public.entity_discovery_candidates
  where id = p_candidate_id
  for update;

  if v_candidate.id is null then
    raise exception 'entity_candidate_not_found';
  end if;

  if v_candidate.status = 'PROMOTED' and v_candidate.promoted_entity_id is not null then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'entityId', v_candidate.promoted_entity_id,
      'promoted', true,
      'created', false,
      'alreadyPromoted', true
    );
  end if;

  if v_candidate.status = 'DUPLICATE' and v_candidate.duplicate_entity_id is not null then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'entityId', v_candidate.duplicate_entity_id,
      'promoted', true,
      'created', false,
      'duplicate', true
    );
  end if;

  if v_candidate.status not in ('PENDING','REVIEWING','APPROVED') then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'promoted', false,
      'reason', 'candidate_status_not_eligible'
    );
  end if;

  if v_candidate.proposed_entity_type <> 'MOVIE' or v_candidate.confidence < 0.92 then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'promoted', false,
      'reason', 'ott_candidate_type_or_confidence_gate'
    );
  end if;

  select
    count(*)::integer,
    count(distinct source_identity_id)::integer,
    count(distinct source_identity_id) filter (where is_first_party)::integer
  into v_signal_evidence_count, v_signal_source_count, v_signal_first_party_count
  from public.entity_discovery_evidence
  where candidate_id = v_candidate.id
    and match_method = 'DETERMINISTIC_TITLE'
    and metadata ->> 'signalType' = 'OTT_RELEASE';

  if v_signal_evidence_count < 2
     or v_signal_source_count < 2
     or v_signal_first_party_count < 1 then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'promoted', false,
      'reason', 'ott_candidate_evidence_gate',
      'evidenceCount', v_signal_evidence_count,
      'sourceCount', v_signal_source_count,
      'firstPartySourceCount', v_signal_first_party_count
    );
  end if;

  select matched.id into v_existing_entity_id
  from (
    select e.id, 0 as priority
    from public.entities e
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and public.normalize_entity_discovery_name(e.canonical_name) = v_candidate.normalized_name
    union all
    select ea.entity_id as id, 1 as priority
    from public.entity_aliases ea
    join public.entities e on e.id = ea.entity_id
    where e.status = 'ACTIVE'
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and public.normalize_entity_discovery_name(ea.alias) = v_candidate.normalized_name
  ) matched
  order by matched.priority, matched.id
  limit 1;

  if v_existing_entity_id is not null then
    v_entity_id := v_existing_entity_id;
    update public.entity_discovery_candidates
    set status = 'DUPLICATE',
        duplicate_entity_id = v_entity_id,
        promoted_entity_id = null,
        reviewed_by = null,
        reviewed_at = now(),
        review_reason = 'System matched verified OTT candidate to existing canonical entity',
        updated_at = now()
    where id = v_candidate.id;
  else
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
      'MOVIE',
      v_candidate.proposed_name,
      v_slug,
      v_candidate.primary_language,
      coalesce(v_candidate.country_code, 'IN'),
      'ACTIVE'
    ) returning id into v_entity_id;

    insert into public.entity_aliases (
      entity_id, alias, normalized_alias, language_code, alias_type
    ) values (
      v_entity_id,
      v_candidate.proposed_name,
      v_candidate.normalized_name,
      v_candidate.primary_language,
      'OFFICIAL'
    );

    update public.entity_discovery_candidates
    set status = 'PROMOTED',
        promoted_entity_id = v_entity_id,
        duplicate_entity_id = null,
        reviewed_by = null,
        reviewed_at = now(),
        review_reason = 'System promoted candidate after verified OTT two-source evidence gate',
        updated_at = now()
    where id = v_candidate.id;

    v_created := true;
  end if;

  -- OTT platform, studio and trade identities are broad multi-title sources. The
  -- verified release evidence therefore becomes an item-level resolution
  -- assertion, not a whole-source title scope.
  insert into public.operator_resolution_overrides (
    raw_item_id, entity_id, active, reason, created_by
  )
  select distinct
    ede.raw_item_id,
    v_entity_id,
    true,
    'SYSTEM_VERIFIED_OTT_PROMOTION: preserve deterministic release evidence at item scope',
    null
  from public.entity_discovery_evidence ede
  where ede.candidate_id = v_candidate.id
    and ede.match_method = 'DETERMINISTIC_TITLE'
    and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
  on conflict (raw_item_id) do update
    set entity_id = excluded.entity_id,
        active = true,
        reason = excluded.reason,
        updated_at = now();
  get diagnostics v_item_overrides = row_count;

  -- Only genuinely title-specific identities may teach durable scope. Broad OTT
  -- services, production houses and trade feeds are intentionally excluded.
  for v_evidence in
    select ede.source_identity_id,
           bool_or(ede.is_first_party) as has_first_party,
           max(ede.weight) as max_weight,
           s.source_role
    from public.entity_discovery_evidence ede
    join public.source_identities si on si.id = ede.source_identity_id
    join public.sources s on s.id = si.source_id
    where ede.candidate_id = v_candidate.id
      and ede.match_method = 'DETERMINISTIC_TITLE'
      and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
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

  for v_raw in
    select distinct ede.raw_item_id, ede.source_identity_id
    from public.entity_discovery_evidence ede
    where ede.candidate_id = v_candidate.id
      and ede.match_method = 'DETERMINISTIC_TITLE'
      and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
  loop
    perform public.enqueue_job(
      'PROCESS_RAW_ITEM',
      'process:ott-entity-promotion:' || v_candidate.id::text || ':' || v_raw.raw_item_id::text,
      jsonb_build_object(
        'rawItemId', v_raw.raw_item_id,
        'sourceIdentityId', v_raw.source_identity_id,
        'ottPromotionCandidateId', v_candidate.id
      ),
      20,
      now()
    );
    v_enqueued := v_enqueued + 1;
  end loop;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id,
    'SYSTEM',
    null,
    case when v_created then 'SYSTEM_PROMOTE_VERIFIED_OTT_CANDIDATE' else 'SYSTEM_BIND_VERIFIED_OTT_CANDIDATE' end,
    'ENTITY',
    v_entity_id,
    to_jsonb(v_candidate),
    jsonb_build_object(
      'entityId', v_entity_id,
      'candidateId', v_candidate.id,
      'created', v_created,
      'signalEvidenceCount', v_signal_evidence_count,
      'signalSourceCount', v_signal_source_count,
      'signalFirstPartySourceCount', v_signal_first_party_count,
      'itemOverrideCount', v_item_overrides,
      'scopedSourceCount', v_scoped_sources,
      'reprocessJobsEnqueued', v_enqueued
    ),
    'Verified OTT movie release candidate satisfied deterministic two-source promotion gate'
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', v_candidate.id,
    'entityId', v_entity_id,
    'promoted', true,
    'created', v_created,
    'duplicate', not v_created,
    'itemOverrideCount', v_item_overrides,
    'scopedSourceCount', v_scoped_sources,
    'reprocessJobsEnqueued', v_enqueued
  );
end;
$$;

revoke all on function public.system_promote_verified_ott_candidate(uuid) from public, anon, authenticated;
grant execute on function public.system_promote_verified_ott_candidate(uuid) to service_role;

commit;
