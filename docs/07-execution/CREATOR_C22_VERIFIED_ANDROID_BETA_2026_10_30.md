# CineRelay C22 — Verified Android beta, not fictitious monitoring
**30 October 2026 · Android beta, no backend deployments**

## Why Verified showed zero in C21
The **94 Discover leads** are unverified external research. The older 20 official-channel API identity observations were removed from Git/app bundles under C19 retention policy; the new C19/C20 protected TTL store/verifier is **not deployed**. C21 accurately displayed zero but did not provide a useful review experience.

## Implemented in C22
- Verified page now makes an **authenticated, operator-only POST** with action `pilotIdentities` to the existing protected Supabase Edge API using the app's existing refreshable Supabase user JWT and publishable key, **never** an embedded service-role or YouTube API credential.
- Strict Android parser rejects a response with more than 20 rows, duplicates, invalid UC→UU identity pairing, a missing source, malformed time bounds, expired >28-day API data, non-pending editorial review or any monitoring/metrics/comparison approval flags. No API identity rows are saved to shared preferences or assets.
- Distinguishes **loading**, **no fresh verified identities**, **401/403 active-operator denial**, **404/503 missing hosted identity service**, and unexpected connectivity failure. Operator can tap **Check again**; a transient outage does not make expired data reappear.
- Under Verified, a separately labeled **UNVERIFIED RESEARCH** section now shows up to six language-diverse provisional leads and a link back to the 94-lead Discover view. These are not approved for a verification job and do not count as verified.
- Existing CineRelay movie-news screens and source registry are unchanged; no background monitoring, metrics, device notifications or YouTube provider calls.
- Android tests and Node contracts run in CI. The signed minified beta updates v0.2.9 and C21 without uninstalling:
  - package `com.cinerelay.app`
  - versionCode **221003** (C21: 221002)
  - versionName `0.2.10-creator-beta.2`
  - permanent release signing certificate validated in GitHub CI
  - artifact `cinerelay-c22-verified-research-beta-apk` with signed `CineRelay-C22-Verified-Research-Beta.apk`

## Strict boundary
An operator-only API *cannot* be made publicly accessible simply to populate Verified. Ordinary signed-in accounts correctly receive restricted-state messaging. C19/C20 have not been deployed or enabled, so **fresh official Verified count may still be zero**, even when C22 is installed; the app won't reuse historical expired API data. The six research examples below Verified are explicitly unverified.

**Remaining approval blockers:** hosted retention and backups/PITR, actual Google project quota and existing source reserve, C2/C10/C11 Git history and PR remnants, editorial approvals, and deploying the C19/C20 protected operator services. No paid staging project or production migration was created in C22.

## Tester steps
Install the new release-signed APK **over** C21 (do not uninstall), sign in, choose **Settings → Creator Intelligence → Verified**. You should see a protected status and a section of unverified research suggestions. Check Discover filters and back navigation. If you are not an active CineRelay operator, the private endpoint will refuse actual data access.
