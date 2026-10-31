/**
 * CineRelay C31: offline request-capacity forecasts, not a quota verification.
 * Google project-specific quotas and existing cinema source traffic are UNKNOWN.
 * Never contact APIs or schedule a request based on the output of this module.
 */
import {pathToFileURL} from 'node:url';
import {estimateCreatorDiscoveryBudget} from
 '../../packages/youtube-connector/dist/creator-intelligence.js';

export const DEFAULT_ASSUMPTIONS=Object.freeze({
 channels:1000,
 playlistChecksPerChannelPerDay:1,
 channelLookupsPerDay:0,
 activelyObservedVideos:3000,
 statsChecksPerVideoPerDay:24,
 conservativeVideosPerBatch:50,
 existingCinemaGeneralReadUnits:1200, // HYPOTHETICAL placeholder, not measured!
 otherGeneralReadUnits:0,
 generalDailyLimit:10000, // published default, NOT verified project allocation
 generalReserveUnits:2000,
 generalAlreadyConsumed:0,
 statsDailyLimit:10000, // published default for dedicated bucket, NOT project proof
 statsReserveUnits:1000,
 statsAlreadyConsumed:0,
});
const numeric=(name,x)=>{
 if(!Number.isSafeInteger(x)||x<0)throw new RangeError(name+' must be a nonnegative safe integer');
 return x;
};
const add=(a,b)=>{
 const n=a+b;
 if(!Number.isSafeInteger(n))throw new RangeError('Capacity arithmetic overflow');
 return n;
};
const multiply=(a,b)=>{
 const n=a*b;
 if(!Number.isSafeInteger(n))throw new RangeError('Capacity arithmetic overflow');
 return n;
};
const ceilDiv=(n,d)=>Math.floor(n/d)+(n%d===0?0:1);
export function forecastCreatorQuota(input){
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw Error('C31_INVALID_ASSUMPTIONS');
 const keys=Object.keys(DEFAULT_ASSUMPTIONS);
 if(keys.some(k=>!Object.hasOwn(input,k))||
    Object.keys(input).some(k=>!Object.hasOwn(DEFAULT_ASSUMPTIONS,k)))
  throw Error('C31_INCOMPLETE_OR_UNKNOWN_ASSUMPTION');
 for(const key of keys)numeric(key,input[key]);
 if(input.conservativeVideosPerBatch<1||input.conservativeVideosPerBatch>50)
  throw RangeError('C31 1-50 video batch safety limit');
 if(input.generalReserveUnits>input.generalDailyLimit||
    input.statsReserveUnits>input.statsDailyLimit)
  throw RangeError('C31 reserve exceeds bucket allocation');
 const playlistUnits=multiply(input.channels,input.playlistChecksPerChannelPerDay);
 const general=estimateCreatorDiscoveryBudget({
  newChannels:input.channels,
  channelLookupRequests:input.channelLookupsPerDay,
  playlistChecksPerChannelPerDay:input.playlistChecksPerChannelPerDay,
  existingGeneralReadUnits:add(input.existingCinemaGeneralReadUnits,input.generalAlreadyConsumed),
  otherGeneralReadUnits:input.otherGeneralReadUnits,
  dailyGeneralReadUnits:input.generalDailyLimit,
  reserveUnits:input.generalReserveUnits,
 });
 const batchRequestsPerSweep=ceilDiv(input.activelyObservedVideos,input.conservativeVideosPerBatch);
 const videoStatsDailyUnits=multiply(batchRequestsPerSweep,input.statsChecksPerVideoPerDay);
 const statsProjected=add(input.statsAlreadyConsumed,videoStatsDailyUnits);
 const statsHeadroom=input.statsDailyLimit-input.statsReserveUnits-statsProjected;
 if(!Number.isSafeInteger(statsHeadroom))throw RangeError('Capacity arithmetic overflow');
 const generalHeadroom=general.headroom;
 return {
  kind:'CINERELAY_C31_OFFLINE_CAPACITY_FORECAST',
  evidence:'HYPOTHETICAL_ONLY',
  assumptions:{...input},
  generalRead:{
   bucket:'GENERAL_READ',
   playlistRequestUnitsPerDay:playlistUnits,
   channelLookupUnitsPerDay:input.channelLookupsPerDay,
   existingCinemaUnitsAssumed:input.existingCinemaGeneralReadUnits,
   otherGeneralReadUnitsAssumed:input.otherGeneralReadUnits,
   alreadyConsumedUnitsAssumed:input.generalAlreadyConsumed,
   reserveUnits:input.generalReserveUnits,
   totalPlannedUnits:general.totalProjectedUnits,
   headroomUnits:generalHeadroom,
   fitsAssumedQuota:general.safe,
  },
  videoStats:{
   bucket:'VIDEO_BATCH_STATS',
   activeVideosAssumed:input.activelyObservedVideos,
   conservativeBatchSize:input.conservativeVideosPerBatch,
   requestsPerSweep:batchRequestsPerSweep,
   sweepsPerDayAssumed:input.statsChecksPerVideoPerDay,
   totalPlannedUnits:statsProjected,
   headroomUnits:statsHeadroom,
   fitsAssumedQuota:statsHeadroom>=0,
  },
  fitsBothAssumedBuckets:general.safe&&statsHeadroom>=0,
  actualGoogleCloudAllocationVerified:false,
  actualGoogleCloudUsageVerified:false,
  cinema185SourceTrafficMeasured:false,
  liveProviderCallsMade:0,
  safeToEnableCollection:false,
  liveCreatorPilotAuthorized:false,
  monitoringEnabled:false,
  comparisonEnabled:false,
  warning:'Only hypothetical daily API request budgeting. This neither proves actual quota nor authorizes monitoring, API calls or provider-data retention.',
 };
}
export function creatorCapacityScenarios(){
 const base={...DEFAULT_ASSUMPTIONS};
 const scenarios=[
  {name:'20 creator daily discovery, six-hour statistics',
   values:{...base,channels:20,playlistChecksPerChannelPerDay:1,
    activelyObservedVideos:60,statsChecksPerVideoPerDay:4}},
  {name:'1,000 creators hourly playlist discovery and hourly statistics',
   values:{...base,channels:1000,playlistChecksPerChannelPerDay:24,
    activelyObservedVideos:3000,statsChecksPerVideoPerDay:24}},
  {name:'1,000 creators daily playlist discovery, hourly video statistics',
   values:{...base,channels:1000,playlistChecksPerChannelPerDay:1,
    activelyObservedVideos:3000,statsChecksPerVideoPerDay:24}},
 ];
 return scenarios.map(s=>({name:s.name,forecast:forecastCreatorQuota(s.values)}));
}
export function parseC31Args(args){
 let input={...DEFAULT_ASSUMPTIONS};
 const names=new Set(Object.keys(input));
 const seen=new Set();
 let mode='forecast';
 for(const arg of args){
  if(arg==='--pilot'&&mode==='forecast'){mode='pilot';continue;}
  const match=/^--([a-zA-Z][a-zA-Z0-9]*)=(0|[1-9][0-9]*)$/.exec(arg);
  if(!match||!names.has(match[1])||seen.has(match[1])||mode==='pilot')
   throw Error('C31_INVALID_ARGUMENT');
  const value=Number(match[2]);
  numeric(match[1],value);
  input[match[1]]=value;
  seen.add(match[1]);
 }
 return {mode,input};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {input,mode}=parseC31Args(process.argv.slice(2));
  const out=forecastCreatorQuota(input);
  console.log(JSON.stringify(out,null,2));
  if(mode==='pilot')process.exitCode=2;
 }catch(error){
  console.error('C31_REJECTED: '+String(error.message??error));
  process.exitCode=1;
 }
}
