begin;

create index if not exists push_delivery_targets_device_registration_idx
  on public.push_delivery_targets (device_registration_id, status, next_attempt_at);

commit;
