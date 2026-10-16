import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchPendingCatalogueReviewQueue} from '../lib/review-api';
import {orderPendingCatalogue,titleNeedsManualCleanup} from '../lib/catalogue-review-utils';

type View = 'ALL' | 'CLEANUP' | 'EVIDENCE';

export function CatalogueReviewPanel() {
  const [view,setView] = useState<View>('ALL');
  const query = useQuery({
    queryKey:['pending-catalogue-review'],
    queryFn:()=>fetchPendingCatalogueReviewQueue(100),
    refetchInterval:60_000,
  });
  const items = query.data?.items ?? [];
  const cleanup = items.filter(titleNeedsManualCleanup);
  const ordered = orderPendingCatalogue(items);
  const visible = ordered.filter(item=>{
    const needsCleanup = titleNeedsManualCleanup(item);
    return view==='ALL' || (view==='CLEANUP' && needsCleanup) || (view==='EVIDENCE' && !needsCleanup);
  });

  return <section id="catalogue-review" className="scroll-mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Phase 1 · operator-only</p>
        <h2 className="mt-2 text-xl font-semibold">Pending movie &amp; series catalogue</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Review every pending candidate, including YouTube and RSS discoveries.
          This is a read-only triage queue, not a publication or approval screen.
          A plausible title and a high confidence score do not prove catalogue identity.
        </p>
      </div>
      {query.data && <span className="text-xs text-zinc-500">Updated {new Date(query.data.generatedAt).toLocaleString()}</span>}
    </div>
    {query.isPending && <p className="mt-4 text-sm text-zinc-400">Loading pending candidates and their sources…</p>}
    {query.isError && <p className="mt-4 text-sm text-red-300">Could not load the catalogue queue: {query.error.message}</p>}
    {query.data && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Count label="Pending candidates" value={items.length}/>
        <Count label="Possible captions / headlines" value={cleanup.length}/>
        <Count label="Other titles needing evidence" value={items.length-cleanup.length}/>
      </div>
      <p className="mt-4 text-xs leading-5 text-amber-200">
        Text-quality warnings are screening hints, not editorial decisions. Even unflagged titles need independent
        verification before approval. Duplicate source identities do not necessarily represent independent owners.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {([
          ['ALL','All pending'],
          ['CLEANUP','Possible title cleanup'],
          ['EVIDENCE','Evidence review'],
        ] as const).map(([key,label])=>
          <button key={key} type="button" onClick={()=>setView(key)} aria-pressed={view===key}
            className={'rounded-lg border px-3 py-2 text-xs font-medium transition '+(view===key
              ?'border-amber-500 bg-amber-950/40 text-amber-200'
              :'border-zinc-700 text-zinc-400 hover:text-white')}>{label}</button>)}
      </div>
      {visible.length===0
        ? <p className="mt-4 text-sm text-zinc-500">No candidates in this filter.</p>
        : <div className="mt-4 space-y-3">{visible.map(item=>{
          const needsCleanup=titleNeedsManualCleanup(item);
          return <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span>{item.proposed_entity_type}</span>
                  <span>•</span>
                  <span>Confidence {(item.confidence*100).toFixed(0)}% (not verified)</span>
                  <span>•</span>
                  <span>{item.status}</span>
                </div>
                <h3 className="mt-2 break-words text-base font-semibold text-zinc-100">{item.proposed_name}</h3>
                <p className={'mt-2 text-xs '+(needsCleanup?'text-amber-300':'text-zinc-400')}>
                  {needsCleanup?'Possible promotional caption or article headline — review exact title'
                    :'Title spelling is not flagged — identity and independent evidence still need review'}
                </p>
              </div>
              <span className={'shrink-0 rounded-lg border px-2 py-1 text-xs '+(needsCleanup
                ?'border-amber-800 text-amber-200'
                :'border-zinc-700 text-zinc-400')}>
                {needsCleanup?'Review name':'Check evidence'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>{item.evidence_count} evidence item(s)</span>
              <span>{item.source_count} source identit{item.source_count===1?'y':'ies'}</span>
              <span>{item.first_party_source_count} first-party identit{item.first_party_source_count===1?'y':'ies'}</span>
            </div>
            <details className="mt-3 rounded-lg border border-zinc-800 p-3">
              <summary className="cursor-pointer text-xs font-medium text-sky-300">Inspect retained source evidence ({item.evidence.length})</summary>
              {item.evidence.length===0
                ? <p className="mt-2 text-xs text-zinc-500">No linked evidence returned; verify before any action.</p>
                : <div className="mt-3 space-y-3">{item.evidence.map(evidence=>{
                  const url=evidence.sourceUrl;
                  const safeUrl=typeof url==='string' && /^https?:\/\//i.test(url);
                  return <div key={evidence.id} className="border-t border-zinc-800 pt-3">
                    <p className="text-xs font-medium text-zinc-300">{evidence.sourceName} · {evidence.platform} · {evidence.sourceRole??'Role unknown'}</p>
                    <p className="mt-1 break-words text-xs text-zinc-400">{evidence.rawTitle??'Untitled source'}</p>
                    <p className="mt-1 text-xs text-zinc-600">{evidence.isFirstParty?'First-party evidence':'Not first-party'} · {evidence.matchMethod} · Published {evidence.publishedAt?new Date(evidence.publishedAt).toLocaleString():'unknown'}</p>
                    {safeUrl && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-300 underline">Open original source ↗</a>}
                  </div>;
                })}</div>}
            </details>
            {item.proposed_entity_type==='SERIES' &&
              <p className="mt-3 text-xs text-zinc-400">
                For original producer-post leads, use the <a href="#official-article-review" className="text-sky-300 underline">official article review</a> form;
                a staged lead never counts toward approval.
              </p>}
          </article>;
        })}</div>}
    </>}
  </section>;
}

function Count({label,value}:{label:string;value:number}){
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
  </div>;
}
