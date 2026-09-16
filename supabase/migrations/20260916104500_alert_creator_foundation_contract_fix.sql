begin;

-- The preference expression naturally resolves digest_hour_local through COALESCE
-- as integer. Keep the helper boundary ergonomic and avoid smallint-only overload
-- resolution failures inside the planner.
drop function if exists public.next_alert_digest_at(timestamptz, text, smallint);

create or replace function public.next_alert_digest_at(
  p_now timestamptz,
  p_timezone text,
  p_digest_hour integer
)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_local timestamp without time zone;
  v_target timestamp without time zone;
begin
  if p_digest_hour < 0 or p_digest_hour > 23 then
    raise exception 'invalid_digest_hour';
  end if;
  v_local := timezone(p_timezone, p_now);
  v_target := v_local::date + make_interval(hours => p_digest_hour);
  if v_target <= v_local then
    v_target := v_target + interval '1 day';
  end if;
  return v_target at time zone p_timezone;
end;
$$;

-- Preserve the latest operator-review semantics while adding alert planning.
-- In particular, deterministic reprocessing must never undo operator suppression
-- or replace an operator-reviewed classifier marker.
create or replace function public.upsert_canonical_event_with_evidence(
  p_event_id uuid,
  p_primary_entity_id uuid,
  p_event_type text,
  p_verification_state text,
  p_priority_band text,
  p_headline text,
  p_structured_data jsonb,
  p_dedupe_key text,
  p_classifier_version text,
  p_raw_item_id uuid
)
returns uuid
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  result_id uuid;
  had_evidence boolean;
begin
  if p_verification_state not in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR') then
    raise exception 'invalid verification state';
  end if;
  if p_priority_band not in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED') then
    raise exception 'invalid priority band';
  end if;

  insert into public.events (
    id, primary_entity_id, event_type, event_schema_version, detected_at, verification_state,
    priority_band, headline, structured_data, dedupe_key, status, classifier_version
  ) values (
    p_event_id, p_primary_entity_id, p_event_type, 1, now(), p_verification_state,
    p_priority_band, p_headline, coalesce(p_structured_data, '{}'::jsonb), p_dedupe_key, 'ACTIVE', p_classifier_version
  )
  on conflict (dedupe_key) do update
    set verification_state = case
          when public.verification_rank(excluded.verification_state) < public.verification_rank(public.events.verification_state)
            then excluded.verification_state
          else public.events.verification_state
        end,
        priority_band = case
          when public.events.status = 'SUPPRESSED' then 'SUPPRESSED'
          when excluded.priority_band = 'CRITICAL' then 'CRITICAL'
          when public.events.priority_band = 'CRITICAL' then public.events.priority_band
          when excluded.priority_band = 'HIGH' then 'HIGH'
          when public.events.priority_band = 'HIGH' then public.events.priority_band
          when excluded.priority_band = 'NORMAL' then 'NORMAL'
          else public.events.priority_band
        end,
        headline = excluded.headline,
        structured_data = excluded.structured_data,
        classifier_version = case
          when public.events.classifier_version = 'operator-review-v1' then public.events.classifier_version
          else excluded.classifier_version
        end,
        updated_at = now()
  returning id into result_id;

  select exists(select 1 from public.event_evidence where event_id = result_id)
    into had_evidence;

  insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight)
  values (result_id, p_raw_item_id, case when had_evidence then 'REPEAT' else 'PRIMARY' end, 1)
  on conflict (event_id, raw_item_id) do nothing;

  perform public.plan_event_alerts(result_id);
  return result_id;
end;
$$;

comment on function public.upsert_canonical_event_with_evidence(uuid,uuid,text,text,text,text,jsonb,text,text,uuid) is
  'Atomically deduplicates canonical events, preserves operator suppression/reclassification semantics, attaches evidence, and idempotently plans user alerts.';

commit;
