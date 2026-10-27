# P7 — YouTube Fallback Worker: Verified Artifact / Controlled Release Gate

Date: **2026-10-27**  
Status: **EXACT CI ARTIFACT DEPLOYED AS HOSTED V13 / NATURAL-FALLBACK CHECK PENDING**

## Controlled promotion completed — 2026-10-27

- GitHub Actions staging run [40474971882](https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/40474971882) **succeeded**. It extracted the original artifact ID `12713784991` with strict ZIP and per-file SHA-256 checks, and committed the **exact compiled output**, not a reconstruction, to `ops/p7-stage-pr94-fallback-artifact-20261027`.
- Git blob of staged `index.js` = `f40191866cf31dd18d38663517f6deb849dc8e55` (**exact expected CI blob**); import-map blob = `41e9d0cd4043a28fdb82d343f6379c0b586ca1db`. No host secrets stored in either release file.
- Before deployment, confirmed `youtube-fallback-worker` v12 ACTIVE with `ezbr_sha256=9832f8c83a5f50eb5c025c671761b5a7e19b59d68a9417f559a53b86e689802c` and byte-for-byte verified its stored `index.js`/`deno.json` against rollback branch `ops/p7-youtube-fallback-v12-rollback-20261027`.
- Deployed **only** `youtube-fallback-worker` and immediately read it back from Supabase. Hosted **v13 ACTIVE**, `ezbr_sha256=1dc066dbe9a0f483ab23c3629c0969315ab3c126fa4227f7a7a5f817e79c79f1`, verify_jwt=false unchanged, and hosted `index.js` / `deno.json` **exactly equal** to staged artifact.
- Deployment recorded at `2026-10-27T08:40:30.588Z`. The 08:40 UTC natural poll was before v13 became active, so the first post-deployment natural worker cycle must be measured separately.
- At 08:41 UTC, 150 sources retained raw `DEGRADED/WEBSUB_MISSED_DELIVERY`, 35 `HEALTHY`, none had `last_fallback_check_at` after the v13 timestamp yet. **Do not call health recovery verified until a natural cycle runs.**
- This release changes WebSub-only fallback **health reporting semantics**, not YouTube upload discovery frequency or subscription traffic. Scheduler v17 (28 checks/tick) remains independently deployed. Neither Android nor event catalogue was changed.

## Required remaining acceptance

1. Verify at least one 28-channel natural cycle **after** v13 deployment: 28 successful checks, no provider/API errors, scheduler HTTP 200/no timeout.
2. Verify some sources previously carrying the WebSub-only code now show `HEALTHY` **with `WEBSUB_MISSED_DELIVERY` retained**; never blanket clear warnings. Distinguish direct provider errors and `FALLBACK_WINDOW_GAP` from accelerator-only status.
3. Confirm no surge of duplicate enrichment jobs, canonical events, unexpected push activity or quota spending; inspect 24-hour budget/reserve at natural boundaries.
4. Independent official-published-ID versus ingested-ID checks still needed. Do not infer perfect completeness or real-time notification delivery.
5. If a new error emerges, redeploy the exact preserved v12 `index.js` and `deno.json`, verify hosted read-back, and investigate. Avoid resetting database states.
  
Related: [PR #94](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/94), [WebSub reliability issue #93](https://github.com/rayadinaveen98-ship-it/cinerelay/issues/93), PMV1 [PR #92](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/92).

## Why

Live Supabase's `youtube-fallback-worker` still contains older compiled `decideFallbackHealth` semantics that persist `source_health=DEGRADED` after successful uploads-playlist discovery of a WebSub-missed upload. The repository's shared connector code and planning tests use the later split: authoritative discovery is HEALTHY while the specific `WEBSUB_MISSED_DELIVERY` diagnostic remains visible; `FALLBACK_WINDOW_GAP` still degrades.

This **does not** prove WebSub provider delivery is working. It only fixes a mismatch in how that partial-failure status is represented. The existing `source_effective_health` projection already separates effective polling from accelerator warning.

## Exact validated deploy candidate

| Input | Pinned value |
| --- | --- |
| Repo / branch | `rayadinaveen98-ship-it/cinerelay` / `phase7/youtube-fallback-bundle-contract-20261027` |
| CI head commit | `730ecd8bcab03da23e54beaff1c9340261ae3f30` |
| CI run | [40460764760](https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/40460764760) — completed success |
| CI-generated deployment-native artifact name | `cinerelay-edge-deploy-bundle` |
| GitHub Actions artifact ID | `12713784991` |
| GitHub artifact ZIP SHA-256 | `af1aa89d5d756e8fa96f359e818cb99f69f7fd1b14e0d23bab43ce11132bf5c4` |
| Extracted `youtube-fallback-worker/index.js` SHA-256 | `8b5d0eac26cb4259b0ea0a60c7b62b054e9d031001614d6f1a1e6408326a4c89` |
| Extracted `youtube-fallback-worker/deno.json` SHA-256 | `49215872440aad98f4d4f2f38d9ecbb5b5919ee01fa577599f3a3bffd7c512b2` |
| Artifact expiry | 2026-11-03 (GitHub may automatically expire it) |
| CI gate | Explicit `Verify deployment-native YouTube fallback contract` passed, plus 21 existing YouTube planning canaries and Edge type checks |

The artifact's ZIP SHA-256 was independently verified against the downloaded ZIP bytes, and the contained worker and Deno configuration hashes were calculated independently. **Do not deploy from source with an unpinned, untested build and claim it is this release candidate.**

## Preserved v12 hosted baseline (historical rollback snapshot)

At read-only inspection, Supabase project `dnqaejljfzwhsainpdxb` reported:

- Edge function `youtube-fallback-worker`, deployed version **v12**, `ACTIVE`.
- Hosted `ezbr_sha256`: `9832f8c83a5f50eb5c025c671761b5a7e19b59d68a9417f559a53b86e689802c`.
- Gateway JWT verification disabled, **intentionally**; worker uses its own timing-safe internal secret header. Keep this configuration unchanged.
- Hosted import map uses `@supabase/supabase-js` and bundled dependencies.
- Its compiled decision has `degraded:true` for the WebSub-missed-delivery cases, while the pinned candidate has `degraded:false` and retains the `WEBSUB_MISSED_DELIVERY` code.

Before promotion, export and securely retain all deployed files and their configuration, or confirm an immutable rollback-capable artifact matching **the precise hosted v12 hash**. Do **not** assume an older GitHub main bundle equals deployed v12.

## Release procedure (executed outside this draft PR; natural cycle verified)

1. Freeze scope to this **single Edge function**. Preserve the exact live `get_edge_function` files/config, verify no worker version drift since inspection, and record source-health baseline.
2. Download **artifact ID 12713784991** through authorized GitHub credentials and assert the ZIP SHA-256 and extracted `index.js` / `deno.json` SHA-256 above. Refuse deployment if any mismatch or expiry.
3. Confirm compiled worker has no client-exposed credentials, bundled imports resolve, `verify_jwt=false` remains and internal-secret auth remains unchanged.
4. Deploy **only** `youtube-fallback-worker`, using exact bundled `index.js` plus `deno.json` as its entrypoint/import map. Do not re-run all migrations, restart subscriptions, manually send pushes, alter quota budget or trigger a historical ingest.
5. Compare hosted deployed source hash / version / entrypoint to the newly submitted code, and perform read-only monitoring through at least one natural fallback cycle. Avoid synthetic mass polling that consumes quota.
6. Verify for a source with an already recorded `WEBSUB_MISSED_DELIVERY` warning: a successful authoritative fallback leaves `health_state=HEALTHY` **and retains the WebSub diagnostic**; `FALLBACK_WINDOW_GAP` remains a genuine degradation; priority scheduling is unchanged.
7. Verify jobs/receipts, actual source successes, missing-video detection, quota and notification queues remain safe. No increase in unintended event count/duplicate fanout.
8. On any unexpected change, immediately restore the preserved hosted v12 bundle/config; compare health/queue state, file a rollback report, and stop. Do not blanket-reset health state to conceal errors.

## Acceptance criteria

- [x] CI builds and behavioral bundle check pass on a pinned commit.
- [x] Exact CI artifact downloaded and SHA256 ZIP / worker / import-map files verified independently.
- [x] Observed hosted-versus-Git difference documented, including an operational fallback path.
- [x] Hosted v12 rollback snapshot explicitly retained in `ops/p7-youtube-fallback-v12-rollback-20261027`.
- [x] Exact pinned worker deployed as Supabase `youtube-fallback-worker` v13 on 2026-10-27.
- [x] Post-deployment version/hash parity checked byte-for-byte; hosted hash `1dc066dbe9a0f483ab23c3629c0969315ab3c126fa4227f7a7a5f817e79c79f1`.
- [x] 08:45 UTC natural cycle confirmed 28 checks/28 HTTP 200, 0 provider errors, and 23 post-v13 polled sources `HEALTHY` with `WEBSUB_MISSED_DELIVERY` warning retained. No real fallback-window gap occurred; its severity remains covered by tests.
- [ ] Independently validate published-video completeness, end-to-end mobile delivery, and one full provider quota day before public PMV beta.

## Natural post-v13 poll: production acceptance — 2026-10-27

At **08:45–08:46 UTC**, the unchanged scheduler v17 invoked the **new v13 fallback worker** for a complete natural 28-source poll.

| Indicator | Verified result |
| --- | ---: |
| YouTube playlistItems.list | 28 calls |
| Provider HTTP errors | **0** |
| Sources reporting post-v13 successful 200 checks | **28** |
| Of those, sources HEALTHY with specific WebSub missed-delivery warning retained | **23** |
| Sources still DEGRADED solely due to WebSub warning among these 28 | **0** |
| Canonical events immediately afterward | **233**, unchanged from pre-cycle |
| Alert deliveries | **0**, unchanged |
| Source-activity deliveries immediately afterward | **1,794**, unchanged |
| YouTube read quota at 08:46 UTC | **569** units |

These aggregate snapshots support a successful one-cycle operational rollout and no observed fanout during that cycle, **not** proof of long-term correctness or complete external upload discovery. No `FALLBACK_WINDOW_GAP` occurred in this particular cycle, so real-gap degradation is covered only by the bundle regression contract, not by this live observation.

Keep [issue #93](https://github.com/rayadinaveen98-ship-it/cinerelay/issues/93) open for WebSub callback delivery coverage and independent missed-publication audits. Continue quota monitoring and physical Android follow-to-notification testing. Do not represent this status-semantic correction as near-real-time ingestion.

## Important constraints

The URL `/functions/v1/youtube-fallback-worker` is a privileged internal endpoint even with JWT verification disabled. Never place `CINERELAY_INTERNAL_ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` or `YOUTUBE_API_KEY` in GitHub issue text, frontend or artifact manifest. Live upload coverage and Android notification timeliness **have not** been fully verified; no real-time reliability marketing claim is approved.
