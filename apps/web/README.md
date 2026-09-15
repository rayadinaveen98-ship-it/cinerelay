# CineRelay Internal Web Console

Phase 3 turns the previous placeholder into a real React/TypeScript/Vite operator console.

## Security model

- Browser code uses only `VITE_SUPABASE_URL` and a Supabase publishable key.
- Sign-in uses Supabase Auth magic links.
- Authentication is necessary but not sufficient: the authenticated user must also have an active `public.operator_users` row.
- `cinerelay-console-api` validates the bearer token and the operator allowlist server-side before using the service-role client.
- The browser never receives the service-role key or CineRelay internal worker secrets.

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

## Current P3.1 surface

- Supabase Auth sign-in boundary;
- allowlisted operator authorization;
- typed console API client validated with Zod;
- TanStack Router application shell;
- TanStack Query live overview/health refresh;
- Tailwind-based internal UI;
- real backend counts and source-health aggregate metrics.

P3.2 will add the detailed live intelligence feed and filtering.
