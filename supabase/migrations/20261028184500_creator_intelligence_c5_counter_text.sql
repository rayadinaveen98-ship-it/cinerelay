-- C5 operator dashboard: safe decimal text projection for JSON consumers.
-- Never expose raw creator metrics directly to anon/authenticated roles.
begin;
create view public.creator_intelligence_counter_text
with (security_invoker = true)
as
select
  video_id, observed_at, view_count::text as view_count,
  like_count::text as like_count, comment_count::text as comment_count
from public.creator_intelligence_metric_samples
where expires_at > now()
  and observed_at >= now() - interval '30 days';

revoke all on public.creator_intelligence_counter_text
  from public, anon, authenticated;
grant select on public.creator_intelligence_counter_text to service_role;
comment on view public.creator_intelligence_counter_text is
  'Service-only exact decimal-string projection for 30-day public YouTube observations. No client access and no metrics scoring.';
commit;
