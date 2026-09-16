# Phase 4 P4.2 — Prime Video Parser Incident and Recovery

Date: 2026-09-16

## Status

**RESOLVED / PRODUCTION RECOVERY PROVEN**

This incident did not create incorrect raw items, revisions, processing jobs, events, or baseline movement. The page connector failed closed exactly as designed.

## Affected source

- source: About Amazon India — Prime Video
- page: `https://www.aboutamazon.in/news/tag/prime-video`
- source identity: `60e520f8-7840-46b9-b09e-d8a507d3c339`
- connector: `FIRST_PARTY_HTML`
- profile: `about-amazon-india-prime-video-v2`
- poll class: `ACTIVE_15M`

## Timeline

### Prior healthy state

At `2026-09-16 07:30:01 UTC`:

- HTTP `200`
- parsed items `12`
- connector run `SUCCEEDED`
- items new `0`
- items changed `0`
- source health `HEALTHY`
- raw items `0`
- gap count `0`

### Fail-closed detection

At `2026-09-16 07:50:01 UTC`:

- HTTP `200`
- accepted parser items `0`
- configured minimum `5`
- connector run `FAILED`
- error `PAGE_SELECTOR_UNDER_MINIMUM`
- source health changed to `PARSER_BROKEN`
- previous baseline remained unchanged
- raw items remained `0`
- revisions remained `0`
- processing jobs remained `0`
- gap count remained `0`

A controlled retry at `08:00:51 UTC` failed in the same way, proving this was not a single transient response.

Additional diagnostic retries were allowed to remain visible in telemetry rather than deleting failure history. The final `drift_count` after recovery is therefore `5`.

## Provider-response investigation

A direct request from the hosted Supabase region using the CineRelay user-agent returned:

- HTTP `200`
- `text/html; charset=utf-8`
- a full server-rendered Next.js document
- approximately `284 KB` of HTML
- `229 results - showing results 1 - 12`
- the expected Prime Video article cards and URLs

Amazon's CloudFront response included an `aa_bot_signal` cookie with `non_browser_user_agent`, but it still returned the complete first-party page. Therefore the incident was not an empty anti-bot response and no browser automation was required.

The stored include URL regex was also inspected byte-for-byte and independently matched the existing official article URL. The profile itself was not the failure source.

## Root cause

The page markup uses image-first accessible anchors. For an article card, the first article link can look like:

```html
<a aria-label="Article title" href="https://www.aboutamazon.in/news/entertainment/...">
  <picture>...</picture>
</a>
```

A later anchor may repeat the same article URL with visible text.

The generic parser already delayed duplicate registration until after a usable title existed, protecting against an image-only duplicate consuming the stable URL. However, it still only treated visible `innerText` as the title. In the current server-rendered markup, the first valid anchor carries its title through the accessibility attribute `aria-label`.

The production investigation also exposed a deployment-history problem: an earlier manual rollout had temporarily pinned `page-poll-worker` to older commit `495c17af5094c4ee86c6abfc19fb25810818eecd`. That older parser registered the stable URL before proving a title existed, making the image-first pattern even more fragile. Production was subsequently returned to a CI-pinned implementation.

## Fix

The generic parser was hardened rather than adding Amazon-specific scraping logic.

`WEB_PAGE_PARSER_VERSION` is now:

`first-party-html-v2`

Title extraction now falls back in this order:

1. configured title node visible text;
2. configured title node `aria-label`;
3. configured title node `title`;
4. link node visible text;
5. link node `aria-label`;
6. link node `title`.

The stable URL is still added to the duplicate set only after a usable title is established.

Regression coverage now includes:

- an image-first anchor with `aria-label` and no visible text;
- a later duplicate visible-text anchor for the same URL;
- an image anchor using the HTML `title` attribute;
- exact two-item extraction with no duplicate.

## CI proof

### Stacked P4.3 branch

CineRelay CI `#251`, run `35072200517`, head:

`ef747536dcdfc390a91f0627983c8f6d88b043a7`

All four jobs passed:

- intelligence/connectors;
- web console;
- Edge Functions, including `page-poll-worker` type-check and deployment bundle;
- fresh database migrations + pgTAP + DB lint.

### Actual P4.2 parent branch

The same parser/test fix was copied into `phase-4/first-party-pages` itself.

CineRelay CI `#253`, run `35072587450`, head:

`fad8b209b405d9663945e99b65359e6b4b48c5bc`

All four jobs passed, so PR #5 independently contains and validates the production fix.

## Production rollout

`page-poll-worker` v4 was deployed from the green parser-v2 implementation.

- status: `ACTIVE`
- `verify_jwt=false` remains intentional because the worker uses CineRelay's independent internal-secret authentication boundary
- parser telemetry: `first-party-html-v2`

## Recovery proof

### Controlled recovery

At `2026-09-16 08:11:07 UTC`:

- connector run `SUCCEEDED`
- HTTP `200`
- items seen `12`
- items new `0`
- items changed `0`
- source health `HEALTHY`
- consecutive failures `0`
- last error cleared
- same baseline item retained
- gap count `0`
- raw items `0`
- revisions `0`
- processing jobs `0`

This proves recovery did not replay the page archive or invent a delta.

### Normal automatic scheduler repeat

The source was then marked due without manually dispatching the worker.

Hosted pg_cron job `6` ran normally:

- cron run id `5951`
- started `2026-09-16 08:15:00.042542 UTC`
- cron status `succeeded`
- return message `1 row`

The resulting page connector run started at `08:15:01.973 UTC` and finished at `08:15:03.250 UTC`:

- status `SUCCEEDED`
- items seen `12`
- items new `0`
- items changed `0`
- error `null`

Final source state after the automatic run:

- health `HEALTHY`
- parser `first-party-html-v2`
- profile `about-amazon-india-prime-video-v2`
- last item count `12`
- same newest stable URL
- gap count `0`
- drift count `5` retained for audit history
- raw items `0`
- revisions `0`
- page processing jobs `0`

## Conclusion

The incident validates the intended reliability contract:

1. a structurally unusable parse failed closed;
2. the existing good baseline was never advanced;
3. no false source item or intelligence was created;
4. investigation used the actual hosted provider representation rather than guessing from a browser page;
5. the correction was made in the generic parser and regression-tested;
6. the actual P4.2 parent branch passed full CI;
7. both controlled and unattended production retries recovered cleanly.

P4.2 still has one unchanged release gate: a genuinely new official About Amazon India Prime Video article published after the established baseline must traverse the exactly-once raw/revision/job path and then repeat without duplicate work.
