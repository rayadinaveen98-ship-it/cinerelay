# Operator review: pending suggestions first, archival status clear

This is a UI-only quality improvement following production acceptance replay. The private Sources & ops → Movie & series article review section now places `PENDING` typed title suggestions before manual-only headlines. It labels first-party WEB_ARTICLE entries with unknown, invalid, old (>48 hours) or future publication/discovery timestamps **Historical or undated — identity-only on approval — no new alert**.

The badge uses a pure tested projection of the deployed backend `reviewedArticleHoldReason`; backend remains source of truth and unchanged. No approvals, events, notification changes, database schema change, or APK change.

Regression tests cover valid recent dates, missing/old timestamps, and typed-first sorting without changing underlying data. Actual human authenticated UI acceptance remains separate.
