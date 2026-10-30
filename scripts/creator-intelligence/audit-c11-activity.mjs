/**
 * C11 one-shot YouTube public activity evidence audit.
 * Max 21 requests (one channels.list for <=20 IDs + one playlistItems.list
 * per channel), no retries, no ingestion, no private analytics.
 * Never log API key, full URLs or raw provider responses.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const UC=/^UC[A-Za-z0-9_-]{22}$/;
const UU=/^UU[A-Za-z0-9_-]{22}$/;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const DATE=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const MAX_CHANNELS=20;
const MAX_REQUESTS=MAX_CHANNELS+1;
function date(value){return typeof value==='string'&&DATE.test(value)&&Number.isFinite(Date.parse(value));}
function timestamp(value){return date(value)?new Date(value).toISOString():null;}
function decimal(value){return typeof value==='string'&&/^(?:0|[1-9]\d{0,19})$/.test(value)?value:null;}
export function validateC11Input(pilot) {
 if(!pilot||pilot.kind!=='CINERELAY_C10_OFFICIAL_API_IDENTITY_REVIEW'||
 !Array.isArray(pilot.channels)||pilot.channels.length!==MAX_CHANNELS||
 !date(pilot.verifiedAt))throw Error('C11 needs the complete 20-ID official C10 cohort');
 const unique=new Set(),handles=new Set();
 for(const c of pilot.channels){
  if(!c||typeof c.channelId!=='string'||!UC.test(c.channelId)||
    typeof c.uploadsPlaylistId!=='string'||!UU.test(c.uploadsPlaylistId)||
    c.uploadsPlaylistId!=='UU'+c.channelId.slice(2)||
    typeof c.listedHandle!=='string'||!c.listedHandle.startsWith('@')||
    unique.has(c.channelId)||handles.has(c.listedHandle.toLowerCase())||
    c.identityState!=='OFFICIAL_API_ID_VERIFIED_REVIEW_PENDING'||
    c.operatorApproved!==false||c.monitoringEnabled!==false||c.metricsEnabled!==false)
   throw Error('Invalid, duplicated, or activated C11 pilot identity');
  unique.add(c.channelId);handles.add(c.listedHandle.toLowerCase());
 }
 return pilot.channels;
}
function safeResponse(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.items))throw Error('Malformed provider response');
 return data.items;
}
function makeApiUrl(route,params,key){
 const url=new URL('https://www.googleapis.com/youtube/v3/'+route);
 for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
 url.searchParams.set('key',key);
 return url.toString();
}
export async function runC11ActivityAudit({pilot,apiKey,fetcher=fetch,at=new Date().toISOString(),requestLimit=MAX_REQUESTS}){
 const channels=validateC11Input(pilot);
 if(!date(at))throw Error('Expected UTC observation timestamp');
 if(!Number.isSafeInteger(requestLimit)||requestLimit<0||requestLimit>MAX_REQUESTS)
  throw Error('Request cap must be 0–21');
 const report={kind:'CINERELAY_C11_PUBLIC_ACTIVITY_AUDIT',observedAt:at,
  expiresAt:new Date(Date.parse(at)+30*86400000).toISOString(),
  sourceVerificationAt:pilot.verifiedAt,channelCount:channels.length,
  quotaBucket:'GENERAL_READ',maxRequests:MAX_REQUESTS,usedRequests:0,
  status:'PENDING',channelResults:[],monitoringEnabled:false,metricsEnabled:false};
 if(!apiKey){report.status='BLOCKED_MISSING_GITHUB_API_KEY';return report;}
 if(requestLimit===0){report.status='BLOCKED_ZERO_BUDGET';return report;}
 let info;
 try{
  report.usedRequests++;
  const response=await fetcher(makeApiUrl('channels',{
    part:'contentDetails,statistics',
    id:channels.map(x=>x.channelId).join(','),
    fields:'items(id,contentDetails(relatedPlaylists(uploads)),statistics(subscriberCount,hiddenSubscriberCount,videoCount))',
  },apiKey),{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok){report.status=[401,403,429].includes(response.status)?'BLOCKED_PROVIDER_AUTH_OR_QUOTA':'BLOCKED_CHANNEL_HTTP_ERROR';return report;}
  const items=safeResponse(await response.json());
  info=new Map();
  for(const item of items){
   if(!item||typeof item.id!=='string'||!UC.test(item.id)||info.has(item.id)||
    !channels.some(x=>x.channelId===item.id))throw Error('Unexpected channel ID in API response');
   info.set(item.id,item);
  }
 }catch{report.status='BLOCKED_CHANNEL_RESPONSE';return report;}
 let halted=false;
 for(const c of channels){
  const record=info.get(c.channelId);
  const result={channelId:c.channelId,listedHandle:c.listedHandle,
    verificationState:'OFFICIAL_API_ID_VERIFIED_REVIEW_PENDING',
    monitoringEnabled:false,metricsEnabled:false,subscriberCountApprox:null,
    subscriberHidden:null,videoCountPublic:null,latestPublicVideos:[],status:'PENDING'};
  if(!record){
   result.status='MISSING_FROM_CURRENT_API_RESPONSE';report.channelResults.push(result);
   continue;
  }
  if(record?.contentDetails?.relatedPlaylists?.uploads!==c.uploadsPlaylistId){
   result.status='UPLOADS_PLAYLIST_ID_CHANGED';report.channelResults.push(result);
   continue;
  }
  const stats=record.statistics;
  result.subscriberHidden=typeof stats?.hiddenSubscriberCount==='boolean'?stats.hiddenSubscriberCount:null;
  result.subscriberCountApprox=result.subscriberHidden===false?decimal(stats?.subscriberCount):null;
  result.videoCountPublic=decimal(stats?.videoCount);
  if(halted||report.usedRequests>=requestLimit){
   result.status=halted?'BLOCKED_UPSTREAM':'NOT_ATTEMPTED_BUDGET';
   report.channelResults.push(result);continue;
  }
  report.usedRequests++;
  try{
   const response=await fetcher(makeApiUrl('playlistItems',{
    part:'contentDetails',playlistId:c.uploadsPlaylistId,maxResults:'3',
    fields:'items(contentDetails(videoId,videoPublishedAt))'
   },apiKey),{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!response.ok){
    result.status='PLAYLIST_HTTP_ERROR';
    if([401,403,429].includes(response.status))halted=true;
   }else{
    const items=safeResponse(await response.json());
    if(items.length>3)throw Error('Unexpected playlist length');
    const ids=new Set();
    const recent=[];
    for(const item of items){
     const videoId=item?.contentDetails?.videoId;
     const publishedAt=timestamp(item?.contentDetails?.videoPublishedAt);
     if(typeof videoId!=='string'||!VIDEO.test(videoId)||ids.has(videoId)||
       (item?.contentDetails?.videoPublishedAt!=null&&!publishedAt))
      throw Error('Malformed playlist item');
     ids.add(videoId);
     recent.push({videoId,publishedAt});
    }
    result.latestPublicVideos=recent;
    result.status=items.length===0?'NO_PUBLIC_UPLOADS_IN_PLAYLIST':'PUBLIC_UPLOADS_OBSERVED';
   }
  }catch{result.status='PLAYLIST_RESPONSE_ERROR';}
  report.channelResults.push(result);
 }
 const clean=report.channelResults.length===MAX_CHANNELS&&report.channelResults.every(x=>
   x.status==='PUBLIC_UPLOADS_OBSERVED'||x.status==='NO_PUBLIC_UPLOADS_IN_PLAYLIST');
 report.status=halted?'HALTED_PROVIDER_AUTH_OR_QUOTA':
 clean&&report.usedRequests===MAX_REQUESTS?'COMPLETED':'PARTIAL_EVIDENCE';
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const inputFile=process.env.CREATOR_C11_PILOT_FILE||'apps/web/src/data/creator-official-pilot-2026-10-30.json';
 const outputFile=process.env.CREATOR_C11_RESULT_FILE||'research/creator-intelligence/c11-public-activity-results.json';
 const input=JSON.parse(await readFile(inputFile,'utf8'));
 const result=await runC11ActivityAudit({pilot:input,apiKey:process.env.YOUTUBE_API_KEY||''});
 await writeFile(outputFile,JSON.stringify(result,null,2)+'\n','utf8');
 const statuses={};for(const row of result.channelResults)statuses[row.status]=(statuses[row.status]||0)+1;
 console.log(JSON.stringify({status:result.status,usedRequests:result.usedRequests,maxRequests:result.maxRequests,
  resultCounts:statuses,outputFile},null,2));
 if(result.status!=='COMPLETED')process.exitCode=1;
}
