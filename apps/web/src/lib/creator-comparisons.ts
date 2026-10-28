/**
 * CineRelay C6 comparison math — explicitly gated by operator/API policy.
 *
 * Compare FACTUAL public cumulative video counters at similar observed ages.
 * No normalization, estimation, interpolation, fictional hourly series,
 * channel ranking, winner label, inferred scores or private Analytics metrics.
 */
export const C6_AGE_WINDOWS = [
  {key:'6h',label:'Around 6 hours',targetHours:6,toleranceHours:1},
  {key:'24h',label:'Around 24 hours',targetHours:24,toleranceHours:2},
  {key:'48h',label:'Around 48 hours',targetHours:48,toleranceHours:3},
  {key:'72h',label:'Around 72 hours',targetHours:72,toleranceHours:4},
  {key:'7d',label:'Around 7 days',targetHours:168,toleranceHours:12},
] as const;
type VideoFormat='LONG'|'SHORT'|'LIVE'|'UNKNOWN';
export type ComparableVideo={
  videoId:string;channelId:string;publishedAt:string;format:VideoFormat;
  samples:readonly {observedAt:string;viewCount:string|null;likeCount:string|null;commentCount:string|null}[];
};
type C6Status='OBSERVED'|'MISSING_A'|'MISSING_B'|'MISSING_BOTH';
type C6Sample={observedAt:string;ageHours:number;viewCount:string|null;likeCount:string|null;commentCount:string|null};
export type C6Window={key:string;label:string;targetHours:number;toleranceHours:number;
  status:C6Status;a:C6Sample|null;b:C6Sample|null};
export type C6Comparison={
  comparable:boolean;reason:'READY'|'SAME_VIDEO'|'FORMAT_UNKNOWN'|'FORMAT_MISMATCH'|'INVALID_INPUT';
  format:VideoFormat|null;windows:C6Window[];completeWindows:number;
};
const VIDEO=/^[A-Za-z0-9_-]{11}$/,CHANNEL=/^UC[A-Za-z0-9_-]{22}$/,COUNT=/^\d+$/;
const HOUR=3600000;
function time(value:string):number {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return Number.NaN;
  return Date.parse(value);
}
function validCount(v:string|null):boolean {
  return v===null || (typeof v==='string'&&COUNT.test(v));
}
function validVideo(v:ComparableVideo):boolean {
  const published=time(v.publishedAt);
  return VIDEO.test(v.videoId) && CHANNEL.test(v.channelId) &&
    Number.isFinite(published) && ['LONG','SHORT','LIVE','UNKNOWN'].includes(v.format) &&
    Array.isArray(v.samples) && v.samples.length<=800 &&
    v.samples.every(s=>Number.isFinite(time(s.observedAt))&&time(s.observedAt)>=published &&
      validCount(s.viewCount)&&validCount(s.likeCount)&&validCount(s.commentCount));
}
function nearest(v:ComparableVideo, nowMs:number, targetHours:number,toleranceHours:number):C6Sample|null{
  const published=time(v.publishedAt),maxDeviation=toleranceHours*HOUR;
  let best:{sample:C6Sample;distance:number;stamp:number}|null=null;
  for(const s of v.samples){
    const t=time(s.observedAt),age=(t-published)/HOUR;
    // Do not present expired, future or inaccessible public metric readings.
    if(t>nowMs+60000||t<nowMs-30*24*HOUR||s.viewCount===null)continue;
    const distance=Math.abs(age-targetHours)*HOUR;
    if(distance>maxDeviation)continue;
    if(!best||distance<best.distance||(distance===best.distance&&t>best.stamp)){
      best={sample:{observedAt:s.observedAt,ageHours:age,viewCount:s.viewCount,
        likeCount:s.likeCount,commentCount:s.commentCount},distance,stamp:t};
    }
  }
  return best?.sample??null;
}
/** For a future approved analytics product only; never call from the operator
 * UI without the server-verified C6 approval gate.
 */
export function comparePublicVideoObservations(
  a:ComparableVideo,b:ComparableVideo,now:string
):C6Comparison{
  const nowMs=time(now);
  const zero={comparable:false,format:null,windows:[],completeWindows:0} as const;
  if(!Number.isFinite(nowMs)||!validVideo(a)||!validVideo(b))
    return {...zero,reason:'INVALID_INPUT'};
  if(a.videoId===b.videoId)return {...zero,reason:'SAME_VIDEO'};
  if(a.format==='UNKNOWN'||b.format==='UNKNOWN')return {...zero,reason:'FORMAT_UNKNOWN'};
  if(a.format!==b.format)return {...zero,reason:'FORMAT_MISMATCH'};
  const windows:C6Window[]=C6_AGE_WINDOWS.map(({key,label,targetHours,toleranceHours})=>{
    const va=nearest(a,nowMs,targetHours,toleranceHours);
    const vb=nearest(b,nowMs,targetHours,toleranceHours);
    const status:C6Status=va&&vb?'OBSERVED':!va&&!vb?'MISSING_BOTH':!va?'MISSING_A':'MISSING_B';
    return {key,label,targetHours,toleranceHours,status,a:va,b:vb};
  });
  return {comparable:true,reason:'READY',format:a.format,windows,
    completeWindows:windows.filter(x=>x.status==='OBSERVED').length};
}
