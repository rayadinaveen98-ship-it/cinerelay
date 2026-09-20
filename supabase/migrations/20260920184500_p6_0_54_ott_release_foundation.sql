begin;

-- P6.0.54: canonical OTT release intelligence. OTT is an intelligence surface,
-- not an ingestion platform. Future dates remain evidence-backed and one
-- title/provider/territory has one mutable canonical release record.

create table if not exists public.ott_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  homepage_url text,
  territory text not null default 'IN',
  active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = upper(code)),
  check (char_length(btrim(code)) >= 2),
  check (char_length(btrim(display_name)) >= 2)
);

insert into public.ott_providers (code, display_name, homepage_url, territory, sort_order)
values
  ('NETFLIX', 'Netflix', 'https://www.netflix.com/in/', 'IN', 10),
  ('PRIME_VIDEO', 'Prime Video', 'https://www.primevideo.com/', 'IN', 20),
  ('JIOHOTSTAR', 'JioHotstar', 'https://www.hotstar.com/in', 'IN', 30),
  ('ZEE5', 'ZEE5', 'https://www.zee5.com/', 'IN', 40),
  ('SONYLIV', 'SonyLIV', 'https://www.sonyliv.com/', 'IN', 50),
  ('AHA', 'aha', 'https://www.aha.video/', 'IN', 60),
  ('SUN_NXT', 'Sun NXT', 'https://www.sunnxt.com/', 'IN', 70),
  ('ETV_WIN', 'ETV Win', 'https://www.etvwin.com/', 'IN', 80)
on conflict (code) do update
  set display_name = excluded.display_name,
      homepage_url = excluded.homepage_url,
      territory = excluded.territory,
      sort_order = excluded.sort_order,
      active = true,
      updated_at = now();

create table if not exists public.ott_releases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  provider_id uuid not null references public.ott_providers(id) on delete restrict,
  territory text not null default 'IN',
  languages text[] not null default '{}',
  release_type text not null check (release_type in ('ORIGINAL','POST_THEATRICAL')),
  release_date date,
  date_precision text not null default 'TBA' check (date_precision in ('DAY','MONTH','TBA')),
  state text not null default 'TBA' check (state in ('UPCOMING','RELEASED','DELAYED','TBA')),
  evidence_status text not null default 'TBA' check (evidence_status in ('CONFIRMED','REPORTED','TBA')),
  previous_release_date date,
  first_observed_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, provider_id, territory),
  check ((date_precision = 'TBA' and release_date is null) or (date_precision in ('DAY','MONTH') and release_date is not null)),
  check (state <> 'RELEASED' or release_date is not null)
);

create table if not exists public.ott_release_evidence (
  ott_release_id uuid not null references public.ott_releases(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  evidence_role text not null check (evidence_role in ('PRIMARY','CORROBORATING','CONFLICTING','REPEAT')),
  is_first_party boolean not null default false,
  observed_at timestamptz not null default now(),
  note text,
  primary key (ott_release_id, raw_item_id)
);

create table if not exists public.ott_release_history (
  id uuid primary key default gen_random_uuid(),
  ott_release_id uuid not null references public.ott_releases(id) on delete cascade,
  old_release_date date,
  new_release_date date,
  old_date_precision text,
  new_date_precision text,
  old_state text,
  new_state text,
  old_evidence_status text,
  new_evidence_status text,
  evidence_raw_item_id uuid references public.raw_items(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create index if not exists ott_releases_date_idx
  on public.ott_releases (territory, release_date, state)
  where release_date is not null;
create index if not exists ott_releases_provider_idx
  on public.ott_releases (provider_id, territory, state, release_date);
create index if not exists ott_releases_entity_idx
  on public.ott_releases (entity_id, last_verified_at desc);
create index if not exists ott_releases_languages_gin_idx
  on public.ott_releases using gin (languages);
create index if not exists ott_release_evidence_raw_idx
  on public.ott_release_evidence (raw_item_id, observed_at desc);
create index if not exists ott_release_history_release_idx
  on public.ott_release_history (ott_release_id, changed_at desc);

create trigger ott_providers_set_updated_at
before update on public.ott_providers
for each row execute function public.set_updated_at();

create trigger ott_releases_set_updated_at
before update on public.ott_releases
for each row execute function public.set_updated_at();

alter table public.ott_providers enable row level security;
alter table public.ott_releases enable row level security;
alter table public.ott_release_evidence enable row level security;
alter table public.ott_release_history enable row level security;

revoke all on table public.ott_providers from public, anon, authenticated;
revoke all on table public.ott_releases from public, anon, authenticated;
revoke all on table public.ott_release_evidence from public, anon, authenticated;
revoke all on table public.ott_release_history from public, anon, authenticated;

grant select, insert, update, delete on table public.ott_providers to service_role;
grant select, insert, update, delete on table public.ott_releases to service_role;
grant select, insert, update, delete on table public.ott_release_evidence to service_role;
grant select, insert, update, delete on table public.ott_release_history to service_role;

create or replace function public.ott_evidence_rank(p_status text)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case upper(coalesce(p_status, ''))
    when 'CONFIRMED' then 0
    when 'REPORTED' then 1
    when 'TBA' then 2
    else 99
  end;
$$;

create or replace function public.upsert_ott_release_with_evidence(
  p_entity_id uuid,
  p_provider_code text,
  p_raw_item_id uuid,
  p_territory text default 'IN',
  p_languages text[] default '{}'::text[],
  p_release_type text default 'POST_THEATRICAL',
  p_release_date date default null,
  p_date_precision text default 'TBA',
  p_state text default 'TBA',
  p_evidence_status text default 'TBA',
  p_reason text default null
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_entity_type text;
  v_entity_name text;
  v_provider_id uuid;
  v_provider_name text;
  v_provider_code text := upper(btrim(coalesce(p_provider_code, '')));
  v_territory text := upper(btrim(coalesce(p_territory, 'IN')));
  v_release_type text := upper(btrim(coalesce(p_release_type, '')));
  v_date_precision text := upper(btrim(coalesce(p_date_precision, '')));
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_evidence_status text := upper(btrim(coalesce(p_evidence_status, '')));
  v_languages text[] := '{}'::text[];
  v_source_tier smallint;
  v_source_role text;
  v_is_first_party boolean := false;
  v_existing public.ott_releases%rowtype;
  v_release_id uuid;
  v_event_id uuid;
  v_event_type text;
  v_verification_state text;
  v_priority_band text;
  v_dedupe_key text;
  v_headline text;
  v_structured jsonb;
  v_existing_evidence_role text;
  v_evidence_role text;
  v_evidence_count integer := 0;
  v_material_change boolean := false;
  v_date_changed boolean := false;
  v_accept_canonical boolean := true;
  v_incoming_rank integer;
  v_existing_rank integer;
  v_merged_languages text[];
begin
  select entity_type, canonical_name
  into v_entity_type, v_entity_name
  from public.entities
  where id = p_entity_id
    and status = 'ACTIVE'
    and entity_type in ('MOVIE','SERIES','SEASON');

  if v_entity_type is null then
    raise exception 'ott_entity_not_found_or_ineligible';
  end if;

  select id, display_name
  into v_provider_id, v_provider_name
  from public.ott_providers
  where code = v_provider_code and active = true;

  if v_provider_id is null then
    raise exception 'ott_provider_not_found';
  end if;

  if v_release_type not in ('ORIGINAL','POST_THEATRICAL') then
    raise exception 'invalid_ott_release_type';
  end if;
  if v_date_precision not in ('DAY','MONTH','TBA') then
    raise exception 'invalid_ott_date_precision';
  end if;
  if v_state not in ('UPCOMING','RELEASED','DELAYED','TBA') then
    raise exception 'invalid_ott_release_state';
  end if;
  if v_evidence_status not in ('CONFIRMED','REPORTED','TBA') then
    raise exception 'invalid_ott_evidence_status';
  end if;
  if v_date_precision = 'TBA' and p_release_date is not null then
    raise exception 'ott_tba_date_must_be_null';
  end if;
  if v_date_precision in ('DAY','MONTH') and p_release_date is null then
    raise exception 'ott_precise_date_required';
  end if;
  if v_state = 'RELEASED' and p_release_date is null then
    raise exception 'ott_released_date_required';
  end if;

  select s.authority_tier, s.source_role
  into v_source_tier, v_source_role
  from public.raw_items r
  join public.source_identities si on si.id = r.source_identity_id
  join public.sources s on s.id = si.source_id
  where r.id = p_raw_item_id;

  if v_source_tier is null then
    raise exception 'ott_evidence_raw_item_not_found';
  end if;

  v_is_first_party := coalesce(
    v_source_tier <= 2 and v_source_role in (
      'OTT_PLATFORM','PRODUCTION_HOUSE','DISTRIBUTOR','PROJECT_OFFICIAL',
      'FILM_OFFICIAL','CAST_CREW_OFFICIAL'
    ),
    false
  );

  if v_evidence_status = 'CONFIRMED' and not v_is_first_party then
    raise exception 'ott_confirmed_requires_first_party_evidence';
  end if;
  if v_evidence_status in ('REPORTED','TBA') and coalesce(v_source_tier, 5) > 3 then
    raise exception 'ott_evidence_source_not_credible_enough';
  end if;

  select coalesce(array_agg(distinct lower(btrim(language))) order by lower(btrim(language))), '{}'::text[])
  into v_languages
  from unnest(coalesce(p_languages, '{}'::text[])) as language
  where btrim(language) <> '';

  select * into v_existing
  from public.ott_releases
  where entity_id = p_entity_id
    and provider_id = v_provider_id
    and territory = v_territory
  for update;

  if v_existing.id is not null then
    v_material_change :=
      v_existing.release_date is distinct from p_release_date
      or v_existing.date_precision is distinct from v_date_precision
      or v_existing.state is distinct from v_state
      or v_existing.release_type is distinct from v_release_type;
    v_date_changed := v_existing.release_date is distinct from p_release_date;
    v_incoming_rank := public.ott_evidence_rank(v_evidence_status);
    v_existing_rank := public.ott_evidence_rank(v_existing.evidence_status);

    -- Weaker evidence may corroborate an existing canonical release but cannot
    -- move it. Equal-strength non-confirmed reports with conflicting material
    -- fields are also retained as conflicting evidence rather than oscillating
    -- the user-visible date between secondary reports.
    if v_material_change and v_incoming_rank > v_existing_rank then
      v_accept_canonical := false;
    elsif v_material_change and v_incoming_rank = v_existing_rank and v_evidence_status <> 'CONFIRMED' then
      v_accept_canonical := false;
    end if;
  end if;

  select evidence_role into v_existing_evidence_role
  from public.ott_release_evidence
  where ott_release_id = v_existing.id and raw_item_id = p_raw_item_id;

  if v_existing_evidence_role is not null then
    v_evidence_role := v_existing_evidence_role;
  elsif not v_accept_canonical then
    v_evidence_role := 'CONFLICTING';
  else
    select count(*)::integer into v_evidence_count
    from public.ott_release_evidence
    where ott_release_id = v_existing.id;
    v_evidence_role := case when v_existing.id is null or v_evidence_count = 0 then 'PRIMARY' else 'CORROBORATING' end;
  end if;

  if v_existing.id is null then
    insert into public.ott_releases (
      entity_id, provider_id, territory, languages, release_type, release_date,
      date_precision, state, evidence_status, first_observed_at, last_verified_at
    ) values (
      p_entity_id, v_provider_id, v_territory, v_languages, v_release_type, p_release_date,
      v_date_precision, v_state, v_evidence_status, now(), now()
    ) returning id into v_release_id;
  elsif v_accept_canonical then
    if v_material_change then
      insert into public.ott_release_history (
        ott_release_id,
        old_release_date, new_release_date,
        old_date_precision, new_date_precision,
        old_state, new_state,
        old_evidence_status, new_evidence_status,
        evidence_raw_item_id, reason
      ) values (
        v_existing.id,
        v_existing.release_date, p_release_date,
        v_existing.date_precision, v_date_precision,
        v_existing.state, v_state,
        v_existing.evidence_status,
        case
          when public.ott_evidence_rank(v_evidence_status) <= public.ott_evidence_rank(v_existing.evidence_status)
            then v_evidence_status
          else v_existing.evidence_status
        end,
        p_raw_item_id,
        nullif(btrim(coalesce(p_reason, '')), '')
      );
    end if;

    select coalesce(array_agg(distinct language order by language), '{}'::text[])
    into v_merged_languages
    from unnest(coalesce(v_existing.languages, '{}'::text[]) || v_languages) as language
    where btrim(language) <> '';

    update public.ott_releases
    set languages = v_merged_languages,
        release_type = v_release_type,
        release_date = p_release_date,
        date_precision = v_date_precision,
        state = v_state,
        evidence_status = case
          when public.ott_evidence_rank(v_evidence_status) <= public.ott_evidence_rank(v_existing.evidence_status)
            then v_evidence_status
          else v_existing.evidence_status
        end,
        previous_release_date = case
          when v_date_changed then v_existing.release_date
          else v_existing.previous_release_date
        end,
        last_verified_at = now(),
        updated_at = now()
    where id = v_existing.id
    returning id into v_release_id;
  else
    v_release_id := v_existing.id;
  end if;

  if v_accept_canonical then
    if v_existing.id is null and p_release_date is null then
      v_event_type := 'OTT_PLATFORM_ANNOUNCED';
    elsif v_existing.id is null and p_release_date is not null then
      v_event_type := 'OTT_DATE_ANNOUNCED';
    elsif v_existing.state is distinct from 'RELEASED' and v_state = 'RELEASED' then
      v_event_type := 'OTT_RELEASED';
    elsif v_existing.release_date is null and p_release_date is not null then
      v_event_type := 'OTT_DATE_ANNOUNCED';
    elsif v_date_changed then
      v_event_type := 'OTT_DATE_CHANGED';
    end if;
  end if;

  if v_event_type is not null then
    v_verification_state := case
      when v_source_tier <= 1 then 'OFFICIAL'
      when v_source_tier = 2 then 'CONFIRMED'
      else 'RELIABLE_REPORT'
    end;
    v_priority_band := case
      when v_event_type in ('OTT_DATE_ANNOUNCED','OTT_DATE_CHANGED') then 'CRITICAL'
      else 'HIGH'
    end;
    v_headline := case v_event_type
      when 'OTT_PLATFORM_ANNOUNCED' then v_entity_name || ' streaming destination: ' || v_provider_name
      when 'OTT_DATE_ANNOUNCED' then v_entity_name || ' streams on ' || v_provider_name || ' from ' || p_release_date::text
      when 'OTT_DATE_CHANGED' then v_entity_name || ' OTT date changed to ' || p_release_date::text
      when 'OTT_RELEASED' then v_entity_name || ' is now streaming on ' || v_provider_name
      else v_entity_name || ' OTT update'
    end;
    v_dedupe_key := 'ott|' || p_entity_id::text || '|' || v_provider_code || '|' || v_territory || '|' ||
      case v_event_type
        when 'OTT_PLATFORM_ANNOUNCED' then 'platform'
        when 'OTT_DATE_ANNOUNCED' then 'date|' || coalesce(p_release_date::text, 'tba')
        when 'OTT_DATE_CHANGED' then 'changed|' || coalesce(v_existing.release_date::text, 'tba') || '|' || coalesce(p_release_date::text, 'tba')
        when 'OTT_RELEASED' then 'released|' || coalesce(p_release_date::text, 'unknown')
        else lower(v_event_type)
      end;
    v_structured := jsonb_build_object(
      'ottReleaseId', v_release_id,
      'providerCode', v_provider_code,
      'providerName', v_provider_name,
      'territory', v_territory,
      'languages', to_jsonb(v_languages),
      'releaseType', v_release_type,
      'releaseDate', p_release_date,
      'previousReleaseDate', case when v_date_changed then v_existing.release_date else null end,
      'datePrecision', v_date_precision,
      'state', v_state,
      'evidenceStatus', case
        when v_existing.id is null then v_evidence_status
        when public.ott_evidence_rank(v_evidence_status) <= public.ott_evidence_rank(v_existing.evidence_status) then v_evidence_status
        else v_existing.evidence_status
      end
    );

    v_event_id := public.upsert_canonical_event_with_evidence(
      gen_random_uuid(),
      p_entity_id,
      v_event_type,
      v_verification_state,
      v_priority_band,
      v_headline,
      v_structured,
      v_dedupe_key,
      'ott-release-intelligence-v1',
      p_raw_item_id
    );
  end if;

  insert into public.ott_release_evidence (
    ott_release_id, raw_item_id, event_id, evidence_role, is_first_party, observed_at, note
  ) values (
    v_release_id,
    p_raw_item_id,
    v_event_id,
    v_evidence_role,
    v_is_first_party,
    now(),
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  on conflict (ott_release_id, raw_item_id) do update
    set event_id = coalesce(excluded.event_id, public.ott_release_evidence.event_id),
        evidence_role = public.ott_release_evidence.evidence_role,
        is_first_party = public.ott_release_evidence.is_first_party or excluded.is_first_party,
        observed_at = greatest(public.ott_release_evidence.observed_at, excluded.observed_at),
        note = coalesce(excluded.note, public.ott_release_evidence.note);

  return jsonb_build_object(
    'releaseId', v_release_id,
    'providerCode', v_provider_code,
    'acceptedCanonical', v_accept_canonical,
    'evidenceRole', v_evidence_role,
    'isFirstParty', v_is_first_party,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.ott_evidence_rank(text) from public, anon, authenticated;
grant execute on function public.ott_evidence_rank(text) to service_role;

revoke all on function public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text)
  to service_role;

comment on table public.ott_releases is 'Canonical evidence-backed OTT availability for one title/provider/territory. Weaker conflicting reports never overwrite stronger canonical evidence.';
comment on table public.ott_release_evidence is 'Raw-item provenance for OTT release intelligence, including first-party and conflicting evidence.';
comment on table public.ott_release_history is 'Material date/state/evidence transitions for OTT releases; preserves previous canonical values.';
comment on function public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text) is 'Service-only evidence gate for OTT canonical state and lifecycle events.';

commit;
