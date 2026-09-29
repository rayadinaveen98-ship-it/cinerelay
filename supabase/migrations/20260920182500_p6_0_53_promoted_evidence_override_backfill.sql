begin;

-- Promotions created before the P6.0.53 scope-hardening migration may have
-- taught broad source scope without persisting the reviewed evidence itself as
-- an item-level assertion. Backfill those exact reviewed evidence rows before
-- broad project scopes are replayed under the safe canonical-title resolver.
insert into public.operator_resolution_overrides (
  raw_item_id,
  entity_id,
  active,
  reason,
  created_by
)
select distinct
  ede.raw_item_id,
  edc.promoted_entity_id,
  true,
  'ENTITY_DISCOVERY_PROMOTION_HARDENING: preserve reviewed evidence at item scope',
  edc.reviewed_by
from public.entity_discovery_candidates edc
join public.entity_discovery_evidence ede on ede.candidate_id = edc.id
where edc.status = 'PROMOTED'
  and edc.promoted_entity_id is not null
on conflict (raw_item_id) do update
  set entity_id = excluded.entity_id,
      active = true,
      reason = excluded.reason,
      created_by = coalesce(excluded.created_by, public.operator_resolution_overrides.created_by),
      updated_at = now();

commit;
