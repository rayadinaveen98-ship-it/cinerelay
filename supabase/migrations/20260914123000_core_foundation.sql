begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.event_types (
  code text primary key,
  family text not null,
  default_importance text not null check (default_importance in ('critical','high','normal','low')),
  taxonomy_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.event_types (code, family, default_importance, taxonomy_version)
values
  ('PROJECT_ANNOUNCED','project','high',1),
  ('TITLE_ANNOUNCED','project','high',1),
  ('TITLE_CHANGED','project','high',1),
  ('SEQUEL_OR_SPINOFF_ANNOUNCED','project','high',1),
  ('SEASON_RENEWED','project','high',1),
  ('PROJECT_ON_HOLD','project','high',1),
  ('PROJECT_CANCELLED','project','critical',1),
  ('CAST_ANNOUNCED','people','normal',1),
  ('CREW_ANNOUNCED','people','normal',1),
  ('CAST_EXIT_REPORTED','people','high',1),
  ('CREW_EXIT_REPORTED','people','high',1),
  ('PRODUCTION_LAUNCHED','production','high',1),
  ('SHOOT_STARTED','production','high',1),
  ('SHOOT_SCHEDULE_UPDATE','production','normal',1),
  ('SHOOT_WRAPPED','production','high',1),
  ('BTS_RELEASED','production','normal',1),
  ('MAKING_VIDEO_RELEASED','production','normal',1),
  ('FIRST_LOOK_RELEASED','marketing','high',1),
  ('POSTER_RELEASED','marketing','normal',1),
  ('GLIMPSE_RELEASED','video','high',1),
  ('TEASER_ANNOUNCED','video','high',1),
  ('TEASER_RELEASED','video','high',1),
  ('TRAILER_ANNOUNCED','video','high',1),
  ('TRAILER_RELEASED','video','critical',1),
  ('PROMO_RELEASED','video','normal',1),
  ('SONG_ANNOUNCED','music','normal',1),
  ('SONG_RELEASED','music','high',1),
  ('ALBUM_UPDATE','music','normal',1),
  ('INTERVIEW_RELEASED','publicity','normal',1),
  ('PRESS_MEET_ANNOUNCED','publicity','normal',1),
  ('PRESS_MEET_STARTED_OR_RELEASED','publicity','normal',1),
  ('PRE_RELEASE_EVENT_ANNOUNCED','publicity','high',1),
  ('PRE_RELEASE_EVENT_STARTED_OR_RELEASED','publicity','high',1),
  ('PREMIERE_OR_SCREENING_ANNOUNCED','publicity','normal',1),
  ('THEATRICAL_DATE_ANNOUNCED','release','critical',1),
  ('THEATRICAL_DATE_CHANGED','release','critical',1),
  ('THEATRICAL_RELEASED','release','high',1),
  ('OTT_PLATFORM_ANNOUNCED','release','high',1),
  ('OTT_DATE_ANNOUNCED','release','critical',1),
  ('OTT_DATE_CHANGED','release','critical',1),
  ('OTT_RELEASED','release','high',1),
  ('DELAY_OR_POSTPONEMENT','release','critical',1),
  ('CERTIFICATION_UPDATED','metadata','normal',1),
  ('RUNTIME_UPDATED','metadata','normal',1)
on conflict (code) do nothing;

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('MOVIE','SERIES','SEASON','PERSON','ORGANIZATION','FRANCHISE','EVENT_VENUE','OTHER')),
  canonical_name text not null,
  slug text unique,
  primary_language text,
  country_code text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text,
  alias_type text not null default 'OFFICIAL' check (alias_type in ('OFFICIAL','WORKING_TITLE','TRANSLITERATION','FORMER_TITLE','HASHTAG','ABBREVIATION','OTHER')),
  valid_from timestamptz,
  valid_to timestamptz,
  source_evidence_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists entity_aliases_normalized_idx on public.entity_aliases (normalized_alias);
create index if not exists entity_aliases_trgm_idx on public.entity_aliases using gin (normalized_alias gin_trgm_ops);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.entities(id) on delete set null,
  display_name text not null,
  authority_tier smallint not null check (authority_tier between 1 and 5),
  source_role text,
  territory text,
  languages text[] not null default '{}',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_identities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  platform text not null,
  platform_identity_id text,
  handle text,
  canonical_url text not null,
  connector_type text not null,
  poll_class text not null default 'NORMAL_60M' check (poll_class in ('PUSH','HOT_5M','ACTIVE_15M','NORMAL_60M','COLD_6H','DAILY','MANUAL')),
  access_mode text not null check (access_mode in ('WEBHOOK','API','FEED','PUBLIC_WEB','MANUAL')),
  connector_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists source_identity_platform_id_uq
  on public.source_identities (platform, platform_identity_id)
  where platform_identity_id is not null;
create unique index if not exists source_identity_url_uq on public.source_identities (canonical_url);

create table if not exists public.source_health (
  source_identity_id uuid primary key references public.source_identities(id) on delete cascade,
  health_state text not null default 'HEALTHY' check (health_state in ('HEALTHY','DEGRADED','RATE_LIMITED','AUTH_REQUIRED','PARSER_BROKEN','UNSUPPORTED','DISABLED','BUDGET_EXHAUSTED')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_item_at timestamptz,
  next_due_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_http_status integer,
  last_error_code text,
  last_error_message text,
  rate_limited_until timestamptz,
  auth_expires_at timestamptz,
  subscription_expires_at timestamptz,
  parser_version text,
  updated_at timestamptz not null default now()
);

create index if not exists source_health_next_due_idx on public.source_health (next_due_at) where health_state not in ('DISABLED','UNSUPPORTED');

create table if not exists public.connector_runs (
  id uuid primary key default gen_random_uuid(),
  source_identity_id uuid references public.source_identities(id) on delete set null,
  connector_type text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCEEDED','PARTIAL','FAILED','RATE_LIMITED','CANCELLED')),
  items_seen integer not null default 0,
  items_new integer not null default 0,
  items_changed integer not null default 0,
  requests_made integer not null default 0,
  quota_units numeric not null default 0,
  estimated_cost_microunits bigint not null default 0,
  error_summary text
);

create table if not exists public.raw_items (
  id uuid primary key default gen_random_uuid(),
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  platform_item_id text,
  canonical_url text not null,
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  item_type text not null,
  raw_title text,
  raw_text text,
  normalized_text text,
  language_code text,
  media_type text,
  metadata jsonb not null default '{}'::jsonb,
  content_fingerprint text not null,
  deleted_or_unavailable_at timestamptz,
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists raw_items_platform_item_uq
  on public.raw_items (source_identity_id, platform_item_id)
  where platform_item_id is not null;
create index if not exists raw_items_published_idx on public.raw_items (published_at desc);
create index if not exists raw_items_source_seen_idx on public.raw_items (source_identity_id, first_seen_at desc);

create table if not exists public.raw_item_revisions (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  observed_at timestamptz not null default now(),
  title text,
  text text,
  metadata jsonb not null default '{}'::jsonb,
  content_fingerprint text not null,
  change_kind text not null default 'OBSERVED',
  unique (raw_item_id, content_fingerprint)
);

alter table public.raw_items
  drop constraint if exists raw_items_current_revision_fk;
alter table public.raw_items
  add constraint raw_items_current_revision_fk
  foreign key (current_revision_id) references public.raw_item_revisions(id) on delete set null;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  state text not null default 'PENDING' check (state in ('PENDING','LEASED','SUCCEEDED','RETRY_WAIT','DEAD_LETTER','CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  run_after timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists jobs_due_idx on public.jobs (state, run_after, priority, created_at)
  where state in ('PENDING','RETRY_WAIT');
create index if not exists jobs_expired_lease_idx on public.jobs (lease_expires_at)
  where state = 'LEASED';

create table if not exists public.entity_resolution_results (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 1),
  resolution_state text not null check (resolution_state in ('RESOLVED','AMBIGUOUS','UNRESOLVED')),
  methods jsonb not null default '[]'::jsonb,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists resolution_raw_item_idx on public.entity_resolution_results (raw_item_id, score desc);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid references public.entities(id) on delete set null,
  predicate text not null,
  value_json jsonb not null default '{}'::jsonb,
  qualifiers_json jsonb not null default '{}'::jsonb,
  claim_time timestamptz,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  engine_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_evidence (
  claim_id uuid not null references public.claims(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  raw_item_revision_id uuid references public.raw_item_revisions(id) on delete set null,
  evidence_role text not null default 'PRIMARY' check (evidence_role in ('PRIMARY','CORROBORATING','CONFLICTING','REPEAT')),
  text_span_or_pointer jsonb not null default '{}'::jsonb,
  primary key (claim_id, raw_item_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  primary_entity_id uuid not null references public.entities(id) on delete cascade,
  event_type text not null references public.event_types(code),
  event_schema_version integer not null default 1,
  occurred_at timestamptz,
  announced_at timestamptz,
  detected_at timestamptz not null default now(),
  verification_state text not null check (verification_state in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR')),
  verification_confidence numeric check (verification_confidence is null or (verification_confidence >= 0 and verification_confidence <= 1)),
  priority_score numeric not null default 0,
  priority_band text not null default 'NORMAL' check (priority_band in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED')),
  headline text not null,
  summary text,
  structured_data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED','RETRACTED','SUPPRESSED','NEEDS_REVIEW')),
  supersedes_event_id uuid references public.events(id) on delete set null,
  classifier_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_entity_detected_idx on public.events (primary_entity_id, detected_at desc);
create index if not exists events_type_status_idx on public.events (event_type, status, detected_at desc);

create table if not exists public.event_evidence (
  event_id uuid not null references public.events(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  evidence_role text not null check (evidence_role in ('PRIMARY','CORROBORATING','CONFLICTING','REPEAT')),
  weight numeric not null default 1,
  added_at timestamptz not null default now(),
  primary key (event_id, raw_item_id)
);

create table if not exists public.audit_actions (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('SYSTEM','USER','ADMIN')),
  actor_id uuid,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entities_set_updated_at
before update on public.entities
for each row execute function public.set_updated_at();

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

create trigger source_identities_set_updated_at
before update on public.source_identities
for each row execute function public.set_updated_at();

create trigger source_health_set_updated_at
before update on public.source_health
for each row execute function public.set_updated_at();

create trigger raw_items_set_updated_at
before update on public.raw_items
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.entities enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.sources enable row level security;
alter table public.source_identities enable row level security;
alter table public.source_health enable row level security;
alter table public.connector_runs enable row level security;
alter table public.raw_items enable row level security;
alter table public.raw_item_revisions enable row level security;
alter table public.jobs enable row level security;
alter table public.entity_resolution_results enable row level security;
alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.events enable row level security;
alter table public.event_evidence enable row level security;
alter table public.audit_actions enable row level security;

comment on table public.raw_items is 'Canonical retained metadata/text for one external source item. Third-party binaries are not mirrored by default.';
comment on table public.events is 'Primary user-facing, evidence-backed CineRelay event object.';
comment on table public.jobs is 'Database-backed idempotent work queue. Workers lease bounded batches.';

commit;
