-- CineRelay C12: non-authorized YouTube public channel activity, expiring and service-only.
-- DRAFT migration, not applied to production. No cinema source/event modifications.
begin;

create table public.creator_intelligence_activity_observations (
 channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
 observed_at timestamptz not null,
 expires_at timestamptz not null,
 subscriber_count numeric(20,0) check (subscriber_count >= 0),
 subscribers_hidden boolean,
 public_video_count numeric(20,0) check (public_video_count >= 0),
 recent_public_uploads jsonb not null default '[]'::jsonb,
 last_updated_at timestamptz not null default now(),
 constraint creator_c12_30day_retention
  check (expires_at > observed_at and expires_at <= observed_at + interval '29 days'),
 constraint creator_c12_uploads_array
  check (jsonb_typeof(recent_public_uploads) = 'array'
     and jsonb_array_length(recent_public_uploads) <= 3),
 constraint creator_c12_hidden_subscriber_redaction
  check (coalesce(subscribers_hidden, false) = false or subscriber_count is null)
);
-- Preserve exact decimal public counters when the server serializes JSON.
-- This view is still service-only and uses caller permissions/RLS.
create view public.creator_intelligence_activity_text with (security_invoker = true) as
 select channel_id, observed_at, expires_at,
        subscriber_count::text as subscriber_count,
        subscribers_hidden, public_video_count::text as public_video_count,
        recent_public_uploads
 from public.creator_intelligence_activity_observations;

create index creator_c12_expiry_idx on public.creator_intelligence_activity_observations(expires_at);

create function public.creator_c12_activity_write_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $guard$
begin
 if new.observed_at > clock_timestamp() + interval '2 minutes'
    or new.observed_at < clock_timestamp() - interval '29 days' then
   raise exception 'creator_c12_observation_outside_policy_window';
 end if;
 if new.expires_at > new.observed_at + interval '29 days'
    or new.expires_at <= new.observed_at then
   raise exception 'creator_c12_invalid_retention';
 end if;
 if exists (
   select 1 from jsonb_array_elements(new.recent_public_uploads) item
   where jsonb_typeof(item) <> 'object'
     or not (item ? 'videoId')
     or (item->>'videoId') !~ '^[A-Za-z0-9_-]{11}$'
     or ((item->>'publishedAt') is not null and (item->>'publishedAt') !~ '^20[0-9]{2}-')
 ) then raise exception 'creator_c12_invalid_public_upload';
 end if;
 new.last_updated_at := clock_timestamp();
 return new;
end;
$guard$;

create trigger creator_c12_activity_write_guard
before insert or update on public.creator_intelligence_activity_observations
for each row execute function public.creator_c12_activity_write_guard();

alter table public.creator_intelligence_activity_observations enable row level security;
revoke all on public.creator_intelligence_activity_observations from public,anon,authenticated;
grant select, insert, update, delete on public.creator_intelligence_activity_observations to service_role;
revoke all on public.creator_intelligence_activity_text from public,anon,authenticated;
grant select on public.creator_intelligence_activity_text to service_role;
revoke all on function public.creator_c12_activity_write_guard() from public,anon,authenticated;

-- Hourly purge, independent of creator-monitoring enablement.
-- Not a public RPC and not a cross-platform data collector.
select cron.schedule(
 'cinerelay-c12-public-activity-ttl',
 '7 * * * *',
 $purge$delete from public.creator_intelligence_activity_observations
        where expires_at <= now();$purge$
);

comment on table public.creator_intelligence_activity_observations is
 'C12 service-only public channel activity evidence: <=29-day expiry and hourly deletion (guarantees under 30 days); never authorizes monitoring or derived metrics.';
commit;
