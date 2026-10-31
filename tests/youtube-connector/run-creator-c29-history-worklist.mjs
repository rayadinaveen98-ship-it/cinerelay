import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {evaluateC29,fromCheckout} from '../../scripts/creator-intelligence/c29-history-worklist.mjs';

const evidence=JSON.parse(readFileSync(
 'docs/07-execution/creator-c29-historical-review-evidence-2026-10-31.json','utf8'));
let n=0;
function test(title,fn){fn();n++;console.log('PASS C29: '+title);}
test('accurate source-only snapshot keeps all release gates blocked',()=>{
 const report=fromCheckout();
 assert.equal(report.snapshotOnly,true);
 assert.equal(report.safeToRunLivePilot,false);
 assert.equal(report.releaseAuthorized,false);
 assert.equal(report.historyCleanupAuthorized,false);
 assert.equal(report.noPaidResourcesCreated,true);
 assert.equal(report.historicalRefs.length,3);
 assert.deepEqual(report.historicalRefs.map(x=>x.pullRequest),[100,108,109]);
 assert.equal(report.production.creatorMigrationCount,0);
 assert.equal(report.production.stagingBranches,0);
});
test('no historical ref is treated as purged merely because a branch disappears',()=>{
 const amended=structuredClone(evidence);
 amended.historical[2].prState='closed';
 amended.historical[2].branchVisibility='not-found';
 const report=evaluateC29(amended);
 assert.equal(report.safeToRunLivePilot,false);
 assert.equal(report.historicalRefs[2].historicalObjectsPurged,false);
 assert.ok(report.blockers.includes('HISTORICAL_REF_AND_CACHED_OBJECT_REVIEW_REQUIRED'));
});
test('no forged historical purge or inferred approvals can be accepted',()=>{
 const fake=structuredClone(evidence);
 fake.historical[2].historicalObjectsPurged=true;
 assert.throws(()=>evaluateC29(fake),/C29_UNVERIFIED_HISTORICAL_REF/);
 const fake2=structuredClone(evidence);
 fake2.externalGates.actualCloudQuotaVerified=true;
 assert.throws(()=>evaluateC29(fake2),/C29_EXTERNAL_GATES_NOT_INDEPENDENTLY_VERIFIED/);
});
test('wrong project, fabricated release or missing sources fail closed',()=>{
 assert.throws(()=>evaluateC29({...evidence,repository:'someone/other'}),/C29_INVALID_OR_UNTRUSTED_SNAPSHOT/);
 assert.throws(()=>evaluateC29({...evidence,releaseAuthorized:true}),/C29_INVALID_OR_UNTRUSTED_SNAPSHOT/);
 const fake=structuredClone(evidence);fake.historical[1].knownRiskPaths=[];
 assert.throws(()=>evaluateC29(fake),/C29_UNVERIFIED_HISTORICAL_REF/);
});
test('C11 expiry is not mistaken for a deadline covering C2 or C10',()=>{
 const report=fromCheckout();
 assert.ok(report.c11ExpiryScope.includes('NOT a general deadline'));
 assert.ok(report.c11LatestReportedObservationExpiry.startsWith('2026-11-29'));
 const fake=structuredClone(evidence);fake.c11ExpiryScope='All API data can be retained';
 assert.throws(()=>evaluateC29(fake),/C29_EXPIRY_SCOPE_UNTRUSTED/);
});
test('CLI audit reports state but release always exits blocked',()=>{
 const script='scripts/creator-intelligence/c29-history-worklist.mjs';
 const audit=spawnSync(process.execPath,[script,'--audit'],{encoding:'utf8'});
 assert.equal(audit.status,0,audit.stderr);
 assert.equal(JSON.parse(audit.stdout).safeToRunLivePilot,false);
 const release=spawnSync(process.execPath,[script,'--release'],{encoding:'utf8'});
 assert.equal(release.status,2,release.stderr);
 assert.equal(JSON.parse(release.stdout).historyCleanupAuthorized,false);
});
test('worklist source cannot run remote calls, erase refs or read credentials',()=>{
 const code=readFileSync('scripts/creator-intelligence/c29-history-worklist.mjs','utf8');
 assert.ok(!/execFile|spawn|https:\/\/|fetch\(|curl|git push|git branch -D|git filter-repo|process\.env/.test(code));
 assert.ok(code.includes('safeToRunLivePilot:false'));
 assert.ok(code.includes('historyCleanupAuthorized:false'));
 assert.ok(code.includes('releaseAuthorized:false'));
});
console.log('PASS CineRelay C29: '+n+' non-destructive metadata and release-gate tests');
