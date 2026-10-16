-- Reject unambiguous marketing captions at the last automatic OTT promotion
-- boundary too. Protects historical PENDING rows; does not mutate any row or
-- affect operator review/promotion of a genuinely verified title.
create or replace function public.automated_ott_candidate_title_looks_canonical(p_title text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select coalesce(
    char_length(btrim(p_title)) between 2 and 100
    and p_title !~* '(ott[[:space:]]+release[[:space:]]+date|when[[:space:]]+and[[:space:]]+where[[:space:]]+to[[:space:]]+watch|((latest[[:space:]]+)?(telugu|tamil|malayalam|kannada|hindi|english)[[:space:]]+full([[:space:]]+(movie|film))?)|latest[[:space:]]+(telugu|tamil|malayalam|kannada|hindi|english)[[:space:]]+(movie|film)|full[[:space:]]+(movie|film)|byte[[:space:]]+about|this[[:space:]]+(top[[:space:]]+)?studio)'
    and p_title !~ '[[:space:]]#[[:alnum:]_]+',
    false
  );
$$;

revoke all on function public.automated_ott_candidate_title_looks_canonical(text) from public, anon, authenticated;
grant execute on function public.automated_ott_candidate_title_looks_canonical(text) to service_role;

-- Both automatic paths must protect old PENDING candidates even if an
-- independent source arrives later. The orchestrator calls these two paths.
do $quality_gate$
declare
  v_name text;
  v_body text;
  v_anchor text := '  if v_candidate.proposed_entity_type';
  v_guard text := E'  if v_candidate.proposed_entity_type = ''MOVIE''\n     and not public.automated_ott_candidate_title_looks_canonical(v_candidate.proposed_name) then\n    return jsonb_build_object(\n      ''candidateId'', v_candidate.id,\n      ''promoted'', false,\n      ''reason'', ''automated_ott_candidate_title_quality_gate''\n    );\n  end if;\n\n';
begin
  foreach v_name in array array[
    'system_promote_first_party_ott_candidate',
    'system_promote_verified_ott_candidate_two_source'
  ] loop
    v_body := pg_get_functiondef(('public.' || v_name || '(uuid)')::regprocedure);
    if position('automated_ott_candidate_title_looks_canonical(' in v_body) = 0 then
      if position(v_anchor in v_body) = 0 then
        raise exception 'unexpected_auto_ott_promotion_body_for_%', v_name;
      end if;
      v_body := replace(v_body, v_anchor, v_guard || v_anchor);
      execute v_body;
    end if;
    if position('automated_ott_candidate_title_looks_canonical(' in
      pg_get_functiondef(('public.' || v_name || '(uuid)')::regprocedure)) = 0 then
      raise exception 'auto_ott_title_quality_gate_missing_%', v_name;
    end if;
  end loop;
end
$quality_gate$;

revoke all on function public.system_promote_first_party_ott_candidate(uuid) from public, anon, authenticated;
revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from public, anon, authenticated;
grant execute on function public.system_promote_first_party_ott_candidate(uuid) to service_role;
grant execute on function public.system_promote_verified_ott_candidate_two_source(uuid) to service_role;
