begin;

-- P7.2 hosted canary proved that an official Tier-A link establishes relevance,
-- not ownership. Clean the first-pass presentation/metadata and make ownership
-- inference conservative before the recurring scheduler is re-enabled.
update public.source_discovery_candidates
set display_name = case
      when candidate_kind in ('INSTAGRAM_PROFILE','X_PROFILE','THREADS_PROFILE')
        then '@' || regexp_replace(normalized_url, '^https://(?:www\.)?(?:instagram\.com|x\.com|threads\.net)/@?', '', 'i')
      when candidate_kind = 'YOUTUBE_CHANNEL'
        then regexp_replace(normalized_url, '^https://(?:www\.)?youtube\.com/(?:channel/|user/|c/)?', '', 'i')
      when candidate_kind = 'PUBLIC_WEB'
        then regexp_replace(regexp_replace(normalized_url, '^https://', '', 'i'), '/.*$', '')
      else display_name
    end,
    metadata = (metadata - 'suggestedOwnerSourceId' - 'suggestedOwnerSourceName')
      || jsonb_build_object(
        'originLinkOnly', true,
        'trustMutation', 'PROPOSAL_ONLY',
        'discoveryVersion', 'p7.2-direct-link-v2'
      ),
    updated_at = now()
where discovery_method = 'OFFICIAL_LINK'
  and coalesce(metadata->>'discoveryVersion','') like 'p7.2-direct-link-v%';

create or replace function public.source_officiality_proposal_candidates()
returns table (
  candidate_id uuid,
  proposal_type text,
  matched_source_id uuid,
  matched_source_identity_id uuid,
  proposed_authority_tier smallint,
  proposed_source_role text,
  officiality_score numeric(5,4),
  support_count integer,
  distinct_origin_sources integer,
  recommended_action text,
  rationale jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with eligible as (
    select c.*
    from public.source_discovery_candidates c
    where c.discovery_method = 'OFFICIAL_LINK'
      and c.status in ('PENDING','REVIEWING','APPROVED')
  ), origin_stats as (
    select
      c.id as candidate_id,
      count(e.id) filter (where os.authority_tier = 1)::integer as support_count,
      count(distinct os.id) filter (where os.authority_tier = 1)::integer as distinct_origin_sources,
      array_agg(distinct os.id) filter (where os.authority_tier = 1) as origin_source_ids
    from eligible c
    left join public.source_discovery_evidence e
      on e.candidate_id = c.id
     and e.evidence_type = 'OFFICIAL_LINK'
    left join public.sources os
      on os.id::text = e.metadata->>'originSourceId'
     and os.active = true
    group by c.id
  ), derived as (
    select
      c.*,
      coalesce(stats.support_count,0) as support_count,
      coalesce(stats.distinct_origin_sources,0) as distinct_origin_sources,
      stats.origin_source_ids,
      exact_identity.id as exact_identity_id,
      exact_identity.source_id as exact_source_id,
      exact_source.authority_tier as exact_authority_tier,
      exact_source.source_role as exact_source_role,
      origin_source.id as origin_source_id,
      origin_source.authority_tier as origin_authority_tier,
      origin_source.source_role as origin_source_role,
      regexp_replace(lower(coalesce(origin_source.display_name,'')), '[^a-z0-9]+', '', 'g') as source_name_key,
      regexp_replace(lower(coalesce(c.metadata->>'platformIdentityKey','')), '[^a-z0-9]+', '', 'g') as identity_key,
      regexp_replace(
        lower(
          regexp_replace(
            regexp_replace(c.normalized_url, '^https://(?:www\.)?', '', 'i'),
            '/.*$', ''
          )
        ),
        '[^a-z0-9]+', '', 'g'
      ) as domain_key,
      regexp_replace(
        lower(
          split_part(
            regexp_replace(
              regexp_replace(c.normalized_url, '^https://(?:www\.)?', '', 'i'),
              '/.*$', ''
            ),
            '.',
            1
          )
        ),
        '[^a-z0-9]+', '', 'g'
      ) as domain_label_key,
      regexp_replace(
        lower(
          regexp_replace(c.normalized_url, '^.*/', '')
        ),
        '[^a-z0-9]+', '', 'g'
      ) as path_leaf_key
    from eligible c
    left join origin_stats stats on stats.candidate_id = c.id
    left join lateral (
      select si.id, si.source_id
      from public.source_identities si
      where lower(rtrim(si.canonical_url, '/')) = lower(rtrim(c.normalized_url, '/'))
      order by si.active desc, si.updated_at desc
      limit 1
    ) exact_identity on true
    left join public.sources exact_source on exact_source.id = exact_identity.source_id
    left join public.sources origin_source
      on coalesce(stats.distinct_origin_sources,0) = 1
     and origin_source.id = stats.origin_source_ids[1]
  ), scored as (
    select d.*,
      (
        d.distinct_origin_sources = 1
        and d.origin_source_id is not null
        and length(d.source_name_key) >= 5
        and (
          (length(d.identity_key) >= 5 and (
            d.source_name_key like '%' || d.identity_key || '%'
            or d.identity_key like '%' || d.source_name_key || '%'
          ))
          or (length(d.domain_label_key) >= 5 and (
            d.source_name_key like '%' || d.domain_label_key || '%'
            or d.domain_label_key like '%' || d.source_name_key || '%'
          ))
          or (length(d.path_leaf_key) >= 5 and (
            d.source_name_key like '%' || d.path_leaf_key || '%'
            or d.path_leaf_key like '%' || d.source_name_key || '%'
          ))
        )
      ) as ownership_self_match
    from derived d
  )
  select
    d.id,
    case
      when d.exact_identity_id is not null then 'EXACT_IDENTITY'
      when d.ownership_self_match then 'ADD_IDENTITY_TO_EXISTING_SOURCE'
      when d.distinct_origin_sources >= 1 then 'REVIEW_OWNERSHIP'
      else 'REVIEW_NEW_SOURCE'
    end,
    case
      when d.exact_identity_id is not null then d.exact_source_id
      when d.ownership_self_match then d.origin_source_id
      else null
    end,
    d.exact_identity_id,
    case
      when d.exact_identity_id is not null then d.exact_authority_tier::smallint
      when d.ownership_self_match then d.origin_authority_tier::smallint
      else null::smallint
    end,
    case
      when d.exact_identity_id is not null then coalesce(d.proposed_source_role,d.exact_source_role)
      when d.ownership_self_match then coalesce(d.proposed_source_role,d.origin_source_role)
      else null
    end,
    case
      when d.exact_identity_id is not null then 1.0000
      when d.ownership_self_match then least(
        0.9700::numeric,
        greatest(d.confidence, 0.9000::numeric)
          + least(0.0500::numeric, greatest(d.support_count - 1, 0)::numeric * 0.0100::numeric)
      )
      when d.distinct_origin_sources > 1 then least(
        0.8500::numeric,
        greatest(d.confidence, 0.6500::numeric)
          + least(0.1000::numeric, d.distinct_origin_sources::numeric * 0.0200::numeric)
      )
      when d.distinct_origin_sources = 1 then least(0.8000::numeric, greatest(d.confidence,0.7000::numeric))
      else greatest(d.confidence, 0.5500::numeric)
    end::numeric(5,4),
    d.support_count,
    d.distinct_origin_sources,
    case
      when d.exact_identity_id is not null then 'Mark duplicate/reactivation candidate after operator verification; this identity already exists in the registry.'
      when d.ownership_self_match then 'The Tier-A link and destination name/handle/domain self-match. Review adding it as another identity; do not auto-promote authority.'
      when d.distinct_origin_sources >= 1 then 'Tier-A links prove relevance, not ownership. Verify the destination own bio/domain/official markers before assigning it to a source.'
      else 'Evidence is insufficient to assign an owner automatically; review as a possible new source.'
    end,
    jsonb_build_object(
      'candidateUrl', d.normalized_url,
      'candidateKind', d.candidate_kind,
      'candidateConfidence', d.confidence,
      'supportCount', d.support_count,
      'distinctOriginSources', d.distinct_origin_sources,
      'originSourceIds', coalesce(to_jsonb(d.origin_source_ids), '[]'::jsonb),
      'exactRegistryMatch', d.exact_identity_id is not null,
      'ownershipSelfMatch', d.ownership_self_match,
      'trustMutation', 'PROPOSAL_ONLY',
      'proposalVersion', 'p7.2-official-link-v2'
    )
  from scored d;
$$;

revoke all on function public.source_officiality_proposal_candidates()
  from public, anon, authenticated;
grant execute on function public.source_officiality_proposal_candidates()
  to service_role;

select public.refresh_source_officiality_proposals(now());

-- Fresh installs and hosted hardening both end with exactly one recurring scan.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'cinerelay-source-discovery'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'cinerelay-source-discovery',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"source-discovery"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

commit;
