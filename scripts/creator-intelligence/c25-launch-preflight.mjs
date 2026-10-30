/**
 * C25 local, zero-cost preflight. Dated evidence is NOT a live remote query.
 * --audit: source guard; --pilot: fail-closed until independently signed off.
 * This script never invokes Google/Supabase/GitHub APIs, changes state or
 * reads credentials. A clean code check cannot certify production readiness.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {auditTrackedPaths} from './c18-retention-gate.mjs';
import {execFileSync} from 'node:child_process';

const SOURCE_EVIDENCE='docs/07-execution/creator-c25-rollout-evidence-2026-10-30.json';
export const REQUIRED_SOURCE_FILES=Object.freeze([
 'supabase/migrations/20261030110000_creator_intelligence_c12_activity_retention.sql',
 'supabase/migrations/20261030170000_creator_intelligence_c14_atomic_claim.sql',
 'supabase/migrations/20261030190000_creator_intelligence_c19_private_identity_evidence.sql',
 'supabase/migrations/20261030194500_creator_intelligence_c20_handle_quota.sql',
 'supabase/migrations/20261030203000_creator_intelligence_c23_atomic_identity_commit.sql',
 'supabase/functions/cinerelay-creator-identity-verify/index.ts',
 'supabase/functions/cinerelay-creator-identity-verify/flow.mjs',
 'supabase/functions/cinerelay-creator-intelligence-api/index.ts',
 'apps/android/app/src/main/java/com/cinerelay/app/data/CreatorIdentityV22.kt',
]);
export const REQUIRED_MANUAL_GATES=Object.freeze([
 'historyAndCachesRemediated',
 'actualGoogleQuotaAndExistingSourceReserveVerified',
 'backupPitrLogExportRetentionApproved',
 'isolatedStagingCostAuthorized',
 'stagingOperatorAuthAndTtlProven',
 'singleReviewedCandidateAndPolicyApproved',
 'manualProviderPilotApproved',
]);
const TRACKED=()=>execFileSync('git',['ls-files','-z'],{encoding:'utf8',
 maxBuffer:8*1024*1024,timeout:12000}).split('\0').filter(Boolean);
const load=(p)=>readFileSync(p,'utf8');
export function evaluateC25(evidence,files,contents){
 if(!evidence||evidence.schema!=='CINERELAY_C25_ROLLOUT_EVIDENCE_V1'||
  evidence.snapshotOnly!==true||evidence.providerCallsMade!==false||
  evidence.productionMutationsMade!==false||!evidence.verified||
  !/^\d{4}-\d{2}-\d{2}$/.test(evidence.observedAt??''))throw Error('C25_BAD_EVIDENCE');
 const snapshot=evidence.verified;
 const missing=REQUIRED_SOURCE_FILES.filter(p=>!files.includes(p));
 const trackedAudit=auditTrackedPaths(files);
 const identityEndpoint=contents['supabase/functions/cinerelay-creator-identity-verify/index.ts']??'';
 const identityFlow=contents['supabase/functions/cinerelay-creator-identity-verify/flow.mjs']??'';
 const pilotApi=contents['supabase/functions/cinerelay-creator-intelligence-api/index.ts']??'';
 const checks={
  noUnreviewedNewSnapshots:trackedAudit.sourceRegressionPassed,
  requiredSourceFilesPresent:missing.length===0,
  identityVerifierOffByDefault:
   identityEndpoint.includes("CINERELAY_C20_IDENTITY_VERIFY_ENABLED')==='true'")&&
   identityEndpoint.includes("CINERELAY_C20_ATOMIC_QUOTA_ENABLED')==='true'"),
  activeOperatorRequired:
   identityEndpoint.includes('activeOperator')&&
   identityFlow.includes('await deps.activeOperator(request)'),
  verifiedReadRequiresOperator:
   pilotApi.includes("if(!(await operator(request)))")&&
   pilotApi.includes("if(body.action==='pilotIdentities')return await pilotIdentities()"),
  noAutoEnrollment:
   identityFlow.includes("review_state:'REVIEW_PENDING'")&&
   identityFlow.includes("monitoring_enabled:false,metrics_enabled:false"),
  historicalRefsStillOpen:
   snapshot.historicalC11BranchStillAccessible===true&&
   snapshot.historicalC11PrStillOpen===true,
  productionNotMistakenForStaging:
   snapshot.productionCreatorMigrationsDeployed===false&&
   snapshot.productionCreatorMigrationCount===0&&
   snapshot.hostedDevelopmentBranches===0,
 };
 const hardFailures=Object.entries(checks)
  .filter(([key,value])=>key==='historicalRefsStillOpen'?
   false:key==='productionNotMistakenForStaging'?false:value!==true)
  .map(([key])=>key);
 const manualEvidence=Object.fromEntries(REQUIRED_MANUAL_GATES.map(gate=>[gate,false]));
 const hardBlockers=[
  ...(snapshot.historicalC11BranchStillAccessible?['HISTORICAL_GIT_PUBLIC_API_DATA']:[]),
  ...(snapshot.actualGoogleCloudQuotaVerified?[]:['GOOGLE_CLOUD_ACTUAL_QUOTA_UNKNOWN']),
  ...(snapshot.hostedBackupPitrLogDeletionVerified?[]:['HOSTED_BACKUP_PITR_LOG_RETENTION_UNKNOWN']),
  ...(snapshot.independentStagingAuthorized?[]:['STAGING_NOT_AUTHORIZED']),
  ...(snapshot.operatorReviewedSingleCandidate?[]:['SINGLE_CHANNEL_EDITORIAL_REVIEW_PENDING']),
  ...(snapshot.realProviderPilotAuthorized?[]:['REAL_PROVIDER_PILOT_NOT_AUTHORIZED']),
  ...hardFailures.map(x=>'CODE_CHECK_FAILED_'+x),
 ];
 return {
  kind:'CINERELAY_C25_RELEASE_PREFLIGHT',asOf:evidence.observedAt,
  projectId:evidence.projectId,sourceCheckPassed:hardFailures.length===0,
  safeToRunLivePilot:false, // a dated static JSON cannot authorize live action
  noNewPaidResourcesCreated:true,
  checkedSourceFiles:REQUIRED_SOURCE_FILES.length,missingSourceFiles:missing,
  checks,manualEvidenceRequired:manualEvidence,
  blockers:[...new Set(hardBlockers)],
  caveat:'Read-only local evidence. Reverify all external gates with project owner; never enable C20 from this output.',
 };
}
export function fromCheckout(){
 const evidence=JSON.parse(load(SOURCE_EVIDENCE)),files=TRACKED();
 const contents=Object.fromEntries(REQUIRED_SOURCE_FILES
  .filter(p=>files.includes(p)).map(p=>[p,load(p)]));
 return evaluateC25(evidence,files,contents);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=process.argv[2]??'--audit';
 if(!['--audit','--pilot'].includes(arg)){
  console.error('Usage: node scripts/creator-intelligence/c25-launch-preflight.mjs --audit|--pilot');
  process.exitCode=64;
 }else{
  const result=fromCheckout();console.log(JSON.stringify(result,null,2));
  if(!result.sourceCheckPassed)process.exitCode=1;
  else if(arg==='--pilot')process.exitCode=2;
 }
}
