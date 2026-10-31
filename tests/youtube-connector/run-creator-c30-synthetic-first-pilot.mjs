import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runC30SyntheticRehearsal} from '../../scripts/creator-intelligence/c30-synthetic-first-pilot.mjs';

let count=0;
async function test(label,fn){
 await fn();count++;console.log('PASS C30: '+label);
}
const report=await runC30SyntheticRehearsal();

await test('five actual C20-flow scenarios pass with no real provider or hosted DB',()=>{
 assert.equal(report.kind,'CINERELAY_C30_SYNTHETIC_FIRST_CREATOR_REHEARSAL');
 assert.equal(report.mode,'OFFLINE_SIMULATION_ONLY');
 assert.deepEqual(report.scenarios.map(x=>x.name),
  ['feature-off','unauthorized','success','provider-error','stale-claim']);
 assert.ok(report.scenarios.every(x=>x.passed===true));
 assert.equal(report.realProviderCalls,0);
 assert.equal(report.realDatabaseWrites,0);
 assert.equal(report.realQuotaUnitsUsed,0);
 assert.equal(report.paidResourcesCreated,0);
 assert.equal(report.syntheticRecordsPersisted,0);
});
await test('two fail-closed gates cannot spend a simulated API unit',()=>{
 for(const [i,status] of [[0,503],[1,403]]){
  const x=report.scenarios[i];
  assert.equal(x.httpStatus,status);
  assert.equal(x.mockedProviderCalls,0);
  assert.equal(x.simulatedQuotaUnits,0);
  assert.equal(x.inMemoryReviewRecords,0);
 }
 assert.deepEqual(report.scenarios[0].steps,[]);
 assert.deepEqual(report.scenarios[1].steps,['auth']);
});
await test('one identity stored for review, replay does not fetch or spend again',()=>{
 const x=report.scenarios[2];
 assert.equal(x.httpStatus,200);
 assert.equal(x.mockedProviderCalls,1);
 assert.equal(x.simulatedQuotaUnits,1);
 assert.equal(x.inMemoryReviewRecords,1);
 assert.equal(x.failureFinalizations,0);
 assert.deepEqual(x.steps,['auth','claim','provider','commit','auth','claim']);
 assert.equal(report.simulatedIdentityAgeDays,27);
});
await test('provider error consumes only synthetic receipt and never stores identity',()=>{
 const x=report.scenarios[3];
 assert.equal(x.httpStatus,503);
 assert.deepEqual(x.steps,['auth','claim','provider','finalize']);
 assert.equal(x.failureFinalizations,1);
 assert.equal(x.inMemoryReviewRecords,0);
 assert.equal(x.simulatedQuotaUnits,1);
});
await test('stale claim never writes data or finalizes someone else receipt',()=>{
 const x=report.scenarios[4];
 assert.equal(x.httpStatus,503);
 assert.deepEqual(x.steps,['auth','claim','provider','commit']);
 assert.equal(x.failureFinalizations,0);
 assert.equal(x.inMemoryReviewRecords,0);
 assert.equal(x.simulatedQuotaUnits,1);
});
await test('C25/C29 release authorizations remain blocked in synthetic success',()=>{
 assert.equal(report.c25ReleaseBlocked,true);
 assert.equal(report.c29ReleaseBlocked,true);
 assert.equal(report.safeToRunLivePilot,false);
 assert.equal(report.creatorMonitoringEnabled,false);
 assert.equal(report.creatorMetricsEnabled,false);
 assert.equal(report.creatorComparisonsEnabled,false);
});
await test('CLI prints sanitized rehearsal but pilot mode deliberately exits 2',()=>{
 const entry='scripts/creator-intelligence/c30-synthetic-first-pilot.mjs';
 const a=spawnSync(process.execPath,[entry,'--rehearse'],{encoding:'utf8',timeout:15000});
 assert.equal(a.status,0,a.stderr);
 const obj=JSON.parse(a.stdout);
 assert.equal(obj.passed,true);
 assert.ok(!a.stdout.includes('@c30synthetic'));
 assert.ok(!a.stdout.includes('UC'+'z'.repeat(22)));
 assert.ok(!a.stdout.includes('MUST_NEVER_BE_RETURNED'));
 const b=spawnSync(process.execPath,[entry,'--pilot'],{encoding:'utf8',timeout:15000});
 assert.equal(b.status,2,b.stderr);
 assert.equal(JSON.parse(b.stdout).safeToRunLivePilot,false);
});
await test('rehearsal has no network clients, cloud credentials or live API side effects',()=>{
 const code=readFileSync('scripts/creator-intelligence/c30-synthetic-first-pilot.mjs','utf8');
 assert.ok(code.includes('runC20IdentityRequest'));
 assert.ok(code.includes("https://example.invalid/only-in-memory"));
 assert.ok(!/\bfetch\s*\(|createClient\s*\(|process\.env|execFile|spawnSync|\bDeno\.|googleapis\.com|SUPABASE_SERVICE_ROLE_KEY|YOUTUBE_API_KEY/.test(code));
});
console.log('PASS CineRelay C30: '+count+' synthetic single-creator verification assertions');
