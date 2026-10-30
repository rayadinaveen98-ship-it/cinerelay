import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchConsoleOverview} from '../lib/console-api';
import {fetchCreatorPilotActivity,fetchCreatorPilotIdentities} from '../lib/creator-intelligence-api';

const LOCALE:Record<string,string>={te:'Telugu',kn:'Kannada',mr:'Marathi'};
const TIER:Record<string,string>={
 NANO_LT10K:'Nano · under 10K',MICRO_10K_100K:'Micro · 10K–100K',
 MID_100K_1M:'Mid · 100K–1M',LARGE_1M_10M:'Large · 1M–10M',
 MEGA_10M_PLUS:'Mega · 10M+',UNVERIFIED:'Size unknown',
};
const ist=(value:string)=>new Intl.DateTimeFormat('en-IN',{
 timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short',
}).format(new Date(value))+' IST';
function Panel({children}:{children:React.ReactNode}){
 return <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/55 p-5 sm:p-7">{children}</section>;
}
export function CreatorPilotReviewPage(){
 const [search,setSearch]=useState('');
 const [locale,setLocale]=useState('all');
 const [tier,setTier]=useState('all');
 const [selected,setSelected]=useState<string|null>(null);
 const guard=useQuery({queryKey:['creator-pilot-operator-guard'],queryFn:fetchConsoleOverview,
  retry:false,staleTime:60000});
 const identities=useQuery({queryKey:['creator-c19-private-identities'],
  queryFn:fetchCreatorPilotIdentities,enabled:guard.isSuccess,retry:false,
  staleTime:30000,refetchInterval:60000});
 const activity=useQuery({queryKey:['creator-c12-private-activity'],
  queryFn:fetchCreatorPilotActivity,enabled:guard.isSuccess,retry:false,
  staleTime:30000,refetchInterval:60000});
 const clock=Date.now();
 // Even a cached server response must never display expired API facts.
 const verified=(identities.data?.channels??[]).filter(x=>
  Date.parse(x.observedAt)<=clock && Date.parse(x.expiresAt)>clock &&
  x.reviewState==='REVIEW_PENDING'&&!x.operatorApproved&&
  !x.monitoringEnabled&&!x.metricsEnabled);
 const filtered=useMemo(()=>verified.filter(x=>{
  const needle=search.trim().toLocaleLowerCase();
  return (!needle||[x.listedName,x.officialChannelTitle,x.listedHandle,x.categoryProvisional]
    .some(y=>y.toLocaleLowerCase().includes(needle)))&&
    (locale==='all'||x.locale===locale)&&(tier==='all'||x.sizeTierProvisional===tier);
 }),[identities.data,clock,search,locale,tier]);
 const current=filtered.find(x=>x.channelId===selected)??filtered[0]??null;
 const source=activity.data?.channels.find(x=>x.channelId===current?.channelId);
 const evidence=source&&Date.parse(source.observedAt)<=clock &&
  Date.parse(source.expiresAt)>clock?source:null;
 const locales=[...new Set(verified.map(x=>x.locale))].sort();
 const sizes=[...new Set(verified.map(x=>x.sizeTierProvisional))];
 if(guard.isPending)return <main role="status"><Panel>Checking CineRelay operator access…</Panel></main>;
 if(guard.isError)return <main><Panel>Active CineRelay operator authorization required.</Panel></main>;
 return <main className="min-w-0 space-y-6 pb-12">
  <Panel>
   <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
    Creator Intelligence / Verified Pilot
   </p>
   <h1 className="mt-3 text-3xl font-semibold tracking-tight">Verify before you monitor.</h1>
   <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
    Official YouTube identities and activity observations load from separate expiring,
    operator-protected services. No API responses, channel IDs or subscriber statistics
    are bundled into this web app. No identity is approved for monitoring.
   </p>
  </Panel>
  {identities.isPending?<Panel><p role="status" className="text-sm text-zinc-400">
    Checking protected identity evidence…</p></Panel>:
   identities.isError?<Panel><p role="status" className="text-sm text-amber-300">
    Fresh identity evidence is unavailable. C19 storage may not be deployed or
    operator access may need reauthorization. Historic API results will not be shown.</p></Panel>:
   verified.length===0?<Panel>
    <h2 className="text-lg font-semibold">Awaiting fresh official verification</h2>
    <p className="mt-2 text-sm leading-7 text-zinc-400">
     There are currently no unexpired API-verified identities in private review storage.
     The separate Research Desk still contains discovery leads. An operator must refresh
     official identity evidence through an approved, quota-safe ingestion process before review.</p>
    <a href="/creators/research" className="mt-4 inline-block text-sm text-amber-300 underline underline-offset-4">
     Open Research Desk</a>
   </Panel>:
   <Panel><p role="status" className="text-sm text-zinc-400">
    {verified.length} unexpired official identity records, all pending human review.
    No monitoring, derived comparisons or automatic admission.
   </p></Panel>}
  {verified.length>0&&<>
   <Panel>
    <div className="grid gap-4 sm:grid-cols-3">
     <label className="text-xs font-medium text-zinc-400">
      Search creator or niche
      <input aria-label="Search verified creators" type="search" value={search}
       onChange={e=>setSearch(e.target.value)} placeholder="Name, handle, niche"
       className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-white"/>
     </label>
     <label className="text-xs font-medium text-zinc-400">
      Language / region
      <select value={locale} onChange={e=>setLocale(e.target.value)}
       className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-white">
       <option value="all">All languages</option>
       {locales.map(x=><option key={x} value={x}>{LOCALE[x]??x}</option>)}
      </select>
     </label>
     <label className="text-xs font-medium text-zinc-400">
      Provisional size
      <select value={tier} onChange={e=>setTier(e.target.value)}
       className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-white">
       <option value="all">All segments</option>
       {sizes.map(x=><option key={x} value={x}>{TIER[x]??x}</option>)}
      </select>
     </label>
    </div>
    <p role="status" className="mt-4 text-xs text-zinc-500">
     Showing {filtered.length} of {verified.length} fresh records. Size and category labels are provisional.
    </p>
   </Panel>
   <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
    <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
     <h2 className="px-3 pb-3 text-base font-semibold">Official identity queue</h2>
     {filtered.length===0?<p className="p-4 text-sm text-zinc-500">No matching fresh records.</p>:
      <div className="max-h-[680px] space-y-2 overflow-y-auto">
       {filtered.map(c=><button key={c.channelId} type="button"
        onClick={()=>setSelected(c.channelId)}
        aria-pressed={current?.channelId===c.channelId}
        className={'w-full rounded-2xl border p-4 text-left transition '+(
         current?.channelId===c.channelId?
          'border-amber-700/60 bg-amber-950/20':'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600')}>
        <p className="text-sm font-semibold text-zinc-100">{c.officialChannelTitle}</p>
        <p className="mt-2 text-xs text-zinc-400">{c.listedHandle} · {LOCALE[c.locale]??c.locale}</p>
        <p className="mt-2 text-xs text-amber-300">Identity verified · editorial review pending</p>
       </button>)}
      </div>}
    </section>
    {current?<Panel>
     <p className="text-xs font-semibold uppercase tracking-[0.23em] text-amber-400">
      Official YouTube identity · operator review pending
     </p>
     <h2 className="mt-3 text-2xl font-semibold">{current.officialChannelTitle}</h2>
     <p className="mt-2 text-sm text-zinc-400">{current.listedHandle} · {current.categoryProvisional} (provisional)</p>
     <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {([
       ['Stable channel ID',current.channelId],
       ['Uploads playlist',current.uploadsPlaylistId],
       ['Size research segment',TIER[current.sizeTierProvisional]??'Unknown'],
       ['Editorial decision','PENDING · monitoring OFF'],
       ['Identity observed',ist(current.observedAt)],
       ['Identity expires',ist(current.expiresAt)],
      ] as const).map(([label,value])=><div key={label}
       className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
       <p className="text-xs text-zinc-500">{label}</p>
       <p className="mt-2 break-all text-sm text-zinc-200">{value}</p>
      </div>)}
     </div>
     {evidence?<section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-sm font-semibold">Separate public activity observation</p>
      <p className="mt-2 text-xs text-zinc-500">
       Observed {ist(evidence.observedAt)} · expires {ist(evidence.expiresAt)}
      </p>
      <p className="mt-3 text-sm text-zinc-300">
       Approximate subscribers: {evidence.subscriberCountApprox??'Unavailable'} ·
       Public videos: {evidence.videoCountPublic??'Unavailable'}
      </p>
      <div className="mt-3 space-y-2">
       {evidence.latestPublicVideos.map(video=><a key={video.videoId}
        href={'https://www.youtube.com/watch?v='+video.videoId}
        target="_blank" rel="noopener noreferrer"
        className="block text-sm text-amber-300 underline underline-offset-4">
        Inspect public video · {video.publishedAt?ist(video.publishedAt):'Date unavailable'}
       </a>)}
      </div>
     </section>:<p className="mt-5 text-sm text-zinc-500">
      No unexpired private activity evidence. Counts and upload dates are not inferred.</p>}
     <div className="mt-5 flex flex-wrap gap-4 text-sm">
      <a href={'https://www.youtube.com/channel/'+current.channelId}
       target="_blank" rel="noopener noreferrer"
       className="text-amber-300 underline underline-offset-4">Inspect YouTube channel</a>
      <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer"
       className="text-zinc-400 underline underline-offset-4">Original research source</a>
     </div>
    </Panel>:<Panel><p className="text-sm text-zinc-500">No channel selected.</p></Panel>}
   </div>
  </>}
  <p className="text-xs text-zinc-500">
   C19 is a review-only read path. There are no activation, collection, notification,
   statistics-monitoring or comparison actions here. Historical Git evidence is not used as a fallback.
  </p>
 </main>;
}
