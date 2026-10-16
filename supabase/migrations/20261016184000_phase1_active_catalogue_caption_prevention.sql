-- Phase 1 hardening after production audit found promotional captions already
-- promoted to ACTIVE canonical MOVIE/SERIES identities with active events.
-- This is a conservative AUTO-PROMOTION filter, NOT a deletion, correction,
-- suppression, alert resend or editorial canonical-title decision.
-- Preserve historical entity/event rows pending individual operator review.
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
    and p_title !~* '(movie|film)[[:space:]]+scenes?|(^|[[:space:]])(telugu|tamil|malayalam|kannada|hindi)[[:space:]]+movie|^(catch|watch)[[:space:]]+.{3,80}[[:space:]]+in[[:space:]]+|^(hot[[:space:]]+takes|the[[:space:]]+entertainer[[:space:]]+everyone|the[[:space:]]+little[[:space:]]+things[[:space:]]+that[[:space:]]+made|from[[:space:]]+[0-9]+[[:space:]]+to[[:space:]]+[0-9]+)|super[[:space:]]+show[![:space:]]*$|[|]|[.][.][.]|[[:space:]]+streaming$'
    and p_title !~ '.#[[:alnum:]_]+',
    false
  );
$$;

revoke all on function public.automated_ott_candidate_title_looks_canonical(text) from public, anon, authenticated;
grant execute on function public.automated_ott_candidate_title_looks_canonical(text) to service_role;

-- Historical guard was MOVIE-only. Apply the same conservative title quality
-- to BOTH automatic first-party and two-source promoter paths for SERIES.
-- Keep all pre-existing owner, first-party, confidence, date and status gates.
do $caption_guard$
declare
  v_name text;
  v_before text;
  v_after text;
  v_old text := 'if v_candidate.proposed_entity_type = ''MOVIE''';
  v_new text := 'if v_candidate.proposed_entity_type in (''MOVIE'',''SERIES'')';
begin
  foreach v_name in array array[
    'system_promote_first_party_ott_candidate',
    'system_promote_verified_ott_candidate_two_source'
  ] loop
    v_before := pg_get_functiondef(('public.' || v_name || '(uuid)')::regprocedure);
    if position(v_old in v_before) = 0 then
      raise exception 'unexpected_%_title_guard_definition', v_name;
    end if;
    v_after := replace(v_before, v_old, v_new);
    execute v_after;
    if position(v_new in pg_get_functiondef(('public.' || v_name || '(uuid)')::regprocedure))=0 then
      raise exception 'series_title_guard_not_installed_%',v_name;
    end if;
  end loop;
end
$caption_guard$;

revoke all on function public.system_promote_first_party_ott_candidate(uuid) from public, anon, authenticated;
revoke all on function public.system_promote_verified_ott_candidate_two_source(uuid) from public, anon, authenticated;
grant execute on function public.system_promote_first_party_ott_candidate(uuid) to service_role;
grant execute on function public.system_promote_verified_ott_candidate_two_source(uuid) to service_role;
