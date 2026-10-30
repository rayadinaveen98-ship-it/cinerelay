#!/usr/bin/env python3
"""C15: real multi-connection concurrency test against local Supabase CI Postgres.

Never run against a remote DB. No YouTube requests, no secrets, no source enrollments.
Uses separate PostgreSQL client processes and deliberately overlaps their transactions.
"""
import os
import re
import shutil
import subprocess
import sys
import time

REPO_DB = "postgres"
CHANNEL_A = "UC" + "z" * 22
CHANNEL_B = "UC" + "y" * 22
LOCK = "CINERELAY_C14_ACTIVITY_GLOBAL"
METHOD = "creatorC14.oneShotPublicActivity"

if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CINERELAY_C15_EPHEMERAL_TEST") != "true":
    sys.exit("REFUSED: C15 concurrency test requires explicit GitHub ephemeral CI flags")
if os.environ.get("PGHOST", "127.0.0.1") not in ("127.0.0.1", "localhost"):
    sys.exit("REFUSED: never test against a remote PostgreSQL host")
if os.environ.get("PGPORT", "54322") != "54322":
    sys.exit("REFUSED: unexpected port (must be Supabase local 54322)")

env = dict(os.environ, PGPASSWORD="postgres", PGHOST="127.0.0.1", PGPORT="54322")
if shutil.which("psql"):
    base = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
            "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", REPO_DB]
elif shutil.which("docker"):
    # Supabase local project id "cinerelay"; postgres inside Docker via local Unix socket.
    base = ["docker", "exec", "-i", "supabase_db_cinerelay", "psql",
            "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", REPO_DB]
else:
    sys.exit("REFUSED: neither psql nor local Supabase docker client available")

def query(sql, timeout=20):
    result = subprocess.run(base + ["-c", sql], text=True, capture_output=True,
                            timeout=timeout, env=env, check=False)
    if result.returncode:
        # SQL is local-only; do not print arbitrary connection strings or secrets.
        raise AssertionError("C15 local psql failed: " + result.stderr[-600:])
    return result.stdout.strip()

def claim_sql(channel):
    return ("select public.creator_c14_claim_and_reserve_activity("
            f"'{channel}',10000,2000)->>'state';")

def receipt_counts():
    data = query(f"select count(*)::text||'|'||coalesce(sum(units),0)::text "
                 "from public.connector_quota_usage "
                 f"where method='{METHOD}';")
    c, u = data.split("|")
    return int(c), int(float(u))

def cleanup():
    # Only the two fixed, fixture-only identities, and exactly their ledger receipts.
    query("with d as (delete from public.creator_intelligence_activity_claims "
          f"where channel_id in ('{CHANNEL_A}','{CHANNEL_B}') returning quota_receipt_id) "
          "delete from public.connector_quota_usage q using d "
          f"where q.id=d.quota_receipt_id and q.method='{METHOD}';")

# Fail closed when targeting a database without our C14 schema.
db_ok = query("select current_database(),current_setting('server_version_num')::int >= 150000;")
if "postgres|t" not in db_ok:
    sys.exit("REFUSED: C15 requires the ephemeral Supabase postgres DB")

# This test uses fixed identifiers; a CI database is disposable and must not
# already contain a prior successful claim for either fixture.
before_claims = query(
    "select count(*) from public.creator_intelligence_activity_claims "
    f"where channel_id in ('{CHANNEL_A}','{CHANNEL_B}');"
)
if before_claims != "0":
    sys.exit("REFUSED: fixture identities already present; requires a fresh local DB")

initial_receipts, initial_units = receipt_counts()
locker = None
first = None
second = None
try:
    # Session 1 explicitly holds the SAME transaction-scoped advisory lock the
    # production claim RPC uses. Both competing psql processes then queue.
    locker_sql = ("begin; "
                  f"select pg_advisory_xact_lock(hashtext('{LOCK}')); "
                  "select 'LOCK_HELD'; select pg_sleep(2.5); commit;")
    locker = subprocess.Popen(base + ["-c", locker_sql], stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True, bufsize=1, env=env)
    if locker.stdout is None:
        raise AssertionError("Cannot inspect local lock session")
    started = time.monotonic()
    marker = ""
    while time.monotonic() - started < 5:
        line = locker.stdout.readline()
        if not line:
            break
        if line.strip() == "LOCK_HELD":
            marker = "LOCK_HELD"
            break
    assert marker == "LOCK_HELD", "Lock session did not establish the barrier"

    first = subprocess.Popen(base + ["-c", claim_sql(CHANNEL_A)], text=True,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    second = subprocess.Popen(base + ["-c", claim_sql(CHANNEL_A)], text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    time.sleep(0.3)
    assert first.poll() is None and second.poll() is None, (
        "Both requests must overlap while the global advisory lock is held"
    )
    out1, err1 = first.communicate(timeout=15)
    out2, err2 = second.communicate(timeout=15)
    assert first.returncode == 0 and second.returncode == 0, (
        "Local claim SQL failed: " + (err1 + err2)[-600:])
    states = sorted([out1.strip(), out2.strip()])
    assert states == ["BLOCKED_ACTIVE_OR_COOLDOWN", "CLAIMED"], states
    assert locker.wait(timeout=5) == 0, "Lock session failed"

    receipts, units = receipt_counts()
    assert (receipts - initial_receipts, units - initial_units) == (1, 2), (
        "Simultaneous same-channel calls must create exactly one two-unit quota receipt"
    )
    assert query("select count(*) from public.creator_intelligence_activity_claims "
                 f"where channel_id='{CHANNEL_A}' and state='IN_FLIGHT';") == "1"

    # A third duplicate attempt remains blocked and cannot spend another unit.
    assert query(claim_sql(CHANNEL_A)) == "BLOCKED_ACTIVE_OR_COOLDOWN"
    assert receipt_counts() == (receipts, units)

    # Different identities can still be claimed (no accidental global ban).
    assert query(claim_sql(CHANNEL_B)) == "CLAIMED"
    after2, units2 = receipt_counts()
    assert (after2 - initial_receipts, units2 - initial_units) == (2, 4)

    # The legitimate holder can finalize; a fake token cannot.
    rec = query("select claim_token::text||'|'||quota_receipt_id::text "
                "from public.creator_intelligence_activity_claims "
                f"where channel_id='{CHANNEL_A}';")
    token, rid = rec.split("|")
    assert re.fullmatch(r"[a-f0-9-]{36}", token)
    assert query("select public.creator_c14_finalize_activity_claim("
                 f"'{CHANNEL_A}','00000000-0000-0000-0000-000000000000'::uuid,{rid},true,200);") == "f"
    assert query("select public.creator_c14_finalize_activity_claim("
                 f"'{CHANNEL_A}','{token}'::uuid,{rid},true,200);") == "t"
    assert query(claim_sql(CHANNEL_A)) == "BLOCKED_ACTIVE_OR_COOLDOWN"
    assert receipt_counts() == (after2, units2)

    print("PASS C15: true two-connection simultaneous claim, 1 winner / 1 blocked, "
          "exactly 2 units, replay/finalization rejection, distinct-channel isolation")
finally:
    for proc in (first, second, locker):
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)
    cleanup()
    assert receipt_counts() == (initial_receipts, initial_units), (
        "C15 temporary quota receipts must be removed from ephemeral DB"
    )
