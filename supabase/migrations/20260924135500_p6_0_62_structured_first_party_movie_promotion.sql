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
  v_first_party jsonb;
  v_has_first_party_movie_evidence boolean := false;
begin
  select exists (
    select 1
    from public.entity_discovery_evidence ede
    join public.entity_discovery_candidates c on c.id = ede.candidate_id
    join public.source_identities si on si.id = ede.source_identity_id
    join public.sources s on s.id = si.source_id
    join public.raw_items r on r.id = ede.raw_item_id
    where ede.candidate_id = p_candidate_id
      and c.proposed_entity_type = 'MOVIE'
      and ede.match_method = 'DETERMINISTIC_TITLE'
      and ede.is_first_party = true
      and ede.weight >= 0.95
      and ede.metadata ->> 'signalType' = 'OTT_RELEASE'
      and ede.metadata ->> 'evidenceStatus' = 'CONFIRMED'
      and coalesce(ede.metadata ->> 'providerCode', '') <> ''
      and s.source_role = 'OTT_PLATFORM'
      and s.authority_tier = 1
      and (
        (coalesce(r.raw_title, '') || ' ' || coalesce(r.raw_text, '')) ~* '\m(movie|film)\M'
        or ede.metadata ->> 'contentType' = 'MOVIE'
      )
  ) into v_has_first_party_movie_evidence;

  if v_has_first_party_movie_evidence then
    v_first_party := public.system_promote_first_party_ott_candidate(p_candidate_id);
    if coalesce((v_first_party ->> 'promoted')::boolean, false) then
      return v_first_party || jsonb_build_object('promotionPath', 'FIRST_PARTY_OTT');
    end if;
  end if;

  return public.system_promote_verified_ott_candidate_two_source(p_candidate_id)
    || jsonb_build_object('promotionPath', 'CORROBORATED');
end;
$$;

revoke all on function public.system_promote_verified_ott_candidate(uuid) from public;
revoke all on function public.system_promote_verified_ott_candidate(uuid) from anon;
revoke all on function public.system_promote_verified_ott_candidate(uuid) from authenticated;
grant execute on function public.system_promote_verified_ott_candidate(uuid) to service_role;

comment on function public.system_promote_verified_ott_candidate(uuid) is
  'Promotes a verified OTT movie candidate through the first-party path only when Tier-1 OTT evidence is confirmed and either explicitly says movie/film or carries the deterministic parser contentType=MOVIE assertion; otherwise requires corroboration.';

commit;
