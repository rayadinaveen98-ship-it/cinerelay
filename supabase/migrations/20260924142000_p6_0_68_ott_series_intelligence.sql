create table if not exists public.ott_series_processing_state (
  raw_item_id uuid primary key references public.raw_items(id) on delete cascade,
  parser_version text not null,
  outcome text not null check (outcome in ('NO_SIGNAL','PROMOTED','ERROR')),
  candidate_id uuid references public.entity_discovery_candidates(id) on delete set null,
  entity_id uuid references public.entities(id) on delete set null,
  signal jsonb not null default '{}'::jsonb,
  last_error text,
  processed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ott_series_processing_state enable row level security;
revoke all on table public.ott_series_processing_state from anon, authenticated;
grant select, insert, update, delete on table public.ott_series_processing_state to service_role;

comment on table public.ott_series_processing_state is
  'Idempotency and audit state for strict first-party OTT series release intelligence.';

do $$
declare
  v_definition text;
  v_next text;
begin
  select pg_get_functiondef('public.system_promote_first_party_ott_candidate(uuid)'::regprocedure)
    into v_definition;

  if position('if v_candidate.proposed_entity_type <> ''MOVIE'' or v_candidate.confidence < 0.97 then' in v_definition) = 0 then
    raise exception 'P6.0.68 expected first-party OTT type gate was not found';
  end if;

  v_next := replace(
    v_definition,
    'if v_candidate.proposed_entity_type <> ''MOVIE'' or v_candidate.confidence < 0.97 then',
    'if v_candidate.proposed_entity_type not in (''MOVIE'',''SERIES'') or v_candidate.confidence < 0.97 then'
  );

  if ((length(v_next) - length(replace(v_next,
      'and e.entity_type in (''MOVIE'',''SERIES'',''SEASON'')', ''))) /
      length('and e.entity_type in (''MOVIE'',''SERIES'',''SEASON'')')) <> 2 then
    raise exception 'P6.0.68 expected two canonical entity-type match clauses';
  end if;

  v_next := replace(
    v_next,
    'and e.entity_type in (''MOVIE'',''SERIES'',''SEASON'')',
    'and e.entity_type = v_candidate.proposed_entity_type'
  );

  if position(E'values (\n      ''MOVIE'',\n      v_candidate.proposed_name,' in v_next) = 0 then
    raise exception 'P6.0.68 expected hard-coded MOVIE insert pattern was not found';
  end if;

  v_next := replace(
    v_next,
    E'values (\n      ''MOVIE'',\n      v_candidate.proposed_name,',
    E'values (\n      v_candidate.proposed_entity_type,\n      v_candidate.proposed_name,'
  );

  execute v_next;
end $$;

comment on function public.system_promote_first_party_ott_candidate(uuid) is
  'Promotes Tier-1 first-party OTT MOVIE or SERIES candidates at >=0.97 confidence, preserving same-type canonical matching and retained evidence.';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cinerelay-ott-series-intelligence') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cinerelay-ott-series-intelligence';
  end if;
end $$;

select cron.schedule(
  'cinerelay-ott-series-intelligence',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/ott-series-intelligence-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"limit":25}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $cron$
);
