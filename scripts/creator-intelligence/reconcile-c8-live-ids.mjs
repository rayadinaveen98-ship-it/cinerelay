/**
 * CineRelay C8 — reconcile evidence with a fresh, read-only production
 * YouTube UC-ID snapshot. No live database calls, network, mutations or
 * automatic monitoring. A generated review queue is NOT approval.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {auditC7Pilot} from './audit-c7-pilot.mjs';

const UC=/^UC[A-Za-z0-9_-]{22}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const MAX_AGE_MS=15*60*1000;
const SOURCE='PUBLIC_SOURCE_IDENTITIES_YOUTUBE_SELECT_ONLY';

function instant(value,name){
  if(typeof value!=='string'||!UTC.test(value)||!Number.isFinite(Date.parse(value)))
    throw Error('Invalid '+name+' UTC timestamp');
  return Date.parse(value);
}

export function reconcileC8LiveIds({pool,existing,verification,live,firstParty,
  at=new Date().toISOString(),maxReview=10}){
  const now=instant(at,'audit');
  if(!live || live.kind!=='CINERELAY_C8_LIVE_SOURCE_IDS'||live.source!==SOURCE||
    !Array.isArray(live.channelIds)||live.channelIds.length===0||
    !Number.isInteger(live.sourceCount)||live.sourceCount!==live.channelIds.length)
    throw Error('C8 requires a complete explicit SELECT-only production UC-ID snapshot');
  const captured=instant(live.capturedAt,'production snapshot');
  if(captured>now)throw Error('Future source snapshot cannot be trusted');
  const liveSet=new Set();
  for(const id of live.channelIds){
    if(typeof id!=='string'||!UC.test(id)||liveSet.has(id))
      throw Error('Invalid or duplicate live source UC identity');
    liveSet.add(id);
  }
  const baseline=new Set(existing?.channelIds);
  if(!existing||!Array.isArray(existing.channelIds)||baseline.size!==existing.channelIds.length ||
    [...baseline].some(id=>typeof id!=='string'||!UC.test(id)))
    throw Error('Invalid old source-ID baseline');
  if(!firstParty || firstParty.apiVerified!==false||firstParty.reviewApproved!==false||
    firstParty.trackingEnabled!==false||!Array.isArray(firstParty.matches))
    throw Error('First-party public-page leads cannot be treated as API verification');
  const pageSeen=new Set();
  const pages=firstParty.matches.map(x=>{
    if(!x || typeof x.officialChannelId!=='string'||!UC.test(x.officialChannelId)||
      x.firstPartyChannelPage!=='https://www.youtube.com/channel/'+x.officialChannelId ||
      x.stage!=='YOUTUBE_PAGE_ID_FOUND_API_PENDING'||x.approved!==false ||
      pageSeen.has(x.officialChannelId))throw Error('Invalid or duplicated first-party preliminary evidence');
    pageSeen.add(x.officialChannelId);
    return {name:x.name,listedHandle:x.listedHandle,
      duplicateInCurrentProduction:liveSet.has(x.officialChannelId),
      stage:'PRELIMINARY_ONLY_NOT_API_VERIFIED'};
  });
  const c7=auditC7Pilot({pool,existing,verification,at,maxReview});
  const added=[...liveSet].filter(id=>!baseline.has(id));
  const removed=[...baseline].filter(id=>!liveSet.has(id));
  const fresh=now-captured<=MAX_AGE_MS;
  const drift=added.length>0||removed.length>0;
  const wouldReview=c7.reviewQueue;
  const currentDuplicates=wouldReview.filter(x=>liveSet.has(x.officialChannelId));
  // C7 can report a partial reviewQueue during quota/auth failure; do not
  // surface it. Only a live, non-drifting snapshot plus valid C7 status opens
  // a human review queue, NEVER an activation pathway.
  const canShowReview=c7.status==='AWAITING_OPERATOR_REVIEW'&&fresh&&!drift&&
    currentDuplicates.length===0;
  const status=!fresh?'BLOCKED_STALE_LIVE_SNAPSHOT':
    drift?'BLOCKED_PRODUCTION_ID_DRIFT':
    currentDuplicates.length?'BLOCKED_LIVE_ID_COLLISION':
    c7.status==='AWAITING_OPERATOR_REVIEW'?'AWAITING_HUMAN_IDENTITY_REVIEW':
    'BLOCKED_'+c7.status;
  return {
    kind:'CINERELAY_CREATOR_C8_LIVE_DEDUPE',auditedAt:at,
    status,sourceReportStatus:c7.status,
    sourceSnapshot:{capturedAt:live.capturedAt,source:SOURCE,
      maximumAgeMinutes:15,withinFreshnessWindow:fresh,
      currentTotal:liveSet.size,previousTotal:baseline.size,
      addedIds:added.length,removedIds:removed.length,
      // A digest for audit; never a claimed Google approval or freshness proof.
      sortedIdsSha256:createHash('sha256').update([...liveSet].sort().join('\n')).digest('hex')},
    pilot:{researchCandidates:c7.counts.researchCandidates,
      apiVerifiedRows:c7.counts.officialIdsResolved,
      preliminaryPublicPageMatches:pages.length,
      preliminaryNowDuplicate:pages.filter(x=>x.duplicateInCurrentProduction).length,
      candidateAlreadyInCurrentProduction:currentDuplicates.length,
      eligibleForHumanReview:canShowReview?wouldReview.length:0},
    preliminaryPublicPageEvidence:pages,
    reviewQueue:canShowReview?wouldReview:[],
    gates:{...c7.gates,liveProductionUcIdDedupeComplete:fresh&&!drift&&
      currentDuplicates.length===0,creatorOperatorApprovalsPresent:false,
      projectQuotasConfirmed:false,youtubeDerivedMetricsPermissionVerified:false,
      productionCollectionAuthorized:false},
    safeguards:{noNetworkRequests:true,noDatabaseWrites:true,noCreatorActivation:true,
      noMetricsCollection:true,noCrossChannelComparison:true},
    nextStep:!fresh?'Capture fresh SELECT-only production YouTube IDs within 15 minutes of audit':
      drift?'Review changed production IDs and refresh the baseline with human approval':
      currentDuplicates.length?'Investigate new UC-ID collisions before reviewing any creator':
      c7.nextStep
  };
}

// Optional offline CLI. Never queries production itself and never accepts
// credentials. Current real source snapshot must be supplied as JSON.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const base='research/creator-intelligence/';
  const read=name=>readFile(base+name,'utf8').then(JSON.parse);
  const snapshotFile=process.argv[2]||'c8-live-youtube-source-ids-2026-10-28.json';
  const [pool,existing,verification,firstParty,live]=await Promise.all([
    read('c2-verification-input-20.json'),
    read('c2-existing-youtube-ids-2026-10-28.json'),
    read('c2-official-id-results.json'),
    read('c2-first-party-page-identity-matches-2026-10-28.json'),
    read(snapshotFile)]);
  console.log(JSON.stringify(reconcileC8LiveIds({pool,existing,verification,firstParty,live}),null,2));
}
