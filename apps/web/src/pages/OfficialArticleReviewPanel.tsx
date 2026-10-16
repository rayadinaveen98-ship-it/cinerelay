import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {isIdentityOnlyWebArticle,prioritizePendingSuggestions} from '../lib/article-review-utils';
import {
  fetchOfficialArticleReviewQueue,resolveReviewItem,searchReviewEntities,
  type OfficialArticleReviewItem,
} from '../lib/review-api';

type Article = OfficialArticleReviewItem['items'][number];

function OfficialArticleCard({item}:{item:Article}) {
  const queryClient=useQueryClient();
  const [entitySearch,setEntitySearch]=useState('');
  const [entityId,setEntityId]=useState('');
  const [title,setTitle]=useState('');
  const [entityType,setEntityType]=useState<'MOVIE'|'SERIES'|'SEASON'>('SERIES');
  const [language,setLanguage]=useState('');
  const [country,setCountry]=useState('');
  const [reason,setReason]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const typed=item.typedSuggestion;
  const candidates=useQuery({
    queryKey:['review-entity-search',entitySearch],
    queryFn:()=>searchReviewEntities(entitySearch),
    enabled:entitySearch.trim().length>=2,
  });
  const apply=useMutation({
    mutationFn:()=>resolveReviewItem({
      rawItemId:item.rawItem.id,reason:reason.trim(),
      ...(entityId?{entityId}:{
        newEntityName:title.trim(),
        newEntityType:entityType,
        ...(language.trim()?{primaryLanguage:language.trim().toLowerCase()} : {}),
        ...(country.trim()?{countryCode:country.trim().toUpperCase()} : {}),
      }),
    }),
    onSuccess:async()=>{
      setReason('');setConfirmed(false);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:['official-article-review-queue']}),
        queryClient.invalidateQueries({queryKey:['review-bootstrap']}),
        queryClient.invalidateQueries({queryKey:['console-feed']}),
      ]);
    },
  });
  const metadataValid=(!language.trim()||/^[a-z]{2,3}$/i.test(language.trim()))&&
    (!country.trim()||/^[a-z]{2}$/i.test(country.trim()));
  const canApply=confirmed&&reason.trim().length>=15&&metadataValid&&
    Boolean(entityId||(title.trim().length>=3&&title.trim().length<=100))&&!apply.isPending;
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{item.source.name} · Tier {item.source.authorityTier} · {item.resolution.resolution_state}</p>
        <h3 className="mt-2 text-base font-semibold text-zinc-100">{item.rawItem.raw_title??'Untitled article'}</h3>
        {isIdentityOnlyWebArticle(item.rawItem)&&<p className="mt-2 text-xs font-medium text-amber-300">Historical or undated · identity-only on approval · no new alert</p>}
        <p className="mt-2 text-xs text-zinc-500">Ingested {new Date(item.rawItem.first_seen_at).toLocaleString()}{item.rawItem.published_at?' · Published '+new Date(item.rawItem.published_at).toLocaleString(): ' · Source publication date unconfirmed'}</p>
      </div>
      <a href={item.rawItem.canonical_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-amber-300 hover:underline">Read official article ↗</a>
    </div>
    {typed?.status==='PENDING'?<div className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-amber-300">Pending typed suggestion · Not approved</p>
      <p className="mt-2 font-semibold text-zinc-100">{typed.proposed_name} <span className="text-sm font-normal text-zinc-400">· {typed.proposed_entity_type}</span></p>
      <p className="mt-1 text-xs text-zinc-400">{typed.first_party_source_count} first-party source(s) · {typed.evidence_count} evidence item(s)</p>
      {Boolean(typed.metadata.editorialVerification) &&
        typeof typed.metadata.editorialVerification === 'object' &&
        !Array.isArray(typed.metadata.editorialVerification) &&
        <div className="mt-3 rounded-lg border border-zinc-700/70 bg-zinc-900/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Evidence checked · Not catalogue approval</p>
          <p className="mt-1 text-xs leading-5 text-zinc-300">
            {String((typed.metadata.editorialVerification as Record<string, unknown>).reviewNote ?? 'Awaiting independent corroboration')}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Region: {(typed.metadata.editorialVerification as Record<string, unknown>).priority === 'INDIA_FIRST'
              ? 'India-first' : 'Global / secondary'} · Language: {typed.primary_language?.toUpperCase() ?? 'Unknown'} · Country: {typed.country_code ?? 'Unknown'}
          </p>
        </div>}
      <p className="mt-2 text-xs text-amber-300">
        {typed.source_count} source identit{typed.source_count === 1 ? 'y' : 'ies'} recorded.
        Catalogue approval requires 2 independent source owners and confidence of at least 0.85.
        {typed.confidence < 0.85 ? ' Confidence is currently below that threshold.' : ''}
      </p>
      {Boolean(typed.metadata.externalProductionCorroboration) &&
        typeof typed.metadata.externalProductionCorroboration === 'object' &&
        !Array.isArray(typed.metadata.externalProductionCorroboration) &&
        <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Producer-side corroboration located · External only</p>
          <p className="mt-2 font-medium text-zinc-200">{String((typed.metadata.externalProductionCorroboration as Record<string,unknown>).producer ?? 'Production company')}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-300">{String((typed.metadata.externalProductionCorroboration as Record<string,unknown>).verificationNote ?? '')}</p>
          <p className="mt-1 text-xs leading-5 text-amber-200">{String((typed.metadata.externalProductionCorroboration as Record<string,unknown>).identityAndReleaseCaveat ?? '')}</p>
          {typeof (typed.metadata.externalProductionCorroboration as Record<string,unknown>).producerOwnedEvidenceUrl === 'string' &&
           /^https:\/\/(www\.)?linkedin\.com\//.test(String((typed.metadata.externalProductionCorroboration as Record<string,unknown>).producerOwnedEvidenceUrl)) &&
           <a className="mt-2 inline-block text-xs text-sky-300 hover:underline" target="_blank" rel="noopener noreferrer"
             href={String((typed.metadata.externalProductionCorroboration as Record<string,unknown>).producerOwnedEvidenceUrl)}>
             Open original producer page ↗
           </a>}
          <p className="mt-2 text-xs text-zinc-400">Not collected by a CineRelay connector. Does not count toward independent-owner approval or trigger publication.</p>
        </div>}
      {typeof typed.metadata.seasonNumber==='number'&&<p className="mt-1 text-xs text-zinc-400">Season {typed.metadata.seasonNumber} mentioned in evidence</p>}
      {typeof typed.metadata.proposedReleaseDate==='string'&&<p className="mt-1 text-xs text-amber-300">Suggested release date {typed.metadata.proposedReleaseDate} — unverified; do not publish without reviewing primary evidence</p>}
      <button type="button" onClick={()=>{setTitle(typed.proposed_name);setEntityType(typed.proposed_entity_type);setEntityId('');}} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-200 hover:bg-amber-950/40">Copy suggested name into review form (not approval)</button>
    </div>:<div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">{item.reviewStatus==='MANUAL_TITLE_REVIEW'?'No reliable title detected. Identify the actual movie or series in the official article before proceeding.':'No pending suggestion. Verify the title manually.'}</div>}
    <details className="mt-4 rounded-xl border border-zinc-800 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Resolve after checking evidence (audited action)</summary>
      <p className="mt-3 text-xs leading-5 text-amber-200">This action resolves an individual article; it is NOT an approval of the typed catalogue candidate. Catalogue approval is separately gated by evidence from two independent owners. Resolving an item can reprocess it and potentially publish a canonical event. Verify the precise title, format, and relevance before choosing an entity. Unknown language, country, and release date must remain blank. Older (more than 48 hours since discovery or publication) and undated website articles are identity-only corrections: no new event or notification is generated.</p>
      <label className="mt-4 block text-xs text-zinc-400">Search existing movie / series first
        <input value={entitySearch} onChange={e=>{setEntitySearch(e.target.value);setEntityId('');}} placeholder="Search canonical titles" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
      </label>
      {(candidates.data?.items.length??0)>0&&<div className="mt-2 max-h-32 space-y-1 overflow-y-auto">{candidates.data?.items.map(e=><button type="button" key={e.id} onClick={()=>{setEntityId(e.id);setTitle('');}} className={'block w-full rounded-lg border px-3 py-2 text-left text-sm '+(entityId===e.id?'border-amber-500 bg-amber-950/30':'border-zinc-800')}>{e.canonical_name} · {e.entity_type}</button>)}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">Or verified new title
          <input value={title} onChange={e=>{setTitle(e.target.value);setEntityId('');}} placeholder="Exact verified title" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-zinc-400">Verified type
          <select value={entityType} onChange={e=>setEntityType(e.target.value as 'MOVIE'|'SERIES'|'SEASON')} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="MOVIE">Movie</option><option value="SERIES">Series</option><option value="SEASON">Season</option></select>
        </label>
        <label className="text-xs text-zinc-400">Language code (optional; verified only)
          <input value={language} onChange={e=>setLanguage(e.target.value)} maxLength={3} placeholder="Unknown · e.g. hi" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-zinc-400">Country code (optional; verified only)
          <input value={country} onChange={e=>setCountry(e.target.value)} maxLength={2} placeholder="Unknown · e.g. IN" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="mt-3 block text-xs text-zinc-400">Audit reason and evidence reviewed (15+ characters)
        <textarea value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm" placeholder="Why does the official article establish this exact title and format?" />
      </label>
      <label className="mt-3 flex items-start gap-2 text-xs text-zinc-300"><input checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} type="checkbox" className="mt-0.5" />I read the original first-party announcement, confirmed the title/type, checked for an existing entity, and understand this action may publish a new event.</label>
      <button type="button" disabled={!canApply} onClick={()=>apply.mutate()} className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40">{apply.isPending?'Applying…':'Resolve and reprocess after review'}</button>
      {apply.isError&&<p className="mt-2 text-sm text-red-300">{apply.error.message}</p>}
      {apply.isSuccess&&<p className="mt-2 text-sm text-emerald-300">Operator resolution submitted and logged. Check the resulting event before treating it as published.</p>}
    </details>
  </article>;
}

export function OfficialArticleReviewPanel(){
  const query=useQuery({queryKey:['official-article-review-queue'],queryFn:()=>fetchOfficialArticleReviewQueue(50),refetchInterval:30_000});
  return <section id="official-article-review" className="scroll-mt-6 space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Official website evidence</p><h2 className="mt-2 text-xl font-semibold">Movie & series article review</h2><p className="mt-2 text-sm leading-6 text-zinc-400">First-party articles that CineRelay ingested but could not associate with a verified title. Typed suggestions are pending evidence, never automatic catalogue approval. No inferred release dates. Pending suggestions are shown first; unknown-dated items remain identity-only.</p></div>
    {query.isPending&&<p className="text-sm text-zinc-500">Loading protected official-article review queue…</p>}
    {query.isError&&<p className="text-sm text-red-300">Could not load the operator queue: {query.error.message}</p>}
    {query.data&&<><p className="text-sm text-zinc-400">{query.data.items.length} unresolved official article(s) · {query.data.items.filter(x=>x.typedSuggestion?.status==='PENDING').length} with pending typed suggestions · refreshed {new Date(query.data.generatedAt).toLocaleString()}</p>
      {query.data.items.length===0?<p className="text-sm text-zinc-500">No unresolved official articles.</p>:<div className="space-y-3">{prioritizePendingSuggestions(query.data.items).map(item=><OfficialArticleCard key={item.rawItem.id} item={item}/>)}</div>}
    </>}
  </section>;
}
