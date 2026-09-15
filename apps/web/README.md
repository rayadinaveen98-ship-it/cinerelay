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
