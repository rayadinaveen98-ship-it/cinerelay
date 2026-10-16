# Official-article typed entity review — follow-up

Fixes a confirmed gap: official Netflix Tudum WEB_ARTICLE items can be ingested and have jobs marked SUCCEEDED but get no canonical event when they cannot resolve against CineRelay's entity catalogue.

## Behavior
- In first-party WEB_ARTICLE from approved owner-operated OTT, studio, project or film identities, when the resolver fails, conservatively extract **only explicitly named series with numbered seasons**.
- Create a `SERIES` candidate in the **existing entity_discovery_candidates** and evidence tables, `status=PENDING`, metadata `reviewRequired=true`. No new entity, publication, verified event, OTT premiere date, or notification.
- A documentary *about* a person is not necessarily titled after that person. It remains in existing unresolved operator review, with `MANUAL_TITLE_REVIEW` status.
- New **operator-authenticated** `officialArticleReviewQueue` action on `cinerelay-review-api` returns recent unresolved official articles with typed suggestion if present; no new public exposure.
- Duplicate processing of same candidate/raw-item pair remains idempotent under existing DB constraint.
- User-approved resolution and candidate promotion remain controlled by existing operator actions; no bypass of source/evidence policy.

## Gates
- Deno tests for explicit season headings, ambiguous documentary headlines, non-official sources and uncertain titles.
- Edge typecheck, full CI on PR.
- Deploy review API and processing worker separately after CI; verify unauthorized queue request = HTTP 401.
- Backfill the two known Netflix Tudum raw items only under deliberate operator-safe conditions, without resending old news or notifications. For "The Diplomat Season 4", create pending series candidate; keep Natalee Holloway documentary article manual-only.
- Full Android APK remains v0.2.6, unchanged.
