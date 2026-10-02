begin;

create table if not exists public.source_entity_relationship_proposals (
  id uuid primary key default gen_random_uuid(),
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  relationship text not null default 'PROJECT_COVERAGE' check (relationship in ('PROJECT_COVERAGE')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  recommended_valid_days smallint not null default 60 check (recommended_valid_days between 7 and 180),
  status text not null default 'OPEN' check (status in ('OPEN','STALE','APPROVED','REJECTED')),
  rationale jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_identity_id, entity_id, relationship)
);

create trigger source_entity_relationship_proposals_set_updated_at
before update on public.source_entity_relationship_proposals
for each row execute function public.set_updated_at();

create index if not exists source_entity_relationship_proposals_open_idx
  on public.source_entity_relationship_proposals (status, confidence desc, evidence_count desc, last_seen_at desc)
  where status in ('OPEN','STALE');
create index if not exists source_entity_relationship_proposals_identity_idx
  on public.source_entity_relationship_proposals (source_identity_id, status, last_seen_at desc);

create table if not exists public.source_entity_relationship_evidence (
  proposal_id uuid not null references public.source_entity_relationship_proposals(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  resolution_result_id uuid not null references public.entity_resolution_results(id) on delete cascade,
  resolution_score numeric(5,4) not null check (resolution_score >= 0 and resolution_score <= 1),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (proposal_id, raw_item_id)
);

create index if not exists source_entity_relationship_evidence_raw_idx
  on public.source_entity_relationship_evidence (raw_item_id, proposal_id);

alter table public.source_entity_relationship_proposals enable row level security;
alter table public.source_entity_relationship_evidence enable row level security;
revoke all on table public.source_entity_relationship_proposals from public, anon, authenticated;
revoke all on table public.source_entity_relationship_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.source_entity_relationship_proposals to service_role;
grant select, insert, update, delete on table public.source_entity_relationship_evidence to service_role;

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
  with eligible_evidence as (
    select
      ri.source_identity_id,
      err.entity_id,
      err.id as resolution_result_id,
      ri.id as raw_item_id,
      err.score,
      coalesce(ri.published_at, ri.first_seen_at) as observed_at,
      s.source_role
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
      and not exists (
        select 1
        from public.source_entity_candidates sec
        where sec.source_identity_id = ri.source_identity_id
          and sec.entity_id = err.entity_id
          and sec.active = true
          and (sec.valid_from is null or sec.valid_from <= p_now)
          and (sec.valid_to is null or sec.valid_to > p_now)
      )
  ), aggregated as (
    select
      ee.source_identity_id,
      ee.entity_id,
      count(distinct ee.raw_item_id)::integer as evidence_count,
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
      'relationship', 'PROJECT_COVERAGE',
      'trustMutation', 'PROPOSAL_ONLY',
      'proposalVersion', 'p7.5-source-entity-v1',
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

  insert into public.source_entity_relationship_evidence (
    proposal_id, raw_item_id, resolution_result_id, resolution_score, observed_at
  )
  select
    p.id,
    ri.id,
    err.id,
    err.score::numeric(5,4),
    coalesce(ri.published_at, ri.first_seen_at)
  from public.source_entity_relationship_proposals p
  join public.raw_items ri on ri.source_identity_id = p.source_identity_id
  join public.entity_resolution_results err on err.raw_item_id = ri.id and err.entity_id = p.entity_id
  join public.source_identities si on si.id = ri.source_identity_id and si.active = true
  join public.sources s on s.id = si.source_id and s.active = true and s.authority_tier = 1
  join public.entities e on e.id = err.entity_id and e.status = 'ACTIVE'
  where p.status in ('OPEN','STALE','APPROVED')
    and s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL')
    and e.entity_type in ('MOVIE','SERIES','SEASON')
    and err.resolution_state = 'RESOLVED'
    and err.engine_version = 'canonical-title-resolver-v1'
    and err.score >= 0.9500
    and coalesce(ri.published_at, ri.first_seen_at) >= p_now - make_interval(days => p_lookback_days)
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

create or replace function public.operator_review_source_entity_relationship(
  p_actor_id uuid,
  p_proposal_id uuid,
  p_decision text,
  p_reason text,
  p_valid_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_proposal public.source_entity_relationship_proposals%rowtype;
  v_identity public.source_identities%rowtype;
  v_source public.sources%rowtype;
  v_entity public.entities%rowtype;
  v_decision text := upper(btrim(coalesce(p_decision, '')));
  v_valid_days integer;
  v_action_id uuid := gen_random_uuid();
  v_before jsonb;
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if v_decision not in ('APPROVE','REJECT') then raise exception 'invalid_relationship_decision'; end if;

  select * into v_proposal
  from public.source_entity_relationship_proposals
  where id = p_proposal_id
  for update;
  if v_proposal.id is null then raise exception 'relationship_proposal_not_found'; end if;
  if v_proposal.status <> 'OPEN' then raise exception 'relationship_proposal_not_open'; end if;

  select * into v_identity from public.source_identities where id = v_proposal.source_identity_id for update;
  if v_identity.id is null or not v_identity.active then raise exception 'source_identity_not_active'; end if;
  select * into v_source from public.sources where id = v_identity.source_id;
  if v_source.id is null or not v_source.active or v_source.authority_tier <> 1
     or v_source.source_role not in ('PRODUCTION_HOUSE','MUSIC_LABEL','OTT_PLATFORM','PROJECT_OFFICIAL') then
    raise exception 'source_not_eligible_for_project_coverage_relationship';
  end if;
  select * into v_entity from public.entities where id = v_proposal.entity_id;
  if v_entity.id is null or v_entity.status <> 'ACTIVE' or v_entity.entity_type not in ('MOVIE','SERIES','SEASON') then
    raise exception 'entity_not_eligible_for_project_coverage_relationship';
  end if;

  if v_decision = 'REJECT' then
    update public.source_entity_relationship_proposals
    set status = 'REJECTED', reviewed_by = p_actor_id, reviewed_at = now(), review_reason = btrim(p_reason), resolved_at = now(), updated_at = now()
    where id = p_proposal_id;

    insert into public.audit_actions (
      id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason
    ) values (
      v_action_id, 'ADMIN', p_actor_id, 'REJECT_SOURCE_ENTITY_RELATIONSHIP', 'SOURCE_ENTITY_RELATIONSHIP_PROPOSAL', p_proposal_id,
      to_jsonb(v_proposal), jsonb_build_object('status','REJECTED'), btrim(p_reason)
    );

    return jsonb_build_object('actionId',v_action_id,'proposalId',p_proposal_id,'decision','REJECT','relationshipActivated',false);
  end if;

  v_valid_days := coalesce(p_valid_days, v_proposal.recommended_valid_days);
  if v_valid_days < 7 or v_valid_days > 180 then raise exception 'relationship_valid_days_out_of_range'; end if;

  select to_jsonb(sec) into v_before
  from public.source_entity_candidates sec
  where sec.source_identity_id = v_proposal.source_identity_id and sec.entity_id = v_proposal.entity_id;

  insert into public.source_entity_candidates (
    source_identity_id, entity_id, relationship, confidence, priority,
    valid_from, valid_to, active, created_at, updated_at
  ) values (
    v_proposal.source_identity_id,
    v_proposal.entity_id,
    v_proposal.relationship,
    v_proposal.confidence,
    100,
    now(),
    now() + make_interval(days => v_valid_days),
    true,
    now(),
    now()
  )
  on conflict (source_identity_id, entity_id) do update
    set relationship = excluded.relationship,
        confidence = greatest(public.source_entity_candidates.confidence, excluded.confidence),
        priority = least(public.source_entity_candidates.priority, excluded.priority),
        valid_from = excluded.valid_from,
        valid_to = excluded.valid_to,
        active = true,
        updated_at = now();

  update public.source_entity_relationship_proposals
  set status = 'APPROVED', reviewed_by = p_actor_id, reviewed_at = now(), review_reason = btrim(p_reason), resolved_at = now(), updated_at = now()
  where id = p_proposal_id;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id, before_json, after_json, reason
  ) values (
    v_action_id,
    'ADMIN',
    p_actor_id,
    'APPROVE_SOURCE_ENTITY_RELATIONSHIP',
    'SOURCE_ENTITY_RELATIONSHIP_PROPOSAL',
    p_proposal_id,
    v_before,
    jsonb_build_object(
      'sourceIdentityId', v_proposal.source_identity_id,
      'entityId', v_proposal.entity_id,
      'relationship', v_proposal.relationship,
      'confidence', v_proposal.confidence,
      'validDays', v_valid_days,
      'active', true,
      'trustMutation', 'OPERATOR_APPROVED_RESOLVER_PRIOR'
    ),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'proposalId', p_proposal_id,
    'decision', 'APPROVE',
    'sourceIdentityId', v_proposal.source_identity_id,
    'entityId', v_proposal.entity_id,
    'relationshipActivated', true,
    'validDays', v_valid_days
  );
end;
$$;

revoke all on function public.operator_review_source_entity_relationship(uuid,uuid,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.operator_review_source_entity_relationship(uuid,uuid,text,text,integer)
  to service_role;

commit;
