create table if not exists public.user_personalization_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_version integer not null default 0 check (onboarding_version >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorite_source_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_identity_id)
);

create index if not exists user_favorite_source_identities_active_idx
  on public.user_favorite_source_identities (user_id, updated_at desc)
  where active = true;

create index if not exists user_favorite_source_identities_source_idx
  on public.user_favorite_source_identities (source_identity_id, user_id)
  where active = true;

create table if not exists public.user_favorite_languages (
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language_code),
  check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$')
);

create index if not exists user_favorite_languages_active_idx
  on public.user_favorite_languages (user_id, language_code)
  where active = true;

alter table public.user_personalization_preferences enable row level security;
alter table public.user_favorite_source_identities enable row level security;
alter table public.user_favorite_languages enable row level security;

revoke all on table public.user_personalization_preferences from anon;
revoke all on table public.user_favorite_source_identities from anon;
revoke all on table public.user_favorite_languages from anon;

grant select, insert, update, delete on table public.user_personalization_preferences to authenticated;
grant select, insert, update, delete on table public.user_favorite_source_identities to authenticated;
grant select, insert, update, delete on table public.user_favorite_languages to authenticated;

create policy "user_personalization_preferences_select_own"
  on public.user_personalization_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_personalization_preferences_insert_own"
  on public.user_personalization_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_personalization_preferences_update_own"
  on public.user_personalization_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_personalization_preferences_delete_own"
  on public.user_personalization_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_favorite_source_identities_select_own"
  on public.user_favorite_source_identities for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_favorite_source_identities_insert_own"
  on public.user_favorite_source_identities for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_favorite_source_identities_update_own"
  on public.user_favorite_source_identities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_favorite_source_identities_delete_own"
  on public.user_favorite_source_identities for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_favorite_languages_select_own"
  on public.user_favorite_languages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_favorite_languages_insert_own"
  on public.user_favorite_languages for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_favorite_languages_update_own"
  on public.user_favorite_languages for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_favorite_languages_delete_own"
  on public.user_favorite_languages for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.replace_user_personalization_selection(
  p_user_id uuid,
  p_source_identity_ids uuid[],
  p_language_codes text[],
  p_complete boolean default true,
  p_onboarding_version integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_source_ids uuid[];
  v_languages text[];
  v_valid_source_count integer := 0;
begin
  if p_user_id is null then raise exception 'user_id_required'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'forbidden'; end if;

  select coalesce(array_agg(distinct value), '{}'::uuid[])
  into v_source_ids
  from unnest(coalesce(p_source_identity_ids, '{}'::uuid[])) as value;

  select coalesce(array_agg(distinct lower(trim(value))), '{}'::text[])
  into v_languages
  from unnest(coalesce(p_language_codes, '{}'::text[])) as value
  where trim(value) <> '';

  if cardinality(v_source_ids) < 1 then raise exception 'favorite_source_required'; end if;
  if cardinality(v_source_ids) > 50 then raise exception 'too_many_favorite_sources'; end if;
  if cardinality(v_languages) < 1 then raise exception 'favorite_language_required'; end if;
  if cardinality(v_languages) > 12 then raise exception 'too_many_favorite_languages'; end if;

  if exists (
    select 1 from unnest(v_languages) as language_code
    where language_code !~ '^[a-z]{2,3}(-[A-Z]{2})?$'
  ) then raise exception 'invalid_language_code'; end if;

  select count(*)
  into v_valid_source_count
  from public.source_identities si
  join public.sources s on s.id = si.source_id
  where si.id = any(v_source_ids)
    and si.active = true
    and s.active = true
    and si.platform = 'YOUTUBE'
    and s.authority_tier <= 2;

  if v_valid_source_count <> cardinality(v_source_ids) then
    raise exception 'invalid_favorite_source';
  end if;

  update public.user_favorite_source_identities
  set active = false, updated_at = now()
  where user_id = p_user_id
    and active = true
    and not (source_identity_id = any(v_source_ids));

  insert into public.user_favorite_source_identities (user_id, source_identity_id, active, created_at, updated_at)
  select p_user_id, source_identity_id, true, now(), now()
  from unnest(v_source_ids) as source_identity_id
  on conflict (user_id, source_identity_id) do update
  set active = true, updated_at = now();

  update public.user_favorite_languages
  set active = false, updated_at = now()
  where user_id = p_user_id
    and active = true
    and not (language_code = any(v_languages));

  insert into public.user_favorite_languages (user_id, language_code, active, created_at, updated_at)
  select p_user_id, language_code, true, now(), now()
  from unnest(v_languages) as language_code
  on conflict (user_id, language_code) do update
  set active = true, updated_at = now();

  insert into public.user_personalization_preferences (
    user_id, onboarding_version, completed_at, created_at, updated_at
  ) values (
    p_user_id,
    greatest(coalesce(p_onboarding_version, 1), 0),
    case when coalesce(p_complete, true) then now() else null end,
    now(),
    now()
  )
  on conflict (user_id) do update
  set onboarding_version = greatest(public.user_personalization_preferences.onboarding_version, excluded.onboarding_version),
      completed_at = case
        when coalesce(p_complete, true) then coalesce(public.user_personalization_preferences.completed_at, now())
        else public.user_personalization_preferences.completed_at
      end,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'favoriteSourceCount', cardinality(v_source_ids),
    'favoriteLanguageCount', cardinality(v_languages),
    'completed', coalesce(p_complete, true),
    'onboardingVersion', greatest(coalesce(p_onboarding_version, 1), 0)
  );
end;
$function$;

revoke all on function public.replace_user_personalization_selection(uuid, uuid[], text[], boolean, integer) from public;
grant execute on function public.replace_user_personalization_selection(uuid, uuid[], text[], boolean, integer) to authenticated, service_role;
