# Quarantined fallback staging attempt (2026-10-27)

**DO NOT DEPLOY FROM THIS BRANCH.**

The reconstructed Edge worker text was staged briefly but **failed byte-for-byte verification** against the exact GitHub CI-built artifact for PR #94 (`f40191866cf31dd18d38663517f6deb849dc8e55` expected Git blob). The incorrect staging file was deleted. A similarly sized minified worker may have compiler-generated differences beyond the two intended health-state literals; never treat a same-length rebuild as a matching release.

Production `youtube-fallback-worker` v12 remains unchanged. Safe release must use the exact verified CI artifact from PR #94 / artifact ID `12713784991`, with full rollback verification as recorded in `docs/07-execution/P7_YOUTUBE_FALLBACK_RELEASE_CANDIDATE_2026_10_27.md`. The v12 rollback snapshot remains at `ops/p7-youtube-fallback-v12-rollback-20261027`.

No production rollback is necessary because this attempt never deployed.
