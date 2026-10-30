import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const src=await readFile('supabase/migrations/20261030213000_creator_intelligence_c26_lock_time_lease.sql','utf8');
const ci=await readFile('.github/workflows/phase-1-ci.yml','utf8');
const race=await readFile('tests/database/run-creator-c26-lease-expiry-race.py','utf8');
let n=0;
function test(name,fn){fn();n++;console.log('PASS C26: '+name);}
test('C23 identity lease checked only after row lock returns',()=>{
 const fn=src.slice(src.indexOf('create or replace function public.creator_c23'));
 const idxLock=fn.indexOf('where handle_key=v_handle for update;');
 const idxClock=fn.indexOf('v_lease_checked_at := clock_timestamp();');
 const idxLease=fn.indexOf('v_claim.retry_after<=v_lease_checked_at');
 const idxWrite=fn.indexOf('insert into public.creator_intelligence_identity_evidence');
 assert.ok(idxLock>0&&idxClock>idxLock&&idxLease>idxClock&&idxWrite>idxLease);
 assert.ok(fn.includes("v_expiry<=v_lease_checked_at"));
 assert.ok(fn.includes("v_observed<v_lease_checked_at-interval '10 minutes'"));
});
test('C20 daily quota and handle cooldown sampled only after global lock',()=>{
 const fn=src.slice(src.indexOf('create or replace function public.creator_c20_claim'),
  src.indexOf('create or replace function public.creator_c23'));
 const idxLock=fn.indexOf("pg_advisory_xact_lock(hashtext('CINERELAY_C14_ACTIVITY_GLOBAL'))");
 const idxTime=fn.indexOf('v_now := clock_timestamp();');
 const idxClaim=fn.indexOf('select * into v_claim');
 const idxQuota=fn.indexOf("from public.connector_quota_usage");
 assert.ok(idxLock>0&&idxTime>idxLock&&idxClaim>idxTime&&idxQuota>idxTime);
 assert.ok(!fn.includes('v_now timestamptz:=clock_timestamp()'));
});
test('new migration preserves service-role-only permissions and no activation fields',()=>{
 assert.ok(src.startsWith('-- C26:'));
 assert.equal((src.match(/create or replace function/g)||[]).length,2);
 assert.ok(src.includes('security definer'));
 assert.ok(src.includes("monitoring_enabled=false,metrics_enabled=false"));
 assert.ok(!src.includes('grant execute on function public.creator_c23'));
});
test('CI concurrency test cannot connect to production',()=>{
 assert.ok(race.includes('CINERELAY_C26_EPHEMERAL_TEST'));
 assert.ok(race.includes('GITHUB_ACTIONS'));
 assert.ok(race.includes('REFUSED: not a local Supabase test database'));
 assert.ok(race.includes('expired claim persisted an identity'));
 assert.ok(race.includes('C20 claim time was sampled before its long global advisory lock wait'));
 assert.ok(ci.includes('CINERELAY_C26_EPHEMERAL_TEST: "true"'));
 assert.ok(ci.includes('python3 tests/database/run-creator-c26-lease-expiry-race.py'));
});
test('local no-env attempt refuses before contacting DB',()=>{
 const r=spawnSync('python3',['tests/database/run-creator-c26-lease-expiry-race.py'],
  {encoding:'utf8',timeout:3000,env:{...process.env,
   CINERELAY_C26_EPHEMERAL_TEST:'false',GITHUB_ACTIONS:'false'}});
 assert.notEqual(r.status,0);
 assert.ok((r.stderr+r.stdout).includes('REFUSED:'));
});
console.log('PASS CineRelay C26: '+n+' lock-time, quota-time and no-remote-DB contracts');
