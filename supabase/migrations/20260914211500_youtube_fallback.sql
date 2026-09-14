begin;

alter table public.youtube_channel_state
  add column if not exists next_fallback_check_at timestamptz,
  add column if not exists fallback_gap_count integer not null default 0 check (fallback_gap_count >= 0);

update public.youtube_channel_state
set next_fallback_check_at = coalesce(next_fallback_check_at, now())
where uploads_playlist_id is not null;

create index if not exists youtube_channel_state_fallback_due_idx
  on public.youtube_channel_state (next_fallback_check_at)
  where uploads_playlist_id is not null;

comment on column public.youtube_channel_state.next_fallback_check_at is 'Next safety-net uploads-playlist check. WebSub remains the primary path.';
comment on column public.youtube_channel_state.fallback_gap_count is 'Count of fallback checks where the previous known upload fell outside the returned safety window.';

commit;
