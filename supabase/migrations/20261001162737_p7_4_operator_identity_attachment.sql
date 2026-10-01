begin;

create or replace function public.operator_attach_discovered_identity(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_candidate public.source_discovery_candidates%rowtype;
  v_proposal public.source_officiality_proposals%rowtype;
  v_existing public.source_identities%rowtype;
  v_identity public.source_identities%rowtype;
  v_platform text;
  v_platform_identity_id text;
  v_handle text;
  v_connector_type text;
  v_poll_class text;
  v_access_mode text;
  v_connector_config jsonb;
  v_created boolean := false;
  v_action_id uuid := gen_random_uuid();
  v_key text;
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;

  select * into v_candidate
  from public.source_discovery_candidates
  where id = p_candidate_id
  for update;
  if v_candidate.id is null then raise exception 'source_candidate_not_found'; end if;
  if v_candidate.status <> 'APPROVED' then raise exception 'candidate_must_be_approved_before_attachment'; end if;
  if v_candidate.discovery_method <> 'OFFICIAL_LINK' then raise exception 'attachment_requires_official_link_candidate'; end if;

  select * into v_proposal
  from public.source_officiality_proposals
  where candidate_id = p_candidate_id
    and status = 'OPEN'
  for update;
  if v_proposal.candidate_id is null then raise exception 'open_officiality_proposal_required'; end if;
  if v_proposal.proposal_type <> 'ADD_IDENTITY_TO_EXISTING_SOURCE' then
    raise exception 'proposal_not_eligible_for_identity_attachment';
  end if;
  if v_proposal.matched_source_id is null then raise exception 'matched_source_required'; end if;
  if not coalesce((v_proposal.rationale->>'ownershipSelfMatch')::boolean, false) then
    raise exception 'ownership_self_match_required';
  end if;
  if not exists (
    select 1 from public.sources s
    where s.id = v_proposal.matched_source_id and s.active = true
  ) then raise exception 'matched_source_not_active'; end if;

  v_key := nullif(btrim(coalesce(v_candidate.metadata->>'platformIdentityKey', '')), '');

  case v_candidate.candidate_kind
    when 'INSTAGRAM_PROFILE' then
      if v_key is null or v_key !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'invalid_instagram_identity_key'; end if;
      v_platform := 'INSTAGRAM';
      v_handle := lower(v_key);
      v_platform_identity_id := null;
      v_connector_type := 'INSTAGRAM_BUSINESS_DISCOVERY';
      v_poll_class := 'NORMAL_60M';
      v_access_mode := 'API';
      v_connector_config := jsonb_build_object('p7Attached', true, 'activationPolicy', 'EXPLICIT_OPERATOR');

    when 'THREADS_PROFILE' then
      if v_key is null or v_key !~ '^[A-Za-z0-9._]{1,64}$' then raise exception 'invalid_threads_identity_key'; end if;
      v_platform := 'THREADS';
      v_handle := lower(v_key);
      v_platform_identity_id := null;
      v_connector_type := 'THREADS_PROFILE_API';
      v_poll_class := 'NORMAL_60M';
      v_access_mode := 'API';
      v_connector_config := jsonb_build_object('p7Attached', true, 'activationPolicy', 'EXPLICIT_OPERATOR');

    when 'X_PROFILE' then
      if v_key is null or v_key !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'invalid_x_identity_key'; end if;
      v_platform := 'X';
      v_handle := lower(v_key);
      v_platform_identity_id := null;
      v_connector_type := 'X_API_V2';
      v_poll_class := 'ACTIVE_15M';
      v_access_mode := 'API';
      v_connector_config := jsonb_build_object('p7Attached', true, 'activationPolicy', 'PROVIDER_REENABLE_REQUIRED');

    when 'YOUTUBE_CHANNEL' then
      if v_key is null or v_key !~ '^UC[A-Za-z0-9_-]{22}$' then
        raise exception 'youtube_channel_id_resolution_required';
      end if;
      v_platform := 'YOUTUBE';
      v_handle := null;
      v_platform_identity_id := v_key;
      v_connector_type := 'YOUTUBE_WEBSUB';
      v_poll_class := 'PUSH';
      v_access_mode := 'WEBHOOK';
      v_connector_config := jsonb_build_object('p7Attached', true, 'activationPolicy', 'EXPLICIT_OPERATOR');

    when 'PUBLIC_WEB' then
      v_platform := 'WEB';
      v_handle := null;
      v_platform_identity_id := null;
      v_connector_type := 'FIRST_PARTY_HTML';
      v_poll_class := 'COLD_6H';
      v_access_mode := 'PUBLIC_WEB';
      v_connector_config := jsonb_build_object('p7Attached', true, 'activationPolicy', 'PARSER_PROFILE_REQUIRED');

    else
      raise exception 'candidate_kind_not_attachable';
  end case;

  perform pg_advisory_xact_lock(hashtextextended(
    'source-identity:' || v_platform || ':' || coalesce(v_platform_identity_id, v_candidate.normalized_url), 0
  ));

  select * into v_existing
  from public.source_identities si
  where (v_platform_identity_id is not null and si.platform = v_platform and si.platform_identity_id = v_platform_identity_id)
     or si.canonical_url = v_candidate.normalized_url
  order by (si.canonical_url = v_candidate.normalized_url) desc, si.active desc, si.updated_at desc
  limit 1
  for update;

  if v_existing.id is not null then
    if v_existing.source_id <> v_proposal.matched_source_id then
      raise exception 'source_identity_owned_by_other_source';
    end if;
    v_identity := v_existing;
  else
    select si.source_identity_id, si.created
      into v_identity.id, v_created
    from public.attach_source_identity(
      v_proposal.matched_source_id,
      v_platform,
      v_platform_identity_id,
      v_handle,
      v_candidate.normalized_url,
      v_connector_type,
      v_poll_class,
      v_access_mode,
      v_connector_config,
      false
    ) si;

    select * into v_identity
    from public.source_identities
    where id = v_identity.id;
  end if;

  update public.source_discovery_candidates
  set status = 'PROMOTED',
      promoted_source_identity_id = v_identity.id,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      metadata = metadata || jsonb_build_object(
        'p7AttachmentActionId', v_action_id,
        'p7AttachmentState', case when v_identity.active then 'EXISTING_ACTIVE' else 'ATTACHED_INACTIVE' end,
        'p7AttachmentSourceId', v_proposal.matched_source_id
      ),
      updated_at = now()
  where id = p_candidate_id;

  update public.source_officiality_proposals
  set status = 'RESOLVED',
      resolved_at = now(),
      rationale = rationale || jsonb_build_object(
        'resolution', case when v_created then 'ATTACHED_INACTIVE' else 'ATTACHED_EXISTING_SAME_SOURCE' end,
        'resolvedByActionId', v_action_id,
        'resolvedSourceIdentityId', v_identity.id,
        'activationAutomatic', false
      ),
      updated_at = now()
  where candidate_id = p_candidate_id;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id,
    'ADMIN',
    p_actor_id,
    'ATTACH_DISCOVERED_SOURCE_IDENTITY',
    'SOURCE_IDENTITY',
    v_identity.id,
    jsonb_build_object('candidate', to_jsonb(v_candidate), 'proposal', to_jsonb(v_proposal)),
    jsonb_build_object(
      'sourceIdentity', to_jsonb(v_identity),
      'candidateId', p_candidate_id,
      'candidateStatus', 'PROMOTED',
      'created', v_created,
      'activationAutomatic', false
    ),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', p_candidate_id,
    'sourceId', v_proposal.matched_source_id,
    'sourceIdentityId', v_identity.id,
    'created', v_created,
    'active', v_identity.active,
    'activationAutomatic', false,
    'activationPolicy', v_connector_config->>'activationPolicy'
  );
end;
$$;

create or replace function public.operator_activate_discovered_identity(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_candidate public.source_discovery_candidates%rowtype;
  v_before public.source_identities%rowtype;
  v_after public.source_identities%rowtype;
  v_action_id uuid := gen_random_uuid();
  v_handle text;
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;

  select * into v_candidate
  from public.source_discovery_candidates
  where id = p_candidate_id
  for update;
  if v_candidate.id is null then raise exception 'source_candidate_not_found'; end if;
  if v_candidate.status <> 'PROMOTED' or v_candidate.promoted_source_identity_id is null then
    raise exception 'candidate_identity_not_attached';
  end if;

  select * into v_before
  from public.source_identities
  where id = v_candidate.promoted_source_identity_id
  for update;
  if v_before.id is null then raise exception 'promoted_source_identity_not_found'; end if;

  if v_before.active then
    return jsonb_build_object(
      'candidateId', p_candidate_id,
      'sourceIdentityId', v_before.id,
      'active', true,
      'alreadyActive', true
    );
  end if;

  if v_before.platform = 'X' then
    raise exception 'x_activation_requires_provider_reenable';
  elsif v_before.platform = 'WEB' then
    raise exception 'public_web_activation_requires_parser_profile';
  elsif v_before.platform = 'YOUTUBE' then
    if v_before.connector_type <> 'YOUTUBE_WEBSUB' or v_before.access_mode <> 'WEBHOOK'
       or v_before.platform_identity_id is null or v_before.platform_identity_id !~ '^UC[A-Za-z0-9_-]{22}$' then
      raise exception 'youtube_identity_not_activation_ready';
    end if;
    update public.source_identities set active = true, updated_at = now() where id = v_before.id;
    perform public.seed_source_identity_runtime(v_before.id, null);
  elsif v_before.platform = 'INSTAGRAM' then
    if v_before.connector_type <> 'INSTAGRAM_BUSINESS_DISCOVERY' or v_before.access_mode <> 'API' then
      raise exception 'instagram_identity_not_activation_ready';
    end if;
    v_handle := lower(regexp_replace(btrim(coalesce(v_before.handle, '')), '^@+', ''));
    if v_handle = '' then raise exception 'instagram_handle_required'; end if;
    update public.source_identities set active = true, updated_at = now() where id = v_before.id;
    perform public.register_instagram_business_source(v_before.id, v_handle, 'instagram-business-discovery-v1');
  elsif v_before.platform = 'THREADS' then
    if v_before.connector_type <> 'THREADS_PROFILE_API' or v_before.access_mode <> 'API' then
      raise exception 'threads_identity_not_activation_ready';
    end if;
    v_handle := lower(regexp_replace(btrim(coalesce(v_before.handle, '')), '^@+', ''));
    if v_handle = '' then raise exception 'threads_handle_required'; end if;
    update public.source_identities set active = true, updated_at = now() where id = v_before.id;
    perform public.register_threads_profile_source(v_before.id, v_handle, 'threads-profile-v1');
  else
    raise exception 'identity_platform_not_activation_supported';
  end if;

  select * into v_after from public.source_identities where id = v_before.id;

  update public.source_discovery_candidates
  set metadata = metadata || jsonb_build_object(
        'p7ActivationActionId', v_action_id,
        'p7AttachmentState', 'ACTIVE'
      ),
      updated_at = now()
  where id = p_candidate_id;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id,
    'ADMIN',
    p_actor_id,
    'ACTIVATE_DISCOVERED_SOURCE_IDENTITY',
    'SOURCE_IDENTITY',
    v_after.id,
    to_jsonb(v_before),
    to_jsonb(v_after),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', p_candidate_id,
    'sourceIdentityId', v_after.id,
    'platform', v_after.platform,
    'active', v_after.active,
    'alreadyActive', false
  );
end;
$$;

revoke all on function public.operator_attach_discovered_identity(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.operator_attach_discovered_identity(uuid,uuid,text)
  to service_role;

revoke all on function public.operator_activate_discovered_identity(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.operator_activate_discovered_identity(uuid,uuid,text)
  to service_role;

commit;
