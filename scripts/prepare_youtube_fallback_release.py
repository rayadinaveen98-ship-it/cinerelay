#!/usr/bin/env python3
"""Prepare the pinned CineRelay YouTube fallback release candidate OFFLINE.

Only verifies and extracts two exact files from an already downloaded GitHub
Actions artifact. No network, secrets, database queries, migrations, or
production deployments occur. Requires Python 3.10+ standard library.

Usage:
  python scripts/prepare_youtube_fallback_release.py /path/to/ci-artifact.zip /path/to/empty/output-dir
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile, BadZipFile

EXPECTED = {
    "artifact_sha256": "af1aa89d5d756e8fa96f359e818cb99f69f7fd1b14e0d23bab43ce11132bf5c4",
    "youtube-fallback-worker/index.js": "8b5d0eac26cb4259b0ea0a60c7b62b054e9d031001614d6f1a1e6408326a4c89",
    "youtube-fallback-worker/deno.json": "49215872440aad98f4d4f2f38d9ecbb5b5919ee01fa577599f3a3bffd7c512b2",
}
COMMIT = "730ecd8bcab03da23e54beaff1c9340261ae3f30"
ARTIFACT_ID = 12713784991
HOSTED_ROLLBACK_SHA256 = "9832f8c83a5f50eb5c025c671761b5a7e19b59d68a9417f559a53b86e689802c"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fail(message: str) -> None:
    raise SystemExit(f"REFUSED RELEASE: {message}")


def prepare(artifact_zip: Path, target: Path) -> dict[str, object]:
    if not artifact_zip.is_file():
        fail("artifact ZIP missing")
    if target.exists():
        fail("target directory already exists; use an unused output directory")
    if sha256(artifact_zip.read_bytes()) != EXPECTED["artifact_sha256"]:
        fail("artifact digest mismatch (wrong build, modified bytes or expired/replaced download)")

    required_members = ("youtube-fallback-worker/index.js", "youtube-fallback-worker/deno.json")
    try:
        with ZipFile(artifact_zip) as archive:
            if archive.testzip() is not None:
                fail("ZIP CRC check failed")
            entries = archive.namelist()
            if len(entries) != len(set(entries)):
                fail("duplicate ZIP member paths detected")
            if not all(member in entries for member in required_members):
                fail("required worker files are missing")
            contents = {member: archive.read(member) for member in required_members}
    except (BadZipFile, EOFError, OSError) as exc:
        fail(f"invalid ZIP archive: {type(exc).__name__}")

    for member in required_members:
        if sha256(contents[member]) != EXPECTED[member]:
            fail(f"file hash mismatch: {member}")

    worker = contents[required_members[0]].decode("utf-8")
    config = json.loads(contents[required_members[1]].decode("utf-8"))
    if "Authoritative uploads polling remains healthy; WebSub accelerator recovery is still being monitored" not in worker:
        fail("expected corrected WebSub health semantics absent from compiled worker")
    if "Authoritative uploads polling is healthy; awaiting a successful WebSub delivery to restore accelerator health" in worker:
        fail("old hosted health implementation still present")
    if "CINERELAY_INTERNAL_ADMIN_SECRET" not in worker or "SUPABASE_SERVICE_ROLE_KEY" not in worker:
        fail("expected internal-auth environment contract not recognized")
    if config.get("imports", {}).get("@supabase/supabase-js") != "npm:@supabase/supabase-js@2.57.4":
        fail("unexpected Supabase JS import-map dependency")

    target.mkdir(parents=True)
    for member in required_members:
        out = target / member
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(contents[member])
    manifest = {
        "status": "candidate_verified_NOT_deployed",
        "repository": "rayadinaveen98-ship-it/cinerelay",
        "ci_commit": COMMIT,
        "github_actions_artifact_id": ARTIFACT_ID,
        "zip_sha256": EXPECTED["artifact_sha256"],
        "function_name": "youtube-fallback-worker",
        "entrypoint_path": "youtube-fallback-worker/index.js",
        "import_map_path": "youtube-fallback-worker/deno.json",
        "verify_jwt": False,
        "files_sha256": {k: EXPECTED[k] for k in required_members},
        "previous_hosted_ezbr_sha256_for_rollback_comparison": HOSTED_ROLLBACK_SHA256,
        "required_next_step": "preserve live exact-version rollback bundle, then separately authorize and verify controlled single-function deployment",
    }
    (target / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("usage: prepare_youtube_fallback_release.py ARTIFACT_ZIP UNUSED_OUTPUT_DIR")
    info = prepare(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"PASS: pinned CineRelay function release candidate verified; artifact {info['github_actions_artifact_id']}")
    print("NO DEPLOYMENT WAS PERFORMED")
