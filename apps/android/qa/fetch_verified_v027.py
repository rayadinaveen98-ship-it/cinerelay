#!/usr/bin/env python3
"""Fetch exactly CineRelay v0.2.7's existing published APK for S4 upgrade QA.

This is a CI input, NOT a new APK and NOT distribution authorization. Download
only official GitHub URLs, verify original released asset identity, byte count,
and independently calculated SHA-256. No secrets, mirror, or mutable artifact.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

REPO = "rayadinaveen98-ship-it/cinerelay"
TAG = "v0.2.7"
NAME = "CineRelay-v0.2.7.apk"
ASSET_ID = 646215448
EXPECTED_BYTES = 2317064
EXPECTED_SHA256 = "3cef2f4a3b7586189f0e6731c5a65f4c82d263190cbfab6c1b8355fc7998c8ab"
RELEASE_API = f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"
ASSET_API = f"https://api.github.com/repos/{REPO}/releases/assets/{ASSET_ID}"
DIRECT_URL = f"https://github.com/{REPO}/releases/download/{TAG}/{NAME}"
ALLOWED_HOSTS = frozenset({
    "api.github.com", "github.com",
    "release-assets.githubusercontent.com", "objects.githubusercontent.com",
})
RETRYABLE = frozenset({429, 500, 502, 503, 504})


class BaselineError(Exception):
    """Refuse untrusted, unavailable, or corrupted release binary."""


def assert_github_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise BaselineError("Invalid GitHub download URL") from exc
    if (
        parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS
        or parsed.port not in (None, 443) or parsed.username or parsed.password
        or parsed.fragment
    ):
        raise BaselineError("APK download redirected outside official GitHub hosts")


class GitHubOnlyRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        assert_github_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def release_asset(*, opener) -> dict:
    request = Request(RELEASE_API, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "cinerelay-s4-readonly-upgrade-qa/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with opener.open(request, timeout=40) as response:
        assert_github_url(response.geturl())
        body = response.read(512_000)
    try:
        info = json.loads(body)
    except (ValueError, UnicodeDecodeError) as exc:
        raise BaselineError("GitHub published release metadata was not JSON") from exc
    if not isinstance(info, dict) or info.get("tag_name") != TAG or info.get("draft"):
        raise BaselineError("Exact published CineRelay release is unavailable")
    candidates = [a for a in info.get("assets", []) if a.get("name") == NAME]
    if len(candidates) != 1:
        raise BaselineError("Expected exactly one published baseline APK asset")
    asset = candidates[0]
    if (
        asset.get("id") != ASSET_ID
        or asset.get("size") != EXPECTED_BYTES
        or asset.get("digest") != "sha256:" + EXPECTED_SHA256
        or asset.get("state") != "uploaded"
        or asset.get("browser_download_url") != DIRECT_URL
    ):
        raise BaselineError("Baseline APK does not match recorded immutable GitHub asset metadata")
    return asset


def _download_one(url: str, output: Path, *, opener) -> None:
    assert_github_url(url)
    request = Request(url, headers={
        "Accept": "application/octet-stream",
        "User-Agent": "cinerelay-s4-readonly-upgrade-qa/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    sha = hashlib.sha256()
    count = 0
    with opener.open(request, timeout=45) as response, output.open("wb") as handle:
        assert_github_url(response.geturl())
        while True:
            part = response.read(1024 * 1024)
            if not part:
                break
            count += len(part)
            if count > EXPECTED_BYTES:
                raise BaselineError("APK exceeded recorded release size")
            sha.update(part)
            handle.write(part)
    if count != EXPECTED_BYTES:
        raise BaselineError("APK byte count did not match the published release")
    if sha.hexdigest() != EXPECTED_SHA256:
        raise BaselineError("Downloaded APK SHA-256 mismatches immutable expected checksum")


def is_transient(error: Exception) -> bool:
    if isinstance(error, HTTPError):
        return error.code in RETRYABLE
    return isinstance(error, (URLError, TimeoutError))


def download_baseline(output: Path, *, opener=None, attempts_per_route: int = 2,
                      pause=None) -> dict:
    """Only transient fetch failures can switch routes, never integrity failures."""
    import time
    if not 1 <= attempts_per_route <= 3:
        raise ValueError("Retry count outside supported bounded range")
    opener = opener or build_opener(GitHubOnlyRedirects())
    pause = pause or time.sleep
    release_asset(opener=opener)  # exact original ID, URL, size, digest
    output.parent.mkdir(parents=True, exist_ok=True)
    errors = []
    with tempfile.TemporaryDirectory(prefix="cinerelay-v027-") as tmp:
        candidate = Path(tmp) / NAME
        for route_name, route in (("published URL", DIRECT_URL),
                                  ("official GitHub asset API", ASSET_API)):
            for attempt in range(attempts_per_route):
                try:
                    _download_one(route, candidate, opener=opener)
                    os.replace(candidate, output)
                    return {
                        "release_tag": TAG, "asset_id": ASSET_ID,
                        "name": NAME, "size_bytes": EXPECTED_BYTES,
                        "verified_sha256": EXPECTED_SHA256,
                        "transport": route_name,
                        "distribution_approved": False,
                    }
                except (HTTPError, URLError, TimeoutError) as exc:
                    if not is_transient(exc):
                        raise BaselineError("Non-transient GitHub asset error; blocked") from exc
                    errors.append(route_name)
                    if attempt < attempts_per_route - 1:
                        pause(2**attempt)
        raise BaselineError(
            "Both official GitHub baseline download routes failed after bounded retries"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = download_baseline(args.output)
    except (BaselineError, HTTPError, URLError, TimeoutError, OSError) as exc:
        print("BLOCKED: verified old APK unavailable; no emulator comparison or approval.")
        print("Reason:", str(exc)[:160])
        return 1
    print(f"VERIFIED: {result['release_tag']} {result['name']} "
          f"{result['verified_sha256']} using {result['transport']}. "
          "QA-only: no public distribution granted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
