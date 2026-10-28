import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCreatorOverview,fetchCreatorDetail,
} from '../lib/creator-intelligence-api';
import {creatorChartPoints,formatPublicCounter,observedGrowth,observedPublicationHours} from '../lib/creator-metrics';

type Filter='all'|'monitoring'|'review';
const getTime=(value:string,zone:string)=>
 new Intl.DateTimeFormat('en-IN',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function Metric({label,value,note}:{label:string;value:number;note?:string}){
 return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
   <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
   <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-zinc-50">{value.toLocaleString('en-IN')}</p>
   {note&&<p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>}
 </div>;
}
function EmptyPanel({title,children}:{title:string;children:React.ReactNode}){
 return <section className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-10 text-center">
  <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-amber-600/40 bg-amber-400/10 text-amber-300" aria-hidden="true">◎</div>
  <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">{children}</p>
 </section>;
}
function Stage({value}:{value:string}){
 const title=value==='APPROVED'?'Approved':value==='REJECTED'?'Rejected':'Review pending';
 return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
   value==='APPROVED'?'border-emerald-900 bg-emerald-950/40 text-emerald-300':
   value==='REJECTED'?'border-red-900 bg-red-950/30 text-red-300':
   'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{title}</span>;
}
function CreatorDetailCard({channelId,zone}:{channelId:string;zone:string}){
 const [pickedVideo,setPickedVideo]=useState<string|null>(null);
 const query=useQuery({
   queryKey:['creator-intelligence-channel',channelId],
   queryFn:()=>fetchCreatorDetail(channelId),
   retry:false,refetchInterval:60000,
 });
 if(query.isPending)return <section role="status" className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-sm text-zinc-400">Reading public observations…</section>;
 if(query.isError)return <EmptyPanel title="Creator detail unavailable">{query.error.message}</EmptyPanel>;
 const {channel,videos,samples}=query.data;
 const observedHours=observedPublicationHours(videos,zone as 'Asia/Kolkata'|'UTC');
 const peakHourCount=Math.max(1,...observedHours);
 const selectedVideo=videos.some(v=>v.videoId===pickedVideo)?pickedVideo:videos[0]?.videoId??null;
 const observations=samples.filter(x=>x.videoId===selectedVideo)
   .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const latest=observations.at(-1);
 const change=observedGrowth(observations);
 const line=creatorChartPoints(observations);
 const video=videos.find(v=>v.videoId===selectedVideo);
 return <div className="space-y-5">
   <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-400">Creator profile</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{channel.title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{channel.handle??'Handle unavailable'} · {channel.language.toUpperCase()} · {channel.niche}</p>
     </div>
     <Stage value={channel.reviewState}/>
    </div>
    <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
      <span>Monitoring {channel.monitoringEnabled?'enabled':'disabled'}</span>
      <span>·</span>
      <span>Metadata refreshed {getTime(channel.metadataRefreshedAt,zone)}</span>
      <a href={`https://www.youtube.com/channel/${channel.channelId}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-amber-400 underline underline-offset-4">Official channel</a>
    </div>
   </section>
   {videos.length>0&&<section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
     <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-400">Recent publication times</p>
     <h3 className="mt-2 text-lg font-semibold">When these videos became public</h3>
     <p className="mt-2 text-xs leading-5 text-zinc-500">Distribution of the latest {videos.length} recorded videos in {zone==='Asia/Kolkata'?'IST':'UTC'}. This is a limited observed sample, not a forecast or the creator's complete history.</p>
     <div className="mt-5 grid grid-cols-12 gap-1.5 sm:grid-cols-[repeat(24,minmax(0,1fr))]" role="img" aria-label="Recorded public video publishing counts for each hour of the day">
       {observedHours.map((n,h)=><div key={h} className="min-w-0 text-center" title={`${String(h).padStart(2,'0')}:00 — ${n} video(s)`}>
         <div className="flex h-20 items-end justify-center rounded-sm bg-zinc-950/60 px-0.5 pb-0.5">
           <div className={`w-full rounded-t-sm ${n>0?'bg-amber-400':'bg-zinc-800'}`}
             style={{height:`${n>0?Math.max(9,100*n/peakHourCount):4}%`}}/>
         </div>
         <span className="mt-1 block text-[9px] text-zinc-500">{String(h).padStart(2,'0')}</span>
       </div>)}
     </div>
   </section>}
   {videos.length===0?<EmptyPanel title="No discovered videos yet">
      This verified creator has no video records in Creator Intelligence. Publication history is not inferred from other channels.
    </EmptyPanel>:<>
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[0.22em] text-amber-400">Video observations</p>
       <h3 className="mt-2 text-xl font-semibold">Observed performance</h3>
       <p className="mt-2 text-xs text-zinc-500">Public cumulative counters · latest 30 days · no private YouTube Analytics</p></div>
      <label className="text-xs text-zinc-400">Choose video
       <select className="mt-1 block max-w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-zinc-100"
        value={selectedVideo??''} onChange={e=>setPickedVideo(e.target.value)}>
         {videos.map(v=><option value={v.videoId} key={v.videoId}>{v.videoId} · {v.format}</option>)}
       </select>
      </label>
     </div>
     {video&&<p className="mt-4 text-xs text-zinc-500">Published {getTime(video.publishedAt,zone)} · Format {video.format}</p>}
     {observations.length===0?<div className="mt-6 rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">
       No public metric readings captured for this video yet. The chart will appear after genuine observations arrive.
      </div>:<>
       <div className="mt-6 grid gap-3 sm:grid-cols-3">
         <div className="rounded-xl bg-zinc-950/60 p-4"><p className="text-xs text-zinc-500">Latest reported views</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPublicCounter(latest?.viewCount??null)}</p></div>
         <div className="rounded-xl bg-zinc-950/60 p-4"><p className="text-xs text-zinc-500">Latest likes</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPublicCounter(latest?.likeCount??null)}</p></div>
         <div className="rounded-xl bg-zinc-950/60 p-4"><p className="text-xs text-zinc-500">Latest comments</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPublicCounter(latest?.commentCount??null)}</p></div>
       </div>
       <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="text-sm font-medium">Public views over observation time</p>
        {line?<svg viewBox="0 0 540 170" role="img" aria-label="Observed cumulative public YouTube video views over time"
         className="mt-4 w-full overflow-visible" preserveAspectRatio="none">
          <path d="M10 160 H530 M10 85 H530 M10 10 H530" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 6" fill="none"/>
          <polyline points={line} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
         </svg>:<div className="mt-4 py-10 text-center text-sm text-zinc-500">At least two real view readings are needed for a trend line.</div>}
        <div className="mt-2 flex justify-between gap-3 text-[11px] text-zinc-500"><span>{getTime(observations[0].observedAt,zone)}</span><span>{getTime(observations[observations.length-1].observedAt,zone)}</span></div>
       </div>
       <div className="mt-5 rounded-xl border border-zinc-800 p-4 text-sm">
        <p className="font-semibold text-zinc-200">Observed interval growth</p>
        {change.adjustment?<p className="mt-2 text-amber-300">YouTube's reported counter decreased. Treated as a counter adjustment, not negative engagement.</p>:
         change.delta!==null?<p className="mt-2 text-zinc-300">
         +{formatPublicCounter(change.delta)} views across {change.elapsedHours!.toFixed(1)} observed hours ·
         approx. {formatPublicCounter(change.perHour)} per hour across that interval
         </p>:<p className="mt-2 text-zinc-500">Two timed public view readings are required to calculate an observed growth rate.</p>}
        <p className="mt-2 text-xs leading-5 text-zinc-500">This rate is calculated between captured readings; it is not YouTube's private realtime view-per-hour report.</p>
       </div>
       <p className="mt-4 text-xs text-zinc-500">Last reading {getTime(latest!.observedAt,zone)} · {observations.length} captured reading{observations.length===1?'':'s'} shown</p>
      </>}
     {query.data.samplesTruncated&&<p className="mt-4 text-xs text-amber-300">Display limit reached (800 readings across the latest videos). These charts are partial; do not use them as complete interval comparisons.</p>}
    </section>
   </>}
 </div>;
}

export function CreatorIntelligencePage(){
 const [filter,setFilter]=useState<Filter>('all');
 const [search,setSearch]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [zone,setZone]=useState<'Asia/Kolkata'|'UTC'>('Asia/Kolkata');
 const query=useQuery({queryKey:['creator-intelligence-overview'],queryFn:fetchCreatorOverview,
   retry:false,refetchInterval:60000});
 const channels=query.data?.channels??[];
 const visible=useMemo(()=>channels.filter(c=>{
  const term=search.trim().toLocaleLowerCase();
  const matched=!term||[c.title,c.handle??'',c.niche,c.language].some(s=>s.toLocaleLowerCase().includes(term));
  const correct=filter==='all'||(filter==='monitoring'?c.monitoringEnabled:c.reviewState==='REVIEW_PENDING');
  return matched&&correct;
 }),[channels,search,filter]);
 const selected=channels.some(c=>c.channelId===selectedId)?selectedId:visible[0]?.channelId??null;
 return <main className="min-w-0 space-y-6 pb-12">
  <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/30 p-6 sm:p-8">
   <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"/>
   <div className="relative">
     <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">CineRelay / Creator Intelligence</p>
     <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The story behind every upload.</h1>
     <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">Observe real public creator video metrics, publication rhythms and performance patterns. Small channels matter as much as established creators.</p>
     <div className="mt-5 flex flex-wrap items-center gap-3">
       <span className="rounded-full border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-200">Read-only operator preview</span>
       <label className="text-xs text-zinc-500">Times shown in
         <select aria-label="Display timezone" className="ml-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200" value={zone} onChange={e=>setZone(e.target.value as 'Asia/Kolkata'|'UTC')}>
           <option value="Asia/Kolkata">India (IST)</option><option value="UTC">UTC</option>
         </select>
       </label>
     </div>
   </div>
  </div>
  {query.isPending?<div role="status" className="rounded-2xl border border-zinc-800 p-6 text-sm text-zinc-400">Checking Creator Intelligence data availability…</div>:
   query.isError?<EmptyPanel title="Creator Intelligence not active yet">
     {query.error.message} The dashboard will display actual verified creators and public observations once its separate server and storage are deployed.
   </EmptyPanel>:<>
     <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Verified channels" value={query.data.totals.channels} note="API-verified registry"/>
      <Metric label="Monitored" value={query.data.totals.monitored} note="Operator-approved only"/>
      <Metric label="Discovered videos" value={query.data.totals.videos} note="Creator video registry"/>
      <Metric label="Public readings" value={query.data.totals.samplesLast30Days} note="Last 30 days only"/>
     </div>
     {query.data.state==='AWAITING_VERIFIED_CHANNELS'?<EmptyPanel title="Awaiting verified creators">
        The discovery research pool is separate from the live verified registry. No creator or performance totals are invented here. Official identity review is still required.
       </EmptyPanel>:<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
         <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Creator directory</h2><span className="text-xs text-zinc-500">{visible.length} shown</span></div>
         <label htmlFor="creator-filter" className="sr-only">Find creator</label>
         <input id="creator-filter" value={search} onChange={e=>setSearch(e.target.value)}
           placeholder="Search creators or niches" className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-500"/>
         <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter creators">
          {([['all','All'],['monitoring','Monitored'],['review','Needs review']] as const).map(([value,title])=>
           <button key={value} type="button" onClick={()=>setFilter(value)}
            aria-pressed={filter===value} className={`rounded-full border px-3 py-1.5 text-xs transition ${
             filter===value?'border-amber-700 bg-amber-950/50 text-amber-200':'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}>{title}</button>)}
         </div>
         {visible.length===0?<p className="p-6 text-center text-sm text-zinc-500">No creators match these filters.</p>:
          <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
           {visible.map(c=><button type="button" key={c.channelId} onClick={()=>setSelectedId(c.channelId)}
            aria-pressed={selected===c.channelId} className={`w-full rounded-2xl border p-4 text-left transition ${
             selected===c.channelId?'border-amber-700/60 bg-amber-950/20':'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600'}`}>
             <p className="truncate text-sm font-semibold text-zinc-100">{c.title}</p>
             <p className="mt-1 truncate text-xs text-zinc-500">{c.handle??c.channelId}</p>
             <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">{c.language.toUpperCase()}</span>
              <span className="max-w-[150px] truncate text-[11px] text-zinc-400">{c.niche}</span></div>
           </button>)}
          </div>}
         {query.data.hasMoreChannels&&<p className="mt-3 text-xs text-amber-300">Showing only the first 100 verified creators. Pagination is required for the larger catalogue.</p>}
        </section>
        {selected?<CreatorDetailCard channelId={selected} zone={zone}/>:<EmptyPanel title="Select a verified channel">Choose a creator to view actual captured public video statistics.</EmptyPanel>}
       </div>}
     <p className="text-xs text-zinc-600">Last server update {getTime(query.data.generatedAt,zone)}. No scoreboards, revenue estimates, subscriber-growth claims or predicted upload times are displayed.</p>
   </>}
 </main>;
}
