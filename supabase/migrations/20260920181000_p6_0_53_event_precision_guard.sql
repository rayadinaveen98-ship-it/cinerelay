begin;

create table if not exists public.classifier_event_rejections (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  attempted_event_type text not null,
  dedupe_key text not null,
  classifier_version text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(raw_item_id, attempted_event_type, classifier_version)
);

create index if not exists classifier_event_rejections_entity_idx
  on public.classifier_event_rejections (entity_id, created_at desc);
create index if not exists classifier_event_rejections_raw_idx
  on public.classifier_event_rejections (raw_item_id, created_at desc);

alter table public.classifier_event_rejections enable row level security;
revoke all on table public.classifier_event_rejections from public, anon, authenticated;
grant select, insert, update, delete on table public.classifier_event_rejections to service_role;

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
  v_title text;
  v_source_tier smallint;
  v_source_role text;
  v_reject_reason text;
begin
  if p_verification_state not in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR') then
    raise exception 'invalid verification state';
  end if;
  if p_priority_band not in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED') then
    raise exception 'invalid priority band';
  end if;

  select
    public.normalize_entity_discovery_name(coalesce(r.raw_title, '')),
    s.authority_tier,
    s.source_role
  into v_title, v_source_tier, v_source_role
  from public.raw_items r
  join public.source_identities si on si.id = r.source_identity_id
  join public.sources s on s.id = si.source_id
  where r.id = p_raw_item_id;

  if v_title is null then
    raise exception 'raw item not found';
  end if;

  -- Reporting/trade sources often repeat background facts inside article bodies.
  -- High-impact media/release events must therefore be headline-grounded for
  -- non-first-party sources. First-party sources may still announce in body copy.
  if coalesce(v_source_tier, 5) >= 3 then
    if p_event_type in ('TRAILER_ANNOUNCED','TRAILER_RELEASED')
       and position('trailer' in v_title) = 0 then
      v_reject_reason := 'non_first_party_trailer_not_title_grounded';
    elsif p_event_type in ('TEASER_ANNOUNCED','TEASER_RELEASED')
       and position('teaser' in v_title) = 0 then
      v_reject_reason := 'non_first_party_teaser_not_title_grounded';
    elsif p_event_type in ('THEATRICAL_DATE_ANNOUNCED','THEATRICAL_DATE_CHANGED')
       and not (
         v_title like '%release date%'
         or v_title like '%release on%'
         or v_title like '%releases on%'
         or v_title like '%releasing on%'
         or v_title like '%arrives in cinema%'
         or v_title like '%arrives in theatre%'
         or v_title like '%hits cinema%'
         or v_title like '%hits theatre%'
         or v_title like '%in cinemas%'
         or v_title like '%in theatres%'
         or v_title like '%theatrical release%'
         or v_title like '%worldwide release%'
       ) then
      v_reject_reason := 'non_first_party_theatrical_date_not_title_grounded';
    end if;
  end if;

  if v_reject_reason is not null then
    insert into public.classifier_event_rejections (
      raw_item_id, entity_id, attempted_event_type, dedupe_key,
      classifier_version, reason, metadata
    ) values (
      p_raw_item_id,
      p_primary_entity_id,
      p_event_type,
      p_dedupe_key,
      p_classifier_version,
      v_reject_reason,
      jsonb_build_object(
        'sourceAuthorityTier', v_source_tier,
        'sourceRole', v_source_role,
        'title', v_title,
        'verificationState', p_verification_state,
        'priorityBand', p_priority_band
      )
    )
    on conflict (raw_item_id, attempted_event_type, classifier_version) do update
      set reason = excluded.reason,
          metadata = excluded.metadata,
          dedupe_key = excluded.dedupe_key,
          created_at = now();

    -- Returning the deterministic event UUID keeps the worker idempotent and
    -- successful while intentionally creating no canonical event or alert.
    return p_event_id;
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

commit;
