# Creator Intelligence — broad discovery research (27 October 2026)

**Status: RESEARCH ONLY. These are candidates, NOT onboarded/monitored channels.**

This replaces the celebrity-first / Telugu-only reading of the Creator Intelligence proposal. Research should span creator size, languages, geographies, niches, content formats and early-stage creators. There is **no fixed creator-count ceiling**: 94 is the first research batch, not the eventual target or the number of channels activated.

## First pool, with explicit limitations

File: `candidate-pool-2026-10-27.csv`

- **94 distinct listed candidates** researched from **13 public directory/editorial sources**; **44 have a listed @handle**, 50 are name-only leads.
- Research languages/geographies: **38 Telugu, 6 Tamil, 5 Kannada, 8 Malayalam, 6 Marathi, 4 Bengali, 9 pan-India Hindi/English, 10 English/global, 8 multilingual/global-growth**. These are discovery-source labels, **not YouTube-verified audience geographies**.
- **Provisional third-party size tiers**, where reported: **7 under 10K**, **21 from 10K to under 100K**, **20 from 100K to under 1M**, **19 from 1M to under 10M**, **6 at 10M or more**, **21 unverified**. Counts can be stale or inaccurate. Never advertise them as current official YouTube subscriber counts.
- Listed handles and category labels are leads, not identity proof. A handle may change, be recycled or match a different publisher. All `official_channel_id` fields are intentionally empty.
- `youtube_api_verified=false`, `ingestion_enabled=false` and `metrics_collection_enabled=false` for **every entry**. No Supabase changes, new scheduled jobs, quota spent or notifications sent by staging this file.
- **Do not automatically assign a creator's title, content category or subscriber tier based on a single third-party page**. Verify the channel and current content mix. Some "creators" are teams, media companies or channels for children; record distinct channel/operator type rather than assuming each is one individual.

## Continuous discovery, not a static top-50 list

Build a repeatable low-cost discovery funnel:

1. **Candidate sources:** Public directories, YouTube's own public creator features, topical/local editorial sources, user-submitted channel links, relevant collaborations and verified adjacent creators. Keep provenance URL and date. Do not copy website rankings or fake engagement figures as product analytics.
2. **Identity verification:** For listed handles, verify with YouTube Data API `channels.list` using the handle, resolve the stable `UC...` channel ID, canonical title, description and uploads playlist. For name-only leads, verify the actual matching channel manually or with a tightly metered search path; never guess channel IDs or fabricate handles.
3. **Deduplication:** Check the verified UC channel ID against existing CineRelay `source_identities` (185 active cinema/OTT sources at the prior audit); a creator affiliated with a media company may already be represented by another source. Handle/name equality alone is insufficient.
4. **Health/activity:** Check recent upload activity, original-content versus aggregator identity, active/public channel accessibility, Shorts/long-form/livestream mix and official/publicly accessible metrics. A new small channel must not be excluded merely because it lacks dozens of uploads.
5. **Sampling quality:** Maintain a meaningful presence of `<10K` and `10K–100K` creators in **every pilot and future expansion**, in addition to larger reference channels. Sample across topical cohorts, formats, languages, regions, and upload cadence. Compare like with like, not an emerging village vlogger's raw views against a global celebrity's.
6. **Quotas:** Stage verified identities first. Creator-stat snapshots and new-upload monitoring remain disabled until the quota allocation is measured against the existing live 28-check/five-minute YouTube fallback scheduler and safe reserve.
7. **Privacy/policy:** Public YouTube metadata only; no private analytics claims. Store API-retrieved public counters subject to YouTube API Services retention and refresh policies. No inferred revenue, demographics or private insights. Rankings/derived performance scores require separate policy assessment.

## Candidate → enabled progression

`RESEARCH_LEAD → CHANNEL_ID_VERIFIED → DUPLICATE_CHECKED → ACTIVITY_CHECKED → ELIGIBLE → ENABLED_FOR_DISCOVERY → ENABLED_FOR_PUBLIC_METRIC_SNAPSHOTS`

Never skip verification simply because a channel is popular. No record in this CSV is further than `RESEARCH_LEAD`.

## Phase-1 demonstration question

Not "which is the largest creator?" but **"How do upload timing and observed public video-counter changes differ between small, medium and large creators doing comparable formats?"**

First use a deliberately mixed sample across size and content segments; estimate age-normalized views, likes and comments from prospective snapshots, and retain a defensible observation count before introducing predictions. Missing hidden likes/comments must be distinguished from zero.

## Source provenance

Each CSV entry links to its **specific discovery source page**. Those third-party sites are not endorsements and not substitutes for official YouTube verification. Google/YouTube editorial sources identify creator examples but do not necessarily expose precise channel IDs. No raw scraped page dumps, personal contact details or creator private information are stored.

## Immediate acceptance gates

- [x] Research pool constructed across multiple languages, regions, niches and sizes, including sub-10K.
- [x] Every lead retains a public source, size uncertainty and disabled-ingestion state.
- [x] Existing production ingest left untouched.
- [ ] Resolve and dedupe the first batch of `UC...` channel IDs with official channel API results; record UTC `verified_at`.
- [ ] Expand the **small/non-Telugu creator** cohorts before calling the pool representative globally.
- [ ] Build a no-write quota simulator for additional channel-discovery and prospective video-stat checks.
- [ ] Select a balanced eligible monitoring cohort; activate only with controlled canary, rollback and quota acceptance.

**No real channel was added to CineRelay production by creating this research list.**
