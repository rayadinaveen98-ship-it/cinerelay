begin;

create table if not exists public.source_officiality_proposals (
  candidate_id uuid primary key references public.source_discovery_candidates(id) on delete cascade,
  proposal_type text not null check (proposal_type in (
    'EXACT_IDENTITY',
    'ADD_IDENTITY_TO_EXISTING_SOURCE',
    'REVIEW_OWNERSHIP',
    'REVIEW_NEW_SOURCE'
  )),
  matched_source_id uuid references public.sources(id) on delete set null,
  matched_source_identity_id uuid references public.source_identities(id) on delete set null,
  proposed_authority_tier smallint check (proposed_authority_tier between 1 and 5),
  proposed_source_role text,
  officiality_score numeric(5,4) not null check (officiality_score >= 0 and officiality_score <= 1),
  support_count integer not null default 0 check (support_count >= 0),
  distinct_origin_sources integer not null default 0 check (distinct_origin_sources >= 0),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  recommended_action text not null,
  rationale jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger source_officiality_proposals_set_updated_at
before update on public.source_officiality_proposals
for each row execute function public.set_updated_at();

create index if not exists source_officiality_proposals_open_idx
  on public.source_officiality_proposals (status, officiality_score desc, last_seen_at desc)
  where status = 'OPEN';
create index if not exists source_officiality_proposals_source_idx
  on public.source_officiality_proposals (matched_source_id, status, last_seen_at desc)
  where matched_source_id is not null;

alter table public.source_officiality_proposals enable row level security;
revoke all on table public.source_officiality_proposals from public, anon, authenticated;
grant select, insert, update, delete on table public.source_officiality_proposals to service_role;

create or replace function public.source_officiality_proposal_candidates()
returns table (
  candidate_id uuid,
  proposal_type text,
  matched_source_id uuid,
  matched_source_identity_id uuid,
  proposed_authority_tier smallint,
  proposed_source_role text,
  officiality_score numeric(5,4),
  support_count integer,
  distinct_origin_sources integer,
  recommended_action text,
  rationale jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with eligible as (
    select c.*
    from public.source_discovery_candidates c
    where c.discovery_method = 'OFFICIAL_LINK'
      and c.status in ('PENDING','REVIEWING','APPROVED')
  ), origin_stats as (
    select
      c.id as candidate_id,
      count(e.id) filter (where os.authority_tier = 1)::integer as support_count,
      count(distinct os.id) filter (where os.authority_tier = 1)::integer as distinct_origin_sources,
      array_agg(distinct os.id) filter (where os.authority_tier = 1) as origin_source_ids
    from eligible c
    left join public.source_discovery_evidence e
      on e.candidate_id = c.id
     and e.evidence_type = 'OFFICIAL_LINK'
    left join public.sources os
      on os.id::text = e.metadata->>'originSourceId'
     and os.active = true
    group by c.id
  ), derived as (
    select
      c.*,
      coalesce(stats.support_count,0) as support_count,
      coalesce(stats.distinct_origin_sources,0) as distinct_origin_sources,
      stats.origin_source_ids,
      exact_identity.id as exact_identity_id,
      exact_identity.source_id as exact_source_id,
      exact_source.authority_tier as exact_authority_tier,
      exact_source.source_role as exact_source_role,
      origin_source.id as origin_source_id,
      origin_source.authority_tier as origin_authority_tier,
      origin_source.source_role as origin_source_role
    from eligible c
    left join origin_stats stats on stats.candidate_id = c.id
    left join lateral (
      select si.id, si.source_id
      from public.source_identities si
      where lower(rtrim(si.canonical_url, '/')) = lower(rtrim(c.normalized_url, '/'))
      order by si.active desc, si.updated_at desc
      limit 1
    ) exact_identity on true
    left join public.sources exact_source on exact_source.id = exact_identity.source_id
    left join public.sources origin_source
      on coalesce(stats.distinct_origin_sources,0) = 1
     and origin_source.id = stats.origin_source_ids[1]
  )
  select
    d.id,
    case
      when d.exact_identity_id is not null then 'EXACT_IDENTITY'
      when d.distinct_origin_sources = 1 and d.origin_source_id is not null then 'ADD_IDENTITY_TO_EXISTING_SOURCE'
      when d.distinct_origin_sources > 1 then 'REVIEW_OWNERSHIP'
      else 'REVIEW_NEW_SOURCE'
    end,
    case
      when d.exact_identity_id is not null then d.exact_source_id
      when d.distinct_origin_sources = 1 then d.origin_source_id
      else null
    end,
    d.exact_identity_id,
    case
      when d.exact_identity_id is not null then d.exact_authority_tier::smallint
      when d.distinct_origin_sources = 1 then d.origin_authority_tier::smallint
      else null::smallint
    end,
    coalesce(
      d.proposed_source_role,
      case
        when d.exact_identity_id is not null then d.exact_source_role
        when d.distinct_origin_sources = 1 then d.origin_source_role
        else null
      end
    ),
    case
      when d.exact_identity_id is not null then 1.0000
      when d.distinct_origin_sources = 1 then least(
        0.9700::numeric,
        greatest(d.confidence, 0.9000::numeric)
          + least(0.0500::numeric, greatest(d.support_count - 1, 0)::numeric * 0.0100::numeric)
      )
      when d.distinct_origin_sources > 1 then least(
        0.8500::numeric,
        greatest(d.confidence, 0.6500::numeric)
          + least(0.1000::numeric, d.distinct_origin_sources::numeric * 0.0200::numeric)
      )
      else greatest(d.confidence, 0.5500::numeric)
    end::numeric(5,4),
    d.support_count,
    d.distinct_origin_sources,
    case
      when d.exact_identity_id is not null then 'Mark duplicate after operator verification; the identity already exists in the registry.'
      when d.distinct_origin_sources = 1 and d.origin_source_id is not null then 'Review adding this as another identity of the linked Tier-A source. Do not auto-promote authority.'
      when d.distinct_origin_sources > 1 then 'Multiple Tier-A sources link this destination; review ownership before assigning it to any source.'
      else 'Evidence is insufficient to assign an owner automatically; review as a possible new source.'
    end,
    jsonb_build_object(
      'candidateUrl', d.normalized_url,
      'candidateKind', d.candidate_kind,
      'candidateConfidence', d.confidence,
      'supportCount', d.support_count,
      'distinctOriginSources', d.distinct_origin_sources,
      'originSourceIds', coalesce(to_jsonb(d.origin_source_ids), '[]'::jsonb),
      'exactRegistryMatch', d.exact_identity_id is not null,
      'trustMutation', 'PROPOSAL_ONLY',
      'proposalVersion', 'p7.2-official-link-v1'
    )
  from derived d;
$$;

revoke all on function public.source_officiality_proposal_candidates()
  from public, anon, authenticated;
grant execute on function public.source_officiality_proposal_candidates()
  to service_role;

create or replace function public.refresh_source_officiality_proposals(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_upserted integer := 0;
  v_resolved integer := 0;
  v_open integer := 0;
begin
  insert into public.source_officiality_proposals (
    candidate_id,
    proposal_type,
    matched_source_id,
    matched_source_identity_id,
    proposed_authority_tier,
    proposed_source_role,
    officiality_score,
    support_count,
    distinct_origin_sources,
    status,
    recommended_action,
    rationale,
    first_seen_at,
    last_seen_at,
    resolved_at
  )
  select
    p.candidate_id,
    p.proposal_type,
    p.matched_source_id,
    p.matched_source_identity_id,
    p.proposed_authority_tier,
    p.proposed_source_role,
    p.officiality_score,
    p.support_count,
    p.distinct_origin_sources,
    'OPEN',
    p.recommended_action,
    p.rationale,
    p_now,
    p_now,
    null
  from public.source_officiality_proposal_candidates() p
  on conflict (candidate_id) do update
    set proposal_type = excluded.proposal_type,
        matched_source_id = excluded.matched_source_id,
        matched_source_identity_id = excluded.matched_source_identity_id,
        proposed_authority_tier = excluded.proposed_authority_tier,
        proposed_source_role = excluded.proposed_source_role,
        officiality_score = excluded.officiality_score,
        support_count = excluded.support_count,
        distinct_origin_sources = excluded.distinct_origin_sources,
        status = 'OPEN',
        recommended_action = excluded.recommended_action,
        rationale = excluded.rationale,
        last_seen_at = p_now,
        resolved_at = null,
        updated_at = p_now;
  get diagnostics v_upserted = row_count;

  update public.source_officiality_proposals existing
  set status = 'RESOLVED',
      resolved_at = p_now,
      updated_at = p_now
  where existing.status = 'OPEN'
    and not exists (
      select 1
      from public.source_officiality_proposal_candidates() current
      where current.candidate_id = existing.candidate_id
    );
  get diagnostics v_resolved = row_count;

  select count(*) into v_open
  from public.source_officiality_proposals
  where status = 'OPEN';

  return jsonb_build_object(
    'refreshedAt', p_now,
    'upserted', v_upserted,
    'resolved', v_resolved,
    'open', v_open
  );
end;
$$;

revoke all on function public.refresh_source_officiality_proposals(timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_source_officiality_proposals(timestamptz)
  to service_role;

commit;
