# Operator article review UI: evidence-first, no guessed nationality

The previous operator manual entity form silently set `primaryLanguage='te'` and `countryCode='IN'` for all new entities, including unrelated global Netflix productions. Those defaults have been removed. Both fields now remain unset unless reviewed and entered deliberately; inputs validate ISO-like 2–3-letter language and 2-letter country strings.

The existing operator-only `officialArticleReviewQueue` action is now visible in the private web-console Sources & ops page under **Movie & series article review**, with a jump link near the top. It lists unresolved first-party `WEB_ARTICLE` items and a pending typed suggestion, where applicable, with original source links and evidence counts.

Operator can open the evidence, check for an existing entity, manually copy a suggestion (never automatically approve), and submit a deliberate audited resolution; the form requires an explanation (>=15 characters) and positive checkbox acknowledgement that reprocessing could publish an event. No language/country or release-date guesses.

Security: uses the existing authenticated operator API, no public endpoint or service-role key in the browser. Backend entity approval semantics remain unchanged; no raw content is published on page load.

Checks: `npm --prefix apps/web run build` plus full CI. Final production UX with a real operator session remains a device/browser acceptance check. No Android APK change.
