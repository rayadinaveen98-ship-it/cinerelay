-- CineRelay C19: private 28-day API-verified channel identity review records.
-- DRAFT ONLY. No production writes or import of historic Git snapshots.
begin;
create table public.creator_intelligence_identity_evidence (
 channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
 listed_name text not null check (char_length(btrim(listed_name)) between 1 and 200),
 listed_handle text not null check (listed_handle ~ '^@[^[:space:]/]{3,30}$'),
 official_channel_title text not null check (char_length(btrim(official_channel_title)) between 1 and 200),
 uploads_playlist_id text not null check (
  uploads_playlist_id ~ '^UU[A-Za-z0-9_-]{22}$'
  and uploads_playlist_id='UU'||substring(channel_id from 3)
 ),
 locale text not null check (char_length(locale) between 2 and 20),
 category_provisional text not null check (char_length(category_provisional) between 2 and 100),
 size_tier_provisional text not null check (size_tier_provisional in (
  'NANO_LT10K','MICRO_10K_100K','MID_100K_1M','LARGE_1M_10M','MEGA_10M_PLUS','UNVERIFIED')),
 source_url text not null check (source_url ~ '^https://[^ ]+$'),
 observed_at timestamptz not null,
 expires_at timestamptz not null,
 review_state text not null default 'REVIEW_PENDING' check (review_state='REVIEW_PENDING'),
 monitoring_enabled boolean not null default false check (monitoring_enabled=false),
 metrics_enabled boolean not null default false check (metrics_enabled=false),
 constraint creator_c19_identity_28day_max
  check (expires_at>observed_at and expires_at<=observed_at+interval '28 days')
);
create index creator_c19_identity_expires_idx
 on public.creator_intelligence_identity_evidence(expires_at);
create unique index creator_c19_identity_handle_idx
 on public.creator_intelligence_identity_evidence(lower(listed_handle));

create function public.creator_c19_identity_write_guard()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public
as $guard$
begin
 if new.observed_at>clock_timestamp()+interval '2 minutes'
    or new.observed_at<clock_timestamp()-interval '28 days'
    or new.expires_at<=clock_timestamp() then
  raise exception 'creator_c19_expired_or_unverified_identity';
 end if;
 if new.review_state<>'REVIEW_PENDING' or new.monitoring_enabled or new.metrics_enabled then
  raise exception 'creator_c19_review_only';
 end if;
 return new;
end;
$guard$;
create trigger creator_c19_identity_write_guard
before insert or update on public.creator_intelligence_identity_evidence
for each row execute function public.creator_c19_identity_write_guard();

alter table public.creator_intelligence_identity_evidence enable row level security;
revoke all on public.creator_intelligence_identity_evidence from public,anon,authenticated;
grant select,insert,update,delete on public.creator_intelligence_identity_evidence to service_role;
revoke all on function public.creator_c19_identity_write_guard() from public,anon,authenticated;

select cron.schedule(
 'cinerelay-c19-identity-evidence-ttl','13 * * * *',
 $purge$delete from public.creator_intelligence_identity_evidence
   where expires_at<=now();$purge$
);

comment on table public.creator_intelligence_identity_evidence is
 'C19: service-only, read-only-for-operators official public API identity review; 28-day maximum TTL + hourly cleanup. Never admission, monitoring, metrics or source registry.';
commit;
