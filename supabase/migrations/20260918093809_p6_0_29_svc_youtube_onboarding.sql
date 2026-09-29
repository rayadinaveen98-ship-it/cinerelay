do $$
declare
  v_source_id uuid;
  v_identity_id uuid;
begin
  select id into v_source_id
  from public.sources
  where lower(display_name)=lower('Sri Venkateswara Creations')
    and active=true
  limit 1;

  if v_source_id is null then raise exception 'svc_source_not_found'; end if;

  select source_identity_id into v_identity_id
  from public.attach_source_identity(
    v_source_id,
    'YOUTUBE',
    'UCH-aQJq1vGWCfvgoWXYmkcA',
    '@srivenkateswaracreations3802',
    'https://www.youtube.com/channel/UCH-aQJq1vGWCfvgoWXYmkcA',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object('schemaVersion',1,'discoveryPriority','HIGH'),
    true
  );

  perform public.seed_source_identity_runtime(v_identity_id, null);
end;
$$;
