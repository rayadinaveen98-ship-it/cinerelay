begin;

create table public.creator_radar_entries (
  event_id uuid primary key references public.events(id) on delete cascade,
  creator_score smallint not null check (creator_score between 0 and 100),
  opportunity_label text not null
    check (opportunity_label in ('SHORT_OPPORTUNITY','BREAKING_EXPLAINER','TRAILER_ANALYSIS','FOLLOW_UP_NEEDED','NO_ACTION')),
  reason_codes text[] not null default '{}'::text[],
  input_snapshot jsonb not null default '{}'::jsonb,
  engine_version text not null default 'creator-radar-v1',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_radar_entries_score_idx
  on public.creator_radar_entries (creator_score desc, generated_at desc);

create index creator_radar_entries_label_idx
  on public.creator_radar_entries (opportunity_label, creator_score desc);

create trigger creator_radar_entries_set_updated_at
before update on public.creator_radar_entries
for each row execute function public.set_updated_at();

create or replace function public.creator_radar_compute(p_event_id uuid)
returns table (
  creator_score integer,
  opportunity_label text,
  reason_codes text[],
  input_snapshot jsonb
)
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_score integer := 0;
  v_label text := 'NO_ACTION';
  v_reasons text[] := '{}'::text[];
  v_evidence_count integer := 0;
begin
  select * into v_event
  from public.events
  where id = p_event_id;

  if v_event.id is null then
    raise exception 'creator_radar_event_not_found';
  end if;

  select count(*)::integer
  into v_evidence_count
  from public.event_evidence
  where event_id = p_event_id;

  case v_event.event_type
    when 'TRAILER_RELEASED' then
      v_score := v_score + 45;
      v_label := 'TRAILER_ANALYSIS';
      v_reasons := array_append(v_reasons, 'TYPE_TRAILER_RELEASED');

    when 'THEATRICAL_DATE_CHANGED', 'OTT_DATE_CHANGED', 'DELAY_OR_POSTPONEMENT', 'PROJECT_CANCELLED' then
      v_score := v_score + 45;
      v_label := 'BREAKING_EXPLAINER';
      v_reasons := array_append(v_reasons, 'TYPE_MAJOR_CHANGE');

    when 'PROJECT_ANNOUNCED', 'TITLE_ANNOUNCED', 'TITLE_CHANGED',
         'SEQUEL_OR_SPINOFF_ANNOUNCED', 'SEASON_RENEWED',
         'THEATRICAL_DATE_ANNOUNCED', 'OTT_DATE_ANNOUNCED', 'OTT_PLATFORM_ANNOUNCED' then
      v_score := v_score + 38;
      v_label := 'BREAKING_EXPLAINER';
      v_reasons := array_append(v_reasons, 'TYPE_MAJOR_ANNOUNCEMENT');

    when 'TEASER_RELEASED', 'GLIMPSE_RELEASED', 'FIRST_LOOK_RELEASED' then
      v_score := v_score + 34;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_HIGH_VALUE_VISUAL');

    when 'SONG_RELEASED', 'POSTER_RELEASED', 'CAST_ANNOUNCED', 'CREW_ANNOUNCED',
         'PRODUCTION_LAUNCHED', 'SHOOT_WRAPPED',
         'PRE_RELEASE_EVENT_ANNOUNCED', 'PRE_RELEASE_EVENT_STARTED_OR_RELEASED' then
      v_score := v_score + 24;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_CREATOR_FRIENDLY_UPDATE');

    when 'CAST_EXIT_REPORTED', 'CREW_EXIT_REPORTED', 'PROJECT_ON_HOLD' then
      v_score := v_score + 32;
      v_label := 'FOLLOW_UP_NEEDED';
      v_reasons := array_append(v_reasons, 'TYPE_FOLLOW_UP_EVENT');

    else
      v_score := v_score + 10;
      v_label := 'NO_ACTION';
      v_reasons := array_append(v_reasons, 'TYPE_LOWER_SIGNAL_EVENT');
  end case;

  case v_event.priority_band
    when 'CRITICAL' then
      v_score := v_score + 25;
      v_reasons := array_append(v_reasons, 'PRIORITY_CRITICAL');
    when 'HIGH' then
      v_score := v_score + 15;
      v_reasons := array_append(v_reasons, 'PRIORITY_HIGH');
    when 'NORMAL' then
      v_score := v_score + 5;
      v_reasons := array_append(v_reasons, 'PRIORITY_NORMAL');
    when 'LOW' then
      v_reasons := array_append(v_reasons, 'PRIORITY_LOW');
    when 'SUPPRESSED' then
      v_reasons := array_append(v_reasons, 'PRIORITY_SUPPRESSED');
    else
      v_reasons := array_append(v_reasons, 'PRIORITY_UNKNOWN');
  end case;

  case v_event.verification_state
    when 'OFFICIAL' then
      v_score := v_score + 20;
      v_reasons := array_append(v_reasons, 'VERIFICATION_OFFICIAL');
    when 'CONFIRMED' then
      v_score := v_score + 15;
      v_reasons := array_append(v_reasons, 'VERIFICATION_CONFIRMED');
    when 'RELIABLE_REPORT' then
      v_score := v_score + 8;
      v_reasons := array_append(v_reasons, 'VERIFICATION_RELIABLE_REPORT');
    when 'DEVELOPING' then
      v_score := v_score + 2;
      v_label := 'FOLLOW_UP_NEEDED';
      v_reasons := array_append(v_reasons, 'VERIFICATION_DEVELOPING');
    when 'RUMOR' then
      v_score := v_score - 20;
      v_label := 'FOLLOW_UP_NEEDED';
      v_reasons := array_append(v_reasons, 'VERIFICATION_RUMOR');
    else
      v_reasons := array_append(v_reasons, 'VERIFICATION_UNKNOWN');
  end case;

  if v_evidence_count >= 3 then
    v_score := v_score + 10;
    v_reasons := array_append(v_reasons, 'EVIDENCE_3_PLUS');
  elsif v_evidence_count = 2 then
    v_score := v_score + 6;
    v_reasons := array_append(v_reasons, 'EVIDENCE_2');
  elsif v_evidence_count = 1 then
    v_score := v_score + 3;
    v_reasons := array_append(v_reasons, 'EVIDENCE_1');
  else
    v_score := v_score - 5;
    v_reasons := array_append(v_reasons, 'EVIDENCE_NONE');
  end if;

  if v_event.status <> 'ACTIVE' or v_event.priority_band = 'SUPPRESSED' then
    v_score := 0;
    v_label := 'NO_ACTION';
    v_reasons := array_append(v_reasons, 'EVENT_NOT_ACTIONABLE');
  else
    v_score := greatest(0, least(v_score, 100));

    if v_event.verification_state = 'RUMOR' then
      v_score := least(v_score, 40);
    end if;

    if v_score < 25 then
      v_label := 'NO_ACTION';
      v_reasons := array_append(v_reasons, 'SCORE_BELOW_ACTION_THRESHOLD');
    end if;
  end if;

  creator_score := v_score;
  opportunity_label := v_label;
  reason_codes := v_reasons;
  input_snapshot := jsonb_build_object(
    'eventId', v_event.id,
    'entityId', v_event.primary_entity_id,
    'eventType', v_event.event_type,
    'verificationState', v_event.verification_state,
    'priorityBand', v_event.priority_band,
    'eventStatus', v_event.status,
    'evidenceCount', v_evidence_count,
    'eventUpdatedAt', v_event.updated_at
  );

  return next;
end;
$$;

create or replace function public.refresh_creator_radar(p_limit integer default 100)
returns integer
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event record;
  v_calc record;
  v_refreshed integer := 0;
begin
  for v_event in
    select e.id
    from public.events e
    left join public.creator_radar_entries r on r.event_id = e.id
    left join lateral (
      select count(*)::integer as evidence_count,
             max(ee.added_at) as last_evidence_at
      from public.event_evidence ee
      where ee.event_id = e.id
    ) evidence_state on true
    where r.event_id is null
       or r.engine_version <> 'creator-radar-v1'
       or (r.input_snapshot->>'eventType') is distinct from e.event_type
       or (r.input_snapshot->>'verificationState') is distinct from e.verification_state
       or (r.input_snapshot->>'priorityBand') is distinct from e.priority_band
       or (r.input_snapshot->>'eventStatus') is distinct from e.status
       or coalesce((r.input_snapshot->>'evidenceCount')::integer, -1)
          <> coalesce(evidence_state.evidence_count, 0)
       or r.generated_at < greatest(
            e.updated_at,
            coalesce(evidence_state.last_evidence_at, e.updated_at)
          )
    order by e.detected_at desc nulls last, e.created_at desc, e.id asc
    for update of e skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    select * into v_calc
    from public.creator_radar_compute(v_event.id);

    insert into public.creator_radar_entries (
      event_id,
      creator_score,
      opportunity_label,
      reason_codes,
      input_snapshot,
      engine_version,
      generated_at
    ) values (
      v_event.id,
      v_calc.creator_score,
      v_calc.opportunity_label,
      v_calc.reason_codes,
      v_calc.input_snapshot,
      'creator-radar-v1',
      clock_timestamp()
    )
    on conflict (event_id) do update
      set creator_score = excluded.creator_score,
          opportunity_label = excluded.opportunity_label,
          reason_codes = excluded.reason_codes,
          input_snapshot = excluded.input_snapshot,
          engine_version = excluded.engine_version,
          generated_at = excluded.generated_at,
          updated_at = clock_timestamp();

    v_refreshed := v_refreshed + 1;
  end loop;

  return v_refreshed;
end;
$$;

alter table public.creator_radar_entries enable row level security;

revoke all on table public.creator_radar_entries from public, anon, authenticated;
grant select,insert,update,delete on public.creator_radar_entries to service_role;

revoke all on function public.creator_radar_compute(uuid) from public, anon, authenticated;
revoke all on function public.refresh_creator_radar(integer) from public, anon, authenticated;
grant execute on function public.creator_radar_compute(uuid) to service_role;
grant execute on function public.refresh_creator_radar(integer) to service_role;

commit;
