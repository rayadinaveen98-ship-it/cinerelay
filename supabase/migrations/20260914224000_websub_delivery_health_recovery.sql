begin;

create or replace function public.record_youtube_websub_delivery(
  p_source_identity_id uuid,
  p_latest_video_id text,
  p_accepted_count integer,
  p_received_at timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  if p_accepted_count <= 0 then
    raise exception 'accepted count must be positive';
  end if;
  if p_latest_video_id is null or p_latest_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'invalid latest YouTube video id';
  end if;

  update public.youtube_channel_state
  set last_websub_at = p_received_at,
      latest_known_video_id = p_latest_video_id,
      consecutive_websub_events = consecutive_websub_events + p_accepted_count,
      next_fallback_check_at = p_received_at + interval '6 hours',
      updated_at = p_received_at
  where source_identity_id = p_source_identity_id;

  if not found then
    raise exception 'youtube channel state not found';
  end if;

  update public.source_health
  set health_state = 'HEALTHY',
      last_attempt_at = p_received_at,
      last_success_at = p_received_at,
      consecutive_failures = 0,
      last_error_code = null,
      last_error_message = null,
      updated_at = p_received_at
  where source_identity_id = p_source_identity_id
    and last_error_code in ('WEBSUB_MISSED_DELIVERY', 'WEBSUB_STALE');
end;
$$;

comment on function public.record_youtube_websub_delivery is 'Atomically advances YouTube WebSub state and clears only WebSub-specific delivery degradation after a successful push.';

-- Repair the hosted-pilot semantics introduced by the first fallback worker.
-- A quiet channel is not stale merely because it has not emitted an event.
-- Only a post-subscription upload recovered through fallback proves a missed push.
update public.source_health sh
set health_state = 'DEGRADED',
    last_error_code = 'WEBSUB_MISSED_DELIVERY',
    last_error_message = 'Fallback recovered a post-subscription upload that was not observed via WebSub',
    updated_at = now()
where sh.last_error_code = 'WEBSUB_STALE'
  and exists (
    select 1
    from public.jobs j
    where j.job_type = 'YOUTUBE_ENRICH_VIDEO'
      and j.payload ->> 'sourceIdentityId' = sh.source_identity_id::text
      and j.payload #>> '{notification,discoveredBy}' = 'UPLOADS_PLAYLIST_FALLBACK'
      and j.created_at >= coalesce((
        select max(cs.verified_at)
        from public.connector_subscriptions cs
        where cs.source_identity_id = sh.source_identity_id
          and cs.provider = 'YOUTUBE_WEBSUB'
          and cs.verified_at is not null
      ), '-infinity'::timestamptz)
  );

update public.source_health
set health_state = 'HEALTHY',
    consecutive_failures = 0,
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
where last_error_code = 'WEBSUB_STALE';

update public.youtube_channel_state y
set next_fallback_check_at = greatest(coalesce(y.next_fallback_check_at, now()), now() + interval '6 hours'),
    updated_at = now()
from public.source_health sh
where sh.source_identity_id = y.source_identity_id
  and sh.health_state = 'HEALTHY'
  and sh.last_error_code is null;

commit;
