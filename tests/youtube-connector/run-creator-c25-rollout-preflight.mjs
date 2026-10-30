import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {evaluateC25,fromCheckout,REQUIRED_SOURCE_FILES,REQUIRED_MANUAL_GATES}
 from '../../scripts/creator-intelligence/c25-launch-preflight.mjs';
const evidence=JSON.parse(readFileSync(
 'docs/07-execution/creator-c25-rollout-evidence-2026-10-30.json','utf8'));
const tracked=execFileSync('git',['ls-files','-z'],{
 encoding:'utf8'}).split('\0').filter(Boolean);
const contents=Object.fromEntries(REQUIRED_SOURCE_FILES.map(path=>
 [path,readFileSync(path,'utf8')]));
let count=0;
function test(name,fn){fn();count++;console.log('PASS C25: '+name)}
test('real dated production read-only audit is explicit about nondeployment and old refs',()=>{
 const current=fromCheckout();
 assert.equal(current.sourceCheckPassed,true,JSON.stringify(current));
 assert.equal(current.safeToRunLivePilot,false);
 assert.equal(current.checkedSourceFiles,REQUIRED_SOURCE_FILES.length);
 assert.ok(current.checks.productionNotMistakenForStaging);
 assert.ok(current.checks.historicalRefsStillOpen);
 assert.ok(current.blockers.includes('GOOGLE_CLOUD_ACTUAL_QUOTA_UNKNOWN'));
 assert.ok(current.blockers.includes('HOSTED_BACKUP_PITR_LOG_RETENTION_UNKNOWN'));
 assert.ok(current.blockers.includes('HISTORICAL_GIT_PUBLIC_API_DATA'));
 assert.equal(evidence.verified.productionCreatorMigrationCount,0);
 assert.equal(evidence.verified.hostedDevelopmentBranches,0);
});
test('all requested manual evidence gates are deliberately unsatisfied',()=>{
 const current=fromCheckout();
 assert.deepEqual(Object.keys(current.manualEvidenceRequired),
  [...REQUIRED_MANUAL_GATES]);
 assert.ok(Object.values(current.manualEvidenceRequired).every(x=>x===false));
});
test('reintroduced raw snapshot or missing creator migration fails CI audit',()=>{
 const old=evaluateC25(evidence,[
  ...tracked,'research/creator-intelligence/c11-public-activity-results.json'],contents);
 assert.equal(old.sourceCheckPassed,false);
 assert.equal(old.checks.noUnreviewedNewSnapshots,false);
 const missing=evaluateC25(evidence,tracked.filter(x=>x!==REQUIRED_SOURCE_FILES[0]),contents);
 assert.equal(missing.sourceCheckPassed,false);
 assert.deepEqual(missing.missingSourceFiles,[REQUIRED_SOURCE_FILES[0]]);
});
test('turning off the active operator gate fails code audit',()=>{
 const patched={...contents,
  'supabase/functions/cinerelay-creator-intelligence-api/index.ts':
  contents['supabase/functions/cinerelay-creator-intelligence-api/index.ts']
   .replace("if(!(await operator(request)))","if(true)")};
 const evaluated=evaluateC25(evidence,tracked,patched);
 assert.equal(evaluated.sourceCheckPassed,false);
 assert.equal(evaluated.checks.verifiedReadRequiresOperator,false);
});
test('enabling verifier by default fails source audit',()=>{
 const patched={...contents,
  'supabase/functions/cinerelay-creator-identity-verify/index.ts':
  contents['supabase/functions/cinerelay-creator-identity-verify/index.ts']
   .replace("CINERELAY_C20_IDENTITY_VERIFY_ENABLED')==='true'",
    "CINERELAY_C20_IDENTITY_VERIFY_ENABLED')!=='false'")};
 const report=evaluateC25(evidence,tracked,patched);
 assert.equal(report.sourceCheckPassed,false);
 assert.equal(report.checks.identityVerifierOffByDefault,false);
});
test('invalid or undocumented evidence cannot be treated as trusted',()=>{
 assert.throws(()=>evaluateC25({...evidence,snapshotOnly:false},tracked,contents),
  /C25_BAD_EVIDENCE/);
 assert.throws(()=>evaluateC25({...evidence,productionMutationsMade:true},tracked,contents),
  /C25_BAD_EVIDENCE/);
});
test('audit can be green, but pilot command ALWAYS fails without independent external signoff',()=>{
 const audit=spawnSync(process.execPath,
  ['scripts/creator-intelligence/c25-launch-preflight.mjs','--audit'],
  {encoding:'utf8'});
 assert.equal(audit.status,0,audit.stderr);
 assert.equal(JSON.parse(audit.stdout).safeToRunLivePilot,false);
 const pilot=spawnSync(process.execPath,
  ['scripts/creator-intelligence/c25-launch-preflight.mjs','--pilot'],
  {encoding:'utf8'});
 assert.equal(pilot.status,2,pilot.stderr);
 assert.equal(JSON.parse(pilot.stdout).safeToRunLivePilot,false);
});
console.log('PASS CineRelay C25: '+count+' fail-closed rollout and production read-only evidence checks');
