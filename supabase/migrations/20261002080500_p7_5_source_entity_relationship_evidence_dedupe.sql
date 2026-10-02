begin;

create or replace function public.source_entity_relationship_proposal_candidates(
  p_now timestamptz default now(),
  p_lookback_days integer default 21
)
returns table (
  source_identity_id uuid,
  entity_id uuid,
  relationship text,
  confidence numeric(5,4),
  evidence_count integer,
  recommended_valid_days smallint,
  rationale jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with ranked_evidence as (
    select
      ri.source_identity_id,
      err.entity_id,
      ri.id as raw_item_id,
      err.score,
      coalesce(ri.published_at, ri.first_seen_at) as observed_at,
      s.source_role,
      row_number() over (
        partition by ri.id
        order by err.created_at desc, err.score desc, err.id desc
      ) as resolution_rank
    from public.entity_resolution_results err
    join public.raw_items ri on ri.id = err.raw_item_id
    join public.source_identities si on si.id = ri.source_identity_id and si.active = true
    join public.sources s on s.id = si.source_id and s.active = true
    join public.entities e on e.id = err.entity_id and e.status = 'ACTIVE'
    where s.authority_tier = 1
      and s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL')
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and err.resolution_state = 'RESOLVED'
      and err.engine_version = 'canonical-title-resolver-v1'
      and err.score >= 0.9500
      and coalesce(ri.published_at, ri.first_seen_at) >= p_now - make_interval(days => greatest(1, least(coalesce(p_lookback_days, 21), 60)))
  ), eligible_evidence as (
    select re.source_identity_id, re.entity_id, re.raw_item_id, re.score, re.observed_at, re.source_role
    from ranked_evidence re
    where re.resolution_rank = 1
      and not exists (
        select 1
        from public.source_entity_candidates sec
        where sec.source_identity_id = re.source_identity_id
          and sec.entity_id = re.entity_id
          and sec.active = true
          and (sec.valid_from is null or sec.valid_from <= p_now)
          and (sec.valid_to is null or sec.valid_to > p_now)
      )
  ), aggregated as (
    select
      ee.source_identity_id,
      ee.entity_id,
      count(*)::integer as evidence_count,
      avg(ee.score) as average_score,
      max(ee.score) as max_score,
      max(ee.observed_at) as last_evidence_at,
      min(ee.source_role) as source_role
    from eligible_evidence ee
    group by ee.source_identity_id, ee.entity_id
  )
  select
    a.source_identity_id,
    a.entity_id,
    'PROJECT_COVERAGE'::text,
    least(
      0.9950::numeric,
      greatest(a.average_score, 0.9500::numeric)
        + least(0.0200::numeric, greatest(a.evidence_count - 1, 0)::numeric * 0.0050::numeric)
    )::numeric(5,4),
    a.evidence_count,
    case
      when a.source_role = 'PROJECT_OFFICIAL' then 180
      when a.source_role = 'PRODUCTION_HOUSE' then 120
      when a.source_role = 'MUSIC_LABEL' then 90
      else 60
    end::smallint,
    jsonb_build_object(
      'sourceRole', a.source_role,
      'averageResolutionScore', round(a.average_score::numeric, 4),
      'maxResolutionScore', round(a.max_score::numeric, 4),
      'evidenceCount', a.evidence_count,
      'lastEvidenceAt', a.last_evidence_at,
      'resolutionEngine', 'canonical-title-resolver-v1',
      'resolutionRowPolicy', 'LATEST_PER_RAW_ITEM',
      'relationship', 'PROJECT_COVERAGE',
      'trustMutation', 'PROPOSAL_ONLY',
      'proposalVersion', 'p7.5-source-entity-v2',
      'feedbackLoopGuard', 'SOURCE_SCOPE_RESOLUTIONS_EXCLUDED'
    )
  from aggregated a
  where a.evidence_count >= 2 or a.max_score >= 0.9900;
$$;

revoke all on function public.source_entity_relationship_proposal_candidates(timestamptz,integer)
  from public, anon, authenticated;
grant execute on function public.source_entity_relationship_proposal_candidates(timestamptz,integer)
  to service_role;

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
      p.id as proposal_id,
      ri.id as raw_item_id,
      err.id as resolution_result_id,
      err.score::numeric(5,4) as resolution_score,
      coalesce(ri.published_at, ri.first_seen_at) as observed_at,
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
    join public.source_entity_relationship_proposals p
      on p.source_identity_id = ri.source_identity_id
    where p.status in ('OPEN','STALE','APPROVED')
      and s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL')
      and e.entity_type in ('MOVIE','SERIES','SEASON')
      and err.resolution_state = 'RESOLVED'
      and err.engine_version = 'canonical-title-resolver-v1'
      and err.score >= 0.9500
      and coalesce(ri.published_at, ri.first_seen_at) >= p_now - make_interval(days => p_lookback_days)
  ), eligible_evidence as (
    select re.proposal_id, re.raw_item_id, re.resolution_result_id, re.resolution_score, re.observed_at
    from ranked_evidence re
    join public.source_entity_relationship_proposals p on p.id = re.proposal_id and p.entity_id = re.entity_id
    where re.resolution_rank = 1
  )
  insert into public.source_entity_relationship_evidence (
    proposal_id, raw_item_id, resolution_result_id, resolution_score, observed_at
  )
  select ee.proposal_id, ee.raw_item_id, ee.resolution_result_id, ee.resolution_score, ee.observed_at
  from eligible_evidence ee
  on conflict (proposal_id, raw_item_id) do update
    set resolution_result_id = excluded.resolution_result_id,
        resolution_score = excluded.resolution_score,
        observed_at = excluded.observed_at;
  get diagnostics v_evidence_upserted = row_count;

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
