# Phase 7 P7.1 — Source Health & Self-Maintenance Foundation

## Goal

Make CineRelay distinguish authoritative source failure from accelerator noise, detect operational drift deterministically, and surface maintenance work without silently changing source trust.

## Scope

- fallback-aware effective health for YouTube sources;
- schedule drift detection when operational timestamps lag behind proven successful checks;
- WebSub accelerator warnings separated from source correctness;
- stale/dead-source detection based on attempts, success age and consecutive failures;
- parser-drift findings for repeatedly failing feed/page sources;
- max-attempt processing jobs surfaced as poison-job findings;
- activity-based poll-class recommendations (proposal only in P7.1);
- source-discovery/trust changes remain operator reviewed;
- security hardening for the public `event_types` reference table and WebSub delivery function search path.

## Trust boundary

P7.1 may create findings and recommendations automatically. It must not silently promote a discovered source into a high-authority tier, change source ownership, or weaken RLS. Existing operator-reviewed source discovery remains authoritative for trust changes.

## Effective health rules

1. `WEBSUB_MISSED_DELIVERY` and `WEBSUB_STALE` are accelerator warnings when a YouTube fallback check succeeded recently and the source has no consecutive failures.
2. A source is only `DEGRADED` for correctness when authoritative polling/enrichment is stale or failing.
3. A source is `STALE` when there has been no authoritative success for 24 hours while the identity remains active.
4. A source is `DEAD` only after repeated failures and a prolonged absence of success; P7.1 reports this and does not auto-retire it.
5. Scheduling timestamps older than recent successful checks are reported as `SCHEDULE_DRIFT` instead of being interpreted as ingestion downtime.

## Poll-class recommendation

Recommendations are based on recent raw-item activity and current poll class:

- frequent recent activity -> `ACTIVE_15M`;
- normal recent activity -> `NORMAL_60M`;
- low recent activity -> `COLD_6H`;
- dormant -> `DAILY`.

The recommendation is advisory in P7.1. Applying it remains an explicit operator action in a later Phase 7 slice.

## Exit gate

- deterministic pgTAP coverage for effective-health and maintenance findings;
- no public access to the maintenance table;
- `event_types` remains publicly readable but non-writable under RLS;
- `record_youtube_websub_delivery` has a fixed search path;
- hosted refresh returns findings that match production state without changing source authority;
- full CI and Android canary remain green.
