# P6.0.27 — YouTube State Seed Fix

Status: **COMPLETE / HOSTED-PROVEN**

## Problem found during hosted verification

P6.0.26 inserted new `source_identities` inside a data-modifying CTE and then attempted to query `source_identities` from a sibling CTE in the same SQL statement to create `youtube_channel_state` rows.

PostgreSQL executes data-modifying CTEs under the same statement snapshot, so sibling reads do not see the newly inserted table rows. The three YouTube identities were created successfully, but their `youtube_channel_state` rows were absent.

## Fix

Hosted migration: `20260918092154_p6_0_27_youtube_state_seed_fix`

Repository migration: `supabase/migrations/20260918092154_p6_0_27_youtube_state_seed_fix.sql`

The fix seeds state in a separate statement from already-persisted active YouTube identities and is idempotent with `ON CONFLICT (source_identity_id) DO UPDATE`.

## Verification

A hosted fallback invocation after the fix returned exactly:

- due: `3`
- checked: `3`
- discoveredUploads: `0`
- baselineSources: `3`
- gapSources: `0`
- highPrioritySources: `2`

Each source then showed a non-null latest video checkpoint, HEALTHY source state, expected 5m/15m next-check cadence, and zero historical raw-item backfill.

## Lesson locked

For future multi-platform source expansion migrations, do not rely on sibling CTE reads to observe rows inserted by a data-modifying CTE. Either consume `RETURNING` directly or seed dependent state in a subsequent SQL statement.
