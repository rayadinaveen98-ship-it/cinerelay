# P6.0.3 — FrameByNavin Fast Newsroom Direction

Status: DIRECTION LOCKED — implementation next.

## Product correction

CineRelay is primarily an internal intelligence/newsroom tool for FrameByNavin at this stage. The Android app must not wait for canonical entity resolution before surfacing useful source activity.

The backend keeps its strict canonical event/evidence model as the trusted knowledge layer, but the user-facing newsroom gets a separate fast signal projection.

## User-facing signal states

Use four simple states with colored dots:

- GREEN — VERIFIED: official source or strongly confirmed signal.
- YELLOW — DEVELOPING: credible new signal still being enriched/confirmed.
- ORANGE — UNCONFIRMED: useful source activity or report that is not yet verified enough to publish as fact.
- RED — CONFLICT / RUMOR: conflicting claims, explicit rumor, or material that needs caution.

The state may upgrade/downgrade as evidence arrives. The app must show source + timestamp + original link so the creator can judge quickly.

## Fast feed contract

A raw source item may enter the newsroom feed before entity resolution if it passes basic relevance/noise filters. Canonicalization, entity resolution, event classification, evidence merging, summaries, Radar and alerts run asynchronously and enrich the same signal later.

Do not suppress a potentially useful source update merely because entity candidate coverage is missing.

## Freshness target

Primary product target:

- push-capable sources: seconds to ~1 minute where provider support is reliable;
- polling sources: 2–5 minutes target;
- 5 minutes is the normal maximum target for high-priority FrameByNavin sources;
- slower 10–15 minute polling only for low-priority/expensive sources.

The UI must expose source-observed time and CineRelay-ingested time.

## Current hosted reality at lock time

Active source identities: 6 total.

- YouTube: 4 — Mythri Movie Makers, Sithara Entertainments, Haarika & Hassine Creations, Geetha Arts.
- RSS: 1 — The Walt Disney Company.
- Web: 1 — About Amazon India / Prime Video.
- Threads: 0 live sources.
- Instagram: 0 live sources.

Hosted raw items currently come only from YouTube. RSS and Web poll successfully but have not emitted a new raw item into CineRelay since enrollment. YouTube WebSub has not delivered a hosted notification yet; all four channels currently depend on fallback polling.

## Immediate implementation order

1. Add newsroom signal projection over raw items, independent of canonical-event creation.
2. Add relevance/noise filter so library clips/reuploads do not drown current-news signals.
3. Add four-state dot UX and tabs/filters in Android.
4. Restore/verify YouTube WebSub push; keep 2–5 minute fallback polling.
5. Expand official YouTube coverage aggressively for Telugu cinema first, then Indian cinema/OTT/music/trailer channels relevant to FrameByNavin.
6. Bring RSS and first-party Web polling down to high-priority 2–5 minute cadence where reasonable.
7. Activate Instagram/Threads connectors only after real source enrollment/auth proof; expose their raw signals immediately through the same newsroom model.
8. Add trusted trade-media/public-page sources as developing/unconfirmed signals rather than blocking them behind canonical resolution.
9. Evaluate X connector separately; it is not a live production source in the current hosted system.

## Product rule

For FrameByNavin, speed + provenance beats hidden perfection. CineRelay should show the creator what happened, where it came from, how confident we are, and then keep improving that signal in the background.