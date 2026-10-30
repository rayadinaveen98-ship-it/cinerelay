import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchConsoleOverview } from '../lib/console-api';
import research from '../data/creator-research-2026-10-27.json';
import pages from '../data/creator-preliminary-page-evidence-2026-10-28.json';
import officialPilot from '../data/creator-official-pilot-2026-10-30.json';

const TIER:Record<string,string>={
 NANO_LT10K:'Nano · under 10K',MICRO_10K_100K:'Micro · 10K–100K',
 MID_100K_1M:'Mid · 100K–1M',LARGE_1M_10M:'Large · 1M–10M',
 MEGA_10M_PLUS:'Mega · 10M+',UNVERIFIED:'Size unknown'};
const LANGUAGE:Record<string,string>={
 te:'Telugu',ta:'Tamil',kn:'Kannada',ml:'Malayalam',mr:'Marathi',bn:'Bengali',
 'hi-en':'Hindi / English',en:'English / Global','multi-global':'Multilingual / Global'};
const norm=(s:string)=>s.toLocaleLowerCase('en-US');
const leadIds=new Set(research.leads.map(x=>x.id));
const newlyVerifiedIds=new Set(officialPilot.channels.map(x=>x.channelId));
function Panel({children}:{children:React.ReactNode}){
 return <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/55 p-5 sm:p-7">{children}</section>;
}
function ResearchContent(){
 const [search,setSearch]=useState('');
 const [locale,setLocale]=useState('all');
 const [tier,setTier]=useState('all');
 const [selected,setSelected]=useState<string|null>(null);
 const [view,setView]=useState<'leads'|'pages'>('leads');
 const languages=useMemo(()=>[...new Set(research.leads.map(x=>x.locale))].sort(),[]);
 const sizes=useMemo(()=>[...new Set(research.leads.map(x=>x.provisionalTier))].sort(),[]);
 const filtered=useMemo(()=>research.leads.filter(x=>{
  const needle=norm(search.trim());
  return (!needle||[x.name,x.listedHandle??'',x.category,x.locale].some(v=>norm(v).includes(needle)))&&
    (locale==='all'||x.locale===locale)&&(tier==='all'||x.provisionalTier===tier);
 }),[search,locale,tier]);
 const active=filtered.find(x=>x.id===selected)??filtered[0]??null;
 const handleCount=research.leads.filter(x=>x.listedHandle).length;
 return <main className="min-w-0 space-y-6 pb-12">
  <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/30 p-6 sm:p-8">
   <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl"/>
   <div className="relative">
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">CineRelay / Creator Intelligence / Research</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Discover beyond the famous.</h1>
    <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
     Source-linked discovery across creator sizes, languages and niches. Research leads are not
     official YouTube channel verifications, monitored creators or live performance data.
    </p>
    <span className="mt-5 inline-block rounded-full border border-zinc-700 bg-zinc-950/65 px-3 py-1.5 text-xs text-zinc-300">
     Research snapshot · 27 October 2026
    </span>
   </div>
  </section>
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {([
    ['Research leads',research.leads.length],['Listed handles',handleCount],
    ['Discovery sources',new Set(research.leads.map(x=>x.discoverySourceUrl)).size],
    ['API-verified leads',0],
   ] as const).map(([label,count])=>
    <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
     <p className="text-xs leading-5 text-zinc-500">{label}</p>
     <p className="mt-3 text-3xl font-semibold tabular-nums">{count}</p>
    </div>)}
  </div>
  <div role="tablist" aria-label="Research evidence type" className="flex flex-wrap gap-2">
   {([
    ['leads','94 research leads'],['pages','3 preliminary channel-page matches']
   ] as const).map(([id,label])=>
    <button role="tab" type="button" aria-selected={view===id} key={id} onClick={()=>setView(id)}
     className={'rounded-xl border px-4 py-3 text-sm font-medium transition '+(
      view===id?'border-amber-600 bg-amber-500/10 text-amber-200':'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
     )}>{label}</button>)}
  </div>
  {view==='pages'?<>
   <Panel>
    <h2 className="text-lg font-semibold">Historical first-party matches · 28 October</h2>
    <p className="mt-3 text-sm leading-7 text-zinc-400">This archived 28 October page-evidence snapshot is not itself API verification. The 30 October pilot records official API identity confirmation for these same three UC IDs.
     Current production-ID deduplication, channel activity review and human approval are still required before admission. None can activate tracking or comparisons.</p>
   </Panel>
   <div className="grid gap-4 lg:grid-cols-3">
    {pages.matches.map(p=><Panel key={p.officialChannelId}>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">{newlyVerifiedIds.has(p.officialChannelId)?'API verified in C10 · review pending':'API pending'}</p>
      <h2 className="mt-3 text-lg font-semibold">{p.name}</h2>
      <p className="mt-2 break-all text-sm text-zinc-400">{p.listedHandle}</p>
      <p className="mt-3 break-all font-mono text-xs text-zinc-500">{p.officialChannelId}</p>
      <a href={p.firstPartyChannelPage} target="_blank" rel="noopener noreferrer"
       className="mt-5 inline-block text-sm text-amber-300 underline underline-offset-4">Inspect YouTube page</a>
      <p className="mt-3 text-xs text-zinc-500">No monitoring, statistics or operator approval.</p>
    </Panel>)}
   </div>
  </>:<>
   <Panel>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     <label className="text-xs font-medium text-zinc-400">Search name, handle or niche
      <input type="search" aria-label="Search research leads" value={search}
       onChange={e=>setSearch(e.target.value)} placeholder="Try farming, podcast, Tamil…"
       className="mt-2 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-400"/>
     </label>
     <label className="text-xs font-medium text-zinc-400">Language / region
      <select aria-label="Filter language" value={locale} onChange={e=>setLocale(e.target.value)}
       className="mt-2 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
       <option value="all">All languages</option>
       {languages.map(x=><option key={x} value={x}>{LANGUAGE[x]??x}</option>)}
      </select>
     </label>
     <label className="text-xs font-medium text-zinc-400">Provisional size
      <select aria-label="Filter size" value={tier} onChange={e=>setTier(e.target.value)}
       className="mt-2 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100">
       <option value="all">Every size</option>
       {sizes.map(x=><option key={x} value={x}>{TIER[x]??x}</option>)}
      </select>
     </label>
    </div>
    <p role="status" className="mt-4 text-xs leading-6 text-zinc-500">
     Showing {filtered.length} of {research.leads.length} leads. Third-party size segments and language labels are provisional, not YouTube-verified.
    </p>
   </Panel>
   <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(270px,0.85fr)_minmax(0,1.15fr)]">
    <section className="min-w-0 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
     <h2 className="px-3 pb-3 pt-2 text-base font-semibold">Discovery queue</h2>
     {filtered.length===0?<p className="px-3 py-8 text-sm text-zinc-400">No matches. Adjust the filters.</p>:
      <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1" aria-label="Research leads">
       {filtered.map(lead=><button type="button" key={lead.id} onClick={()=>setSelected(lead.id)}
        aria-pressed={active?.id===lead.id}
        className={'w-full min-w-0 rounded-2xl border p-4 text-left transition '+(
         active?.id===lead.id?'border-amber-700/70 bg-amber-950/20':'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600'
        )}>
        <div className="flex items-start justify-between gap-3">
         <span className="min-w-0 text-sm font-semibold leading-6 text-zinc-100">{lead.name}</span>
         <span className="shrink-0 text-xs text-zinc-500">{LANGUAGE[lead.locale]??lead.locale}</span>
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500">{lead.category}</p>
        <p className="mt-2 text-xs text-amber-200/80">{TIER[lead.provisionalTier]??'Unknown'} · provisional</p>
       </button>)}
      </div>}
    </section>
    {active&&leadIds.has(active.id)?<Panel>
     <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Research only · identity pending</p>
     <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight">{active.name}</h2>
     <p className="mt-3 text-sm text-zinc-400">{active.category}</p>
     <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {([
       ['Language / region',LANGUAGE[active.locale]??active.locale],
       ['Listed handle',active.listedHandle??'Not yet identified'],
       ['Provisional size',TIER[active.provisionalTier]??'Unknown'],
       ['Official YouTube ID','Not verified'],
      ] as const).map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/65 p-4">
       <p className="text-xs text-zinc-500">{label}</p><p className="mt-2 break-words text-sm font-medium text-zinc-200">{value}</p>
      </div>)}
     </div>
     <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <h3 className="text-sm font-semibold">Discovery provenance</h3>
      <p className="mt-2 text-xs leading-6 text-zinc-500">A third-party public lead, not proof of channel ownership, subscriber count or content type.</p>
      <a href={active.discoverySourceUrl} target="_blank" rel="noopener noreferrer"
       className="mt-3 inline-block max-w-full break-all text-sm text-amber-300 underline underline-offset-4">Open discovery source</a>
     </section>
     <p className="mt-5 text-xs leading-6 text-zinc-400">
      Next: official UC identity lookup, fresh production deduplication, channel activity assessment,
      platform-policy review, and explicit operator approval. This desk cannot enable collection.
     </p>
    </Panel>:<Panel><p className="text-sm text-zinc-400">Select a research lead to inspect evidence.</p></Panel>}
   </div>
  </>}
  <p className="text-xs leading-6 text-zinc-500">Source data is a dated editorial snapshot. This page makes no YouTube API calls and calculates no engagement scores, rankings or analytics.</p>
 </main>;
}

export function CreatorResearchPage(){
 const guard=useQuery({queryKey:['creator-research-operator-guard'],queryFn:fetchConsoleOverview,
  retry:false,staleTime:60_000});
 if(guard.isPending)return <main role="status"><Panel>Checking active operator access before opening the research desk…</Panel></main>;
 if(guard.isError)return <main><Panel>Creator Research Desk requires authorized CineRelay operator access. {guard.error.message}</Panel></main>;
 return <ResearchContent/>;
}
