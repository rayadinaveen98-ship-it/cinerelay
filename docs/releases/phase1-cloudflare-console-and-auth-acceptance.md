# CineRelay Phase 1 — Cloudflare operator console release and acceptance

Status on 16 October 2026: `cinerelay-review-api` v7 is ACTIVE in production and the Sources & ops pending-catalogue UI is merged into `main` (PR #64). The repository locks the web console to **Cloudflare Pages/static hosting** (`apps/web/README.md`). A real Cloudflare Pages project URL, deployment mode and current production commit have **not** been established from the available connected services. Do not claim the UI is live solely from GitHub CI success.

## Identify the existing Cloudflare Pages project (do not create duplicates)

1. In the Cloudflare dashboard, open **Workers & Pages** and look for the CineRelay private console project.
2. Inspect its *Deployments* for the latest successful production commit (at least `e32c335a12da05cc4d3652d6d4eb54b8b37a958f`).
3. If the project is **Git-connected**, verify GitHub repository `rayadinaveen98-ship-it/cinerelay`, production branch `main`, root `apps/web`, build `npm install && npm run build`, output `dist`, and environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use the existing Git integration. Do not change it to a new deployment method.
4. If the existing project was created through **Direct Upload**, build the exact reviewed `main` commit to `apps/web/dist` (the CineRelay CI already produces `cinerelay-web-console-dist`) and deploy to the existing Pages project through its pre-existing secure release path or documented Wrangler Pages command. Do not invent a project name or expose an API token in a chat.
5. If no project exists, set up **one** Cloudflare Pages project using the Git integration and the documented build settings; confirm the target account and the intended URL before publishing.
6. Test deep links: `/`, `/feed`, `/sources`, `/health`, then refresh the browser. The static artifact includes `_redirects` and `_headers`.

## Security and operator acceptance

- The private review backend uses bearer-token validation via Supabase Auth followed by an active `operator_users` allowlist check. The frontend contains only the publishable browser key. Neither sign-in alone nor an arbitrary user ID is operator authorization.
- The `phase1-protected-review-api-smoke.yml` GitHub Action tests live HTTP 401 for missing/invalid bearer, 405 for GET, and 204 for OPTIONS. This is a **negative security contract only**, with zero privileged credentials and no catalogue writes.
- An operator must sign in via the configured Supabase magic link and open **Sources & ops → Pending movie & series catalogue**. Check all 18 live pending suggestions (15 movie, 3 series at last audit). Ten promotional movie strings should be marked for cleanup; eight others require evidence review. Counts may change as intake continues.
- Open the retained original source for several YouTube, RSS, and official WEB candidates; verify that a company profile link is *not* accepted as a producer original post.
- In **Official article & producer leads**, use an authentic eligible original company post only, with the operator attestation, and confirm its status stays `NEEDS_PRIMARY_SOURCE_REVIEW`. Do not mock an operator session or submit invented evidence.
- Confirm an authenticated account **without** an active operator allowlist row gets HTTP 403. The secretless CI smoke cannot prove this; it requires a legitimate nonoperator test session.
- Before/after snapshots must preserve candidate approvals, canonical events, alerts, and source evidence unless a separately audited operator review explicitly changes them.

## Evidence and publishing rules

- Unflagged text is not proof of a valid movie title.
- `Aspirants`, `Storm` (working title), `The Diplomat` remain pending with one owner each; producer leads do not count toward independent ownership.
- Do not promote 10 flagged titles, infer missing release dates or countries, or republish historical archive items as breaking news.
- A signed-in browser check and independently sourced owner corroboration are still outstanding; passing CI cannot substitute for them.

References: [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/) and [Cloudflare Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
