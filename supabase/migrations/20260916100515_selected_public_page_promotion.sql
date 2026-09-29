begin;

create or replace function public.operator_promote_selected_public_page_candidate(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_authority_tier integer,
  p_poll_class text,
  p_parser_profile jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_before public.source_discovery_candidates%rowtype;
  v_after public.source_discovery_candidates%rowtype;
  v_source_id uuid := gen_random_uuid();
  v_identity_id uuid := gen_random_uuid();
  v_action_id uuid := gen_random_uuid();
  v_poll_class text := upper(btrim(coalesce(p_poll_class, '')));
  v_role text;
  v_profile_version text;
  v_item_selector text;
  v_link_selector text;
  v_max_items integer := 50;
  v_min_items integer := 1;
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if p_authority_tier not in (3, 4, 5) then raise exception 'public_page_authority_tier_must_be_3_4_or_5'; end if;
  if v_poll_class not in ('NORMAL_60M','COLD_6H','DAILY') then raise exception 'invalid_public_page_poll_class'; end if;

  if jsonb_typeof(p_parser_profile) <> 'object' then raise exception 'public_page_parser_profile_must_be_object'; end if;
  v_profile_version := nullif(btrim(p_parser_profile ->> 'profileVersion'), '');
  v_item_selector := nullif(btrim(p_parser_profile ->> 'itemSelector'), '');
  v_link_selector := nullif(btrim(p_parser_profile ->> 'linkSelector'), '');
  if v_profile_version is null or length(v_profile_version) > 100 then raise exception 'public_page_profile_version_invalid'; end if;
  if v_item_selector is null or length(v_item_selector) > 500 then raise exception 'public_page_item_selector_invalid'; end if;
  if v_link_selector is null or length(v_link_selector) > 500 then raise exception 'public_page_link_selector_invalid'; end if;

  if p_parser_profile ? 'maxItems' then
    if coalesce(p_parser_profile ->> 'maxItems', '') !~ '^[0-9]{1,3}$' then raise exception 'public_page_max_items_invalid'; end if;
    v_max_items := (p_parser_profile ->> 'maxItems')::integer;
    if v_max_items < 1 or v_max_items > 100 then raise exception 'public_page_max_items_invalid'; end if;
  end if;
  if p_parser_profile ? 'minItems' then
    if coalesce(p_parser_profile ->> 'minItems', '') !~ '^[0-9]{1,3}$' then raise exception 'public_page_min_items_invalid'; end if;
    v_min_items := (p_parser_profile ->> 'minItems')::integer;
    if v_min_items < 1 or v_min_items > v_max_items then raise exception 'public_page_min_items_invalid'; end if;
  end if;
  if p_parser_profile ? 'order' and (p_parser_profile ->> 'order') not in ('NEWEST_FIRST','OLDEST_FIRST') then
    raise exception 'public_page_order_invalid';
  end if;
  if length(coalesce(p_parser_profile ->> 'includeUrlPattern', '')) > 300 then raise exception 'public_page_include_pattern_too_long'; end if;
  if length(coalesce(p_parser_profile ->> 'excludeUrlPattern', '')) > 300 then raise exception 'public_page_exclude_pattern_too_long'; end if;
  if length(coalesce(p_parser_profile ->> 'titleSelector', '')) > 500
     or length(coalesce(p_parser_profile ->> 'summarySelector', '')) > 500
     or length(coalesce(p_parser_profile ->> 'dateSelector', '')) > 500
     or length(coalesce(p_parser_profile ->> 'authorSelector', '')) > 500 then
    raise exception 'public_page_optional_selector_too_long';
  end if;

  v_role := case p_authority_tier
    when 3 then 'TRADE_MEDIA'
    when 4 then 'GENERAL_MEDIA'
    else 'DISCOVERY_ONLY'
  end;

  select * into v_before
  from public.source_discovery_candidates
  where id = p_candidate_id
  for update;

  if v_before.id is null then raise exception 'source_candidate_not_found'; end if;
  if v_before.status = 'PROMOTED' then raise exception 'source_candidate_already_promoted'; end if;
  if v_before.status <> 'APPROVED' then raise exception 'source_candidate_must_be_approved'; end if;
  if v_before.candidate_kind <> 'PUBLIC_WEB' then raise exception 'selected_public_page_promotion_requires_public_web_candidate'; end if;
  if nullif(btrim(coalesce(v_before.display_name, '')), '') is null then raise exception 'source_candidate_display_name_required'; end if;

  if exists (
    select 1 from public.source_identities
    where canonical_url in (v_before.normalized_url, v_before.candidate_url)
  ) then
    raise exception 'source_identity_url_already_registered';
  end if;

  insert into public.sources (
    id, display_name, authority_tier, source_role, territory, languages, active, notes
  ) values (
    v_source_id,
    btrim(v_before.display_name),
    p_authority_tier::smallint,
    v_role,
    v_before.territory,
    coalesce(v_before.languages, '{}'::text[]),
    true,
    'Selected public page promoted from reviewed source-discovery candidate ' || p_candidate_id::text
  );

  insert into public.source_identities (
    id, source_id, platform, platform_identity_id, handle, canonical_url,
    connector_type, poll_class, access_mode, connector_config, active
  ) values (
    v_identity_id,
    v_source_id,
    'WEB',
    null,
    null,
    v_before.normalized_url,
    'FIRST_PARTY_HTML',
    v_poll_class,
    'PUBLIC_WEB',
    jsonb_build_object(
      'parserProfile', p_parser_profile,
      'sourceClass', 'SELECTED_PUBLIC_PAGE',
      'promotedFromCandidateId', p_candidate_id,
      'trustPath', v_role,
      'authorityTier', p_authority_tier
    ),
    true
  );

  perform public.register_page_source(v_identity_id, v_before.normalized_url);

  update public.source_discovery_candidates
  set status = 'PROMOTED',
      promoted_source_identity_id = v_identity_id,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_reason = btrim(p_reason),
      updated_at = now()
  where id = p_candidate_id
  returning * into v_after;

  insert into public.audit_actions (
    id, actor_type, actor_id, action_type, target_type, target_id,
    before_json, after_json, reason
  ) values (
    v_action_id,
    'ADMIN',
    p_actor_id,
    'PROMOTE_PUBLIC_PAGE_CANDIDATE',
    'SOURCE_CANDIDATE',
    p_candidate_id,
    to_jsonb(v_before),
    jsonb_build_object(
      'candidate', to_jsonb(v_after),
      'sourceId', v_source_id,
      'sourceIdentityId', v_identity_id,
      'authorityTier', p_authority_tier,
      'sourceRole', v_role,
      'pollClass', v_poll_class,
      'parserProfileVersion', v_profile_version,
      'sourceClass', 'SELECTED_PUBLIC_PAGE'
    ),
    btrim(p_reason)
  );

  return jsonb_build_object(
    'actionId', v_action_id,
    'candidateId', p_candidate_id,
    'status', 'PROMOTED',
    'sourceId', v_source_id,
    'sourceIdentityId', v_identity_id,
    'authorityTier', p_authority_tier,
    'sourceRole', v_role,
    'pollClass', v_poll_class,
    'parserProfileVersion', v_profile_version,
    'pageRegistered', true
  );
end;
$$;

revoke all on function public.operator_promote_selected_public_page_candidate(uuid,uuid,integer,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.operator_promote_selected_public_page_candidate(uuid,uuid,integer,text,jsonb,text)
  to service_role;

comment on function public.operator_promote_selected_public_page_candidate(uuid,uuid,integer,text,jsonb,text) is
  'Audited operator-only promotion of an APPROVED PUBLIC_WEB candidate onto the hardened page connector. Authority is capped to Tier 3/4/5 and polling to 60 minutes or slower.';

commit;
