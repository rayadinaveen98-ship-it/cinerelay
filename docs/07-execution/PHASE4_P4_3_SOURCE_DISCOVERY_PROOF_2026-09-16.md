# Phase 4 P4.3 — Curated Source Discovery Hosted Proof

Date: 2026-09-16

## Result

P4.3's candidate/evidence/review architecture is implemented, CI-green, migrated to hosted Supabase, and production-verified with a real first-party entertainment candidate.

The central safety contract is proven:

> `APPROVED` means reviewed for a future onboarding decision. It does not create a trusted source, create a source identity, or assign an authority tier.

P4.3 remains a stacked draft behind P4.2/P4.1. The source-discovery console UI is implemented on the branch but is not promoted to the production `main` web console while the parent Phase-4 PRs remain intentionally unmerged.

## Branch / PR

- branch: `phase-4/source-discovery-candidates`
- stacked base: `phase-4/first-party-pages`
- draft PR: `#6 — Phase 4.3: curated source discovery candidates`

## Green engineering gates

Full implementation gate before hosted rollout:

- CineRelay CI `#246`
- run id `35070545393`
- head `81e7e4d7d01178e544109dda85a44a5ea5235876`
- intelligence/connectors: PASS
- web console: PASS
- all Edge functions including `cinerelay-source-discovery-api`: PASS
- deployment-native Edge bundle: PASS
- fresh migrations + pgTAP + DB lint: PASS

Artifacts:

- deployment-native Edge artifact `10436380238`
  - digest `sha256:c0a66893b4d52bd4663438719087cccd6d1af92898a517ed986ab53addf56c04`
- Edge source artifact `10436031432`
  - digest `sha256:aca20604e19654908c7a2966f14aa4886da16b8c3387d20147bc9f148877ff9e`
- web artifact `10435393692`
  - digest `sha256:c6778b63660553c998b4b75617a95b9a8fb09f06b7e9949132273b46ab48c5d8`

Hosted-ledger reconciliation gate:

- CineRelay CI `#248`
- run id `35070824056`
- head `fbe0b9fba5cd3ea2c9fd23074865963b3f6954d6`
- result: PASS

## Database contract

Hosted migration ledger:

`20260916075220_source_discovery_candidates`

Tables:

- `source_discovery_candidates`
- `source_discovery_evidence`

Both are RLS-enabled, have no direct public/anon/authenticated data access, and are service-role-only runtime state.

Candidate state distinguishes discovery from authority. Stored fields include URL/provenance, candidate kind, discovery method, proposed source role, territory/languages, discovery confidence, evidence, review state and audit metadata.

Supported review states:

- `PENDING`
- `REVIEWING`
- `APPROVED`
- `REJECTED`
- `DUPLICATE`
- `PROMOTED` is reserved for a future explicit promotion workflow and cannot be set by the P4.3 review RPC.

Privileged RPCs:

- `submit_source_discovery_candidate(...)`
- `operator_review_source_candidate(...)`

The review RPC accepts only `REVIEWING`, `APPROVED`, `REJECTED`, or `DUPLICATE`, requires an operator actor + reason, writes an `audit_actions` record, and never inserts into `sources` or `source_identities`.

## Operator API / console

Hosted Edge Function:

- `cinerelay-source-discovery-api` v1 ACTIVE
- `verify_jwt=false` is intentional because the function validates the Supabase bearer session itself and then requires an active `operator_users` allowlist row before privileged service-role access.

API workflows:

- bootstrap candidate queue + evidence + exact registry matches;
- submit normalized HTTPS candidate/evidence;
- search existing sources/identities for review context;
- review candidate as reviewing/approved/rejected/duplicate.

There is deliberately no promotion action.

The web console branch adds a source-discovery section inside `Sources & ops` with:

- queue metrics;
- manual candidate submission;
- evidence display;
- exact-registry-match warning;
- mandatory review reason;
- candidate approval/rejection/duplicate review actions;
- explicit `Approve does not promote` language.

## HTTP security canary

Unauthenticated request to the hosted source-discovery API:

- pg_net request id: `5934`
- action: `bootstrap`
- Authorization header: absent
- result: HTTP `401`
- body: `{"error":"authentication_required"}`

This confirms the service-role-backed API is not anonymously exposed.

## Real hosted candidate proof — Netflix Newsroom

Candidate:

**Netflix Newsroom**

Candidate URL:

`https://about.netflix.com/en/newsroom`

Evidence URL:

`https://about.netflix.com/en/news/netflix-brings-fans-its-biggest-south-indian-slate-this-year`

Candidate id:

`60d56c87-518e-4540-846a-f8b8d63b623c`

Candidate metadata:

- kind: `PUBLIC_WEB`
- proposed source role: `OTT_PLATFORM`
- territory: `IN`
- discovery confidence: `0.95`
- evidence records: `1`

### Trusted registry baseline

Before candidate submission/review:

- `sources = 6`
- `source_identities = 6`
- discovery candidates = `0`
- Netflix newsroom identities = `0`

### Candidate submission

Submission created:

- candidate status `PENDING`
- one official evidence record
- no trusted Netflix source identity

### Candidate review

The existing active operator reviewed the candidate as `APPROVED` with an explicit reason.

RPC result explicitly returned:

- `status = APPROVED`
- `sourceCreated = false`
- `authorityAssigned = false`
- `duplicateOfSourceIdentityId = null`

One `REVIEW_SOURCE_CANDIDATE` audit action was created.

### Trusted registry after approval

After approval:

- `sources = 6`
- `source_identities = 6`
- approved Netflix candidates = `1`
- Netflix candidate evidence records = `1`
- Netflix newsroom source identities = `0`
- candidate review audit actions = `1`

This proves candidate approval cannot silently cross the trust boundary into the production source registry.

## P4.3 status

Engineering/backend hosted proof: **PASS**.

Remaining rollout dependency is structural rather than missing P4.3 backend functionality: PR #6 is stacked on P4.2, which is stacked on P4.1. The web UI should receive normal signed-in browser QA after its parent Phase-4 slices become mergeable and the branch can be promoted through the normal chain.

Do not bypass the stack by merging P4.3 directly to `main`.
