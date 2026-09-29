begin;

do $migration$
declare
  v_source_id uuid;
  v_identity_id uuid;
begin
  select s.id, si.id
    into v_source_id, v_identity_id
  from public.sources s
  join public.source_identities si on si.source_id = s.id
  where s.display_name = 'JioStar — JioHotstar OTT Releases'
    and si.platform = 'WEB'
  order by si.created_at asc
  limit 1;

  if v_identity_id is null then
    return;
  end if;

  update public.source_identities
  set active = false,
      updated_at = now()
  where id = v_identity_id;

  update public.sources
  set active = false,
      notes = concat_ws(
        ' ',
        nullif(notes, ''),
        'P6.0.71 retired this mixed movie/series archive lane after live HTML inspection showed card titles, summaries and links require typed parsing; JioHotstar remains covered by active Tier-1 YouTube identities.'
      )
  where id = v_source_id;

  update public.page_source_state
  set next_check_at = '9999-12-31T00:00:00Z'::timestamptz,
      updated_at = now()
  where source_identity_id = v_identity_id;

  update public.source_health
  set health_state = 'DEGRADED',
      next_due_at = '9999-12-31T00:00:00Z'::timestamptz,
      last_error_code = 'SOURCE_RETIRED_TYPED_PARSER_REQUIRED',
      last_error_message = 'Mixed JioStar entertainment archive retired from generic page polling; typed movie/series parsing is required before reactivation.',
      consecutive_failures = 0,
      updated_at = now()
  where source_identity_id = v_identity_id;
end;
$migration$;

commit;
