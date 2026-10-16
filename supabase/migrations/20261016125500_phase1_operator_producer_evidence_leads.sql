-- Safe, operator-only *lead* capture. NOT raw_items or entity discovery evidence.
-- Direct post URLs only; company profile links do not constitute an announcement.
create table if not exists public.operator_producer_evidence_leads (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.entity_discovery_candidates(id) on delete restrict,
  source_url text not null check(length(source_url) between 35 and 600),
  claimed_owner_name text not null check(length(btrim(claimed_owner_name)) between 3 and 120),
  evidence_note text not null check(length(btrim(evidence_note)) between 30 and 1200),
  status text not null default 'NEEDS_PRIMARY_SOURCE_REVIEW'
    check(status = 'NEEDS_PRIMARY_SOURCE_REVIEW'),
  counts_toward_approval boolean not null default false check(counts_toward_approval=false),
  author_asserted_publication_at timestamptz null
    check (author_asserted_publication_at is null),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(candidate_id,source_url)
);
create index if not exists operator_producer_evidence_leads_candidate_idx
  on public.operator_producer_evidence_leads(candidate_id,created_at desc);
alter table public.operator_producer_evidence_leads enable row level security;
revoke all on public.operator_producer_evidence_leads from public,anon,authenticated;
grant select,insert on public.operator_producer_evidence_leads to service_role;
-- Explicitly deny mutation after capture; corrections need an audited future action.
create or replace function public.operator_submit_producer_evidence_lead(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_source_url text,
  p_claimed_owner_name text,
  p_evidence_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions'
as $function$
declare
  v_url text := split_part(split_part(btrim(coalesce(p_source_url,'')),'?',1),'#',1);
  v_owner text := btrim(coalesce(p_claimed_owner_name,''));
  v_note text := btrim(coalesce(p_evidence_note,''));
  v_id uuid;
  v_inserted boolean := false;
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if p_candidate_id is null then raise exception 'candidate_required'; end if;
  -- Only link directly to an authored post. A company profile or employee repost
  -- is not evidence of the original production-company announcement.
  if length(v_url)>600 or v_url !~
     '^https://(www[.])?linkedin[.]com/(posts/[A-Za-z0-9_-]{8,}|feed/update/urn:li:activity:[0-9]{10,})/?$' then
    raise exception 'direct_producer_linkedin_post_required';
  end if;
  if length(v_owner) not between 3 and 120 then raise exception 'owner_name_invalid'; end if;
  if length(v_note) not between 30 and 1200 then raise exception 'evidence_note_requires_detail'; end if;
  if not exists(select 1 from public.entity_discovery_candidates
      where id=p_candidate_id and status='PENDING') then
    raise exception 'pending_candidate_required';
  end if;
  insert into public.operator_producer_evidence_leads(
    candidate_id,source_url,claimed_owner_name,evidence_note,created_by
  ) values(p_candidate_id,v_url,v_owner,v_note,p_actor_id)
  on conflict(candidate_id,source_url) do nothing
  returning id into v_id;
  v_inserted := v_id is not null;
  if not v_inserted then
    select id into strict v_id from public.operator_producer_evidence_leads
    where candidate_id=p_candidate_id and source_url=v_url;
  else
    insert into public.audit_actions(
      actor_type,actor_id,action_type,target_type,target_id,
      before_json,after_json,reason
    ) values(
      'ADMIN',p_actor_id,'OPERATOR_PRODUCER_EVIDENCE_LEAD','ENTITY_DISCOVERY_CANDIDATE',
      p_candidate_id,'{}'::jsonb,
      jsonb_build_object('leadId',v_id,'sourceUrl',v_url,'claimedOwner',v_owner,
       'status','NEEDS_PRIMARY_SOURCE_REVIEW','countsTowardApproval',false),
      'Operator submitted an unverified external producer post lead for later primary-source verification; never automatically ingest, approve or alert.'
    );
  end if;
  return jsonb_build_object('id',v_id,'created',v_inserted,
    'status','NEEDS_PRIMARY_SOURCE_REVIEW','countsTowardApproval',false);
end;
$function$;
revoke all on function public.operator_submit_producer_evidence_lead(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.operator_submit_producer_evidence_lead(uuid,uuid,text,text,text) to service_role;
