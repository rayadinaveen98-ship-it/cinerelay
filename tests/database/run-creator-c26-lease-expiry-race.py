#!/usr/bin/env python3
"""C26: real two-session lock/expiry test in local GitHub Supabase only.

Proves a C23 identity commit which entered while a claim was fresh cannot
write if its row-lock wait outlives the lease. Also proves C20 claim time is
read only after its global quota advisory lock is acquired.
"""
import os
import shutil
import subprocess
import sys
import time

HOST = "127.0.0.1"
PORT = "54322"
HANDLE = "@c26-lock"
QUOTA_HANDLE = "@c26-global"
CHANNEL = "UC" + "w" * 22
METHOD = "creatorC20.oneShotIdentity"
GLOBAL = "CINERELAY_C14_ACTIVITY_GLOBAL"

if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CINERELAY_C26_EPHEMERAL_TEST") != "true":
    sys.exit("REFUSED: C26 runs only in explicitly selected ephemeral GitHub CI")
if os.environ.get("PGHOST", HOST) not in (HOST, "localhost") or os.environ.get("PGPORT", PORT) != PORT:
    sys.exit("REFUSED: not a local Supabase test database")
if os.environ.get("PGDATABASE", "postgres") != "postgres" or os.environ.get("PGUSER", "postgres") != "postgres":
    sys.exit("REFUSED: unexpected test database or role")
env = dict(os.environ, PGHOST=HOST, PGPORT=PORT, PGPASSWORD="postgres",
           PGDATABASE="postgres", PGUSER="postgres")
if shutil.which("psql"):
    base = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
            "-h", HOST, "-p", PORT, "-U", "postgres", "-d", "postgres"]
elif shutil.which("docker"):
    base = ["docker", "exec", "-i", "supabase_db_cinerelay", "psql", "-X", "-q",
            "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]
else:
    sys.exit("REFUSED: local Postgres client unavailable")


def sql(command, timeout=15):
    result = subprocess.run(base + ["-c", command], env=env, text=True,
                            capture_output=True, timeout=timeout)
    if result.returncode != 0:
        raise AssertionError("C26 local SQL failed: " + result.stderr[-650:])
    return result.stdout.strip()


def spawn(command):
    return subprocess.Popen(base + ["-c", command], env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def wait_for_global_lock(timeout=5):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        # pg_try_advisory_xact_lock probes whether the explicit fixture session
        # has successfully acquired the global advisory lock.
        if sql("select pg_try_advisory_xact_lock(hashtext('%s'));" % GLOBAL) == "f":
            return
        time.sleep(0.07)
    raise AssertionError("C26 fixture locker did not obtain expected advisory lock")


def receipt_state(handle):
    return sql("select q.response_status::text from public.connector_quota_usage q "
               "join public.creator_intelligence_handle_claims c on c.quota_receipt_id=q.id "
               "where c.handle_key='%s';" % handle)


def cleanup():
    sql("delete from public.creator_intelligence_identity_evidence where channel_id='%s';" % CHANNEL)
    sql("with deleted as (delete from public.creator_intelligence_handle_claims "
        "where handle_key in ('%s','%s') returning quota_receipt_id) "
        "delete from public.connector_quota_usage q using deleted d "
        "where q.id=d.quota_receipt_id and q.method='%s';" % (HANDLE, QUOTA_HANDLE, METHOD))


def claim(handle):
    data = sql("select public.creator_c20_claim_and_reserve_identity('%s',10000,2000)::text;" % handle)
    # Minimal parsing: values returned by our local C20 function, never external APIs.
    import json
    return json.loads(data)


assert sql("select current_database();") == "postgres"
assert sql("select count(*) from public.creator_intelligence_handle_claims "
           "where handle_key in ('%s','%s');" % (HANDLE, QUOTA_HANDLE)) == "0"
assert sql("select count(*) from public.creator_intelligence_identity_evidence "
           "where channel_id='%s';" % CHANNEL) == "0"
start_quota = sql("select count(*)::text||'|'||coalesce(sum(units),0)::text "
                  "from public.connector_quota_usage where method='%s';" % METHOD)
source_count = sql("select count(*) from public.source_identities;")
locker = None
worker = None
try:
    first = claim(HANDLE)
    assert first["state"] == "CLAIMED", first
    token = first["claimToken"]
    receipt = first["quotaReceiptId"]
    # 1.5-second short lease purely for local race reproducibility. Constraint
    # requires retry_after <= expiry and this is well inside the original 28d.
    sql("update public.creator_intelligence_handle_claims "
        "set retry_after=clock_timestamp()+interval '1.5 seconds' "
        "where handle_key='%s';" % HANDLE)
    # Global lock provides a clear observable barrier; claim row lock is also
    # held by this transaction until after the provider worker is waiting.
    locker = spawn("begin; "
                   "select pg_advisory_xact_lock(hashtext('%s')); " % GLOBAL +
                   "select 1 from public.creator_intelligence_handle_claims "
                   "where handle_key='%s' for update; " % HANDLE +
                   "select pg_sleep(3); commit;")
    wait_for_global_lock()
    record = (
        "jsonb_build_object("
        "'channel_id','%s','listed_name','C26 Synthetic',"
        "'listed_handle','%s','official_channel_title','C26 official',"
        "'uploads_playlist_id','UU%s','locale','te',"
        "'category_provisional','Education','size_tier_provisional','UNVERIFIED',"
        "'source_url','https://example.org/c26-fixture',"
        "'observed_at',clock_timestamp(),"
        "'expires_at',clock_timestamp()+interval '27 days',"
        "'review_state','REVIEW_PENDING',"
        "'monitoring_enabled',false,'metrics_enabled',false)"
    ) % (CHANNEL, HANDLE, CHANNEL[2:])
    worker = spawn("select public.creator_c23_commit_verified_identity("
                   "'%s','%s'::uuid,%d,%s);" % (HANDLE, token, receipt, record))
    time.sleep(0.25)
    assert worker.poll() is None, "C26 worker should be waiting on row lock"
    output, err = worker.communicate(timeout=15)
    assert worker.returncode == 0, "C26 SQL worker failed: " + err[-600:]
    assert output.strip() == "f", (
        "A once-fresh claim MUST be rejected when its lease expires during a real row-lock wait: "
        + output.strip())
    assert locker.wait(timeout=5) == 0, "C26 lease lock session failed"
    assert sql("select count(*) from public.creator_intelligence_identity_evidence "
               "where channel_id='%s';" % CHANNEL) == "0", "Expired claim persisted an identity"
    assert sql("select state from public.creator_intelligence_handle_claims "
               "where handle_key='%s';" % HANDLE) == "IN_FLIGHT"
    assert receipt_state(HANDLE) == "", "Expired claim must not finalize a receipt"

    # C20 now samples the claim/quotaday timestamp AFTER its global lock wait.
    second_locker = spawn("begin; select pg_advisory_xact_lock(hashtext('%s')); "
                          "select pg_sleep(3); commit;" % GLOBAL)
    locker = second_locker
    wait_for_global_lock()
    worker = spawn("select public.creator_c20_claim_and_reserve_identity("
                   "'%s',10000,2000)->>'state';" % QUOTA_HANDLE)
    time.sleep(0.25)
    assert worker.poll() is None, "C26 quota claim should wait on global lock"
    output, err = worker.communicate(timeout=15)
    assert worker.returncode == 0 and output.strip() == "CLAIMED", err[-600:]
    assert locker.wait(timeout=5) == 0
    seconds = float(sql("select extract(epoch from "
                        "(clock_timestamp()-claimed_at)) from "
                        "public.creator_intelligence_handle_claims "
                        "where handle_key='%s';" % QUOTA_HANDLE))
    assert 0 <= seconds < 2.0, (
        "C20 claim time was sampled before its long global advisory lock wait: %s seconds" % seconds)

    assert sql("select count(*) from public.source_identities;") == source_count
    print("PASS C26: real row-lock expiry rejects stale C23 identity with no partial write; "
          "C20 samples quota/claim time after global advisory wait; no production or API calls")
finally:
    for proc in (worker, locker):
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)
    cleanup()
    assert sql("select count(*) from public.creator_intelligence_identity_evidence "
               "where channel_id='%s';" % CHANNEL) == "0"
    assert sql("select count(*) from public.creator_intelligence_handle_claims "
               "where handle_key in ('%s','%s');" % (HANDLE, QUOTA_HANDLE)) == "0"
    assert sql("select count(*)::text||'|'||coalesce(sum(units),0)::text "
               "from public.connector_quota_usage where method='%s';" % METHOD) == start_quota
    assert sql("select count(*) from public.source_identities;") == source_count
