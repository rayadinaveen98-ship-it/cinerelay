import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchCorrectionImpactPreview,searchReviewEntities} from '../lib/review-api';

export function CatalogueCorrectionPreview({
  sourceEntityId,sourceName,sourceType,
}:{
  sourceEntityId:string;sourceName:string;sourceType:'MOVIE'|'SERIES';
}){
  const [open,setOpen]=useState(false);
  const [expectedType,setExpectedType]=useState<'MOVIE'|'SERIES'>(sourceType);
  const [lookup,setLookup]=useState('');
  const [target,setTarget]=useState<{id:string;name:string;type:string}|null>(null);
  const search=useQuery({
    queryKey:['correction-target-search',lookup],
    queryFn:()=>searchReviewEntities(lookup),
    enabled:open&&lookup.trim().length>=2,
  });
  const preview=useQuery({
    queryKey:['catalogue-correction-impact',sourceEntityId,target?.id??null,expectedType],
    queryFn:()=>fetchCorrectionImpactPreview(sourceEntityId,target?.id??null,expectedType),
    enabled:open,
    refetchOnWindowFocus:false,
  });
  return <div className="mt-3 rounded-lg border border-zinc-700/70 p-3">
    <button type="button" onClick={()=>setOpen(v=>!v)}
      aria-expanded={open} className="text-sm font-semibold text-sky-300 underline underline-offset-4">
      {open?'Close correction impact preview':'Preview correction / merge impact (read-only)'}
    </button>
    {open&&<div className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-amber-200">
        This screen cannot fix or approve “{sourceName}”. Confirm the true identity and
        type from official evidence, then check downstream references and release collisions.
        A high-confidence candidate is not proof.
      </p>
      <label className="block text-xs font-medium text-zinc-300">
        Independently verified content type
        <select className="mt-1 block w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-900 p-2"
          value={expectedType} onChange={e=>setExpectedType(e.target.value as 'MOVIE'|'SERIES')}>
          <option value="MOVIE">Movie</option>
          <option value="SERIES">Series</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-zinc-300">
        Optional existing target identity
        <input type="search" value={lookup} onChange={e=>{setLookup(e.target.value);setTarget(null);}}
          placeholder="Search a verified existing title (e.g. Kappi Squad)"
          className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"/>
      </label>
      {lookup.trim().length>=2 && !target && <>
        {search.isPending&&<p className="text-xs text-zinc-400">Searching existing identities…</p>}
        {search.isError&&<p className="text-xs text-red-300">Could not search: {search.error.message}</p>}
        {search.data&&<div className="max-h-40 space-y-1 overflow-auto">
          {search.data.items.filter(item=>item.id!==sourceEntityId && ['MOVIE','SERIES'].includes(item.entity_type)).slice(0,12).map(item=>
            <button type="button" key={item.id}
              onClick={()=>setTarget({id:item.id,name:item.canonical_name,type:item.entity_type})}
              className="block w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 hover:border-sky-800">
              {item.canonical_name} · {item.entity_type}
            </button>)}
        </div>}
      </>}
      {target&&<div className="flex flex-wrap items-center gap-3 text-xs text-sky-200">
        Selected existing entity: <strong>{target.name} · {target.type}</strong>
        <button type="button" className="underline" onClick={()=>{setTarget(null);setLookup('');}}>Clear target</button>
      </div>}
      {preview.isPending&&<p className="text-xs text-zinc-400">Inspecting live references without making changes…</p>}
      {preview.isError&&<p className="text-xs text-red-300">Preview failed: {preview.error.message}</p>}
      {preview.data&&<div className="space-y-3">
        <p className="text-xs font-semibold text-amber-200">Manual decision required · Automatic correction disabled</p>
        {!preview.data.referenceScanComplete&&<p className="text-xs text-red-300">
          Reference query cap reached. Counts are incomplete; stop correction planning until full audit.
        </p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Impact label="Current entry" name={preview.data.source.canonical_name} impact={preview.data.sourceImpact}/>
          {preview.data.target&&preview.data.targetImpact&&
            <Impact label="Existing target" name={preview.data.target.canonical_name} impact={preview.data.targetImpact}/>}
        </div>
        {preview.data.risk.releaseCollisions.length>0&&
          <p className="text-xs font-semibold text-red-300">
            {preview.data.risk.releaseCollisions.length} provider/territory/release-type collision(s).
            A direct merge could duplicate OTT release records.
          </p>}
        <div className="space-y-1">
          {preview.data.risk.warnings.map((warning,i)=>
            <p key={i} className="text-xs leading-5 text-zinc-300">• {warning}</p>)}
        </div>
        <p className="text-xs text-zinc-500">
          No catalogue row, release, event, original evidence, alert or follower has been edited.
          An operator must use a separately audited correction workflow after reviewing the source material.
        </p>
      </div>}
    </div>}
  </div>;
}

type ImpactData=Awaited<ReturnType<typeof fetchCorrectionImpactPreview>>['sourceImpact'];
function Impact({label,name,impact}:{label:string;name:string;impact:ImpactData}){
  return <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold">{name}</p>
    <p className="mt-2 text-xs text-zinc-400">{impact.activeEvents} active events · {impact.ottReleaseRows} OTT release rows</p>
    <p className="mt-1 text-xs text-zinc-400">{impact.promotedCandidates} promoted candidates · {impact.aliases.length} aliases</p>
    <p className="mt-1 text-xs text-zinc-400">{impact.activeFollowers} active followers · {impact.claims} claims</p>
    <p className="mt-1 text-xs text-zinc-400">{impact.alertDeliveries} alert deliveries · {impact.sentAlerts} sent</p>
    <p className="mt-1 text-xs text-zinc-400">{impact.relationshipProposals} relationship proposals · {impact.resolutionLinks} resolution links</p>
    {impact.releaseRows.map(row=><p key={row.id}
      className="mt-2 break-words border-t border-zinc-800 pt-2 text-xs leading-5 text-zinc-500">
      OTT provider ID {row.providerId.slice(0,8)}… · {row.territory??'Unknown region'} ·
      {row.date??'Date unverified'} · {row.state} · {row.precision}
    </p>)}
  </div>;
}
