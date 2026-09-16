begin;

create table public.event_summary_entries (
  event_id uuid primary key references public.events(id) on delete cascade,
  summary_status text not null check (summary_status in ('READY','WITHHELD')),
  summary_text text,
  reason_codes text[] not null default '{}'::text[],
  evidence_count integer not null default 0 check (evidence_count >= 0),
  conflicting_evidence_count integer not null default 0 check (conflicting_evidence_count >= 0),
  input_snapshot jsonb not null default '{}'::jsonb,
  generator_version text not null default 'evidence-summary-v1',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (conflicting_evidence_count <= evidence_count),
  check (
    (summary_status = 'READY' and summary_text is not null and length(btrim(summary_text)) > 0 and evidence_count > 0)
    or
    (summary_status = 'WITHHELD' and summary_text is null)
  )
);

create index event_summary_entries_status_idx
  on public.event_summary_entries (summary_status, generated_at desc);

create table public.event_summary_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_summary_entries(event_id) on delete cascade,
  raw_item_id uuid references public.raw_items(id) on delete set null,
  ordinal smallint not null check (ordinal between 1 and 5),
  evidence_role text not null check (evidence_role in ('PRIMARY','CORROBORATING','CONFLICTING','REPEAT')),
  authority_tier smallint not null check (authority_tier between 1 and 5),
  source_name text not null,
  canonical_url text not null,
  title_snapshot text,
  content_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (event_id, ordinal)
);

create unique index event_summary_evidence_raw_item_uq
  on public.event_summary_evidence (event_id, raw_item_id)
  where raw_item_id is not null;

create index event_summary_evidence_raw_item_idx
  on public.event_summary_evidence (raw_item_id)
  where raw_item_id is not null;

create trigger event_summary_entries_set_updated_at
before update on public.event_summary_entries
for each row execute function public.set_updated_at();

create or replace function public.event_summary_compute(p_event_id uuid)
returns table (
  summary_status text,
  summary_text text,
  reason_codes text[],
  evidence_count integer,
  conflicting_evidence_count integer,
  input_snapshot jsonb,
  evidence_items jsonb
)
language plpgsql
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_evidence_count integer := 0;
  v_conflicting_count integer := 0;
  v_evidence_signature text := md5('');
  v_lead_source text;
  v_verification_label text;
  v_summary text;
  v_reasons text[] := '{}'::text[];
  v_evidence_items jsonb := '[]'::jsonb;
begin
  select * into v_event
  from public.events
  where id = p_event_id;

  if v_event.id is null then
    raise exception 'event_summary_event_not_found';
  end if;

  select
    count(*)::integer,
    count(*) filter (where ee.evidence_role = 'CONFLICTING')::integer,
    md5(coalesce(string_agg(
      ri.id::text || ':' ||
      ee.evidence_role || ':' ||
      coalesce(ee.weight::text, '') || ':' ||
      coalesce(ri.content_fingerprint, '') || ':' ||
      coalesce(s.authority_tier::text, '') || ':' ||
      coalesce(s.display_name, '') || ':' ||
      coalesce(ri.canonical_url, ''),
      '|' order by
        case ee.evidence_role when 'PRIMARY' then 0 when 'CORROBORATING' then 1 when 'REPEAT' then 2 else 3 end,
        s.authority_tier asc,
        ee.weight desc,
        ri.id asc
    ), ''))
  into v_evidence_count, v_conflicting_count, v_evidence_signature
  from public.event_evidence ee
  join public.raw_items ri on ri.id = ee.raw_item_id
  join public.source_identities si on si.id = ri.source_identity_id
  join public.sources s on s.id = si.source_id
  where ee.event_id = p_event_id;

  select s.display_name
  into v_lead_source
  from public.event_evidence ee
  join public.raw_items ri on ri.id = ee.raw_item_id
  join public.source_identities si on si.id = ri.source_identity_id
  join public.sources s on s.id = si.source_id
  where ee.event_id = p_event_id
  order by
    case ee.evidence_role when 'PRIMARY' then 0 when 'CORROBORATING' then 1 when 'REPEAT' then 2 else 3 end,
    s.authority_tier asc,
    ee.weight desc,
    coalesce(ri.published_at, ri.first_seen_at) desc,
    ri.id asc
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ordinal', q.ordinal,
      'rawItemId', q.raw_item_id,
      'evidenceRole', q.evidence_role,
      'authorityTier', q.authority_tier,
      'sourceName', q.source_name,
      'canonicalUrl', q.canonical_url,
      'titleSnapshot', q.title_snapshot,
      'contentFingerprint', q.content_fingerprint
    ) order by q.ordinal
  ), '[]'::jsonb)
  into v_evidence_items
  from (
    select
      row_number() over (
        order by
          case ee.evidence_role when 'PRIMARY' then 0 when 'CORROBORATING' then 1 when 'REPEAT' then 2 else 3 end,
          s.authority_tier asc,
          ee.weight desc,
          coalesce(ri.published_at, ri.first_seen_at) desc,
          ri.id asc
      )::smallint as ordinal,
      ri.id as raw_item_id,
      ee.evidence_role,
      s.authority_tier,
      s.display_name as source_name,
      ri.canonical_url,
      left(coalesce(ri.raw_title, ''), 300) as title_snapshot,
      ri.content_fingerprint
    from public.event_evidence ee
    join public.raw_items ri on ri.id = ee.raw_item_id
    join public.source_identities si on si.id = ri.source_identity_id
    join public.sources s on s.id = si.source_id
    where ee.event_id = p_event_id
    order by
      case ee.evidence_role when 'PRIMARY' then 0 when 'CORROBORATING' then 1 when 'REPEAT' then 2 else 3 end,
      s.authority_tier asc,
      ee.weight desc,
      coalesce(ri.published_at, ri.first_seen_at) desc,
      ri.id asc
    limit 5
  ) q;

  case v_event.verification_state
    when 'OFFICIAL' then v_verification_label := 'Official';
    when 'CONFIRMED' then v_verification_label := 'Confirmed';
    when 'RELIABLE_REPORT' then v_verification_label := 'Reliable report';
    when 'DEVELOPING' then v_verification_label := 'Developing';
    when 'RUMOR' then v_verification_label := 'Rumor / unverified';
    else v_verification_label := v_event.verification_state;
  end case;

  if v_evidence_count = 0 then
    summary_status := 'WITHHELD';
    summary_text := null;
    v_reasons := array_append(v_reasons, 'NO_LINKED_EVIDENCE');
  elsif v_event.status not in ('ACTIVE','NEEDS_REVIEW') then
    summary_status := 'WITHHELD';
    summary_text := null;
    v_reasons := array_append(v_reasons, 'EVENT_NOT_SUMMARIZABLE');
  else
    summary_status := 'READY';
    v_reasons := array_append(v_reasons, 'SUMMARY_READY');
    v_reasons := array_append(v_reasons, 'EVIDENCE_LINKED');
    v_reasons := array_append(v_reasons, 'VERIFICATION_' || v_event.verification_state);

    v_summary := left(rtrim(btrim(v_event.headline), '.!? '), 700)
      || '. Verification: ' || v_verification_label
      || '. Evidence: ' || v_evidence_count::text || ' linked item'
      || case when v_evidence_count = 1 then '' else 's' end;

    if v_lead_source is not null and btrim(v_lead_source) <> '' then
      v_summary := v_summary || ', led by ' || left(btrim(v_lead_source), 120);
    end if;
    v_summary := v_summary || '.';

    if v_conflicting_count > 0 then
      v_summary := v_summary || ' Conflicting evidence retained: ' || v_conflicting_count::text || '.';
      v_reasons := array_append(v_reasons, 'CONFLICTING_EVIDENCE_PRESENT');
    end if;

    summary_text := left(v_summary, 1000);
  end if;

  reason_codes := v_reasons;
  evidence_count := v_evidence_count;
  conflicting_evidence_count := v_conflicting_count;
  input_snapshot := jsonb_build_object(
    'eventId', v_event.id,
    'headline', v_event.headline,
    'verificationState', v_event.verification_state,
    'eventStatus', v_event.status,
    'evidenceCount', v_evidence_count,
    'conflictingEvidenceCount', v_conflicting_count,
    'evidenceSignature', v_evidence_signature,
    'eventUpdatedAt', v_event.updated_at
  );
  evidence_items := v_evidence_items;

  return next;
end;
$$;

create or replace function public.refresh_event_summaries(p_limit integer default 100)
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
    left join public.event_summary_entries se on se.event_id = e.id
    left join lateral (
      select
        count(*)::integer as evidence_count,
        count(*) filter (where ee.evidence_role = 'CONFLICTING')::integer as conflicting_count,
        md5(coalesce(string_agg(
          ri.id::text || ':' ||
          ee.evidence_role || ':' ||
          coalesce(ee.weight::text, '') || ':' ||
          coalesce(ri.content_fingerprint, '') || ':' ||
          coalesce(s.authority_tier::text, '') || ':' ||
          coalesce(s.display_name, '') || ':' ||
          coalesce(ri.canonical_url, ''),
          '|' order by
            case ee.evidence_role when 'PRIMARY' then 0 when 'CORROBORATING' then 1 when 'REPEAT' then 2 else 3 end,
            s.authority_tier asc,
            ee.weight desc,
            ri.id asc
        ), '')) as evidence_signature
      from public.event_evidence ee
      join public.raw_items ri on ri.id = ee.raw_item_id
      join public.source_identities si on si.id = ri.source_identity_id
      join public.sources s on s.id = si.source_id
      where ee.event_id = e.id
    ) evidence_state on true
    where se.event_id is null
       or se.generator_version <> 'evidence-summary-v1'
       or (se.input_snapshot->>'headline') is distinct from e.headline
       or (se.input_snapshot->>'verificationState') is distinct from e.verification_state
       or (se.input_snapshot->>'eventStatus') is distinct from e.status
       or coalesce((se.input_snapshot->>'evidenceCount')::integer, -1) <> coalesce(evidence_state.evidence_count, 0)
       or coalesce((se.input_snapshot->>'conflictingEvidenceCount')::integer, -1) <> coalesce(evidence_state.conflicting_count, 0)
       or (se.input_snapshot->>'evidenceSignature') is distinct from coalesce(evidence_state.evidence_signature, md5(''))
       or se.generated_at < e.updated_at
    order by e.detected_at desc nulls last, e.created_at desc, e.id asc
    for update of e skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    select * into v_calc
    from public.event_summary_compute(v_event.id);

    insert into public.event_summary_entries (
      event_id,
      summary_status,
      summary_text,
      reason_codes,
      evidence_count,
      conflicting_evidence_count,
      input_snapshot,
      generator_version,
      generated_at
    ) values (
      v_event.id,
      v_calc.summary_status,
      v_calc.summary_text,
      v_calc.reason_codes,
      v_calc.evidence_count,
      v_calc.conflicting_evidence_count,
      v_calc.input_snapshot,
      'evidence-summary-v1',
      clock_timestamp()
    )
    on conflict (event_id) do update
      set summary_status = excluded.summary_status,
          summary_text = excluded.summary_text,
          reason_codes = excluded.reason_codes,
          evidence_count = excluded.evidence_count,
          conflicting_evidence_count = excluded.conflicting_evidence_count,
          input_snapshot = excluded.input_snapshot,
          generator_version = excluded.generator_version,
          generated_at = excluded.generated_at,
          updated_at = clock_timestamp();

    delete from public.event_summary_evidence
    where event_id = v_event.id;

    insert into public.event_summary_evidence (
      event_id,
      raw_item_id,
      ordinal,
      evidence_role,
      authority_tier,
      source_name,
      canonical_url,
      title_snapshot,
      content_fingerprint
    )
    select
      v_event.id,
      nullif(item->>'rawItemId', '')::uuid,
      (item->>'ordinal')::smallint,
      item->>'evidenceRole',
      (item->>'authorityTier')::smallint,
      item->>'sourceName',
      item->>'canonicalUrl',
      nullif(item->>'titleSnapshot', ''),
      item->>'contentFingerprint'
    from jsonb_array_elements(coalesce(v_calc.evidence_items, '[]'::jsonb)) item;

    v_refreshed := v_refreshed + 1;
  end loop;

  return v_refreshed;
end;
$$;

alter table public.event_summary_entries enable row level security;
alter table public.event_summary_evidence enable row level security;

revoke all on table public.event_summary_entries from public, anon, authenticated;
revoke all on table public.event_summary_evidence from public, anon, authenticated;
grant select,insert,update,delete on public.event_summary_entries to service_role;
grant select,insert,update,delete on public.event_summary_evidence to service_role;

revoke all on function public.event_summary_compute(uuid) from public, anon, authenticated;
revoke all on function public.refresh_event_summaries(integer) from public, anon, authenticated;
grant execute on function public.event_summary_compute(uuid) to service_role;
grant execute on function public.refresh_event_summaries(integer) to service_role;

commit;
