begin;

alter table public.push_delivery_targets
  add constraint push_delivery_targets_lease_pair_strict_check
  check (
    (status = 'LEASED' and lease_token is not null and leased_until is not null)
    or
    (status <> 'LEASED' and lease_token is null and leased_until is null)
  );

commit;
