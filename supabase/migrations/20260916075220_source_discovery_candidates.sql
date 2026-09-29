begin;

create table if not exists public.source_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_url text not null,
  normalized_url text not null unique,
  display_name text,
  candidate_kind text not null check (candidate_kind in (
    'YOUTUBE_CHANNEL','RSS_ATOM','PUBLIC_WEB','INSTAGRAM_PROFILE','THREADS_PROFILE','X_PROFILE','OTHER'
  )),
  discovery_method text not null check (discovery_method in (
    'OPERATOR','OFFICIAL_LINK','CONNECTOR_HINT','IMPORT'
  )),
  discovered_from_source_identity_id uuid references public.source_identities(id) on delete set null,
  proposed_source_role text,
  territory text,
  languages text[] not null default '{}',
  confidence numeric(5,4) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'PENDING' check (status in (
    'PENDING','REVIEWING','APPROVED','REJECTED','DUPLICATE','PROMOTED'
  )),
  duplicate_of_source_identity_id uuid references public.source_identities(id) on delete set null,
  promoted_source_identity_id uuid references public.source_identities(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (candidate_url ~* '^https://'),
  check (normalized_url ~* '^https://'),
  check (status <> 'DUPLICATE' or duplicate_of_source_identity_id is not null),
  check (status <> 'PROMOTED' or promoted_source_identity_id is not null)
);

create trigger source_discovery_candidates_set_updated_at
before update on public.source_discovery_candidates
for each row execute function public.set_updated_at();

create index if not exists source_discovery_candidates_status_seen_idx
  on public.source_discovery_candidates (status, last_seen_at desc);
create index if not exists source_discovery_candidates_kind_idx
  on public.source_discovery_candidates (candidate_kind, status);

create table if not exists public.source_discovery_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.source_discovery_candidates(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'OFFICIAL_LINK','PROFILE_BIO_LINK','PAGE_METADATA','CONNECTOR_HINT','OPERATOR_NOTE','OTHER'
  )),
  evidence_url text,
  note text,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (evidence_url is null or evidence_url ~* '^https://'),
  check (evidence_url is not null or nullif(btrim(coalesce(note, '')), '') is not null)
);

create unique index if not exists source_discovery_evidence_dedupe_uq
  on public.source_discovery_evidence (
    candidate_id,
    evidence_type,
    coalesce(evidence_url, ''),
    coalesce(note, '')
  );
create index if not exists source_discovery_evidence_candidate_idx
  on public.source_discovery_evidence (candidate_id, observed_at desc);

alter table public.source_discovery_candidates enable row level security;
alter table public.source_discovery_evidence enable row level security;

revoke all on table public.source_discovery_candidates from public, anon, authenticated;
revoke all on table public.source_discovery_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.source_discovery_candidates to service_role;
grant select, insert, update, delete on table public.source_discovery_evidence to service_role;

create or replace function public.submit_source_discovery_candidate(
  p_candidate_url text,
  p_normalized_url text,
  p_candidate_kind text,
  p_discovery_method text,
  p_display_name text default null,
  p_discovered_from_source_identity_id uuid default null,
  p_proposed_source_role text default null,
  p_territory text default null,
  p_languages text[] default '{}'::text[],
  p_confidence numeric default 0.5,
  p_metadata jsonb default '{}'::jsonb,
  p_evidence_type text default null,
  p_evidence_url text default null,
  p_evidence_note text default null,
  p_evidence_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_candidate_id uuid;
  v_url text := btrim(coalesce(p_candidate_url, ''));
  v_normalized text := btrim(coalesce(p_normalized_url, ''));
  v_kind text := upper(btrim(coalesce(p_candidate_kind, '')));
  v_method text := upper(btrim(coalesce(p_discovery_method, '')));
  v_evidence_type text := case when p_evidence_type is null then null else upper(btrim(p_evidence_type)) end;
begin
  if v_url !~* '^https://' or v_normalized !~* '^https://' then
    raise exception 'candidate_url_must_be_https';
  end if;
  if v_kind not in ('YOUTUBE_CHANNEL','RSS_ATOM','PUBLIC_WEB','INSTAGRAM_PROFILE','THREADS_PROFILE','X_PROFILE','OTHER') then
    raise exception 'invalid_candidate_kind';
  end if;
  if v_method not in ('OPERATOR','OFFICIAL_LINK','CONNECTOR_HINT','IMPORT') then
    raise exception 'invalid_discovery_method';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'invalid_candidate_confidence';
  end if;
  if p_discovered_from_source_identity_id is not null
     and not exists(select 1 from public.source_identities where id = p_discovered_from_source_identity_id) then
    raise exception 'discovery_source_identity_not_found';
  end if;

  insert into public.source_discovery_candidates (
    candidate_url,
    normalized_url,
    display_name,
    candidate_kind,
    discovery_method,
    discovered_from_source_identity_id,
    proposed_source_role,
    territory,
    languages,
    confidence,
    metadata,
    first_seen_at,
    last_seen_at
  ) values (
    v_url,
    v_normalized,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    v_kind,
    v_method,
    p_discovered_from_source_identity_id,
    nullif(btrim(coalesce(p_proposed_source_role, '')), ''),
    nullif(upper(btrim(coalesce(p_territory, ''))), ''),
    coalesce(p_languages, '{}'::text[]),
    p_confidence,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (normalized_url) do update
    set candidate_url = excluded.candidate_url,
        display_name = coalesce(excluded.display_name, public.source_discovery_candidates.display_name),
        candidate_kind = excluded.candidate_kind,
        discovery_method = excluded.discovery_method,
        discovered_from_source_identity_id = coalesce(excluded.discovered_from_source_identity_id, public.source_discovery_candidates.discovered_from_source_identity_id),
        proposed_source_role = coalesce(excluded.proposed_source_role, public.source_discovery_candidates.proposed_source_role),
        territory = coalesce(excluded.territory, public.source_discovery_candidates.territory),
        languages = case when cardinality(excluded.languages) > 0 then excluded.languages else public.source_discovery_candidates.languages end,
        confidence = greatest(public.source_discovery_candidates.confidence, excluded.confidence),
        metadata = public.source_discovery_candidates.metadata || excluded.metadata,
        last_seen_at = now(),
        updated_at = now()
  returning id into v_candidate_id;

  if v_evidence_type is not null then
    if v_evidence_type not in ('OFFICIAL_LINK','PROFILE_BIO_LINK','PAGE_METADATA','CONNECTOR_HINT','OPERATOR_NOTE','OTHER') then
      raise exception 'invalid_discovery_evidence_type';
    end if;
    if p_evidence_url is not null and btrim(p_evidence_url) !~* '^https://' then
      raise exception 'evidence_url_must_be_https';
    end if;
    if p_evidence_url is null and nullif(btrim(coalesce(p_evidence_note, '')), '') is null then
      raise exception 'evidence_url_or_note_required';
    end if;

    insert into public.source_discovery_evidence (
      candidate_id, evidence_type, evidence_url, note, metadata
    ) values (
      v_candidate_id,
      v_evidence_type,
      case when p_evidence_url is null then null else btrim(p_evidence_url) end,
      nullif(btrim(coalesce(p_evidence_note, '')), ''),
      coalesce(p_evidence_metadata, '{}'::jsonb)
    )
    on conflict do nothing;
  end if;

  return v_candidate_id;
end;
$$;

create or replace function public.operator_review_source_candidate(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_status text,
  p_reason text,
  p_duplicate_source_identity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_before public.source_discovery_candidates%rowtype;
  v_after public.source_discovery_candidates%rowtype;
  v_status text := upper(btrim(coalesce(p_status, '')));
  v_action_id uuid := gen_random_uuid();
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if v_status not in ('REVIEWING','APPROVED','REJECTED','DUPLICATE') then
    raise exception 'invalid_candidate_review_status';
  end if;
  if v_status = 'DUPLICATE' then
    if p_duplicate_source_identity_id is null
       or not exists(select 1 from public.source_identities where id = p_duplicate_source_identity_id) then
      raise exception 'duplicate_source_identity_required';
    end if;
  elsif p_duplicate_source_identity_id is not null then
    raise exception 'duplicate_identity_only_valid_for_duplicate_status';
  end if;

  select * into v_before
  from public.source_discovery_candidates
  where id = p_candidate_id
  for update;
  if v_before.id is null then raise exception 'source_candidate_not_found'; end if;
  if v_before.status = 'PROMOTED' then raise exception 'promoted_candidate_is_immutable_here'; end if;

  update public.source_discovery_candidates
  set status = v_status,
      duplicate_of_source_identity_id = case when v_status = 'DUPLICATE' then p_duplicate_source_identity_id else null end,
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
    v_action_id,
    'ADMIN',
    p_actor_id,
    'REVIEW_SOURCE_CANDIDATE',
    'SOURCE_CANDIDATE',
    p_candidate_id,
    to_jsonb(v_before),
    to_jsonb(v_after),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', p_candidate_id,
    'status', v_after.status,
    'duplicateOfSourceIdentityId', v_after.duplicate_of_source_identity_id,
    'sourceCreated', false,
    'authorityAssigned', false
  );
end;
$$;

revoke all on function public.submit_source_discovery_candidate(
  text,text,text,text,text,uuid,text,text,text[],numeric,jsonb,text,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.submit_source_discovery_candidate(
  text,text,text,text,text,uuid,text,text,text[],numeric,jsonb,text,text,text,jsonb
) to service_role;

revoke all on function public.operator_review_source_candidate(uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.operator_review_source_candidate(uuid,uuid,text,text,uuid)
  to service_role;

commit;
