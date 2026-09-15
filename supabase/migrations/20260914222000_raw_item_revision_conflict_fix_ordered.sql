create or replace function public.upsert_raw_item_revision(
  p_source_identity_id uuid,
  p_platform_item_id text,
  p_canonical_url text,
  p_published_at timestamptz,
  p_item_type text,
  p_raw_title text,
  p_raw_text text,
  p_normalized_text text,
  p_media_type text,
  p_metadata jsonb,
  p_content_fingerprint text
)
returns table(raw_item_id uuid, revision_id uuid, is_new boolean, is_changed boolean)
language plpgsql
set search_path = pg_catalog, public, extensions
as $function$
declare
  existing_id uuid;
  existing_fingerprint text;
  existing_revision_id uuid;
  next_revision_id uuid;
  created boolean := false;
  changed boolean := false;
begin
  select id, content_fingerprint, current_revision_id
    into existing_id, existing_fingerprint, existing_revision_id
  from public.raw_items
  where source_identity_id = p_source_identity_id
    and platform_item_id = p_platform_item_id
  for update;

  if existing_id is null then
    insert into public.raw_items (
      source_identity_id, platform_item_id, canonical_url, published_at, item_type,
      raw_title, raw_text, normalized_text, media_type, metadata, content_fingerprint
    ) values (
      p_source_identity_id, p_platform_item_id, p_canonical_url, p_published_at, p_item_type,
      p_raw_title, p_raw_text, p_normalized_text, p_media_type, coalesce(p_metadata, '{}'::jsonb), p_content_fingerprint
    ) returning id into existing_id;
    created := true;
    changed := true;
  else
    changed := existing_fingerprint is distinct from p_content_fingerprint;
    update public.raw_items
    set canonical_url = p_canonical_url,
        published_at = coalesce(p_published_at, published_at),
        last_seen_at = now(),
        raw_title = p_raw_title,
        raw_text = p_raw_text,
        normalized_text = p_normalized_text,
        media_type = p_media_type,
        metadata = coalesce(p_metadata, '{}'::jsonb),
        content_fingerprint = p_content_fingerprint,
        deleted_or_unavailable_at = null
    where id = existing_id;
  end if;

  if changed then
    insert into public.raw_item_revisions (raw_item_id, title, text, metadata, content_fingerprint, change_kind)
    values (existing_id, p_raw_title, p_raw_text, coalesce(p_metadata, '{}'::jsonb), p_content_fingerprint, case when created then 'CREATED' else 'UPDATED' end)
    on conflict on constraint raw_item_revisions_raw_item_id_content_fingerprint_key
    do update set observed_at = excluded.observed_at
    returning id into next_revision_id;

    update public.raw_items set current_revision_id = next_revision_id where id = existing_id;
  else
    next_revision_id := existing_revision_id;
  end if;

  return query select existing_id, next_revision_id, created, changed;
end;
$function$;
