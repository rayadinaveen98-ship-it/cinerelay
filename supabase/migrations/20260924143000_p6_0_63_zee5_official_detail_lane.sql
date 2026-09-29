begin;

do $migration$
declare
  v_source_id uuid;
  v_identity_id uuid;
begin
  select id into v_source_id
  from public.sources
  where lower(display_name) = 'zee5'
    and authority_tier = 1
    and source_role = 'OTT_PLATFORM'
  order by created_at
  limit 1;

  if v_source_id is null then
    insert into public.sources (
      display_name,
      authority_tier,
      source_role,
      territory,
      languages,
      active,
      notes
    ) values (
      'ZEE5',
      1,
      'OTT_PLATFORM',
      'IN',
      array['hi','te','ta','ml','kn']::text[],
      true,
      'Official ZEE5 first-party provider evidence lane'
    ) returning id into v_source_id;
  end if;

  insert into public.source_identities (
    source_id,
    platform,
    platform_identity_id,
    canonical_url,
    connector_type,
    poll_class,
    access_mode,
    connector_config,
    active
  ) values (
    v_source_id,
    'WEB',
    'zee5:0-0-1z51080127',
    'https://www.zee5.com/global/videos/details/pooja-meri-jaan-trailer/0-0-1z51080127',
    'OTT_PROVIDER_DETAIL',
    'COLD_6H',
    'PUBLIC_WEB',
    jsonb_build_object(
      'providerCode', 'ZEE5',
      'canonicalTitle', 'Pooja Meri Jaan',
      'primaryLanguage', 'hi',
      'releaseType', 'ORIGINAL',
      'parserProfile', 'ZEE5_PREMIERE_TEXT_V1'
    ),
    true
  )
  on conflict (canonical_url) do update
    set source_id = excluded.source_id,
        connector_type = excluded.connector_type,
        poll_class = excluded.poll_class,
        access_mode = excluded.access_mode,
        connector_config = excluded.connector_config,
        active = true,
        updated_at = now()
  returning id into v_identity_id;

  insert into public.page_source_state (
    source_identity_id,
    page_url,
    next_check_at,
    parser_version,
    parser_profile_version,
    updated_at
  ) values (
    v_identity_id,
    'https://www.zee5.com/global/videos/details/pooja-meri-jaan-trailer/0-0-1z51080127',
    now(),
    'ott-provider-detail-v1',
    'ZEE5_PREMIERE_TEXT_V1',
    now()
  )
  on conflict (source_identity_id) do update
    set page_url = excluded.page_url,
        next_check_at = now(),
        parser_version = excluded.parser_version,
        parser_profile_version = excluded.parser_profile_version,
        updated_at = now();

  insert into public.source_health (source_identity_id, health_state, next_due_at, parser_version, updated_at)
  values (v_identity_id, 'HEALTHY', now(), 'ZEE5_PREMIERE_TEXT_V1', now())
  on conflict (source_identity_id) do update
    set health_state = 'HEALTHY',
        next_due_at = now(),
        parser_version = excluded.parser_version,
        updated_at = now();

  insert into public.source_identities (
    source_id,
    platform,
    platform_identity_id,
    canonical_url,
    connector_type,
    poll_class,
    access_mode,
    connector_config,
    active
  ) values (
    v_source_id,
    'WEB',
    'zee5:0-0-1z51080182',
    'https://www.zee5.com/global/videos/details/agadha-trailer/0-0-1z51080182',
    'OTT_PROVIDER_DETAIL',
    'COLD_6H',
    'PUBLIC_WEB',
    jsonb_build_object(
      'providerCode', 'ZEE5',
      'canonicalTitle', 'Agadha',
      'primaryLanguage', 'te',
      'releaseType', 'POST_THEATRICAL',
      'parserProfile', 'ZEE5_PREMIERE_TEXT_V1'
    ),
    true
  )
  on conflict (canonical_url) do update
    set source_id = excluded.source_id,
        connector_type = excluded.connector_type,
        poll_class = excluded.poll_class,
        access_mode = excluded.access_mode,
        connector_config = excluded.connector_config,
        active = true,
        updated_at = now()
  returning id into v_identity_id;

  insert into public.page_source_state (
    source_identity_id,
    page_url,
    next_check_at,
    parser_version,
    parser_profile_version,
    updated_at
  ) values (
    v_identity_id,
    'https://www.zee5.com/global/videos/details/agadha-trailer/0-0-1z51080182',
    now(),
    'ott-provider-detail-v1',
    'ZEE5_PREMIERE_TEXT_V1',
    now()
  )
  on conflict (source_identity_id) do update
    set page_url = excluded.page_url,
        next_check_at = now(),
        parser_version = excluded.parser_version,
        parser_profile_version = excluded.parser_profile_version,
        updated_at = now();

  insert into public.source_health (source_identity_id, health_state, next_due_at, parser_version, updated_at)
  values (v_identity_id, 'HEALTHY', now(), 'ZEE5_PREMIERE_TEXT_V1', now())
  on conflict (source_identity_id) do update
    set health_state = 'HEALTHY',
        next_due_at = now(),
        parser_version = excluded.parser_version,
        updated_at = now();
end;
$migration$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cinerelay-ott-provider-detail';

select cron.schedule(
  'cinerelay-ott-provider-detail',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"ott-provider-detail"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $cron$
);

commit;
