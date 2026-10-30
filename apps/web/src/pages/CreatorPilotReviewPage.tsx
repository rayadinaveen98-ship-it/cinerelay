import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchConsoleOverview} from '../lib/console-api';
import pilot from '../data/creator-official-pilot-2026-10-30.json';
import activity from '../data/creator-public-activity-2026-10-30.json';

const LOCALE:Record<string,string>={te:'Telugu',kn:'Kannada',mr:'Marathi'};
const TIERS:Record<string,string>={
 NANO_LT10K:'Nano · under 10K',MICRO_10K_100K:'Micro · 10K–100K',
 MID_100K_1M:'Mid · 100K–1M',LARGE_1M_10M:'Large · 1M–10M',
};
const evidenceById=new Map(activity.channels.map(x=>[x.channelId,x]));
const observedClock=Date.parse(activity.observedAt);
function latestVideo(channelId:string){
 const record=evidenceById.get(channelId);
 if(!record)return null;
 const dates=record.latestPublicVideos.map(x=>x.publishedAt).filter((x):x is string=>typeof x==='string')
  .map(Date.parse).filter(Number.isFinite);
 return dates.length?Math.max(...dates):null;
}
function evidenceWindow(channelId:string){
 const latest=latestVideo(channelId);
 if(latest===null||!Number.isFinite(latest)||latest>observedClock)return 'UNKNOWN';
 const days=(observedClock-latest)/86_400_000;
 return days<=30?'WITHIN_30_DAYS':days<=90?'WITHIN_90_DAYS':'OVER_90_DAYS';
}
function observedDate(value:number){
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',
  day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))+' IST';
}
function Panel({children}:{children:React.ReactNode}){
 return <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/55 p-5 sm:p-7">{children}</section>;
}
function ReviewDesk(){
 const [search,setSearch]=useState('');
 const [locale,setLocale]=useState('all');
 const [size,setSize]=useState('all');
 const [windowFilter,setWindowFilter]=useState('all');
 const evidenceExpired=Date.now()>Date.parse(activity.expiresAt);
 const [selected,setSelected]=useState<string|null>(null);
 const locales=useMemo(()=>[...new Set(pilot.channels.map(x=>x.locale))].sort(),[]);
 const sizes=useMemo(()=>[...new Set(pilot.channels.map(x=>x.sizeTierProvisional))],[]);
 const filtered=useMemo(()=>pilot.channels.filter(c=>{
  const needle=search.trim().toLocaleLowerCase();
  return (!needle||[c.listedName,c.officialChannelTitle,c.listedHandle,c.categoryProvisional,c.channelId]
    .some(x=>x.toLocaleLowerCase().includes(needle))) &&
    (locale==='all'||c.locale===locale)&&(size==='all'||c.sizeTierProvisional===size)&&
    (windowFilter==='all'||(!evidenceExpired&&evidenceWindow(c.channelId)===windowFilter));
 }),[search,locale,size,windowFilter,evidenceExpired]);
 const current=filtered.find(x=>x.channelId===selected)??filtered[0]??null;
 const currentEvidence=current&&!evidenceExpired?evidenceById.get(current.channelId):null;
 const countWindow=(key:string)=>pilot.channels.filter(x=>evidenceWindow(x.channelId)===key).length;
 return <main className="min-w-0 space-y-6 pb-12">
  <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/20 p-6 sm:p-8">
   <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">CineRelay / Creator Intelligence / Pilot review</p>
   <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Official IDs. Human decisions.</h1>
   <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
    This dated, read-only review combines official YouTube channel identities with up to three recent publicly listed uploads per creator.
    No creator is approved for ongoing monitoring or performance-statistics collection.
   </p>
   <p className="mt-4 text-xs text-zinc-500">
    API verified {new Date(pilot.verifiedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST ·
    Production dedupe audited {new Date(pilot.productionDedupeAuditAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST
   </p>
  </section>

  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {([
    ['Official IDs verified',pilot.channels.length],
    ['Duplicates at audit',pilot.productionDuplicateCountAtAudit],
    ['Editorial approvals',0],
    ['Tracking enabled',0],
   ] as const).map(([title,value])=>
    <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
     <p className="text-xs leading-5 text-zinc-500">{title}</p>
     <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>)}
  </div>

  <Panel>
   <h2 className="text-lg font-semibold">Before any channel is added to monitoring</h2>
   <p className="mt-3 text-sm leading-7 text-zinc-400">
    Confirm the official channel is the intended creator, inspect recent activity and content type,
    assess actual public subscriber information if available, recheck current production UC IDs,
    confirm available API quota, and obtain explicit operator authorization. No review control on
    this screen can activate or edit a production source.
   </p>
   <p className="mt-3 text-xs leading-6 text-amber-200/80">
    This cohort contains 14 Telugu, 3 Kannada and 3 Marathi research candidates. Size segments are
    provisional third-party labels, not official or current subscriber counts.
   </p>
  </Panel>

  <Panel>
   <h2 className="text-lg font-semibold">Latest public upload evidence</h2>
   <p className="mt-2 text-sm leading-6 text-zinc-400">
    One-time YouTube API observation at {observedDate(observedClock)}. These counts reflect when
    each channel's newest visible uploads-playlist item was published, not complete upload histories,
    current live activity, a ranking, or a guarantee of future uploads.
   </p>
   {evidenceExpired?<p className="mt-3 text-sm font-semibold text-amber-300">
    This snapshot expired on {observedDate(Date.parse(activity.expiresAt))}; refresh the public evidence before review.
   </p>:<div className="mt-5 grid grid-cols-3 gap-3">
    {([
     ['Within 30 days',countWindow('WITHIN_30_DAYS')],
     ['31–90 days',countWindow('WITHIN_90_DAYS')],
     ['Older than 90 days',countWindow('OVER_90_DAYS')],
    ] as const).map(([label,count])=><div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-xs leading-5 text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{count}</p>
    </div>)}
   </div>}
   <p className="mt-4 text-xs text-zinc-500">
    Official public subscriber counts are approximate YouTube display values; hidden/missing values are not shown as zero.
   </p>
  </Panel>

  <Panel>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <label className="text-xs font-medium text-zinc-400">
     Search official title, handle, name or niche
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Search the verified cohort" aria-label="Search verified channels"
      className="mt-2 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-400"/>
    </label>
    <label className="text-xs font-medium text-zinc-400">Language / region
     <select value={locale} onChange={e=>setLocale(e.target.value)} aria-label="Pilot language"
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
      <option value="all">All languages</option>
      {locales.map(l=><option key={l} value={l}>{LOCALE[l]??l}</option>)}
     </select>
    </label>
    <label className="text-xs font-medium text-zinc-400">Provisional size
     <select value={size} onChange={e=>setSize(e.target.value)} aria-label="Pilot size"
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
      <option value="all">Every segment</option>
      {sizes.map(t=><option key={t} value={t}>{TIERS[t]??t}</option>)}
     </select>
    </label>
    <label className="text-xs font-medium text-zinc-400">Latest observed public upload
     <select value={windowFilter} onChange={e=>setWindowFilter(e.target.value)} aria-label="Latest upload evidence"
      disabled={evidenceExpired}
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 disabled:opacity-50">
      <option value="all">Any public upload date</option>
      <option value="WITHIN_30_DAYS">Within 30 days of audit</option>
      <option value="WITHIN_90_DAYS">31–90 days before audit</option>
      <option value="OVER_90_DAYS">Over 90 days before audit</option>
     </select>
    </label>
   </div>
   <p role="status" className="mt-4 text-xs text-zinc-500">Showing {filtered.length} of {pilot.channels.length} identities · all pending editorial review</p>
  </Panel>

  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
   <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
    <h2 className="px-3 pb-3 text-base font-semibold">Verified identity queue</h2>
    {filtered.length===0?<p className="p-4 text-sm text-zinc-500">No channel matches these filters.</p>:
    <div className="max-h-[680px] space-y-2 overflow-y-auto">
     {filtered.map(c=><button key={c.channelId} type="button" onClick={()=>setSelected(c.channelId)}
      aria-pressed={current?.channelId===c.channelId}
      className={'w-full rounded-2xl border p-4 text-left transition '+(current?.channelId===c.channelId?
       'border-amber-700/60 bg-amber-950/20':'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600')}>
      <p className="text-sm font-semibold leading-6 text-zinc-100">{c.officialChannelTitle}</p>
      <p className="mt-1 text-xs text-zinc-400">{c.listedHandle} · {LOCALE[c.locale]??c.locale}</p>
      <p className="mt-2 text-xs text-amber-300">Identity verified · review pending</p>
      {!evidenceExpired&&<p className="mt-2 text-xs text-zinc-400">Last listed public upload: {latestVideo(c.channelId)!==null?observedDate(latestVideo(c.channelId)!):'Not observed'}</p>}
     </button>)}
    </div>}
   </section>
   {current?<Panel>
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">YouTube API verified · not approved</p>
    <h2 className="mt-3 text-2xl font-semibold">{current.officialChannelTitle}</h2>
    <p className="mt-3 text-sm text-zinc-400">
     Discovered as {current.listedName} · {current.listedHandle}
    </p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
     {([
      ['Canonical channel ID',current.channelId],
      ['Uploads playlist ID',current.uploadsPlaylistId],
      ['Language / region',LOCALE[current.locale]??current.locale],
      ['Size label (provisional)',TIERS[current.sizeTierProvisional]??current.sizeTierProvisional],
      ['Provisional niche',current.categoryProvisional],
      ['Operator approval','Pending · monitoring OFF'],
     ] as const).map(([label,value])=><div key={label}
      className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-zinc-200">{value}</p>
     </div>)}
    </div>
    {currentEvidence&&<section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
     <h3 className="text-sm font-semibold text-zinc-100">Dated public activity · {observedDate(observedClock)}</h3>
     <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
       <p className="text-xs text-zinc-500">Public subscriber count (rounded by YouTube)</p>
       <p className="mt-2 text-lg font-semibold">{currentEvidence.subscriberCountApprox!==null?
        Number(currentEvidence.subscriberCountApprox).toLocaleString('en-IN'):'Unavailable'}</p>
      </div>
      <div>
       <p className="text-xs text-zinc-500">Public video count (API)</p>
       <p className="mt-2 text-lg font-semibold">{currentEvidence.videoCountPublic!==null?
        Number(currentEvidence.videoCountPublic).toLocaleString('en-IN'):'Unavailable'}</p>
      </div>
     </div>
     <p className="mt-4 text-xs font-semibold text-zinc-400">Latest publicly listed uploads (max 3)</p>
     {currentEvidence.latestPublicVideos.length===0?
      <p className="mt-2 text-xs text-zinc-500">No public videos returned in the capped sample.</p>:
      <div className="mt-2 space-y-2">
       {currentEvidence.latestPublicVideos.map(v=><div key={v.videoId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs">
        <span className="text-zinc-400">{v.publishedAt?observedDate(Date.parse(v.publishedAt)):'Published date not available'}</span>
        <a href={'https://www.youtube.com/watch?v='+v.videoId} target="_blank" rel="noopener noreferrer"
          className="text-amber-300 underline underline-offset-4">Inspect public video</a>
       </div>)}
      </div>}
     <p className="mt-3 text-xs leading-5 text-zinc-500">
      This sample does not independently verify original content, safety, channel suitability or a complete posting schedule.
     </p>
    </section>}
    {evidenceExpired&&<p className="mt-5 text-sm text-amber-300">Public activity snapshot expired. Refresh before using it for admission.</p>}
    <div className="mt-6 flex flex-wrap gap-4 text-sm">
     <a href={'https://www.youtube.com/channel/'+current.channelId}
      target="_blank" rel="noopener noreferrer" className="text-amber-300 underline underline-offset-4">Inspect official channel</a>
     <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="text-zinc-400 underline underline-offset-4">Original research source</a>
    </div>
    <p className="mt-6 text-xs leading-6 text-zinc-500">
     Source: YouTube Data API v3 channels.list. An API identity match does not certify the publisher's category,
     long-term upload activity, consent, or eligibility for derived statistics.
     A one-time public upload and subscriber metadata check was recorded; no performance counter monitoring has begun.
    </p>
   </Panel>:<Panel><p className="text-sm text-zinc-400">No channel selected.</p></Panel>}
  </div>
  <p className="text-xs leading-6 text-zinc-500">Audit is point-in-time; verify current production identities again at admission. This research-only interface is not a monitoring dashboard.</p>
 </main>;
}
export function CreatorPilotReviewPage(){
 const auth=useQuery({queryKey:['creator-pilot-operator-guard'],queryFn:fetchConsoleOverview,retry:false,staleTime:60_000});
 if(auth.isPending)return <main role="status"><Panel>Checking CineRelay operator authorization…</Panel></main>;
 if(auth.isError)return <main><Panel>Active operator access required. This report is unavailable until authorization succeeds.</Panel></main>;
 return <ReviewDesk/>;
}
