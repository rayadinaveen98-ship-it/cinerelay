-- Close the remaining system OTT-movie promotion bypass of corporate-source
-- ownership, without changing TV/series manual approval or alert semantics.
do $patch$
declare
 v_two text;
 v_one text;
 v_anchor text := '  if v_signal_evidence_count < 2';
 v_check text := E'  if v_signal_independent_owner_count < 2 then\n    return jsonb_build_object(\n      ''candidateId'',v_candidate.id,\n      ''promoted'',false,\n      ''reason'',''ott_candidate_independent_corporate_owner_gate'',\n      ''independentOwnerCount'',v_signal_independent_owner_count\n    );\n  end if;\n\n';
 v_owner_query text := E'  select count(distinct case when cm.owner_id is not null\n       then ''corp:'' || cm.owner_id::text\n       else ''source:'' || si.source_id::text end)::integer\n    into v_signal_independent_owner_count\n    from public.entity_discovery_evidence ede\n    join public.source_identities si on si.id=ede.source_identity_id\n    left join public.source_corporate_owner_memberships cm on cm.source_id=si.source_id\n    where ede.candidate_id=v_candidate.id\n      and ede.match_method=''DETERMINISTIC_TITLE''\n      and ede.metadata ->> ''signalType'' = ''OTT_RELEASE'';\n\n';
begin
 v_two:=pg_get_functiondef('public.system_promote_verified_ott_candidate_two_source(uuid)'::regprocedure);
 v_one:=pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure);

 if position('v_signal_independent_owner_count' in v_two)=0 then
   if position('  v_signal_evidence_count integer := 0;' in v_two)=0
      or position(v_anchor in v_two)=0 then
     raise exception 'two_source_ott_promotion_body_mismatch';
   end if;
   v_two:=replace(v_two,'  v_signal_evidence_count integer := 0;',
     '  v_signal_evidence_count integer := 0;' || chr(10) || '  v_signal_independent_owner_count integer := 0;');
   v_two:=replace(v_two,v_anchor,v_owner_query || v_check || v_anchor);
 end if;
 if position('coalesce(v_candidate.country_code, ''IN'')' in v_two)>0 then
   v_two:=replace(v_two,'coalesce(v_candidate.country_code, ''IN'')','v_candidate.country_code');
 end if;
 if position('coalesce(v_candidate.country_code, ''IN'')' in v_one)>0 then
   v_one:=replace(v_one,'coalesce(v_candidate.country_code, ''IN'')','v_candidate.country_code');
 end if;
 if position('v_signal_independent_owner_count < 2' in v_two)=0
    or position('coalesce(v_candidate.country_code, ''IN'')' in v_two)>0
    or position('coalesce(v_candidate.country_code, ''IN'')' in v_one)>0 then
   raise exception 'ott_promotion_patch_incomplete';
 end if;
 execute v_two;
 execute v_one;
end
$patch$;

revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from public,anon,authenticated;
grant execute on function public.system_promote_verified_ott_candidate_two_source(uuid) to service_role;
revoke all on function public.system_promote_first_party_ott_candidate(uuid) from public,anon,authenticated;
grant execute on function public.system_promote_first_party_ott_candidate(uuid) to service_role;
