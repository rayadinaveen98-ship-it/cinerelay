-- Prevent source activity planning for opted-in users without active FCM devices.
-- This avoids orphan outbox growth after a device token expires or is disabled.
CREATE OR REPLACE FUNCTION public.plan_due_source_activity_notifications(p_limit integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
      and exists (
        select 1 from public.push_device_registrations r
        where r.user_id = pref.user_id
          and r.active = true
          and r.provider = 'FCM'
          and r.target_kind = 'TOKEN'
      )
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
$function$

revoke execute on function public.plan_due_source_activity_notifications(integer) from public, anon, authenticated;
grant execute on function public.plan_due_source_activity_notifications(integer) to service_role;
