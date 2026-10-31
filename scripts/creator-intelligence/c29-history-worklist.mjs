/**
 * C29: non-destructive, metadata-only historical data review.
 * No network, no Git history mutation, no secrets, no provider calls.
 * The recorded status is a dated snapshot, NOT proof of retention compliance.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const C29_EVIDENCE_PATH='docs/07-execution/creator-c29-historical-review-evidence-2026-10-31.json';
const EXPECTED=Object.freeze({C2:100,C10:108,C11:109});
const REQUIRED_EXTERNAL=Object.freeze([
 'actualCloudQuotaVerified','supabaseBackupPitrLogsVerified',
 'ownerApprovalForHistoryRewrite','editorialPilotApproved',
 'costOfStagingApproved'
]);
const ACTIONS=Object.freeze([
 'Classify C2/C10/C11 API records and confirm applicable deletion or refresh limits',
 'Obtain owner and collaborator signoff before any rewrite, PR closure or branch deletion',
 'Inventory affected remote refs, commit objects, PR refs, forks, caches and clones',
 'Prepare a fresh-clone history remediation plan with rollback and affected-PR review',
 'Confirm GitHub retained-object and cache cleanup limitations; escalate to Support if appropriate',
 'Independently verify actual Google Cloud YouTube Data API quota and cinema source reserve',
 'Independently verify the CineRelay Supabase plan, database backups/PITR, logs and exports',
 'Approve the cost of isolated staging before provisioning any resource',
 'Rehearse operator-only TTL deletion with fake data in isolated staging',
 'Review one real creator and explicitly approve any one-shot official provider pilot'
]);
export function evaluateC29(evidence){
 if(!evidence||evidence.schema!=='CINERELAY_C29_GIT_HISTORY_METADATA_V1'||
   !/^\d{4}-\d{2}-\d{2}$/.test(evidence.observedAt??'')||
   evidence.snapshotOnly!==true||evidence.inspectedFileContents!==false||
   evidence.providerCallsMade!==false||evidence.productionMutationsMade!==false||
   evidence.releaseAuthorized!==false||
   evidence.repository!=='rayadinaveen98-ship-it/cinerelay'||
   !Array.isArray(evidence.historical)||evidence.historical.length!==3)
   throw Error('C29_INVALID_OR_UNTRUSTED_SNAPSHOT');

 const seen=new Set();
 for(const h of evidence.historical){
   if(!h||!Object.hasOwn(EXPECTED,h.key)||seen.has(h.key)||
     h.pr!==EXPECTED[h.key]||
     !['open','closed','unknown'].includes(h.prState)||
     !['accessible','not-rechecked','unknown','not-found'].includes(h.branchVisibility)||
     h.historicalObjectsPurged!==false||
     !Array.isArray(h.knownRiskPaths)||h.knownRiskPaths.length===0||
     h.knownRiskPaths.some(p=>typeof p!=='string'||!p.startsWith('research/creator-intelligence/')&&!p.startsWith('apps/web/src/data/')))
     throw Error('C29_UNVERIFIED_HISTORICAL_REF');
   seen.add(h.key);
 }
 const ext=evidence.externalGates;
 if(!ext||REQUIRED_EXTERNAL.some(key=>ext[key]!==false)||
    evidence.production?.creatorMigrationCount!==0||
    evidence.production?.stagingBranches!==0)
   throw Error('C29_EXTERNAL_GATES_NOT_INDEPENDENTLY_VERIFIED');
 const c11=evidence.historical.find(h=>h.key==='C11');
 const c11Expiry=Date.parse(evidence.c11LatestReportedObservationExpiry);
 if(!Number.isFinite(c11Expiry)||evidence.c11ExpiryScope?.includes('NOT a general deadline')!==true)
   throw Error('C29_EXPIRY_SCOPE_UNTRUSTED');
 const blockers=[
   'HISTORICAL_REF_AND_CACHED_OBJECT_REVIEW_REQUIRED',
   ...REQUIRED_EXTERNAL.map(x=>'EXTERNAL_'+x),
   'CREATOR_BACKEND_UNDEPLOYED'
 ];
 return {
  kind:'CINERELAY_C29_HISTORY_REMEDIATION_WORKLIST',
  observedAt:evidence.observedAt,
  repository:evidence.repository,
  snapshotOnly:true,
  historicalRefs:evidence.historical.map(h=>({
   code:h.key,pullRequest:h.pr,prStateAtObservation:h.prState,
   branchVisibilityAtObservation:h.branchVisibility,riskPathCount:h.knownRiskPaths.length,
   historicalObjectsPurged:false,
  })),
  c11LatestReportedObservationExpiry:evidence.c11LatestReportedObservationExpiry,
  c11ExpiryScope:evidence.c11ExpiryScope,
  production:evidence.production,
  requiredOwnerActions:[...ACTIONS],
  blockers,
  safeToRunLivePilot:false,
  historyCleanupAuthorized:false,
  releaseAuthorized:false,
  noPaidResourcesCreated:true,
  warning:'Dated metadata cannot establish deletion from Git history, PR refs, caches, forks or backups. A closed PR or missing branch is not clearance.'
 };
}
export function fromCheckout(){
 const evidence=JSON.parse(readFileSync(C29_EVIDENCE_PATH,'utf8'));
 return evaluateC29(evidence);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'--audit';
 if(!['--audit','--release'].includes(mode)){
   console.error('Usage: node scripts/creator-intelligence/c29-history-worklist.mjs --audit|--release');
   process.exitCode=64;
 }else{
   try{
     console.log(JSON.stringify(fromCheckout(),null,2));
     if(mode==='--release')process.exitCode=2;
   }catch(error){
     console.error(String(error.message??error));
     process.exitCode=1;
   }
 }
}
