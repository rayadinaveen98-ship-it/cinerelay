-- CineRelay Phase 1: independently owned source evidence.
-- New explicit corporate registry, not fuzzy brand-name classification.
-- Unmapped sources remain separate by their immutable source UUID.
-- Changes only catalogue approval/promotion; no candidate/event/news replay.

create table if not exists public.source_corporate_owners (
 id uuid primary key default gen_random_uuid(),
 owner_key text not null unique check(owner_key ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 display_name text not null,
 verified_url text not null check(verified_url ~ '^https://'),
 notes text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.source_corporate_owner_memberships (
 source_id uuid primary key references public.sources(id) on delete restrict,
 owner_id uuid not null references public.source_corporate_owners(id) on delete restrict,
 verification_url text not null check(verification_url ~ '^https://'),
 verification_note text not null,
 reviewed_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists source_corporate_owner_memberships_owner_idx
  on public.source_corporate_owner_memberships(owner_id);

alter table public.source_corporate_owners enable row level security;
alter table public.source_corporate_owner_memberships enable row level security;
revoke all on public.source_corporate_owners from public,anon,authenticated;
revoke all on public.source_corporate_owner_memberships from public,anon,authenticated;
grant select,insert,update,delete on public.source_corporate_owners to service_role;
grant select,insert,update,delete on public.source_corporate_owner_memberships to service_role;

-- Conservative effective owner count: only explicitly checked mappings merge sources.
-- Add "corp:" and "source:" prefixes to avoid UUID identifier namespace collisions.
create or replace function public.catalogue_independent_owner_count(p_candidate_id uuid)
returns integer
language sql stable security invoker
set search_path to 'pg_catalog','public'
as $owner_count$
 select count(distinct case when cm.owner_id is not null
   then 'corp:' || cm.owner_id::text
   else 'source:' || si.source_id::text
 end)::integer
 from public.entity_discovery_evidence ede
 join public.source_identities si on si.id=ede.source_identity_id
 left join public.source_corporate_owner_memberships cm on cm.source_id=si.source_id
 where ede.candidate_id=p_candidate_id
$owner_count$;
revoke all on function public.catalogue_independent_owner_count(uuid) from public,anon,authenticated;
grant execute on function public.catalogue_independent_owner_count(uuid) to service_role;

-- Exact function-body replacement preserves approval parameters, audit and other safeguards.
do $function_change$
declare
 r text;
 promo text;
 old_review text := E'if (select count(distinct si.source_id)\n        from public.entity_discovery_evidence ede\n        join public.source_identities si on si.id = ede.source_identity_id\n        where ede.candidate_id = v_before.id) < 2 then';
 old_promo text := E'if (select count(distinct si.source_id)\n      from public.entity_discovery_evidence ede\n      join public.source_identities si on si.id = ede.source_identity_id\n      where ede.candidate_id = v_candidate.id) < 2 then';
begin
 r:=pg_get_functiondef('public.operator_review_entity_candidate(uuid,uuid,text,text,uuid)'::regprocedure);
 promo:=pg_get_functiondef('public.operator_promote_entity_candidate(uuid,uuid,text,text[])'::regprocedure);
 if position(old_review in r)=0 or position(old_promo in promo)=0 then
   -- Fail closed if either function differs from the tested prior gate.
   if position('public.catalogue_independent_owner_count(v_before.id) < 2 then' in r)=0
      or position('public.catalogue_independent_owner_count(v_candidate.id) < 2 then' in promo)=0 then
     raise exception 'catalogue_corporate_owner_gate_patch_mismatch';
   end if;
 else
   r:=replace(r,old_review,'if public.catalogue_independent_owner_count(v_before.id) < 2 then');
   promo:=replace(promo,old_promo,'if public.catalogue_independent_owner_count(v_candidate.id) < 2 then');
   execute r;
   execute promo;
 end if;
end
$function_change$;

revoke all on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.operator_promote_entity_candidate(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.operator_promote_entity_candidate(uuid,uuid,text,text[]) to service_role;

-- Owner facts substantiated by first-party service/corporate publishing domains.
insert into public.source_corporate_owners(id,owner_key,display_name,verified_url,notes)
values
('aa310000-0000-4000-8000-000000000001','amazon-prime-video','Amazon — Prime Video publishing',
 'https://www.aboutamazon.com/news/entertainment/what-you-need-to-know-about-prime-video',
 'Amazon About Amazon India and Prime Video India channels are one publishing-owner group for evidence corroboration.'),
('aa310000-0000-4000-8000-000000000002','netflix','Netflix publishing',
 'https://about.netflix.com/en/news/netflix-brings-fans-its-biggest-south-indian-slate-this-year',
 'Netflix India and Netflix India South official handles share Netflix publishing ownership.')
on conflict (owner_key) do nothing;

do $owner_seed$
declare rec record;
 added integer;
begin
 for rec in select * from (values
 ('070f383a-721f-4e07-8f59-2674be453d79'::uuid,'About Amazon India — Prime Video'::text,
  'aa310000-0000-4000-8000-000000000001'::uuid,
  'https://www.aboutamazon.com/news/entertainment/what-you-need-to-know-about-prime-video'::text),
 ('858b0eca-fef8-4dfb-948c-8e3393e2d4c1'::uuid,'Prime Video India',
  'aa310000-0000-4000-8000-000000000001'::uuid,
  'https://www.aboutamazon.com/news/entertainment/what-you-need-to-know-about-prime-video'),
 ('38364bc9-4381-4c9c-bbbc-1bda7b2463e9'::uuid,'Netflix India',
  'aa310000-0000-4000-8000-000000000002'::uuid,
  'https://about.netflix.com/en/news/netflix-brings-fans-its-biggest-south-indian-slate-this-year'),
 ('1e78e30b-c0a6-4f80-8ea6-5248e60ab215'::uuid,'Netflix India South',
  'aa310000-0000-4000-8000-000000000002'::uuid,
  'https://about.netflix.com/en/news/netflix-brings-fans-its-biggest-south-indian-slate-this-year')
 ) v(source_id,expected_name,owner_id,proof)
 loop
   if not exists(select 1 from public.sources s where s.id=rec.source_id and s.display_name=rec.expected_name) then
     raise exception 'corporate_source_mismatch: %',rec.expected_name;
   end if;
   if not exists(select 1 from public.source_corporate_owners co where co.id=rec.owner_id) then
     raise exception 'corporate_owner_missing: %',rec.expected_name;
   end if;
   if exists(select 1 from public.source_corporate_owner_memberships m
      where m.source_id=rec.source_id and m.owner_id<>rec.owner_id) then
     raise exception 'corporate_ownership_conflict: %',rec.expected_name;
   end if;
   insert into public.source_corporate_owner_memberships(source_id,owner_id,verification_url,verification_note)
   values(rec.source_id,rec.owner_id,rec.proof,'Human-reviewed exact brand and official corporate source; same publishing parent.')
   on conflict (source_id) do nothing;
   get diagnostics added = row_count;
   if added=1 then
     insert into public.audit_actions(actor_type,action_type,target_type,target_id,before_json,after_json,reason)
     values('SYSTEM','CORPORATE_SOURCE_OWNERSHIP_VERIFIED','SOURCE',rec.source_id,
       '{}'::jsonb,jsonb_build_object('corporateOwnerId',rec.owner_id,'evidenceUrl',rec.proof),
       'Exact first-party publishing-owner verification; ownership used only in catalogue corroboration safety gate.');
   end if;
 end loop;
end
$owner_seed$;
