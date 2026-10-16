-- A social caption can place an emoji or dialogue punctuation immediately
-- before its embedded hashtag (no space). Keep leading #Love-style film names.
-- The producer/source evidence remains unchanged and unapproved.
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
    and p_title !~ '.#[[:alnum:]_]+',
    false
  );
$$;

revoke all on function public.automated_ott_candidate_title_looks_canonical(text) from public, anon, authenticated;
grant execute on function public.automated_ott_candidate_title_looks_canonical(text) to service_role;
