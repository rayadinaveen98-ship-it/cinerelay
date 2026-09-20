begin;

create or replace function public.system_promote_first_party_ott_candidate(
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
  v_first_party_evidence_count integer := 0;
  v_raw record;
  v_enqueued integer := 0;
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

  if v_candidate.proposed_entity_type <> 'MOVIE' or v_candidate.confidence < 0.97 then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'promoted', false,
      'reason', 'first_party_ott_candidate_type_or_confidence_gate'
    );
  end if;

  select count(*)::integer
  into v_first_party_evidence_count
  from public.entity_discovery_evidence ede
  join public.source_identities si on si.id = ede.source_identity_id
  join public.sources s on s.id = si.source_id
  where ede.candidate_id = v_candidate.id
    and ede.match_method = 'DETERMINISTIC_TITLE'
    and ede.is_first_party = true
    and ede.weight >= 0.95
    and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
    and ede.metadata ->> 'evidenceStatus' = 'CONFIRMED'
    and coalesce(ede.metadata ->> 'providerCode', '') <> ''
    and s.source_role = 'OTT_PLATFORM'
    and s.authority_tier = 1;

  if v_first_party_evidence_count < 1 then
    return jsonb_build_object(
      'candidateId', v_candidate.id,
      'promoted', false,
      'reason', 'first_party_ott_evidence_gate',
      'firstPartyEvidenceCount', v_first_party_evidence_count
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
        review_reason = 'System matched direct first-party OTT release evidence to existing canonical entity',
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
        review_reason = 'System promoted candidate from direct Tier-1 OTT platform release evidence',
        updated_at = now()
    where id = v_candidate.id;

    v_created := true;
  end if;

  -- Direct OTT service evidence is item-scoped. Never teach a whole Netflix,
  -- Sony LIV, JioHotstar, etc. identity that it belongs to one film.
  insert into public.operator_resolution_overrides (
    raw_item_id, entity_id, active, reason, created_by
  )
  select distinct
    ede.raw_item_id,
    v_entity_id,
    true,
    'SYSTEM_FIRST_PARTY_OTT_PROMOTION: preserve direct release evidence at item scope',
    null::uuid
  from public.entity_discovery_evidence ede
  join public.source_identities si on si.id = ede.source_identity_id
  join public.sources s on s.id = si.source_id
  where ede.candidate_id = v_candidate.id
    and ede.match_method = 'DETERMINISTIC_TITLE'
    and ede.is_first_party = true
    and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
    and ede.metadata ->> 'evidenceStatus' = 'CONFIRMED'
    and s.source_role = 'OTT_PLATFORM'
    and s.authority_tier = 1
  on conflict (raw_item_id) do update
    set entity_id = excluded.entity_id,
        active = true,
        reason = excluded.reason,
        updated_at = now();
  get diagnostics v_item_overrides = row_count;

  for v_raw in
    select distinct ede.raw_item_id, ede.source_identity_id
    from public.entity_discovery_evidence ede
    join public.source_identities si on si.id = ede.source_identity_id
    join public.sources s on s.id = si.source_id
    where ede.candidate_id = v_candidate.id
      and ede.match_method = 'DETERMINISTIC_TITLE'
      and ede.is_first_party = true
      and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
      and ede.metadata ->> 'evidenceStatus' = 'CONFIRMED'
      and s.source_role = 'OTT_PLATFORM'
      and s.authority_tier = 1
  loop
    perform public.enqueue_job(
      'PROCESS_RAW_ITEM',
      'process:first-party-ott-promotion:' || v_candidate.id::text || ':' || v_raw.raw_item_id::text,
      jsonb_build_object(
        'rawItemId', v_raw.raw_item_id,
        'sourceIdentityId', v_raw.source_identity_id,
        'ottFirstPartyPromotionCandidateId', v_candidate.id
      ),
      15,
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
    case when v_created then 'AUTO_PROMOTE_FIRST_PARTY_OTT_ENTITY' else 'AUTO_BIND_FIRST_PARTY_OTT_ENTITY' end,
    'ENTITY',
    v_entity_id,
    to_jsonb(v_candidate),
    jsonb_build_object(
      'candidateId', v_candidate.id,
      'entityId', v_entity_id,
      'created', v_created,
      'firstPartyEvidenceCount', v_first_party_evidence_count,
      'itemOverrides', v_item_overrides,
      'enqueued', v_enqueued
    ),
    'Direct Tier-1 OTT platform release evidence passed the first-party canonical promotion gate'
  );

  return jsonb_build_object(
    'candidateId', v_candidate.id,
    'entityId', v_entity_id,
    'promoted', true,
    'created', v_created,
    'firstPartyEvidenceCount', v_first_party_evidence_count,
    'itemOverrides', v_item_overrides,
    'scopedSources', 0,
    'enqueued', v_enqueued
  );
end;
$$;

revoke all on function public.system_promote_first_party_ott_candidate(uuid) from public;
revoke all on function public.system_promote_first_party_ott_candidate(uuid) from anon;
revoke all on function public.system_promote_first_party_ott_candidate(uuid) from authenticated;
grant execute on function public.system_promote_first_party_ott_candidate(uuid) to service_role;

-- Preserve the already-proven two-source implementation under an internal name,
-- then keep the public RPC name as a dispatcher so existing workers need no
-- runtime change. Direct Tier-1 OTT evidence gets the narrow fast path; every
-- other candidate falls through to the original corroboration gate unchanged.
alter function public.system_promote_verified_ott_candidate(uuid)
  rename to system_promote_verified_ott_candidate_two_source;

create or replace function public.system_promote_verified_ott_candidate(
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_first_party jsonb;
begin
  v_first_party := public.system_promote_first_party_ott_candidate(p_candidate_id);
  if coalesce((v_first_party ->> 'promoted')::boolean, false) then
    return v_first_party || jsonb_build_object('promotionPath', 'FIRST_PARTY_OTT');
  end if;

  return public.system_promote_verified_ott_candidate_two_source(p_candidate_id)
    || jsonb_build_object('promotionPath', 'CORROBORATED');
end;
$$;

revoke all on function public.system_promote_verified_ott_candidate(uuid) from public;
revoke all on function public.system_promote_verified_ott_candidate(uuid) from anon;
revoke all on function public.system_promote_verified_ott_candidate(uuid) from authenticated;
grant execute on function public.system_promote_verified_ott_candidate(uuid) to service_role;

-- The renamed implementation remains callable only by service role. Keeping its
-- privilege explicit makes the fallback contract auditable after the rename.
revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from public;
revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from anon;
revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from authenticated;
grant execute on function public.system_promote_verified_ott_candidate_two_source(uuid) to service_role;

commit;
