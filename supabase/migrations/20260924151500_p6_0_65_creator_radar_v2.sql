begin;

create or replace function public.creator_radar_compute(p_event_id uuid)
returns table(
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
  v_source_count integer := 0;
  v_official_source_count integer := 0;
  v_last_evidence_at timestamptz;
  v_freshness_at timestamptz;
  v_age_minutes bigint := 0;
begin
  select * into v_event
  from public.events
  where id = p_event_id;

  if v_event.id is null then
    raise exception 'creator_radar_event_not_found';
  end if;

  select
    count(*)::integer,
    count(distinct r.source_identity_id)::integer,
    count(distinct r.source_identity_id) filter (where s.authority_tier <= 1)::integer,
    max(ee.added_at)
  into v_evidence_count, v_source_count, v_official_source_count, v_last_evidence_at
  from public.event_evidence ee
  join public.raw_items r on r.id = ee.raw_item_id
  join public.source_identities si on si.id = r.source_identity_id
  join public.sources s on s.id = si.source_id
  where ee.event_id = p_event_id;

  v_freshness_at := greatest(
    coalesce(v_event.detected_at, v_event.created_at),
    v_event.updated_at,
    coalesce(v_last_evidence_at, v_event.updated_at)
  );
  v_age_minutes := greatest(0, floor(extract(epoch from (now() - v_freshness_at)) / 60)::bigint);

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

    when 'OTT_RELEASED' then
      v_score := v_score + 34;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_OTT_RELEASED');

    when 'TEASER_RELEASED', 'GLIMPSE_RELEASED', 'FIRST_LOOK_RELEASED' then
      v_score := v_score + 34;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_HIGH_VALUE_VISUAL');

    when 'CENSOR_CERTIFIED', 'RUNTIME_REVEALED', 'ADVANCE_BOOKING_OPENED', 'PRE_SALES_OPENED' then
      v_score := v_score + 28;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_RELEASE_WEEK_SIGNAL');

    when 'CAST_ANNOUNCED', 'CREW_ANNOUNCED', 'PRODUCTION_LAUNCHED',
         'SHOOT_STARTED', 'SCHEDULE_STARTED', 'SHOOT_WRAPPED', 'SCHEDULE_WRAPPED',
         'SONG_RELEASED', 'POSTER_RELEASED', 'PRE_RELEASE_EVENT_ANNOUNCED',
         'PRE_RELEASE_EVENT_STARTED_OR_RELEASED' then
      v_score := v_score + 24;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_CREATOR_FRIENDLY_UPDATE');

    when 'BTS_RELEASED', 'MAKING_VIDEO_RELEASED' then
      v_score := v_score + 22;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_CRAFT_MATERIAL');

    when 'BOX_OFFICE_MILESTONE', 'ADVANCE_BOOKING_MILESTONE' then
      v_score := v_score + 22;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_PERFORMANCE_MILESTONE');

    when 'TRAILER_ANNOUNCED', 'TEASER_ANNOUNCED', 'SONG_ANNOUNCED' then
      v_score := v_score + 22;
      v_label := 'FOLLOW_UP_NEEDED';
      v_reasons := array_append(v_reasons, 'TYPE_UPCOMING_DROP');

    when 'PRESS_MEET_ANNOUNCED', 'INTERVIEW_RELEASED' then
      v_score := v_score + 18;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_QUOTE_OR_EVENT_OPPORTUNITY');

    when 'PROMO_RELEASED' then
      v_score := v_score + 14;
      v_label := 'SHORT_OPPORTUNITY';
      v_reasons := array_append(v_reasons, 'TYPE_PROMO_RELEASED');

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
    v_score := v_score + 8;
    v_reasons := array_append(v_reasons, 'EVIDENCE_3_PLUS');
  elsif v_evidence_count = 2 then
    v_score := v_score + 5;
    v_reasons := array_append(v_reasons, 'EVIDENCE_2');
  elsif v_evidence_count = 1 then
    v_score := v_score + 2;
    v_reasons := array_append(v_reasons, 'EVIDENCE_1');
  else
    v_score := v_score - 5;
    v_reasons := array_append(v_reasons, 'EVIDENCE_NONE');
  end if;

  if v_official_source_count >= 2 then
    v_score := v_score + 10;
    v_reasons := array_append(v_reasons, 'OFFICIAL_SOURCES_2_PLUS');
  elsif v_official_source_count = 1 then
    v_score := v_score + 6;
    v_reasons := array_append(v_reasons, 'OFFICIAL_SOURCE_PRESENT');
  elsif v_source_count >= 2 then
    v_score := v_score + 4;
    v_reasons := array_append(v_reasons, 'MULTI_SOURCE_CORROBORATION');
  end if;

  if v_age_minutes <= 120 then
    v_score := v_score + 18;
    v_reasons := array_append(v_reasons, 'FRESH_2H');
  elsif v_age_minutes <= 360 then
    v_score := v_score + 12;
    v_reasons := array_append(v_reasons, 'FRESH_6H');
  elsif v_age_minutes <= 720 then
    v_score := v_score + 7;
    v_reasons := array_append(v_reasons, 'FRESH_12H');
  elsif v_age_minutes <= 1440 then
    v_score := v_score + 3;
    v_reasons := array_append(v_reasons, 'FRESH_24H');
  elsif v_age_minutes <= 2160 then
    v_reasons := array_append(v_reasons, 'AGE_36H');
  elsif v_age_minutes <= 2880 then
    v_score := v_score - 8;
    v_reasons := array_append(v_reasons, 'STALE_48H');
  elsif v_age_minutes <= 4320 then
    v_score := v_score - 18;
    v_reasons := array_append(v_reasons, 'STALE_72H');
  else
    v_score := v_score - 35;
    v_reasons := array_append(v_reasons, 'STALE_72H_PLUS');
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

    if v_age_minutes > 10080 then
      v_score := 0;
      v_label := 'NO_ACTION';
      v_reasons := array_append(v_reasons, 'AGE_OVER_7D');
    elsif v_score < 30 then
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
    'sourceCount', v_source_count,
    'officialSourceCount', v_official_source_count,
    'freshnessAt', v_freshness_at,
    'ageMinutes', v_age_minutes,
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
      select
        count(*)::integer as evidence_count,
        count(distinct ri.source_identity_id)::integer as source_count,
        count(distinct ri.source_identity_id) filter (where s.authority_tier <= 1)::integer as official_source_count,
        max(ee.added_at) as last_evidence_at
      from public.event_evidence ee
      join public.raw_items ri on ri.id = ee.raw_item_id
      join public.source_identities si on si.id = ri.source_identity_id
      join public.sources s on s.id = si.source_id
      where ee.event_id = e.id
    ) evidence_state on true
    where r.event_id is null
       or r.engine_version <> 'creator-radar-v2'
       or (r.input_snapshot->>'eventType') is distinct from e.event_type
       or (r.input_snapshot->>'verificationState') is distinct from e.verification_state
       or (r.input_snapshot->>'priorityBand') is distinct from e.priority_band
       or (r.input_snapshot->>'eventStatus') is distinct from e.status
       or coalesce((r.input_snapshot->>'evidenceCount')::integer, -1) <> coalesce(evidence_state.evidence_count, 0)
       or coalesce((r.input_snapshot->>'sourceCount')::integer, -1) <> coalesce(evidence_state.source_count, 0)
       or coalesce((r.input_snapshot->>'officialSourceCount')::integer, -1) <> coalesce(evidence_state.official_source_count, 0)
       or r.generated_at < greatest(e.updated_at, coalesce(evidence_state.last_evidence_at, e.updated_at))
       or (
         greatest(coalesce(e.detected_at, e.created_at), e.updated_at, coalesce(evidence_state.last_evidence_at, e.updated_at)) >= now() - interval '7 days'
         and r.generated_at < now() - interval '15 minutes'
       )
       or (
         greatest(coalesce(e.detected_at, e.created_at), e.updated_at, coalesce(evidence_state.last_evidence_at, e.updated_at)) < now() - interval '7 days'
         and r.generated_at < now() - interval '6 hours'
       )
    order by
      greatest(coalesce(e.detected_at, e.created_at), e.updated_at, coalesce(evidence_state.last_evidence_at, e.updated_at)) desc,
      e.id asc
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
      'creator-radar-v2',
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

comment on function public.creator_radar_compute(uuid) is
  'Creator Radar v2: evidence/source-strength-aware and freshness-decayed opportunity scoring.';
comment on function public.refresh_creator_radar(integer) is
  'Refreshes Creator Radar v2 when evidence/state changes and periodically as freshness decays.';

commit;
