begin;

create index if not exists user_alert_event_preferences_event_type_idx
  on public.user_alert_event_preferences (event_type, user_id);

commit;
