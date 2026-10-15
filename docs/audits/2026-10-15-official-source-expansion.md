# CineRelay — Official-source expansion 2026-10-15

**Scope:** The user authorized adding new *official* YouTube channels and first-party websites only. This change is **production data** rather than an Android release or schema migration. Source organizations already existed; identity registrations were logged in `audit_actions`.

## Registered and verified

| Source | Kind | Stable identity | Parent source | Status |
|---|---|---|---|---|
| YRF Music | YouTube WebSub | UCjeD2I8jwXg2l_nvXb_6Hzw | YRF | Active; WebSub ACTIVE, verified 2026-10-15 17:45Z |
| Anand Audio Movie Stories | YouTube WebSub | UC8OfZDvClpAFGDJT_oLHHPQ | Anand Audio | Active; WebSub ACTIVE, verified 2026-10-15 17:45Z |
| Netflix Tudum — Official News | First-party web page | https://www.netflix.com/tudum/topics/news/all | Netflix India | Active; HTTP 200, 30 eligible article links, healthy and first-poll baseline |
| Sony Pictures India — What's New | First-party web page | https://www.sonypictures.in/ | Sony Pictures India | Active; HTTP 200, 5 movie links, healthy and first-poll baseline |

Net-new active source **identities**: +4. Active totals after changes: 180 YouTube, 5 Web, 38 RSS, total 223. These totals may subsequently change as normal operations run.

## Evidence and connection rules

1. YouTube channels: both came via Tier-A owner-operated sources' outbound links, used exact `UC...` channel IDs, passed duplicate checks, and retained separate branded identity data on the same `source_id`. We intentionally did not invent new parent companies. `youtube-maintenance-worker` bootstrapped two verified WebSub subscriptions (2 requested, 0 failures); both leases ACTIVE through October 25.
2. Netflix Tudum: Netflix first-party official newsroom. Bounded `FIRST_PARTY_HTML` parser with `li[data-uia="list-item"]`, article anchors `/tudum/articles/...`, and `maxItems=30,minItems=5`. First live poll succeeded without publishing old articles; baseline: `sakamoto-days-season-2-release-date-news`.
3. Sony Pictures India: first-party studio's own site, `article.title-page--whatsnew_grid`, link `a[data-attr="title__card"][href^="/movies/"]`, 5 article cards, `maxItems=15,minItems=3`. First live poll succeeded with no old-article notifications; baseline: `/movies/spider-man-brand-new-day`.
4. Both official web connectors poll `COLD_6H`; monitor future content changes and parser drift. There is no proof of new-post *delta* ingestion yet because initial polls deliberately establish baselines only.
5. Source additions were audited with `actor_type=SYSTEM`, `action_type=OFFICIAL_SOURCE_BATCH_REGISTRATION`. Discovery candidates for the two registered YouTube IDs are marked PROMOTED. Website additions use `attach_source_identity` and `register_page_source`.

## Not added and why

- `https://thinkmusic.in/feed/`: HTTP 200 but an **empty RSS channel**, with a stale November 2025 last-build date; adding would not yield new announcements. Think Music's trailer page embeds playable videos using `data-videoid` but lacks anchor links needed by the current generic first-party HTML parser.
- `https://www.aashirvadcinemas.com/feed/`: HTTP 404 (not a usable RSS feed).
- `https://www.timesmusic.com/feed/`: network timeout.
- Disney corporate `/feed/`: first-party feed returns general-interest news including cruises, not just movie releases, and Disney already has an active feed connector.
- The remaining 98 discovered YouTube candidates are **not** automatically official: many are alternate aliases of tracked channels, direct artist collaborations, or ambiguous ownership. Do not bulk-promote without resolving channel IDs and provenance.
- Sites lacking a validated, bounded parser were not enabled. Discovered web homepages alone do not establish a working announcement feed.

**Follow-up:** Monitor each connector for its first *new* real content and avoid automatic source authority escalation. This change does not modify Android code or notification logic.
