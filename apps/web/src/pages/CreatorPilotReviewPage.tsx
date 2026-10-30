import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchConsoleOverview} from '../lib/console-api';
import {fetchCreatorPilotActivity} from '../lib/creator-intelligence-api';
import pilot from '../data/creator-official-pilot-2026-10-30.json';

const LOCALES:Record<string,string>={te:'Telugu',kn:'Kannada',mr:'Marathi'};
const TIER:Record<string,string>={
 NANO_LT10K:'Nano · under 10K',MICRO_10K_100K:'Micro · 10K–100K',
 MID_100K_1M:'Mid · 100K–1M',LARGE_1M_10M:'Large · 1M–10M',
};
const ist=(time:string)=>new Intl.DateTimeFormat('en-IN',{
 timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'
}).format(new Date(time))+' IST';
function Panel({children}:{children:React.ReactNode}){
 return <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/55 p-5 sm:p-7">{children}</section>;
}
export function CreatorPilotReviewPage(){
 const [queryText,setQueryText]=useState('');
 const [locale,setLocale]=useState('all');
 const [tier,setTier]=useState('all');
 const [selected,setSelected]=useState<string|null>(null);
 const guard=useQuery({queryKey:['creator-pilot-operator-guard'],queryFn:fetchConsoleOverview,retry:false,staleTime:60000});
 const fresh=useQuery({queryKey:['creator-c12-private-activity'],queryFn:fetchCreatorPilotActivity,
  enabled:guard.isSuccess,retry:false,staleTime:30000,refetchInterval:60000});
 const filtered=useMemo(()=>pilot.channels.filter(c=>{
  const needle=queryText.trim().toLocaleLowerCase();
  return (!needle||[c.listedName,c.officialChannelTitle,c.listedHandle,c.categoryProvisional]
    .some(v=>v.toLocaleLowerCase().includes(needle)))&&
    (locale==='all'||c.locale===locale)&&(tier==='all'||c.sizeTierProvisional===tier);
 }),[queryText,locale,tier]);
 const picked=filtered.find(c=>c.channelId===selected)??filtered[0]??null;
 const freshItem=fresh.data?.channels.find(x=>x.channelId===picked?.channelId);
 const itemUnexpired=freshItem!==undefined&&Date.parse(freshItem.expiresAt)>Date.now()&&
  Date.parse(freshItem.observedAt)<=Date.now();
 const evidence=itemUnexpired?freshItem:undefined;
 const locales=[...new Set(pilot.channels.map(c=>c.locale))];
 const tiers=[...new Set(pilot.channels.map(c=>c.sizeTierProvisional))];
 if(guard.isPending)return <main role="status"><Panel>Checking operator access…</Panel></main>;
 if(guard.isError)return <main><Panel>Active CineRelay operator authorization required.</Panel></main>;
 return <main className="min-w-0 space-y-6 pb-12">
  <Panel>
   <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Creator Intelligence / Pilot Review</p>
   <h1 className="mt-3 text-3xl font-semibold tracking-tight">Official identities, private observations.</h1>
   <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
    Verified channel identities are listed for human review. Public activity evidence loads separately from
    a service-only expiring store, and is never bundled into the web app or permanently written into Git.
    Nobody is automatically approved or enrolled for monitoring.
   </p>
   <p className="mt-3 text-xs text-zinc-500">Official identity verification: {ist(pilot.verifiedAt)}.
     Latest production duplicate check: {ist(pilot.productionDedupeAuditAt)}. Both are historical,
     not continuous approval.</p>
  </Panel>
  {fresh.isPending?<Panel><p role="status" className="text-sm text-zinc-400">Checking protected activity service…</p></Panel>:
   fresh.isError?<Panel><p role="status" className="text-sm leading-7 text-amber-300">
    No protected activity report is available. Storage may not be deployed or the operator session may need
    reauthorization. No subscriber counts or upload dates are inferred from the old Git snapshot.</p></Panel>:
   fresh.data?.channels.length===0?<Panel><p className="text-sm text-zinc-400">
    No unexpired activity observations are stored. This is expected before the C12 private storage
    migration and controlled ingestion are approved. Existing YouTube channels are unaffected.</p></Panel>:
   <Panel><p className="text-sm text-zinc-400">
    Protected read-only activity records are available. Last read at {ist(fresh.data!.generatedAt)}.
    Each channel's evidence has its own expiry. This is not continuous tracking or a ranking.</p></Panel>}
  <Panel>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-medium text-zinc-400">Find a verified channel
     <input type="search" aria-label="Search pilot channels" value={queryText}
      onChange={e=>setQueryText(e.target.value)} placeholder="Creator or niche…"
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"/>
    </label>
    <label className="text-xs font-medium text-zinc-400">Provisional language
     <select value={locale} onChange={e=>setLocale(e.target.value)}
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
      <option value="all">All</option>
      {locales.map(x=><option key={x} value={x}>{LOCALES[x]??x}</option>)}
     </select>
    </label>
    <label className="text-xs font-medium text-zinc-400">Provisional size
     <select value={tier} onChange={e=>setTier(e.target.value)}
      className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
      <option value="all">All segments</option>
      {tiers.map(x=><option key={x} value={x}>{TIER[x]??x}</option>)}
     </select>
    </label>
   </div>
   <p role="status" className="mt-4 text-xs text-zinc-500">
    {filtered.length} of {pilot.channels.length} official identities. All require human approval.
    Segment labels are provisional, not current subscriber statistics.</p>
  </Panel>
  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
   <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
    <h2 className="px-3 pb-3 text-base font-semibold">Identity queue</h2>
    {filtered.length===0?<p className="p-3 text-sm text-zinc-500">No channels match this search.</p>:
    <div className="max-h-[680px] space-y-2 overflow-y-auto">
     {filtered.map(c=><button type="button" key={c.channelId} onClick={()=>setSelected(c.channelId)}
      aria-pressed={picked?.channelId===c.channelId}
      className={'w-full rounded-2xl border p-4 text-left transition '+(picked?.channelId===c.channelId?
       'border-amber-700/60 bg-amber-950/20':'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600')}>
      <p className="text-sm font-semibold text-zinc-100">{c.officialChannelTitle}</p>
      <p className="mt-1 text-xs text-zinc-500">{c.listedHandle} · {LOCALES[c.locale]??c.locale}</p>
      <p className="mt-2 text-xs text-amber-300">Review pending · monitoring off</p>
     </button>)}
    </div>}
   </section>
   {picked?<Panel>
    <p className="text-xs font-semibold uppercase tracking-[0.23em] text-amber-400">API identity confirmed · editorial review pending</p>
    <h2 className="mt-3 text-2xl font-semibold">{picked.officialChannelTitle}</h2>
    <p className="mt-3 text-sm text-zinc-400">{picked.listedHandle} · {picked.categoryProvisional} (research classification)</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
     {([
      ['Stable YouTube identity',picked.channelId],
      ['Uploads playlist',picked.uploadsPlaylistId],
      ['Provisional segment',TIER[picked.sizeTierProvisional]??'Unverified'],
      ['Operator decision','PENDING · monitoring OFF'],
     ] as const).map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-all text-sm text-zinc-200">{value}</p>
     </div>)}
    </div>
    {evidence?<section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
     <h3 className="font-semibold">Public activity observed {ist(evidence.observedAt)}</h3>
     <p className="mt-1 text-xs text-zinc-500">Expires {ist(evidence.expiresAt)} · data is not automatically refreshed</p>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <div><p className="text-xs text-zinc-500">YouTube public subscribers (rounded)</p>
       <p className="mt-2 text-lg font-semibold">{evidence.subscriberCountApprox===null?'Unavailable':
       Number(evidence.subscriberCountApprox).toLocaleString('en-IN')}</p></div>
      <div><p className="text-xs text-zinc-500">Public video count</p>
       <p className="mt-2 text-lg font-semibold">{evidence.videoCountPublic===null?'Unavailable':
       Number(evidence.videoCountPublic).toLocaleString('en-IN')}</p></div>
     </div>
     <p className="mt-4 text-xs font-medium text-zinc-400">Latest publicly listed uploads (up to 3)</p>
     <div className="mt-2 space-y-2">
      {evidence.latestPublicVideos.map(v=><div key={v.videoId} className="flex flex-wrap justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
       <span>{v.publishedAt?ist(v.publishedAt):'Date unavailable'}</span>
       <a href={'https://www.youtube.com/watch?v='+v.videoId} target="_blank" rel="noopener noreferrer"
        className="text-amber-300 underline underline-offset-4">Inspect public video</a>
      </div>)}
      {evidence.latestPublicVideos.length===0&&<p className="text-xs text-zinc-500">No uploads returned in this sample.</p>}
     </div>
    </section>:<p className="mt-5 text-sm text-zinc-500">
      No fresh private activity evidence for this channel. Subscriber counts and upload dates are not guessed.</p>}
    <div className="mt-6 flex flex-wrap gap-4 text-sm">
     <a href={'https://www.youtube.com/channel/'+picked.channelId} target="_blank" rel="noopener noreferrer"
      className="text-amber-300 underline underline-offset-4">Open official channel</a>
     <a href={picked.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="text-zinc-400 underline underline-offset-4">Research source</a>
    </div>
   </Panel>:<Panel><p className="text-sm text-zinc-500">No selected channel.</p></Panel>}
  </div>
  <p className="text-xs text-zinc-500">C12 displays public facts, not derived metrics, engagement forecasts or cross-channel rankings. No backend writes or subscription activation are possible from this view.</p>
 </main>;
}
