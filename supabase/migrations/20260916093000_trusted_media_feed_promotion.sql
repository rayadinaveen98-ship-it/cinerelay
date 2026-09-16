begin;

create or replace function public.operator_promote_media_feed_candidate(
  p_actor_id uuid,
  p_candidate_id uuid,
  p_authority_tier integer,
  p_poll_class text,
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
begin
  if p_actor_id is null then raise exception 'actor_required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if p_authority_tier not in (3, 4) then raise exception 'media_authority_tier_must_be_3_or_4'; end if;
  if v_poll_class not in ('ACTIVE_15M','NORMAL_60M','COLD_6H','DAILY') then
    raise exception 'invalid_media_feed_poll_class';
  end if;

  v_role := case when p_authority_tier = 3 then 'TRADE_MEDIA' else 'GENERAL_MEDIA' end;

  select * into v_before
  from public.source_discovery_candidates
  where id = p_candidate_id
  for update;

  if v_before.id is null then raise exception 'source_candidate_not_found'; end if;
  if v_before.status = 'PROMOTED' then raise exception 'source_candidate_already_promoted'; end if;
  if v_before.status <> 'APPROVED' then raise exception 'source_candidate_must_be_approved'; end if;
  if v_before.candidate_kind <> 'RSS_ATOM' then raise exception 'media_feed_promotion_requires_rss_atom_candidate'; end if;
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
    'Promoted from reviewed source-discovery candidate ' || p_candidate_id::text
  );

  insert into public.source_identities (
    id, source_id, platform, platform_identity_id, handle, canonical_url,
    connector_type, poll_class, access_mode, connector_config, active
  ) values (
    v_identity_id,
    v_source_id,
    'RSS',
    null,
    null,
    v_before.normalized_url,
    'RSS_ATOM',
    v_poll_class,
    'FEED',
    jsonb_build_object(
      'promotedFromCandidateId', p_candidate_id,
      'trustPath', v_role,
      'authorityTier', p_authority_tier
    ),
    true
  );

  perform public.register_feed_source(v_identity_id, v_before.normalized_url, 'feed-parser-v1');

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
    'PROMOTE_SOURCE_CANDIDATE',
    'SOURCE_CANDIDATE',
    p_candidate_id,
    to_jsonb(v_before),
    jsonb_build_object(
      'candidate', to_jsonb(v_after),
      'sourceId', v_source_id,
      'sourceIdentityId', v_identity_id,
      'authorityTier', p_authority_tier,
      'sourceRole', v_role,
      'pollClass', v_poll_class
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
    'feedRegistered', true
  );
end;
$$;

revoke all on function public.operator_promote_media_feed_candidate(uuid,uuid,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.operator_promote_media_feed_candidate(uuid,uuid,integer,text,text)
  to service_role;

comment on function public.operator_promote_media_feed_candidate(uuid,uuid,integer,text,text) is
  'Audited operator-only promotion of an APPROVED RSS media candidate. Authority is intentionally capped to Tier 3/4 and feed registration is atomic with promotion.';

commit;
