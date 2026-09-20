alter table public.user_source_activity_preferences
  add column if not exists setup_completed_at timestamptz;

create table if not exists public.user_source_activity_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  enabled boolean not null default true,
  include_videos boolean not null default true,
  include_shorts boolean not null default false,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_identity_id)
);

create index if not exists user_source_activity_subscriptions_source_enabled_idx
  on public.user_source_activity_subscriptions (source_identity_id, enabled)
  where enabled = true;

alter table public.user_source_activity_subscriptions enable row level security;

revoke all on table public.user_source_activity_subscriptions from anon;
grant select, insert, update, delete on table public.user_source_activity_subscriptions to authenticated;

create policy "user_source_activity_subscriptions_select_own"
  on public.user_source_activity_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_source_activity_subscriptions_insert_own"
  on public.user_source_activity_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_source_activity_subscriptions_update_own"
  on public.user_source_activity_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_source_activity_subscriptions_delete_own"
  on public.user_source_activity_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.replace_user_source_activity_selection(
  p_user_id uuid,
  p_source_identity_ids uuid[],
  p_include_videos boolean default true,
  p_include_shorts boolean default false,
  p_master_enabled boolean default true,
  p_complete_setup boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_ids uuid[];
  v_valid_count integer := 0;
  v_enabled boolean;
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(distinct value), '{}'::uuid[])
  into v_ids
  from unnest(coalesce(p_source_identity_ids, '{}'::uuid[])) as value;

  if cardinality(v_ids) > 100 then
    raise exception 'too_many_source_subscriptions';
  end if;

  if cardinality(v_ids) > 0 then
    select count(*)
    into v_valid_count
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where si.id = any(v_ids)
      and si.active = true
      and s.active = true
      and si.platform = 'YOUTUBE'
      and s.authority_tier = 1;

    if v_valid_count <> cardinality(v_ids) then
      raise exception 'invalid_source_identity';
    end if;
  end if;

  update public.user_source_activity_subscriptions
  set enabled = false,
      updated_at = now()
  where user_id = p_user_id
    and enabled = true
    and (cardinality(v_ids) = 0 or not (source_identity_id = any(v_ids)));

  insert into public.user_source_activity_subscriptions (
    user_id,
    source_identity_id,
    enabled,
    include_videos,
    include_shorts,
    activated_at,
    created_at,
    updated_at
  )
  select
    p_user_id,
    source_identity_id,
    true,
    coalesce(p_include_videos, true),
    coalesce(p_include_shorts, false),
    now(),
    now(),
    now()
  from unnest(v_ids) as source_identity_id
  on conflict (user_id, source_identity_id) do update
  set enabled = true,
      include_videos = excluded.include_videos,
      include_shorts = excluded.include_shorts,
      activated_at = case
        when public.user_source_activity_subscriptions.enabled = false
          or public.user_source_activity_subscriptions.include_videos is distinct from excluded.include_videos
          or public.user_source_activity_subscriptions.include_shorts is distinct from excluded.include_shorts
        then now()
        else public.user_source_activity_subscriptions.activated_at
      end,
      updated_at = now();

  v_enabled := coalesce(p_master_enabled, true) and cardinality(v_ids) > 0;

  insert into public.user_source_activity_preferences (
    user_id,
    enabled,
    include_videos,
    include_shorts,
    official_youtube_only,
    activated_at,
    setup_completed_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    v_enabled,
    coalesce(p_include_videos, true),
    coalesce(p_include_shorts, false),
    true,
    now(),
    case when coalesce(p_complete_setup, true) then now() else null end,
    now(),
    now()
  )
  on conflict (user_id) do update
  set enabled = excluded.enabled,
      include_videos = excluded.include_videos,
      include_shorts = excluded.include_shorts,
      official_youtube_only = true,
      activated_at = case
        when public.user_source_activity_preferences.enabled = false and excluded.enabled = true
        then now()
        else public.user_source_activity_preferences.activated_at
      end,
      setup_completed_at = case
        when coalesce(p_complete_setup, true)
        then coalesce(public.user_source_activity_preferences.setup_completed_at, now())
        else public.user_source_activity_preferences.setup_completed_at
      end,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'enabled', v_enabled,
    'selectedSourceCount', cardinality(v_ids),
    'includeVideos', coalesce(p_include_videos, true),
    'includeShorts', coalesce(p_include_shorts, false),
    'setupCompleted', coalesce(p_complete_setup, true)
  );
end;
$function$;

revoke all on function public.replace_user_source_activity_selection(uuid, uuid[], boolean, boolean, boolean, boolean) from public;
grant execute on function public.replace_user_source_activity_selection(uuid, uuid[], boolean, boolean, boolean, boolean) to authenticated, service_role;

create or replace function public.plan_due_source_activity_notifications(p_limit integer default 200)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_count integer := 0;
begin
  with eligible as (
    select
      pref.user_id,
      ri.id as raw_item_id,
      ri.source_identity_id,
      ri.raw_title,
      ri.canonical_url,
      ri.published_at,
      ri.first_seen_at,
      s.display_name as source_name,
      s.source_role,
      case
        when lower(coalesce(ri.raw_title, '')) like '%#shorts%' then 'SHORT'
        else 'VIDEO'
      end as activity_kind,
      public.next_alert_allowed_at(
        now(),
        coalesce(ap.timezone_name, 'Asia/Kolkata'),
        coalesce(ap.quiet_hours_enabled, false),
        coalesce(ap.quiet_start_local, time '22:30'),
        coalesce(ap.quiet_end_local, time '08:00'),
        coalesce(ap.critical_bypass_quiet_hours, false),
        'HIGH'
      ) as scheduled_for
    from public.user_source_activity_preferences pref
    join public.user_source_activity_subscriptions sub
      on sub.user_id = pref.user_id
     and sub.enabled = true
    join public.raw_items ri
      on ri.source_identity_id = sub.source_identity_id
     and ri.first_seen_at >= greatest(pref.activated_at, sub.activated_at)
     and ri.first_seen_at >= now() - interval '2 hours'
    join public.source_identities si on si.id = ri.source_identity_id
    join public.sources s on s.id = si.source_id
    left join public.user_alert_preferences ap on ap.user_id = pref.user_id
    where pref.enabled = true
      and pref.official_youtube_only = true
      and si.active = true
      and s.active = true
      and si.platform = 'YOUTUBE'
      and s.authority_tier = 1
      and ri.item_type = 'YOUTUBE_VIDEO'
      and ri.deleted_or_unavailable_at is null
      and coalesce(ri.published_at, ri.first_seen_at) >= ri.first_seen_at - interval '60 minutes'
      and (
        (lower(coalesce(ri.raw_title, '')) like '%#shorts%' and sub.include_shorts = true)
        or
        (lower(coalesce(ri.raw_title, '')) not like '%#shorts%' and sub.include_videos = true)
      )
      and not exists (
        select 1 from public.source_activity_deliveries d
        where d.user_id = pref.user_id and d.raw_item_id = ri.id
      )
    order by ri.first_seen_at asc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  )
  insert into public.source_activity_deliveries (
    user_id, raw_item_id, source_identity_id, dedupe_key, status, scheduled_for, payload
  )
  select
    e.user_id,
    e.raw_item_id,
    e.source_identity_id,
    'source-activity:' || e.user_id::text || ':' || e.raw_item_id::text,
    case when e.scheduled_for > now() + interval '1 second' then 'DEFERRED' else 'PENDING' end,
    e.scheduled_for,
    jsonb_build_object(
      'notificationClass', 'SOURCE_ACTIVITY',
      'rawItemId', e.raw_item_id,
      'sourceIdentityId', e.source_identity_id,
      'sourceName', e.source_name,
      'sourceRole', e.source_role,
      'platform', 'YOUTUBE',
      'activityKind', e.activity_kind,
      'headline', coalesce(nullif(btrim(coalesce(e.raw_title, '')), ''), 'New official YouTube upload'),
      'canonicalUrl', e.canonical_url,
      'publishedAt', e.published_at,
      'verificationState', 'OFFICIAL_SOURCE_ACTIVITY',
      'priorityBand', 'HIGH'
    )
  from eligible e
  on conflict (user_id, raw_item_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
