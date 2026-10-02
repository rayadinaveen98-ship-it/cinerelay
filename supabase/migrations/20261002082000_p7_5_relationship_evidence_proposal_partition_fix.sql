begin;

create or replace function public.refresh_source_entity_relationship_proposals(
  p_now timestamptz default now(),
  p_lookback_days integer default 21
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_upserted integer := 0;
  v_staled integer := 0;
  v_evidence_upserted integer := 0;
  v_open integer := 0;
begin
  if p_lookback_days is null or p_lookback_days < 1 or p_lookback_days > 60 then
    raise exception 'relationship_lookback_days_out_of_range';
  end if;

  insert into public.source_entity_relationship_proposals (
    source_identity_id, entity_id, relationship, confidence, evidence_count,
    recommended_valid_days, status, rationale, first_seen_at, last_seen_at,
    reviewed_by, reviewed_at, review_reason, resolved_at
  )
  select
    c.source_identity_id, c.entity_id, c.relationship, c.confidence, c.evidence_count,
    c.recommended_valid_days, 'OPEN', c.rationale, p_now, p_now,
    null, null, null, null
  from public.source_entity_relationship_proposal_candidates(p_now, p_lookback_days) c
  on conflict (source_identity_id, entity_id, relationship) do update
    set confidence = excluded.confidence,
        evidence_count = excluded.evidence_count,
        recommended_valid_days = excluded.recommended_valid_days,
        status = 'OPEN',
        rationale = excluded.rationale,
        last_seen_at = p_now,
        resolved_at = null,
        updated_at = p_now
  where public.source_entity_relationship_proposals.status in ('OPEN','STALE');
  get diagnostics v_upserted = row_count;

  update public.source_entity_relationship_proposals p
  set status = 'STALE',
      resolved_at = p_now,
      updated_at = p_now
  where p.status = 'OPEN'
    and not exists (
      select 1
      from public.source_entity_relationship_proposal_candidates(p_now, p_lookback_days) c
      where c.source_identity_id = p.source_identity_id
        and c.entity_id = p.entity_id
        and c.relationship = p.relationship
    );
  get diagnostics v_staled = row_count;

  with ranked_evidence as (
    select
      ri.source_identity_id,
      ri.id as raw_item_id,
      err.id as resolution_result_id,
      err.entity_id,
      err.score::numeric(5,4) as resolution_score,
      coalesce(ri.published_at, ri.first_seen_at) as observed_at,
      row_number() over (
        partition by ri.id
        order by err.created_at desc, err.score desc, err.id desc
      ) as resolution_rank
    from public.raw_items ri
    join public.entity_resolution_results err on err.raw_item_id = ri.id
    join public.source_identities si on si.id = ri.source_identity_id and si.active = true
    join public.sources s on s.id = si.source_id and s.active = true and s.authority_tier = 1
    join public.entities e on e.id = err.entity_id and e.status = 'ACTIVE'
    where s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL')
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and err.resolution_state = 'RESOLVED'
      and err.engine_version = 'canonical-title-resolver-v1'
      and err.score >= 0.9500
      and coalesce(ri.published_at, ri.first_seen_at) >= p_now - make_interval(days => p_lookback_days)
  ), current_evidence as (
    select
      p.id as proposal_id,
      re.raw_item_id,
      re.resolution_result_id,
      re.resolution_score,
      re.observed_at
    from ranked_evidence re
    join public.source_entity_relationship_proposals p
      on p.source_identity_id = re.source_identity_id
     and p.entity_id = re.entity_id
     and p.status in ('OPEN','STALE','APPROVED')
    where re.resolution_rank = 1
  )
  insert into public.source_entity_relationship_evidence (
    proposal_id, raw_item_id, resolution_result_id, resolution_score, observed_at
  )
  select ce.proposal_id, ce.raw_item_id, ce.resolution_result_id, ce.resolution_score, ce.observed_at
  from current_evidence ce
  on conflict (proposal_id, raw_item_id) do update
    set resolution_result_id = excluded.resolution_result_id,
        resolution_score = excluded.resolution_score,
        observed_at = excluded.observed_at;
  get diagnostics v_evidence_upserted = row_count;

  delete from public.source_entity_relationship_evidence evidence
  using public.source_entity_relationship_proposals p
  where p.id = evidence.proposal_id
    and p.status in ('OPEN','STALE')
    and not exists (
      select 1
      from (
        select
          ri.source_identity_id,
          ri.id as raw_item_id,
          err.entity_id,
          row_number() over (
            partition by ri.id
            order by err.created_at desc, err.score desc, err.id desc
          ) as resolution_rank
        from public.raw_items ri
        join public.entity_resolution_results err on err.raw_item_id = ri.id
        join public.source_identities si on si.id = ri.source_identity_id and si.active = true
        join public.sources s on s.id = si.source_id and s.active = true and s.authority_tier = 1
        join public.entities e on e.id = err.entity_id and e.status = 'ACTIVE'
        where s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL')
          and e.entity_type in ('MOVIE','SERIES','SEASON')
          and err.resolution_state = 'RESOLVED'
          and err.engine_version = 'canonical-title-resolver-v1'
          and err.score >= 0.9500
          and coalesce(ri.published_at, ri.first_seen_at) >= p_now - make_interval(days => p_lookback_days)
      ) current_ranked
      where current_ranked.resolution_rank = 1
        and current_ranked.source_identity_id = p.source_identity_id
        and current_ranked.entity_id = p.entity_id
        and current_ranked.raw_item_id = evidence.raw_item_id
    );

  select count(*) into v_open
  from public.source_entity_relationship_proposals
  where status = 'OPEN';

  return jsonb_build_object(
    'refreshedAt', p_now,
    'lookbackDays', p_lookback_days,
    'upserted', v_upserted,
    'staled', v_staled,
    'evidenceUpserted', v_evidence_upserted,
    'open', v_open
  );
end;
$$;

revoke all on function public.refresh_source_entity_relationship_proposals(timestamptz,integer)
  from public, anon, authenticated;
grant execute on function public.refresh_source_entity_relationship_proposals(timestamptz,integer)
  to service_role;

commit;
