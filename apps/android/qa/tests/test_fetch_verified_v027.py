#!/usr/bin/env python3
"""No-network tests for the exact published CineRelay APK upgrade baseline."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_verified_v027 import (
    ASSET_API, ASSET_ID, DIRECT_URL, EXPECTED_BYTES, EXPECTED_SHA256,
    NAME, RELEASE_API, TAG, BaselineError, assert_github_url,
    download_baseline, release_asset,
)

# The real APK is not bundled in tests. The test fixture temporarily overrides
# the digest and size constants, then restores them during cleanup.
FIXTURE = b"synthetic-apk-bytes-for-hash-only-verification"
HASH = hashlib.sha256(FIXTURE).hexdigest()


def metadata():
    return {
        "tag_name": TAG, "draft": False,
        "assets": [{
            "id": ASSET_ID, "name": NAME, "size": len(FIXTURE),
            "digest": "sha256:" + HASH, "state": "uploaded",
            "browser_download_url": DIRECT_URL,
        }],
    }


class Response:
    def __init__(self, url, payload):
        self.url, self.file = url, io.BytesIO(payload)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.file.close()

    def geturl(self):
        return self.url

    def read(self, amount):
        return self.file.read(amount)


class Opener:
    def __init__(self, *, direct_error=None, direct_payload=FIXTURE,
                 api_payload=FIXTURE, bad_metadata=None):
        self.direct_error = direct_error
        self.direct_payload = direct_payload
        self.api_payload = api_payload
        self.bad_metadata = bad_metadata
        self.calls = []

    def open(self, request, timeout=45):
        url = request.full_url
        self.calls.append(url)
        if url == RELEASE_API:
            doc = self.bad_metadata if self.bad_metadata is not None else metadata()
            return Response(url, json.dumps(doc).encode())
        if url == DIRECT_URL:
            if self.direct_error is not None:
                raise HTTPError(url, self.direct_error, "test", {}, None)
            return Response(url, self.direct_payload)
        if url == ASSET_API:
            return Response(url, self.api_payload)
        raise AssertionError("Unexpected destination: " + url)


class BaselineTests(unittest.TestCase):
    def setUp(self):
        import fetch_verified_v027 as target
        self.target = target
        self.old_size = target.EXPECTED_BYTES
        self.old_digest = target.EXPECTED_SHA256
        target.EXPECTED_BYTES = len(FIXTURE)
        target.EXPECTED_SHA256 = HASH
        self.addCleanup(self._restore)

    def _restore(self):
        self.target.EXPECTED_BYTES = self.old_size
        self.target.EXPECTED_SHA256 = self.old_digest

    def test_recorded_release_sha_is_valid_and_static(self):
        self.assertEqual(EXPECTED_BYTES, 2317064)
        self.assertEqual(EXPECTED_SHA256,
            "3cef2f4a3b7586189f0e6731c5a65f4c82d263190cbfab6c1b8355fc7998c8ab")

    def test_exact_direct_download(self):
        opener = Opener()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / NAME
            evidence = download_baseline(out, opener=opener, pause=lambda _: None)
            self.assertEqual(out.read_bytes(), FIXTURE)
        self.assertEqual(evidence["transport"], "published URL")
        self.assertFalse(evidence["distribution_approved"])
        self.assertEqual(opener.calls, [RELEASE_API, DIRECT_URL])

    def test_504_uses_same_asset_api_and_same_hash(self):
        opener = Opener(direct_error=504)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / NAME
            evidence = download_baseline(out, opener=opener, pause=lambda _: None)
            self.assertEqual(out.read_bytes(), FIXTURE)
        self.assertEqual(evidence["transport"], "official GitHub asset API")
        self.assertEqual(opener.calls, [RELEASE_API, DIRECT_URL, DIRECT_URL, ASSET_API])

    def test_wrong_binary_never_falls_back(self):
        opener = Opener(direct_payload=b"X" * len(FIXTURE))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / NAME
            with self.assertRaisesRegex(BaselineError, "SHA-256"):
                download_baseline(out, opener=opener, pause=lambda _: None)
            self.assertFalse(out.exists())
        self.assertEqual(opener.calls, [RELEASE_API, DIRECT_URL])

    def test_wrong_size_never_falls_back(self):
        opener = Opener(direct_payload=FIXTURE[:-1])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / NAME
            with self.assertRaisesRegex(BaselineError, "byte count"):
                download_baseline(out, opener=opener, pause=lambda _: None)
            self.assertFalse(out.exists())
        self.assertEqual(opener.calls, [RELEASE_API, DIRECT_URL])

    def test_403_is_not_retried(self):
        opener = Opener(direct_error=403)
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(BaselineError, "Non-transient"):
                download_baseline(Path(tmp)/NAME, opener=opener, pause=lambda _: None)
        self.assertEqual(opener.calls, [RELEASE_API, DIRECT_URL])

    def test_same_apk_api_json_does_not_pass(self):
        opener = Opener(direct_error=504, api_payload=b"{}")
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(BaselineError):
                download_baseline(Path(tmp)/NAME, opener=opener, pause=lambda _: None)

    def test_transient_metadata_503_recovered_without_skipping_asset_checks(self):
        class FlakyMetadataOpener(Opener):
            def __init__(self):
                super().__init__()
                self.failures = 0

            def open(self, request, timeout=45):
                if request.full_url == RELEASE_API and self.failures < 2:
                    self.failures += 1
                    self.calls.append(RELEASE_API)
                    raise HTTPError(RELEASE_API, 503, "Service Unavailable", {}, None)
                return super().open(request, timeout=timeout)

        opener = FlakyMetadataOpener()
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / NAME
            result = download_baseline(file, opener=opener, pause=lambda _: None)
            self.assertEqual(file.read_bytes(), FIXTURE)
            self.assertFalse(result["distribution_approved"])
        self.assertEqual(opener.calls, [RELEASE_API] * 3 + [DIRECT_URL])

    def test_persistent_metadata_503_blocks_before_apk_download(self):
        class AlwaysUnavailable(Opener):
            def open(self, request, timeout=45):
                self.calls.append(request.full_url)
                raise HTTPError(request.full_url, 503, "Service Unavailable", {}, None)

        opener = AlwaysUnavailable()
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / NAME
            with self.assertRaisesRegex(BaselineError, "metadata unavailable after bounded retries"):
                download_baseline(file, opener=opener, pause=lambda _: None)
            self.assertFalse(file.exists())
        self.assertEqual(opener.calls, [RELEASE_API] * 4)

    def test_metadata_403_never_retried(self):
        class AccessDenied(Opener):
            def open(self, request, timeout=45):
                self.calls.append(request.full_url)
                raise HTTPError(request.full_url, 403, "Forbidden", {}, None)

        opener = AccessDenied()
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(BaselineError, "metadata denied"):
                download_baseline(Path(tmp) / NAME, opener=opener, pause=lambda _: None)
        self.assertEqual(opener.calls, [RELEASE_API])

    def test_asset_id_and_signature_metadata_must_match(self):
        doc = metadata()
        doc["assets"][0]["id"] = 123
        with self.assertRaisesRegex(BaselineError, "metadata"):
            release_asset(opener=Opener(bad_metadata=doc))
        doc = metadata()
        doc["assets"][0]["digest"] = "sha256:" + "f"*64
        with self.assertRaisesRegex(BaselineError, "metadata"):
            release_asset(opener=Opener(bad_metadata=doc))

    def test_draft_release_is_rejected(self):
        doc = metadata()
        doc["draft"] = True
        with self.assertRaisesRegex(BaselineError, "published"):
            release_asset(opener=Opener(bad_metadata=doc))

    def test_block_external_and_http_url(self):
        for url in (
            "https://github.com.evil.invalid/a.apk",
            "https://127.0.0.1/secret",
            "http://github.com/release",
            "https://user:password@github.com/file.apk",
            "https://other.example.invalid/file",
        ):
            with self.assertRaises(BaselineError):
                assert_github_url(url)


if __name__ == "__main__":
    unittest.main()
