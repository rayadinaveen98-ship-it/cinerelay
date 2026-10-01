# P7.1 Implementation Status

Status: implementation in progress on Phase 7 branch.

## Implemented in this slice

- service-owned `source_maintenance_findings` ledger;
- fallback-aware `source_effective_health(...)` projection;
- deterministic `refresh_source_maintenance_findings(...)` refresh;
- WebSub accelerator warnings separated from authoritative fallback health;
- schedule bookkeeping drift findings;
- stale/dead-source findings without automatic retirement;
- repeated parser-failure drift findings;
- exhausted-job / poison-job findings;
- activity-based poll-class recommendations without automatic mutation;
- subscription-expiry findings;
- `event_types` RLS hardening while preserving read-only public reference access;
- fixed search path for `record_youtube_websub_delivery`;
- pgTAP coverage for the P7.1 trust and health contract.

## Not yet claimed

This file does not claim hosted deployment, CI green status, Android release completion, or production automation until those gates are actually verified.
