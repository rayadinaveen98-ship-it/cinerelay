import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchActiveCatalogueQualityAudit} from '../lib/review-api';
import {CatalogueCorrectionPreview} from './CatalogueCorrectionPreview';

type Scope = 'ALL'|'WITH_EVENTS'|'NO_EVIDENCE';

export function ActiveCatalogueAuditPanel() {
  const [scope,setScope]=useState<Scope>('ALL');
  const audit=useQuery({
    queryKey:['active-catalogue-quality-audit'],
    queryFn:()=>fetchActiveCatalogueQualityAudit(100),
    refetchInterval:120_000,
  });
  const items=audit.data?.items??[];
  const visible=items.filter(item=>{
    if(scope==='WITH_EVENTS')return item.activeEventCount>0;
    if(scope==='NO_EVIDENCE')return item.sourceEvidence.length===0;
    return true;
  });

  return <section id="active-catalogue-audit"
    className="scroll-mt-6 rounded-3xl border border-amber-900/60 bg-zinc-900/50 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Phase 1 · existing catalogue</p>
        <h2 className="mt-2 text-xl font-semibold">Active-title quality audit</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Check titles already published in CineRelay. Warnings indicate possible promotional headlines,
          not confirmed errors. Every affected event and original source must be reviewed before correction.
          This panel never renames, removes or republishes anything.
        </p>
      </div>
      {audit.data && <span className="text-xs text-zinc-500">
        Snapshot {new Date(audit.data.generatedAt).toLocaleString()}
      </span>}
    </div>
    {audit.isPending && <p className="mt-4 text-sm text-zinc-400">Reading active titles, linked events and sources…</p>}
    {audit.isError && <p className="mt-4 text-sm text-red-300">
      Active catalogue audit unavailable: {audit.error.message}
    </p>}
    {audit.data && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Active titles scanned" value={audit.data.scannedActiveEntities}/>
        <Metric label="Flagged for manual review" value={audit.data.totalFlagged}/>
        <Metric label="Active events linked to shown entries"
          value={items.reduce((total,item)=>total+item.activeEventCount,0)}/>
      </div>
      {(!audit.data.scanComplete || !audit.data.eventCountsComplete || !audit.data.evidenceLinksComplete) &&
        <p role="status" className="mt-3 text-xs leading-5 text-amber-300">
          This snapshot is limited by the review API scan or evidence cap.
          Do not assume the event totals and links are exhaustive.
        </p>}
      <p className="mt-3 text-xs leading-5 text-zinc-400">
        Ordered by active-event impact. Source links and promoted-candidate records are retained for provenance.
        No automatic corrections or approval decisions are performed here.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {([
          ['ALL','All flagged'],
          ['WITH_EVENTS','With active events'],
          ['NO_EVIDENCE','Missing linked source'],
        ] as const).map(([key,label])=>
          <button type="button" key={key} aria-pressed={scope===key} onClick={()=>setScope(key)}
            className={'rounded-lg border px-3 py-2 text-xs font-medium '+
            (scope===key?'border-amber-500 bg-amber-950/40 text-amber-100':
            'border-zinc-700 text-zinc-400 hover:text-zinc-100')}>{label}</button>)}
      </div>
      {visible.length===0
        ? <p className="mt-4 text-sm text-zinc-500">No entries in this filter.</p>
        : <div className="mt-4 space-y-3">{visible.map(item=>
            <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">{item.entity_type} · {item.status}
                    {item.primary_language?' · '+item.primary_language.toUpperCase():''}</p>
                  <h3 className="mt-2 break-words text-base font-semibold text-zinc-100">{item.canonical_name}</h3>
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    Review hint: {item.warnings.join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-amber-900 px-2 py-1 text-xs text-amber-200">
                  {item.activeEventCount} active event{item.activeEventCount===1?'':'s'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <details className="rounded-lg border border-zinc-800 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-sky-300">
                    Review linked events ({item.activeEventCount})
                  </summary>
                  {item.eventSamples.length===0
                    ? <p className="mt-2 text-xs text-zinc-500">No active events linked.</p>
                    : <div className="mt-3 space-y-3">{item.eventSamples.map(ev=>
                      <div key={ev.id} className="border-t border-zinc-800 pt-2">
                        <p className="text-xs font-medium text-zinc-300">{ev.eventType.replaceAll('_',' ')}</p>
                        <p className="mt-1 break-words text-xs text-zinc-400">{ev.headline??'No headline'}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Detected {new Date(ev.detectedAt).toLocaleString()}
                        </p>
                      </div>)}</div>}
                  {item.activeEventCount>item.eventSamples.length&&
                    <p className="mt-2 text-xs text-amber-300">Only the most recent six linked events are shown.</p>}
                </details>
                <details className="rounded-lg border border-zinc-800 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-sky-300">
                    Check original sources ({item.sourceEvidence.length} shown)
                  </summary>
                  {item.sourceEvidence.length===0
                    ? <p className="mt-2 text-xs text-amber-300">
                        No original source returned. Manual evidence verification required.
                      </p>
                    : <div className="mt-3 space-y-3">{item.sourceEvidence.map(raw=>
                      <div key={raw.rawItemId} className="border-t border-zinc-800 pt-2">
                        <p className="text-xs font-medium text-zinc-300">
                          {raw.sourceName} · {raw.platform}
                        </p>
                        <p className="mt-1 break-words text-xs text-zinc-400">{raw.rawTitle??'Untitled source'}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Published {raw.publishedAt?new Date(raw.publishedAt).toLocaleString():'unknown'}
                        </p>
                        {raw.sourceUrl && /^https?:\/\//i.test(raw.sourceUrl) &&
                          <a href={raw.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs text-sky-300 underline">
                            Open original source ↗
                          </a>}
                      </div>)}</div>}
                </details>
              </div>
              <CatalogueCorrectionPreview sourceEntityId={item.id}
                sourceName={item.canonical_name} sourceType={item.entity_type}/>
              {item.linkedPromotedCandidates.length>0 &&
                <details className="mt-3 rounded-lg border border-zinc-800 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                    Automatic promotion record ({item.linkedPromotedCandidates.length})
                  </summary>
                  {item.linkedPromotedCandidates.map(candidate=>
                    <div key={candidate.id} className="mt-2 break-words text-xs leading-5 text-zinc-500">
                      <span className="text-zinc-300">{candidate.proposedName}</span>
                      {' · '}{candidate.status}{' · '}
                      Confidence {(candidate.confidence*100).toFixed(0)}% (not title verification)
                      {candidate.reviewReason?' · '+candidate.reviewReason:''}
                    </div>)}
                </details>}
            </article>)}</div>}
      <p className="mt-4 text-xs text-zinc-500">
        Editorial review must compare the original official source and correct canonical identity.
        Historical events and notifications should only change through a separately audited workflow.
      </p>
    </>}
  </section>;
}

function Metric({label,value}:{label:string;value:number}){
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
  </div>;
}
