import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {auditTrackedPaths,unsafeNewPath,KNOWN_API_DATA_PATHS,
 MANUAL_RELEASE_GATES,testReleaseDecision}
 from '../../scripts/creator-intelligence/c18-retention-gate.mjs';
let n=0;
function test(name,fn){fn();n++;console.log('PASS creator C18: '+name)}
const legacy=[...KNOWN_API_DATA_PATHS,'apps/web/src/data/creator-preliminary-page-evidence-2026-10-28.json'];
test('existing older snapshots are explicitly marked release blockers, not certified safe',()=>{
 const r=auditTrackedPaths(legacy);
 assert.equal(r.sourceRegressionPassed,true);
 assert.equal(r.legacyApiDataPaths.length,2);
 assert.equal(r.publicPageReviewPaths.length,1);
 assert.equal(r.releaseReady,false);
 assert.equal(testReleaseDecision(r),false);
 assert.ok(r.releaseBlockers.some(x=>x.code==='LEGACY_TRACKED_API_DATA'));
});
test('source code, general research pools, migrations and safe docs are not mistakenly flagged',()=>{
 for(const path of [
  'apps/web/src/pages/CreatorPilotReviewPage.tsx',
  'research/creator-intelligence/c2-existing-youtube-ids-2026-10-28.json',
  'apps/web/src/data/creator-research-2026-10-27.json',
  'supabase/migrations/20261030110000_creator_intelligence_c12_activity_retention.sql',
  'docs/07-execution/CREATOR_C17_EPHEMERAL_DATABASE_INTEGRATION_2026_10_30.md',
 ])assert.equal(unsafeNewPath(path),false,path);
});
test('old C11 raw activity dump and any newly introduced provider snapshots fail the audit',()=>{
 const risky=[
  'research/creator-intelligence/c11-public-activity-results.json',
  'apps/web/src/data/creator-public-activity-2026-11-01.json',
  'research/creator-intelligence/c18-official-youtube-results.json',
  'research/creator-intelligence/youtube-api-response.jsonl',
  'research/creator-intelligence/creator-metrics-2026-11-01.ndjson',
  'apps/web/src/data/creator-subscribers-2026-11-01.json',
 ];
 const r=auditTrackedPaths([...legacy,...risky]);
 assert.equal(r.sourceRegressionPassed,false);
 assert.deepEqual(r.unsafeNewPaths,[...risky].sort());
 assert.equal(testReleaseDecision(r),false);
});
test('duplicate paths do not inflate the risk counts',()=>{
 const r=auditTrackedPaths([...legacy,...legacy]);
 assert.equal(r.trackedFiles,legacy.length);
 assert.equal(r.legacyApiDataPaths.length,2);
});
test('even with current tree clean, prior PR ref/backup/quota approvals cannot self-certify',()=>{
 const report=auditTrackedPaths([]);
 assert.equal(report.sourceRegressionPassed,true);
 assert.equal(testReleaseDecision(report),false);
 assert.equal(MANUAL_RELEASE_GATES.length,4);
 for(const code of ['HISTORICAL_GIT_REFS_UNREMEDIATED',
  'GOOGLE_PROJECT_QUOTA_NOT_VERIFIED',
  'HOSTED_STORAGE_BACKUP_RETENTION_NOT_VERIFIED',
  'HOSTED_STAGING_AND_EDITORIAL_APPROVAL_PENDING'])
   assert.ok(report.releaseBlockers.some(x=>x.code===code));
});
test('actual checkout shows no newly introduced raw C11 activity snapshot path',()=>{
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const report=auditTrackedPaths(tracked);
 assert.equal(report.sourceRegressionPassed,true,JSON.stringify(report.unsafeNewPaths));
 assert.ok(report.trackedFiles>0);
});
test('release CLI fails closed with exit code 2 while manual approvals and Git history remain unresolved',()=>{
 const command=spawnSync(process.execPath,
  ['scripts/creator-intelligence/c18-retention-gate.mjs','--release'],{encoding:'utf8'});
 assert.equal(command.status,2,command.stderr);
 const result=JSON.parse(command.stdout);
 assert.equal(result.releaseReady,false);
 assert.ok(result.releaseBlockers.length>=4);
});
console.log('PASS CineRelay C18: '+n+' source and release safety gate scenarios');
