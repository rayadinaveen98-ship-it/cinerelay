begin;

-- P6.0.60: first-party "Watch Now" / "Now Streaming" evidence proves current
-- availability without necessarily proving the historical premiere day. Keep
-- RELEASED as the lifecycle truth while allowing the date itself to remain TBA.

alter table public.ott_releases
  drop constraint if exists ott_releases_check1;

-- The original upsert function explicitly rejected RELEASED + null date. Remove
-- only that obsolete validation while preserving the rest of the evidence gate.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text)'::regprocedure
  ) into v_definition;

  v_definition := regexp_replace(
    v_definition,
    '[[:space:]]*if[[:space:]]+v_state[[:space:]]*=[[:space:]]*''RELEASED''[[:space:]]+and[[:space:]]+p_release_date[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+''ott_released_date_required'';[[:space:]]+end[[:space:]]+if;',
    E'\n',
    'i'
  );

  if position('ott_released_date_required' in v_definition) > 0 then
    raise exception 'p6_0_60_failed_to_remove_released_date_guard';
  end if;

  execute v_definition;
end;
$migration$;

-- Repair the one known contradictory row produced when an unrelated cross-promo
-- date inside an aha YouTube description was attached to a "Watch Now" title.
-- Preserve the old value in history for audit, but do not surface it as a prior
-- legitimate release date because it never belonged to Month of Madhu.
insert into public.ott_release_history (
  ott_release_id,
  old_release_date,
  new_release_date,
  old_date_precision,
  new_date_precision,
  old_state,
  new_state,
  old_evidence_status,
  new_evidence_status,
  evidence_raw_item_id,
  reason
)
select
  r.id,
  r.release_date,
  null,
  r.date_precision,
  'TBA',
  r.state,
  'RELEASED',
  r.evidence_status,
  r.evidence_status,
  null,
  'P6.0.60 repaired unrelated cross-promo date; official evidence proves availability but not exact premiere day'
from public.ott_releases r
where r.id = '6f0393d0-8c68-4a81-8aeb-b0d7c05a968a'::uuid
  and r.state = 'RELEASED'
  and r.release_date = date '2026-11-07';

update public.ott_releases
set release_date = null,
    date_precision = 'TBA',
    state = 'RELEASED',
    previous_release_date = null,
    last_verified_at = now(),
    updated_at = now()
where id = '6f0393d0-8c68-4a81-8aeb-b0d7c05a968a'::uuid
  and state = 'RELEASED'
  and release_date = date '2026-11-07';

comment on table public.ott_releases is
  'Canonical evidence-backed OTT availability for one title/provider/territory. RELEASED may have date_precision=TBA when first-party evidence proves availability but not the historical premiere day.';

comment on function public.upsert_ott_release_with_evidence(uuid,text,uuid,text,text[],text,date,text,text,text,text) is
  'Service-only OTT evidence gate. RELEASED can carry a null date when first-party availability is confirmed without an exact premiere day.';

commit;
