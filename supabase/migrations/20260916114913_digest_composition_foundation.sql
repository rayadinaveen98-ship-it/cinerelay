begin;

alter table public.alert_deliveries
  drop constraint if exists alert_deliveries_status_check;

alter table public.alert_deliveries
  add constraint alert_deliveries_status_check
  check (status in ('PENDING','DEFERRED','COMPOSED','SENT','FAILED','SUPPRESSED'));

alter table public.alert_deliveries
  add column if not exists composed_at timestamptz;

create table public.alert_digest_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'BUILDING'
    check (status in ('BUILDING','READY','READ','ARCHIVED')),
  item_count integer not null default 0 check (item_count >= 0),
  highest_priority_band text
    check (highest_priority_band is null or highest_priority_band in ('CRITICAL','HIGH','NORMAL','LOW')),
  title text,
  payload jsonb not null default '{}'::jsonb,
  composer_version text not null default 'digest-v1',
  ready_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_for)
);

create index alert_digest_batches_user_ready_idx
  on public.alert_digest_batches (user_id, status, scheduled_for desc);

create table public.alert_digest_items (
  batch_id uuid not null references public.alert_digest_batches(id) on delete cascade,
  alert_delivery_id uuid not null unique references public.alert_deliveries(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ordinal integer not null default 0 check (ordinal >= 0),
  created_at timestamptz not null default now(),
  primary key (batch_id, alert_delivery_id)
);

create index alert_digest_items_event_idx
  on public.alert_digest_items (event_id, batch_id);

create trigger alert_digest_batches_set_updated_at
before update on public.alert_digest_batches
for each row execute function public.set_updated_at();

create or replace function public.compose_due_alert_digests(p_limit integer default 200)
returns integer
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_alert record;
  v_batch_id uuid;
  v_touched uuid[] := '{}'::uuid[];
  v_inserted integer := 0;
  v_composed integer := 0;
  v_batch record;
  v_remaining boolean;
  v_item_count integer;
  v_highest text;
  v_payload jsonb;
begin
  for v_alert in
    select d.id, d.user_id, d.event_id, d.scheduled_for
    from public.alert_deliveries d
    where d.delivery_kind = 'DIGEST'
      and d.status in ('PENDING','DEFERRED','FAILED')
      and d.scheduled_for <= now()
    order by d.scheduled_for asc, d.created_at asc, d.id asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  loop
    insert into public.alert_digest_batches (
      user_id, scheduled_for, status, composer_version
    ) values (
      v_alert.user_id, v_alert.scheduled_for, 'BUILDING', 'digest-v1'
    )
    on conflict (user_id, scheduled_for) do update
      set status = case
          when public.alert_digest_batches.status = 'ARCHIVED' then 'ARCHIVED'
          else 'BUILDING'
        end,
        updated_at = now()
    returning id into v_batch_id;

    insert into public.alert_digest_items (
      batch_id, alert_delivery_id, event_id, ordinal
    ) values (
      v_batch_id, v_alert.id, v_alert.event_id, 0
    )
    on conflict (alert_delivery_id) do nothing;
    get diagnostics v_inserted = row_count;

    update public.alert_deliveries
    set status = 'COMPOSED',
        composed_at = coalesce(composed_at, now()),
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where id = v_alert.id
      and exists (
        select 1
        from public.alert_digest_items i
        where i.alert_delivery_id = v_alert.id
      );

    v_composed := v_composed + v_inserted;

    if not (v_batch_id = any(v_touched)) then
      v_touched := array_append(v_touched, v_batch_id);
    end if;
  end loop;

  for v_batch in
    select b.id, b.user_id, b.scheduled_for, b.status
    from public.alert_digest_batches b
    where b.id = any(v_touched)
  loop
    with ranked as (
      select i.batch_id,
             i.alert_delivery_id,
             row_number() over (
               order by public.alert_priority_rank(e.priority_band) asc,
                        e.detected_at desc,
                        d.created_at asc,
                        d.id asc
             )::integer as ordinal
      from public.alert_digest_items i
      join public.alert_deliveries d on d.id = i.alert_delivery_id
      join public.events e on e.id = i.event_id
      where i.batch_id = v_batch.id
    )
    update public.alert_digest_items i
    set ordinal = r.ordinal
    from ranked r
    where i.batch_id = r.batch_id
      and i.alert_delivery_id = r.alert_delivery_id;

    select
      count(*)::integer,
      case min(public.alert_priority_rank(e.priority_band))
        when 0 then 'CRITICAL'
        when 1 then 'HIGH'
        when 2 then 'NORMAL'
        when 3 then 'LOW'
        else null
      end,
      jsonb_build_object(
        'kind', 'CINERELAY_DIGEST',
        'batchId', v_batch.id,
        'scheduledFor', v_batch.scheduled_for,
        'items', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'eventId', e.id,
              'entityId', e.primary_entity_id,
              'eventType', e.event_type,
              'verificationState', e.verification_state,
              'priorityBand', e.priority_band,
              'headline', e.headline,
              'detectedAt', e.detected_at
            ) order by i.ordinal asc
          ),
          '[]'::jsonb
        )
      )
    into v_item_count, v_highest, v_payload
    from public.alert_digest_items i
    join public.alert_deliveries d on d.id = i.alert_delivery_id
    join public.events e on e.id = i.event_id
    where i.batch_id = v_batch.id;

    v_payload := coalesce(v_payload, '{}'::jsonb)
      || jsonb_build_object(
        'itemCount', coalesce(v_item_count, 0),
        'highestPriorityBand', v_highest
      );

    select exists (
      select 1
      from public.alert_deliveries d
      where d.user_id = v_batch.user_id
        and d.delivery_kind = 'DIGEST'
        and d.scheduled_for = v_batch.scheduled_for
        and d.status in ('PENDING','DEFERRED','FAILED')
        and d.scheduled_for <= now()
    ) into v_remaining;

    update public.alert_digest_batches
    set item_count = coalesce(v_item_count, 0),
        highest_priority_band = v_highest,
        title = 'CineRelay digest - ' || coalesce(v_item_count, 0)::text ||
          case when coalesce(v_item_count, 0) = 1 then ' update' else ' updates' end,
        payload = v_payload,
        status = case
          when status = 'ARCHIVED' then 'ARCHIVED'
          when v_remaining then 'BUILDING'
          else 'READY'
        end,
        ready_at = case
          when status = 'ARCHIVED' then ready_at
          when not v_remaining then coalesce(ready_at, now())
          else null
        end,
        updated_at = now()
    where id = v_batch.id;
  end loop;

  return v_composed;
end;
$$;

alter table public.alert_digest_batches enable row level security;
alter table public.alert_digest_items enable row level security;

revoke all on table public.alert_digest_batches from public, anon, authenticated;
revoke all on table public.alert_digest_items from public, anon, authenticated;
grant select on public.alert_digest_batches to authenticated;
grant select on public.alert_digest_items to authenticated;
grant select,insert,update,delete on public.alert_digest_batches to service_role;
grant select,insert,update,delete on public.alert_digest_items to service_role;

create policy alert_digest_batches_select_own
on public.alert_digest_batches
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy alert_digest_items_select_own
on public.alert_digest_items
for select
to authenticated
using (
  exists (
    select 1
    from public.alert_digest_batches b
    where b.id = alert_digest_items.batch_id
      and b.user_id = (select auth.uid())
  )
);

revoke all on function public.compose_due_alert_digests(integer) from public, anon, authenticated;
grant execute on function public.compose_due_alert_digests(integer) to service_role;

commit;
