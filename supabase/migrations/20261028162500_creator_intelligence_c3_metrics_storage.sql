-- Creator Intelligence C3: isolated public YouTube video metric storage.
-- Source control ONLY: no cron/DDL applied to production before C3 PR review.
-- Creator statistics must never flow through raw_items, events or push queues.
begin;

create table public.creator_intelligence_channels (
  channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  canonical_title text not null check (char_length(btrim(canonical_title)) between 1 and 200),
  handle text,
  language_code text not null default 'und' check (char_length(language_code) between 2 and 20),
  niche text not null default 'UNCLASSIFIED' check (char_length(niche) between 2 and 100),
  verification_method text not null default 'CHANNELS_LIST'
    check (verification_method in ('CHANNELS_LIST')),
  verified_at timestamptz not null,
  metadata_refreshed_at timestamptz not null default now(),
  review_state text not null default 'REVIEW_PENDING'
    check (review_state in ('REVIEW_PENDING','APPROVED','REJECTED')),
  approved_by uuid references public.operator_users(user_id) on delete restrict,
  approved_at timestamptz,
  monitoring_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_intelligence_approval_guard
    check (not monitoring_enabled or (review_state = 'APPROVED' and approved_by is not null and approved_at is not null))
);

create index creator_intelligence_channels_ready_idx
  on public.creator_intelligence_channels (monitoring_enabled, metadata_refreshed_at desc);
create trigger creator_intelligence_channels_updated_at
before update on public.creator_intelligence_channels
for each row execute function public.set_updated_at();

create table public.creator_intelligence_videos (
  video_id text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel_id text not null references public.creator_intelligence_channels(channel_id) on delete cascade,
  published_at timestamptz not null,
  content_format text not null default 'UNKNOWN'
    check (content_format in ('LONG','SHORT','LIVE','UNKNOWN')),
  discovered_at timestamptz not null default now(),
  metadata_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index creator_intelligence_videos_channel_published_idx
  on public.creator_intelligence_videos (channel_id, published_at desc);

create table public.creator_intelligence_metric_samples (
  video_id text not null references public.creator_intelligence_videos(video_id) on delete cascade,
  observed_at timestamptz not null,
  view_count numeric(20,0) check (view_count >= 0),
  like_count numeric(20,0) check (like_count >= 0),
  comment_count numeric(20,0) check (comment_count >= 0),
  quota_bucket text not null default 'VIDEO_BATCH_STATS'
    check (quota_bucket = 'VIDEO_BATCH_STATS'),
  expires_at timestamptz not null,
  primary key (video_id, observed_at),
  constraint creator_intelligence_nonempty_sample
    check (view_count is not null or like_count is not null or comment_count is not null),
  constraint creator_intelligence_max_sample_retention
    check (expires_at > observed_at and expires_at <= observed_at + interval '30 days')
);
create index creator_intelligence_metric_samples_expiry_idx
  on public.creator_intelligence_metric_samples (expires_at);

-- Hard stop rather than accepting metrics for unreviewed/disabled creators.
-- Validate timestamps to avoid storing fabricated backdated hourly readings.
create function public.creator_intelligence_metric_insert_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $guard$
declare
  v_approved boolean;
  v_published timestamptz;
begin
  select c.monitoring_enabled and c.review_state = 'APPROVED'
    and c.approved_by is not null and c.approved_at is not null,
    v.published_at
  into v_approved, v_published
  from public.creator_intelligence_videos v
  join public.creator_intelligence_channels c on c.channel_id = v.channel_id
  where v.video_id = new.video_id
  for share of v, c;
  if coalesce(v_approved, false) is not true then
    raise exception 'creator_metric_channel_not_operator_approved';
  end if;
  if new.observed_at > clock_timestamp() + interval '5 minutes'
     or new.observed_at < clock_timestamp() - interval '30 days'
     or new.observed_at < v_published then
    raise exception 'creator_metric_observed_at_out_of_range';
  end if;
  if new.expires_at > new.observed_at + interval '30 days'
     or new.expires_at <= new.observed_at then
    raise exception 'creator_metric_retention_out_of_range';
  end if;
  return new;
end;
$guard$;

create trigger creator_intelligence_metric_insert_guard
before insert or update on public.creator_intelligence_metric_samples
for each row execute function public.creator_intelligence_metric_insert_guard();

-- Run by service/pg_cron, not exposed as an authenticated client API.
-- Delete expired metrics AND video metadata outside the 30-day observation
-- horizon. No movie/OTT event, notification or existing source is touched.
create function public.creator_intelligence_purge_expired(p_as_of timestamptz default now())
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $purge$
declare
  v_removed integer := 0;
  v_tmp integer := 0;
begin
  if p_as_of is null then raise exception 'invalid_creator_purge_time'; end if;
  delete from public.creator_intelligence_metric_samples
  where expires_at <= p_as_of;
  get diagnostics v_removed = row_count;

  delete from public.creator_intelligence_videos
  where published_at < p_as_of - interval '30 days'
     or metadata_refreshed_at < p_as_of - interval '30 days';
  get diagnostics v_tmp = row_count;
  v_removed := v_removed + v_tmp;

  -- Public channel names and handles are also Non-Authorized API Data.
  -- Delete stale channel metadata if no successful refresh occurred in 30d.
  -- ON DELETE CASCADE removes its remaining videos/observations as well.
  delete from public.creator_intelligence_channels
  where metadata_refreshed_at < p_as_of - interval '30 days';
  get diagnostics v_tmp = row_count;

  return v_removed + v_tmp;
end;
$purge$;

alter table public.creator_intelligence_channels enable row level security;
alter table public.creator_intelligence_videos enable row level security;
alter table public.creator_intelligence_metric_samples enable row level security;

-- No Data API exposure. Future operator views need a separately audited API,
-- not direct SELECT policies on raw public statistics.
revoke all on table public.creator_intelligence_channels from public, anon, authenticated;
revoke all on table public.creator_intelligence_videos from public, anon, authenticated;
revoke all on table public.creator_intelligence_metric_samples from public, anon, authenticated;
grant select, insert, update, delete on public.creator_intelligence_channels to service_role;
grant select, insert, update, delete on public.creator_intelligence_videos to service_role;
grant select, insert, update, delete on public.creator_intelligence_metric_samples to service_role;

revoke all on function public.creator_intelligence_metric_insert_guard() from public, anon, authenticated;
revoke all on function public.creator_intelligence_purge_expired(timestamptz) from public, anon, authenticated;
grant execute on function public.creator_intelligence_purge_expired(timestamptz) to service_role;

-- pg_cron is already present on CineRelay production. Scheduled purge is
-- independent of creator collection and automatically takes effect if/when
-- this migration is explicitly approved and applied.
select cron.schedule(
  'cinerelay-creator-metric-retention-30d',
  '17 5 * * *',
  $job$select public.creator_intelligence_purge_expired();$job$
);

comment on table public.creator_intelligence_channels is
  'Verified, operator-approved creator analytics identities; fully separate from cinema source identities and film-event processing.';
comment on table public.creator_intelligence_metric_samples is
  'Service-only public YouTube counter observations, max 30-day retention, no private analytics or retroactive hourly reconstruction.';
commit;
