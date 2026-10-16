# CineRelay — Evidence-first official-article operator review console

Date: 2026-10-16 IST. Production Supabase `dnqaejljfzwhsainpdxb`.

## Deployment and scope
- PR #49: https://github.com/rayadinaveen98-ship-it/cinerelay/pull/49
- Merged on `main` at `a029ebf3a297d5ac548ed8e8338452b7410dfc01`.
- Existing private operator console built and Cloudflare Pages `main` deployment check reported **SUCCESS**.
- No Android app code, background ingestion, authorization architecture, event publishing, or schema changes.
- One active operator allowlist record exists in `public.operator_users`.

## Fixed
1. Removed incorrect `primaryLanguage:'te'` and `countryCode:'IN'` defaults from the original unresolved-title review form. Those fields are now optional and blank unless the operator verifies them.
2. Wired existing authenticated `officialArticleReviewQueue` API into `apps/web/src/pages/ReviewWorkflow.tsx` via `OfficialArticleReviewPanel.tsx` and typed Zod client in `apps/web/src/lib/review-api.ts`. The link "Jump to official movie & series article review" is available from the Sources & ops top.
3. Operator sees official article source, original link, ingested/published dates (unknown distinct), pending title and format suggestion, evidence count, unverified suggested date when present.
4. Resolution requires opening original evidence, explicit checkbox, audit reason of at least 15 characters, and manual entity selection or verified new title/type. Search for existing entity first; language and territory remain blank if unknown. The action may reprocess/publish **only after operator explicit confirmation**, never on page load.
5. Existing protected API (active operator allowlist) remains the only privileged route; the browser uses publishable key, never service-role or internal secrets.

## Reality check
- SQL equivalent of official queue: **14** unresolved first-party WEB_ARTICLE items; **3** candidates with typed suggestions in `PENDING`: `Aspirants`, `Storm`, `The Diplomat`. All 3 linked canonical event count = 0, no auto approval.
- Read actual official Prime Video India page for **Aspirants Season 3** (series directed by Deepesh Sumitra Jagdish, Hindi drama; article claims streaming), and upcoming **Storm** (Prime Video Original thriller, created/directed by Ajitpal Singh, produced by HRX Films). Netflix Tudum official page verifies **The Diplomat Season 4**; no concrete season 4 premiere date. Evidence URLs are in their original candidate records.
- Unauthenticated POST to `cinerelay-review-api` with `action=officialArticleReviewQueue` returned **401 authentication_required** after merge.
- Active ingestion health **230/230** (184 YOUTUBE / 8 WEB / 38 RSS) remains healthy in post-merge query.
- GitHub PR branch CI: web-console, officiality-review-console, source-discovery-edge, database, Edge, consumer, notification and mobile API checks succeeded. Cloudflare Pages main check succeeded; main workflow runs were still finishing during verification.
- **Not claimed tested:** browsing after an actual email magic-link as the human operator, viewing queue in a real signed-in session, or submitting an audited resolution via the UI. This requires the real operator's session, not synthesized credentials.

## Safety notes and next acceptance
- Do not auto promote known films/series or invent release dates. Cross-check title, type, language, territory and article freshness before any operator approval.
- The already-pending `Storm`, `Aspirants`, `The Diplomat` suggestions are not necessarily published news. Operator review can trigger a fresh content event by calling `resolveReviewItem`.
- When testing with the real operator, sign into the private CineRelay console -> Sources & ops -> Jump to official movie & series article review -> view 14 unresolved entries and 3 typed suggestions -> open original article. This read-only smoke test needs no approval or write action.
