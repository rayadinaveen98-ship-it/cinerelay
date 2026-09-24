begin;

-- Story Intelligence consumes canonical events, so a first-party "Watch Now" signal
-- must materialize as OTT_RELEASED even when the historical premiere day is unknown.
do $migration$
declare
  v_definition text;
  v_before text := $needle$
  if v_accept_canonical then
    if v_existing.id is null and p_release_date is null then
      v_event_type := 'OTT_PLATFORM_ANNOUNCED';
    elsif v_existing.id is null and p_release_date is not null then
      v_event_type := 'OTT_DATE_ANNOUNCED';
$needle$;
  v_after text := $replacement$
  if v_accept_canonical then
    if v_existing.id is null and v_state = 'RELEASED' then
      v_event_type := 'OTT_RELEASED';
    elsif v_existing.id is null and p_release_date is null then
      v_event_type := 'OTT_PLATFORM_ANNOUNCED';
    elsif v_existing.id is null and p_release_date is not null then
      v_event_type := 'OTT_DATE_ANNOUNCED';
$replacement$;
begin
  select pg_get_functiondef(
    'public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text)'::regprocedure
  ) into v_definition;

  if position(v_before in v_definition) = 0 then
    raise exception 'p6_0_61_ott_event_branch_not_found';
  end if;

  v_definition := replace(v_definition, v_before, v_after);
  execute v_definition;
end;
$migration$;

-- Retract the bad canonical event produced from an unrelated description cross-promo.
update public.events e
set status = 'RETRACTED',
    priority_band = 'SUPPRESSED',
    summary = 'Retracted by P6.0.61: November 7 belonged to an unrelated cross-promo in the source description, not this title.',
    updated_at = now()
where e.status = 'ACTIVE'
  and e.event_type = 'OTT_DATE_ANNOUNCED'
  and e.structured_data ->> 'providerCode' = 'AHA'
  and e.structured_data ->> 'releaseDate' = '2026-11-07'
  and exists (
    select 1
    from public.entities en
    where en.id = e.primary_entity_id
      and lower(en.canonical_name) like 'month of madhu%'
  )
  and exists (
    select 1
    from public.ott_releases r
    join public.ott_providers p on p.id = r.provider_id
    where r.entity_id = e.primary_entity_id
      and p.code = 'AHA'
      and r.state = 'RELEASED'
      and r.release_date is null
  );

-- Materialize the corrected availability event from retained first-party evidence.
do $repair$
declare
  v_release_id uuid;
  v_entity_id uuid;
  v_entity_name text;
  v_raw_item_id uuid;
  v_event_id uuid;
begin
  select r.id, r.entity_id, en.canonical_name
    into v_release_id, v_entity_id, v_entity_name
  from public.ott_releases r
  join public.ott_providers p on p.id = r.provider_id
  join public.entities en on en.id = r.entity_id
  where p.code = 'AHA'
    and r.territory = 'IN'
    and r.state = 'RELEASED'
    and r.release_date is null
    and lower(en.canonical_name) like 'month of madhu%'
  order by r.last_verified_at desc
  limit 1;

  if v_release_id is null then
    return;
  end if;

  select ore.raw_item_id
    into v_raw_item_id
  from public.ott_release_evidence ore
  where ore.ott_release_id = v_release_id
  order by ore.is_first_party desc, ore.observed_at asc
  limit 1;

  if v_raw_item_id is null then
    return;
  end if;

  v_event_id := public.upsert_canonical_event_with_evidence(
    gen_random_uuid(),
    v_entity_id,
    'OTT_RELEASED',
    'OFFICIAL',
    'HIGH',
    v_entity_name || ' is now streaming on aha',
    jsonb_build_object(
      'ottReleaseId', v_release_id,
      'providerCode', 'AHA',
      'providerName', 'aha',
      'territory', 'IN',
      'releaseDate', null,
      'datePrecision', 'TBA',
      'state', 'RELEASED',
      'evidenceStatus', 'CONFIRMED'
    ),
    'ott|' || v_entity_id::text || '|AHA|IN|released|unknown',
    'ott-release-intelligence-v2',
    v_raw_item_id
  );

  update public.ott_release_evidence
  set event_id = v_event_id
  where ott_release_id = v_release_id
    and raw_item_id = v_raw_item_id;
end;
$repair$;

comment on function public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text) is
  'Service-only OTT evidence gate. First-party availability without an exact premiere date is RELEASED/TBA and emits OTT_RELEASED, not OTT_PLATFORM_ANNOUNCED.';

commit;
