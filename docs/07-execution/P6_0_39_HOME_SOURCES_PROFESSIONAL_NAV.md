# P6.0.39 — Home + Sources Professional Navigation

Status: **IMPLEMENTED / HOSTED BACKEND ACTIVE / ANDROID CI GREEN / PHYSICAL UI REVIEW NEXT**

Date: 2026-09-20

## Intent

P6.0.39 pauses count-driven source expansion and reorganizes the existing 57-source newsroom into a more professional, source-oriented Android experience.

The product contract for this slice is:

- Home remains the aggregated newsroom feed.
- Sources becomes the dedicated official-channel directory.
- Sources visibly communicate recent activity without pretending that activity is user-specific unread state.
- Tapping a source opens a source-scoped newsroom feed using the same evidence/noise rules as Home.
- YouTube/X remains a platform-level switch, but the control is compact and icon-only.
- X remains architecturally supported but operationally dormant.

## Android navigation

A new bottom-navigation overlay exposes:

- Home
- Sources
- Radar
- Alerts

`Sources` currently uses the existing FOLLOWING tab identity under the hood so the proven V0.2 app shell did not need a risky navigation rewrite. The dedicated Sources workspace visually replaces the old Following surface for this slice.

Implementation:

- `apps/android/app/src/main/java/com/cinerelay/app/MainActivity.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/ui/P6039BottomNavOverlay.kt`

## Sources directory

The Sources workspace shows the complete active official source mesh for the selected platform, including sources with no recent post.

Each source row exposes:

- source name
- platform handle where available
- source role (`Production`, `OTT`, `Music`, `Media`)
- recent-activity state
- a green activity dot and `<n> new` when the source has tracked provider activity in the last 24 hours

Directory ordering is recent-activity first, then name.

### Meaning of `new`

P6.0.39 deliberately defines `new` as:

> provider-published source activity within the rolling last 24 hours

It is **not** a per-user unread/read count.

The source API uses `published_at` when supplied by the provider and falls back to CineRelay `first_seen_at` / `created_at` only when needed.

This keeps V1 deterministic and avoids implying per-user read-state tracking that does not exist yet.

Implementation:

- `supabase/functions/cinerelay-sources-api/index.ts`
- `apps/android/app/src/main/java/com/cinerelay/app/data/SourcesClient.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/ui/SourcesViewModel.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/ui/SourcesDirectoryV039.kt`

## Source-specific newsroom feeds

Source drill-down is server-scoped, not a client-side filter over whichever items happened to be present in the aggregate Home response.

`cinerelay-newsroom-api` now accepts an optional `sourceIdentityId`.

When supplied, the server:

1. validates the selected platform and active source identity;
2. scopes raw-item selection to that exact identity before pagination;
3. applies the existing newsroom noise filters and duplicate suppression;
4. enriches the selected items with the same canonical event/evidence layer used by Home;
5. returns only that source's content.

When `sourceIdentityId` is omitted, existing Home behavior is unchanged.

Implementation:

- `supabase/functions/cinerelay-newsroom-api/index.ts`
- `apps/android/app/src/main/java/com/cinerelay/app/data/SourcesClient.kt`
- `apps/android/app/src/main/java/com/cinerelay/app/ui/SourcesViewModel.kt`

## Compact platform selector

The previous visible `YouTube | X` segmented control was replaced with one compact floating platform button above bottom navigation.

Behavior:

- collapsed: current platform icon only
- tap: expands to YouTube symbol + X symbol only
- select: changes platform and collapses again
- no platform text labels are required

The same selector is available on Home and Sources.

Implementation:

- `apps/android/app/src/main/java/com/cinerelay/app/ui/NewsroomPlatformOverlay.kt`

## X behavior

X remains intentionally dormant after the earlier provider `HTTP 402 Payment Required` canary.

P6.0.39 does not reactivate X ingestion.

If X is selected in Sources, Android renders a deliberate empty state explaining that no active X sources are currently enabled rather than mixing YouTube rows or fabricating activity.

Hosted state remains:

- active YouTube identities: **57**
- active X identities: **0**

## Hosted backend

Supabase project:

- ref: `dnqaejljfzwhsainpdxb`

Hosted functions for this slice:

- `cinerelay-sources-api` — **ACTIVE v1**, `verify_jwt=false`
- `cinerelay-newsroom-api` — **ACTIVE v8**, `verify_jwt=false`

The guest-readable functions expose shaped public newsroom/source data only. Service-role credentials remain server-side inside the functions and are not shipped to Android.

`supabase/config.toml` explicitly locks the guest-aware auth mode for both functions.

## Hosted live proof

### Sources API

A hosted `pg_net` request to `cinerelay-sources-api` returned HTTP 200.

Snapshot at proof time:

- platform: `YOUTUBE`
- source count: **57**
- sources active in rolling 24h: **21**
- tracked new items in rolling 24h: **54**

The activity count is intentionally live and can change as CineRelay ingests new uploads.

At that snapshot, the highest-activity sources included:

- Aditya Music — 7
- Sony LIV — 6
- Sony Music South — 6
- Sun NXT — 4
- T-Series Telugu — 4

### Exact source-feed isolation

Hosted proof used Geetha Arts identity:

`dca084cf-328f-4c2f-a4ed-4a019361dd03`

A hosted `pg_net` request to `cinerelay-newsroom-api` with this exact `sourceIdentityId` returned HTTP 200.

Observed proof:

- echoed source identity matched the request
- scan count: 27 tracked rows
- 18 rows filtered by normal newsroom noise/duplicate rules
- 9 relevant newsroom cards returned
- every returned card belonged to **Geetha Arts**

This proves source drill-down is isolated before feed pagination and cannot be crowded out by other channels.

## CI / Android proof

Exact implementation head before this documentation-only commit:

`0c7bff9c6dce98ad9d565c8fdd2e13ceb303f04d`

Green runs:

- CineRelay CI #503 — **SUCCESS**
- CineRelay Android Canary CI #169 — **SUCCESS**

CI #503 passed:

- intelligence/domain/connector suite
- database migrations + pgTAP + DB lint
- web console build
- every Edge Function type-check
- `cinerelay-sources-api` type-check
- deployment-native Edge bundle generation

Android #169 passed:

- Firebase Android config validation for `com.cinerelay.app`
- privileged-secret source scan
- Gradle APK build
- Firebase build contract
- monotonic version/update-signing contract
- permanent signer verification
- updateable APK publication

Android build identity:

- versionCode: **200169**
- versionName: `0.2.1-canary.169`
- APK SHA-256: `5ccd158cd052ec2ec8663434622d75ed09a009a10b34a995a65f84cb3e882744`
- permanent signer SHA-256: `17728AEDEE7361B8C7126C3317BD396FEE4DDED3AB8790594FDE5BD7E0123617`
- GitHub artifact ID: `10599588690`

The final APK has also been persisted in ChatGPT Library as:

`/CineRelay/CineRelay-v0.2.1-canary.169-P6.0.39.apk`

## Android update safety

The signing-transition gate was already closed before P6.0.39.

The user physically verified that permanent-signed build #155 installed over permanent-signed #154 **without uninstalling**.

Therefore #169 is an ordinary in-place update candidate over the user's current permanent-signed CineRelay installation because it preserves the permanent signer and increases versionCode.

## Known visual limitation

P6.0.39 uses clean initials-based circular source marks rather than channel artwork.

Reason: the current `sources` / `source_identities` schema does not persist provider avatar/logo URLs. The connector configuration contains provider/channel identifiers and polling metadata, not artwork.

This is intentionally treated as visual polish rather than faking or scraping logos.

## Next — P6.0.40

After physical UI review of #169:

1. refine Sources/Home spacing, hierarchy and card density from device feedback;
2. add real first-party channel artwork through an explicit supported metadata path if practical;
3. add source search and lightweight role/activity filters if the 57-source list needs faster navigation;
4. decide how Following should be integrated inside Sources rather than occupying a separate navigation concept;
5. then resume notifications and configure the separate server-side FCM credential `CINERELAY_FCM_SERVICE_ACCOUNT`;
6. keep additional YouTube source expansion paused until the current newsroom experience is clean and useful.
