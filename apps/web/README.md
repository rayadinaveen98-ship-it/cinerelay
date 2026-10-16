# CineRelay Internal Web Console

Phase 3 internal/operator UI for the real CineRelay production backend.

## Stack

- React + TypeScript + Vite
- TanStack Router
- TanStack Query
- Tailwind CSS
- Supabase Auth client
- privileged reads through `cinerelay-console-api`

## Security model

- Browser code uses only `VITE_SUPABASE_URL` and a Supabase publishable key.
- Sign-in uses Supabase Auth magic links.
- Authentication is necessary but not sufficient: the authenticated user must also have an active `public.operator_users` row.
- `cinerelay-console-api` validates the bearer token and operator allowlist server-side before using the service-role client.
- The browser never receives the service-role key or CineRelay internal worker secrets.

## Routes

- `/` — production overview
- `/feed` — canonical intelligence feed with official-source evidence
- `/health` — production health summary

## Local setup

Copy `.env.example` to `.env.local` and provide the hosted/local Supabase URL and publishable key.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Static hosting

Locked production target: Cloudflare Pages/static hosting.

Build settings:

- root directory: `apps/web`
- build command: `npm install && npm run build`
- output directory: `dist`
- environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

`public/_redirects` provides SPA route fallback (`/* /index.html 200`) for `/feed`, `/health`, and future client routes.

Vercel may be used only as a temporary preview/verification surface if needed; it is not a required production dependency.

## Production release provenance and validation (Phase 1)

Every `npm run build` emits a public, **non-secret** `dist/release-info.json` containing the console app identifier, Git commit SHA, branch, build timestamp and build origin. Git-connected Cloudflare Pages injects `CF_PAGES_COMMIT_SHA`; GitHub CI injects `GITHUB_SHA`. Local/unverified builds explicitly have `commit: null`. `_headers` makes the manifest non-cacheable.

The GitHub workflow **CineRelay Cloudflare Console Live Release Verification** is designed to confirm actual deployment, not just compilation:

- PRs perform a read-only **nonblocking** probe of the historically recorded address `https://cinerelay-console.pages.dev`. The address was previously reported but its present deployment state is NOT verified.
- After confirming the **existing** Pages project, use **Actions → CineRelay Cloudflare Console Live Release Verification → Run workflow**, select `main`, and enter the real console HTTPS origin. The check requires the live `release-info.json` commit to match the exact checked-out `main` SHA, and checks the SPA routes and CSP response header.
- A Git-connected project originally used branch `phase-3/internal-web-console`; check **Workers & Pages → project → Settings → Builds & deployments → Production branch** and update to `main` only if that is the actual existing project and production branch is still stale. Preserve the current project/domain. Do NOT create a duplicate, switch deployment mode, or assert that a GitHub build is a Cloudflare production deployment.
- A Direct Upload project may have been created independently; do not alter its deployment mode or upload a new artifact until project/account ownership is verified.

The live verifier makes **no write request**, contains no Supabase operator credentials, and never approves, merges or suppresses any movie/series. Operator sign-in and a genuine nonoperator 403 acceptance check remain separate.
