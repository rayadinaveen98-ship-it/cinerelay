# CineRelay Feed Connector

Generic RSS/Atom normalization package for Phase 4.

Responsibilities:

- parse RSS 2.0 and Atom feeds;
- normalize entries into a stable connector contract;
- remove basic HTML markup from text payloads;
- build conditional HTTP request headers;
- compute adaptive poll timing from CineRelay poll classes;
- parse `Retry-After` hints.

This package does **not** write to the database or decide canonical events. The hosted `feed-poll-worker` persists normalized entries into the existing `raw_items` / `raw_item_revisions` pipeline, and the existing CineRelay intelligence worker remains responsible for entity resolution and event classification.

Parser version: `feed-parser-v1`.
