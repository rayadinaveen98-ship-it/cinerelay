import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
 fetchCreatorComparisonStatus,fetchCreatorOverview,fetchCreatorDetail,
 fetchCreatorComparison,
} from '../lib/creator-intelligence-api';
import {comparePublicVideoObservations} from '../lib/creator-comparisons';
import {formatPublicCounter} from '../lib/creator-metrics';

const idPattern=/^UC[A-Za-z0-9_-]{22}$/;
const videoPattern=/^[A-Za-z0-9_-]{11}$/;
function Message({title,children}:{title:string;children:React.ReactNode}){
 return <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8">
  <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{children}</p>
 </section>;
}
export function CreatorComparisonPage(){
 const [aId,setAId]=useState('');
 const [bId,setBId]=useState('');
 const [aVideoId,setAVideoId]=useState('');
 const [bVideoId,setBVideoId]=useState('');
 const permission=useQuery({
   queryKey:['creator-c6-comparison-permission'],queryFn:fetchCreatorComparisonStatus,
   retry:false,staleTime:30_000,
 });
 // A policy-disallowed operator cannot accidentally invoke cross-channel reads.
 const permitted=permission.data?.enabled===true;
 const overview=useQuery({
   queryKey:['creator-c6-comparison-channels'],queryFn:fetchCreatorOverview,
   enabled:permitted,retry:false,
 });
 const entries=overview.data?.channels.filter(c=>c.reviewState==='APPROVED'&&c.monitoringEnabled)??[];
 const channelA=entries.some(x=>x.channelId===aId)?aId:entries[0]?.channelId??'';
 const channelB=entries.some(x=>x.channelId===bId)&&bId!==channelA?bId:
   entries.find(x=>x.channelId!==channelA)?.channelId??'';
 const aInfo=useQuery({queryKey:['creator-c6-detail',channelA],queryFn:()=>fetchCreatorDetail(channelA),
   enabled:permitted&&idPattern.test(channelA),retry:false});
 const bInfo=useQuery({queryKey:['creator-c6-detail',channelB],queryFn:()=>fetchCreatorDetail(channelB),
   enabled:permitted&&idPattern.test(channelB),retry:false});
 const aVideos=aInfo.data?.videos.filter(x=>x.format!=='UNKNOWN')??[];
 const actualAVideo=aVideos.some(x=>x.videoId===aVideoId)?aVideoId:aVideos[0]?.videoId??'';
 const formatA=aVideos.find(x=>x.videoId===actualAVideo)?.format;
 const bVideos=bInfo.data?.videos.filter(x=>x.format===formatA)??[];
 const actualBVideo=bVideos.some(x=>x.videoId===bVideoId)?bVideoId:bVideos[0]?.videoId??'';
 const canCompare=permitted&&channelA!==channelB&&idPattern.test(channelA)&&
   idPattern.test(channelB)&&videoPattern.test(actualAVideo)&&videoPattern.test(actualBVideo)&&
   formatA!==undefined&&actualAVideo!==actualBVideo;
 const pair=useQuery({
   queryKey:['creator-c6-pair',channelA,actualAVideo,channelB,actualBVideo],
   queryFn:()=>fetchCreatorComparison({
     aChannelId:channelA,aVideoId:actualAVideo,bChannelId:channelB,bVideoId:actualBVideo,
   }),
   enabled:canCompare,retry:false,refetchInterval:60_000,
 });
 const comparison=pair.data?comparePublicVideoObservations(pair.data.a,pair.data.b,pair.data.generatedAt):null;
 return <main className="min-w-0 space-y-6 pb-12">
  <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/20 p-6 sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">CineRelay / Creator Intelligence / C6</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Compare public observations.</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
      Compare individual public YouTube videos at approximately equivalent ages.
      Every value must be an actual API reading. This is neither a creator ranking nor a prediction.
    </p>
    <span className="mt-5 inline-block rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400">
      Operator only · YouTube permission required
    </span>
  </section>
  {permission.isPending?<Message title="Checking analytics permission">Checking server-side YouTube analytics approval before retrieving any comparison data.</Message>:
  permission.isError?<Message title="Comparison service unavailable">
   The comparison API is not deployed or could not validate your operator session. No comparison has been attempted.
  </Message>:
  !permitted?<Message title="Comparisons are not enabled">
   YouTube requires explicit permission for cross-channel performance tracking and certain derived analytics.
   This feature is intentionally locked until the required permission is verified and documented.
   You can still view individual creators in the Creator Intelligence directory when that service is deployed.
  </Message>:
  overview.isPending?<Message title="Loading approved creators">Reading the verified creator directory.</Message>:
  overview.isError?<Message title="Creator directory unavailable">Unable to read operator-approved creators.</Message>:
  entries.length<2?<Message title="At least two approved creators are needed">
   The research candidate list is not a live creator database. Two verified, operator-approved, actively monitored channels are required before comparison.
  </Message>:<>
    <section className="grid gap-4 lg:grid-cols-2">
     {([
       {side:'A' as const,channel:channelA,video:actualAVideo,setChannel:setAId,setVideo:setAVideoId,options:aVideos},
       {side:'B' as const,channel:channelB,video:actualBVideo,setChannel:setBId,setVideo:setBVideoId,options:bVideos},
     ]).map(({side,channel,video,setChannel,setVideo,options})=>
       <div key={side} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Video {side}</p>
        <label className="mt-4 block text-sm text-zinc-300">Creator
         <select value={channel} onChange={e=>{setChannel(e.target.value);setVideo('');}}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100">
          {entries.filter(x=>side==='A'||x.channelId!==channelA).map(c=>
           <option key={c.channelId} value={c.channelId}>{c.title}</option>)}
         </select>
        </label>
        <label className="mt-4 block text-sm text-zinc-300">Public video
         <select value={video} onChange={e=>setVideo(e.target.value)}
          disabled={options.length===0}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 disabled:opacity-50">
          {options.length===0?<option value="">No eligible matching videos</option>:
           options.map(v=><option key={v.videoId} value={v.videoId}>{v.videoId} · {v.format}</option>)}
         </select>
        </label>
        <p className="mt-3 text-xs text-zinc-500">Same public video format required. Unknown formats cannot be compared.</p>
       </div>)}
    </section>
    {!canCompare?<Message title="No eligible matching videos">
      Select two different verified channels with available public videos of the same known format. Unknown or missing formats are not guessed.
    </Message>:pair.isPending?<Message title="Reading captured observations">
      Loading only existing public YouTube counter observations. No new provider calls are triggered.
    </Message>:pair.isError?<Message title="Comparison readings unavailable">
      This may reflect missing stored data, a changed approval, a stale creator, or a temporary service failure.
    </Message>:comparison?.reason!=='READY'?<Message title="This pair is not comparable">
      Both videos need distinct identities, valid publication timestamps and the same known content format.
    </Message>:<>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
       <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Equivalent-age observations</p>
       <h2 className="mt-2 text-xl font-semibold">Two videos. Same age window. Actual readings.</h2>
       <p className="mt-3 text-sm text-zinc-400">
         Format: {comparison.format} · {comparison.completeWindows} of {comparison.windows.length} windows with public view observations from both videos.
       </p>
       <p className="mt-2 text-xs leading-6 text-zinc-500">
         We use the nearest reading within the tolerance shown for each window. No interpolated or backfilled views,
         comparison scores, winner labels, private analytics, or channel-wide rankings.
       </p>
       <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
         <thead><tr className="border-b border-zinc-700 text-xs uppercase tracking-wide text-zinc-400">
          <th scope="col" className="px-3 py-3">Age window</th>
          <th scope="col" className="px-3 py-3">{pair.data?.a.channelTitle} · A</th>
          <th scope="col" className="px-3 py-3">{pair.data?.b.channelTitle} · B</th>
          <th scope="col" className="px-3 py-3">Coverage</th>
         </tr></thead>
         <tbody>
          {comparison.windows.map(row=><tr key={row.key} className="border-b border-zinc-800 align-top">
           <td className="px-3 py-4 font-medium text-zinc-200">{row.label}
            <p className="mt-1 text-xs font-normal text-zinc-500">±{row.toleranceHours}h</p></td>
           {[row.a,row.b].map((value,i)=><td key={i} className="px-3 py-4 tabular-nums">
             {value?<><p className="font-medium text-zinc-100">{formatPublicCounter(value.viewCount)} views</p>
              <p className="mt-1 text-xs text-zinc-400">Actual age {value.ageHours.toFixed(1)}h</p>
              <p className="mt-1 text-xs text-zinc-500">{new Date(value.observedAt).toLocaleString()}</p></>:
              <span className="text-zinc-500">Not observed in window</span>}</td>)}
           <td className="px-3 py-4 text-xs text-zinc-400">{row.status==='OBSERVED'?'Both observed':
             row.status==='MISSING_BOTH'?'Neither observed':row.status==='MISSING_A'?'Video A missing':'Video B missing'}</td>
          </tr>)}
         </tbody>
        </table>
       </div>
       <p className="mt-4 text-xs leading-6 text-zinc-500">
         Sources: stored YouTube public counters from the last 30 days. Readings may differ by actual video age within each tolerance.
         Comparisons are internal, permission-gated and not published as competitive leaderboards.
       </p>
      </section>
    </>}
  </>}
 </main>;
}
