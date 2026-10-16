-- Phase 1: Verified catalogue identity must not invent India as country,
-- and a platform's multiple feed/channel identities are not independent owners.
-- Privileged existing routines retain their exact signatures and grants.
do $migration$
declare
  body text;
  signature text;
  rule text := E'    if (select count(distinct si.source_id)\n        from public.entity_discovery_evidence ede\n        join public.source_identities si on si.id = ede.source_identity_id\n        where ede.candidate_id = v_before.id) < 2 then\n      raise exception ''entity_candidate_requires_two_independent_source_owners'';\n    end if;\n';
  promote_rule text := E'  if (select count(distinct si.source_id)\n      from public.entity_discovery_evidence ede\n      join public.source_identities si on si.id = ede.source_identity_id\n      where ede.candidate_id = v_candidate.id) < 2 then\n    raise exception ''entity_candidate_requires_two_independent_source_owners'';\n  end if;\n';
begin
  signature := 'public.operator_review_entity_candidate(uuid,uuid,text,text,uuid)';
  body := pg_get_functiondef(signature::regprocedure);
  if position('entity_candidate_requires_two_independent_source_owners' in body) = 0 then
    if position('  if v_status = ''APPROVED'' then' in body) = 0 then
      raise exception 'operator_review_entity_candidate approval pattern unexpectedly changed';
    end if;
    body := replace(body,
      '  if v_status = ''APPROVED'' then',
      '  if v_status = ''APPROVED'' then' || chr(10) || rule);
    execute body;
  end if;

  signature := 'public.operator_promote_entity_candidate(uuid,uuid,text,text[])';
  body := pg_get_functiondef(signature::regprocedure);
  if position('entity_candidate_requires_two_independent_source_owners' in body) = 0 then
    if position('  if v_candidate.status <> ''APPROVED'' then raise exception ''entity_candidate_must_be_approved''; end if;' in body) = 0 then
      raise exception 'operator_promote_entity_candidate status pattern unexpectedly changed';
    end if;
    body := replace(body,
      '  if v_candidate.status <> ''APPROVED'' then raise exception ''entity_candidate_must_be_approved''; end if;',
      '  if v_candidate.status <> ''APPROVED'' then raise exception ''entity_candidate_must_be_approved''; end if;' || chr(10) || promote_rule);
  end if;
  if position('coalesce(v_candidate.country_code, ''IN'')' in body) > 0 then
    body := replace(body, 'coalesce(v_candidate.country_code, ''IN'')', 'v_candidate.country_code');
  end if;
  if position('v_candidate.country_code,' in body) = 0 then
    raise exception 'operator_promote_entity_candidate country default still unsafe';
  end if;
  execute body;

  signature := 'public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb)';
  body := pg_get_functiondef(signature::regprocedure);
  if position('p_country_code text DEFAULT ''IN''::text' in body) > 0 then
    body := replace(body, 'p_country_code text DEFAULT ''IN''::text', 'p_country_code text DEFAULT NULL::text');
    execute body;
  end if;
  if position('p_country_code text DEFAULT NULL::text' in
    pg_get_functiondef(signature::regprocedure)) = 0 then
    raise exception 'discovery country must default to unknown';
  end if;
end
$migration$;

-- Least-privilege execution grant must remain untouched.
revoke all on function public.operator_promote_entity_candidate(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.operator_promote_entity_candidate(uuid,uuid,text,text[]) to service_role;
revoke all on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.operator_review_entity_candidate(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.submit_entity_discovery_candidate(text,text,uuid,numeric,text,text,text,numeric,jsonb) to service_role;
