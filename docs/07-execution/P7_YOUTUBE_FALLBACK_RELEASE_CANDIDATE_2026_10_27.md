# P7 — YouTube Fallback Worker: Verified Artifact / Controlled Release Gate

Date: **2026-10-27**  
Status: **CI-CANDIDATE-VERIFIED / HOSTED ROLLOUT NOT PERFORMED**  
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

## Current hosted baseline to preserve for rollback

At read-only inspection, Supabase project `dnqaejljfzwhsainpdxb` reported:

- Edge function `youtube-fallback-worker`, deployed version **v12**, `ACTIVE`.
- Hosted `ezbr_sha256`: `9832f8c83a5f50eb5c025c671761b5a7e19b59d68a9417f559a53b86e689802c`.
- Gateway JWT verification disabled, **intentionally**; worker uses its own timing-safe internal secret header. Keep this configuration unchanged.
- Hosted import map uses `@supabase/supabase-js` and bundled dependencies.
- Its compiled decision has `degraded:true` for the WebSub-missed-delivery cases, while the pinned candidate has `degraded:false` and retains the `WEBSUB_MISSED_DELIVERY` code.

Before promotion, export and securely retain all deployed files and their configuration, or confirm an immutable rollback-capable artifact matching **the precise hosted v12 hash**. Do **not** assume an older GitHub main bundle equals deployed v12.

## Required release procedure (not executed in this PR)

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
- [ ] Hosted v12 rollback snapshot explicitly retained for controlled release.
- [ ] Exact pinned worker deployed to hosting (no production action yet).
- [ ] Post-deployment version/hash parity checked.
- [ ] Natural fallback cycle evidence proves health semantics without hiding a WebSub warning.
- [ ] Manual device/relevance and independent published-upload coverage gates still remain for PMV1.

## Important constraints

The URL `/functions/v1/youtube-fallback-worker` is a privileged internal endpoint even with JWT verification disabled. Never place `CINERELAY_INTERNAL_ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` or `YOUTUBE_API_KEY` in GitHub issue text, frontend or artifact manifest. Live upload coverage and Android notification timeliness **have not** been fully verified; no real-time reliability marketing claim is approved.
