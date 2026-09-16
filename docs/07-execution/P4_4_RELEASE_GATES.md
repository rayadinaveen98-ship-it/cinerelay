# P4.4 Release Gates

P4.4 may be considered production-verified only after all of the following are true:

1. CI is green for connector tests, Edge Function type-check/bundle, fresh migrations, pgTAP and DB lint.
2. Hosted migration is applied and security/performance advisors show no new critical issue from the connector state surface.
3. `threads-profile-poll-worker` is deployed without exposing the Meta credential to the browser or database rows.
4. A Meta Threads token with `threads_profile_discovery` is configured server-side.
5. One curated official cinema/OTT/studio Threads profile baselines with zero historical replay.
6. One genuine post-baseline post creates exactly one raw item, one initial revision and one processing job.
7. A later unchanged poll creates no duplicate work.
8. Credential failure is observable as `AUTH_REQUIRED`.
9. Only after the above should the hosted cron heartbeat for `threads-profile-poll` be activated.
