import { createClient } from '@supabase/supabase-js';
import {candidateOwnerGroupKey} from './owner-grouping.ts';
import {activeCatalogueTitleWarnings,sortActiveCatalogueImpact} from './active-catalogue-audit.ts';
import {assessCorrectionRisk,type CorrectionEntity,type CorrectionRelease} from './correction-impact.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing CineRelay review API environment');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

type OperatorAuth =
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; response: Response };

async function requireOperator(request: Request): Promise<OperatorAuth> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json(401, { error: 'authentication_required' }) };
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return { ok: false, response: json(401, { error: 'invalid_session' }) };
  const { data: operator, error } = await admin.from('operator_users').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!operator) return { ok: false, response: json(403, { error: 'operator_access_required' }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

async function reviewQueue(limit: number) {
  const bounded = Math.max(1, Math.min(100, limit));
  const { data: resolutions, error: resolutionError } = await admin.from('current_entity_resolution_results')
    .select('id,raw_item_id,entity_id,score,resolution_state,methods,engine_version,created_at')
    .in('resolution_state', ['UNRESOLVED', 'AMBIGUOUS'])
    .order('created_at', { ascending: false })
    .limit(bounded);
  if (resolutionError) throw resolutionError;
  const rows = resolutions ?? [];
  if (rows.length === 0) return { generatedAt: new Date().toISOString(), items: [] };

  const rawIds = rows.map((row) => row.raw_item_id);
  const [{ data: raws, error: rawError }, { data: overrides, error: overrideError }] = await Promise.all([
    admin.from('raw_items').select('id,source_identity_id,platform_item_id,canonical_url,published_at,first_seen_at,raw_title,raw_text,metadata').in('id', rawIds),
    admin.from('operator_resolution_overrides').select('id,raw_item_id,entity_id,active,reason,created_by,created_at,updated_at').in('raw_item_id', rawIds),
  ]);
  if (rawError) throw rawError;
  if (overrideError) throw overrideError;

  const rawMap = new Map((raws ?? []).map((row) => [row.id, row]));
  const overrideMap = new Map((overrides ?? []).map((row) => [row.raw_item_id, row]));
  const sourceIdentityIds = [...new Set((raws ?? []).map((row) => row.source_identity_id).filter(Boolean))];
  const entityIds = [...new Set([
    ...rows.map((row) => row.entity_id).filter(Boolean),
    ...(overrides ?? []).map((row) => row.entity_id).filter(Boolean),
  ])];

  const [{ data: identities, error: identityError }, { data: entities, error: entityError }] = await Promise.all([
    sourceIdentityIds.length
      ? admin.from('source_identities').select('id,source_id,platform,handle,canonical_url,connector_type,access_mode').in('id', sourceIdentityIds)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length
      ? admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').in('id', entityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (identityError) throw identityError;
  if (entityError) throw entityError;

  const identityMap = new Map((identities ?? []).map((row) => [row.id, row]));
  const sourceIds = [...new Set((identities ?? []).map((row) => row.source_id).filter(Boolean))];
  const { data: sources, error: sourceError } = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id', sourceIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const entityMap = new Map((entities ?? []).map((row) => [row.id, row]));

  const items = rows.map((resolution) => {
    const raw = rawMap.get(resolution.raw_item_id);
    const identity = raw ? identityMap.get(raw.source_identity_id) : undefined;
    const source = identity ? sourceMap.get(identity.source_id) : undefined;
    const override = overrideMap.get(resolution.raw_item_id);
    return {
      resolution,
      rawItem: raw ?? null,
      source: source && identity ? {
        name: source.display_name,
        authorityTier: source.authority_tier,
        sourceRole: source.source_role,
        platform: identity.platform,
        handle: identity.handle,
        canonicalUrl: identity.canonical_url,
        connectorType: identity.connector_type,
        accessMode: identity.access_mode,
      } : null,
      resolvedEntity: resolution.entity_id ? entityMap.get(resolution.entity_id) ?? null : null,
      override: override ? { ...override, entity: entityMap.get(override.entity_id) ?? null } : null,
    };
  });

  return { generatedAt: new Date().toISOString(), items };
}

/**
 * Official unresolved articles are not a public newsroom feed. Expose them only
 * via existing operator auth, with typed candidate suggestions when verified.
 */
async function officialArticleReviewQueue(limit: number) {
  const bounded = Math.max(1, Math.min(100, limit));
  const {data: rawRows, error: rawError} = await admin.from('raw_items')
    .select('id,source_identity_id,raw_title,canonical_url,first_seen_at,published_at')
    .eq('item_type','WEB_ARTICLE')
    .order('first_seen_at',{ascending:false})
    .limit(Math.min(400, bounded * 4));
  if (rawError) throw rawError;
  const raws = rawRows ?? [];
  if (!raws.length) return {items:[], generatedAt:new Date().toISOString()};
  const rawIds = raws.map(x=>x.id);
  const ids = [...new Set(raws.map(x=>x.source_identity_id))];
  const [a,b,c] = await Promise.all([
    admin.from('current_entity_resolution_results')
      .select('raw_item_id,resolution_state,score,methods,created_at')
      .in('raw_item_id',rawIds),
    admin.from('source_identities')
      .select('id,source_id,platform,connector_type')
      .in('id',ids).eq('active',true),
    admin.from('entity_discovery_evidence')
      .select('raw_item_id,candidate_id').in('raw_item_id',rawIds)
  ]);
  if(a.error) throw a.error;
  if(b.error) throw b.error;
  if(c.error) throw c.error;
  const identities = new Map((b.data??[]).map(x=>[x.id,x]));
  const sourceIds=[...new Set((b.data??[]).map(x=>x.source_id))];
  const src = sourceIds.length
    ? await admin.from('sources').select('id,display_name,authority_tier,source_role').in('id',sourceIds)
    : {data:[],error:null};
  if(src.error) throw src.error;
  const sources=new Map((src.data??[]).map(x=>[x.id,x]));
  const resolutions=new Map((a.data??[]).map(x=>[x.raw_item_id,x]));
  const evidenceByRaw=new Map<string,string>();
  for(const x of c.data??[]) evidenceByRaw.set(x.raw_item_id,x.candidate_id);
  const candidateIds=[...new Set(evidenceByRaw.values())];
  const suggestions = candidateIds.length
    ? await admin.from('entity_discovery_candidates')
        .select('id,proposed_name,proposed_entity_type,status,evidence_count,source_count,first_party_source_count,confidence,primary_language,country_code,metadata')
        .in('id',candidateIds)
    : {data:[],error:null};
  if(suggestions.error) throw suggestions.error;
  const leads = candidateIds.length
    ? await admin.from('operator_producer_evidence_leads')
        .select('id,candidate_id,source_url,claimed_owner_name,evidence_note,status,created_at,counts_toward_approval')
        .in('candidate_id',candidateIds).order('created_at',{ascending:false}).limit(200)
    : {data:[],error:null};
  if(leads.error) throw leads.error;
  const leadMap=new Map<string,Array<Record<string,unknown>>>();
  for(const lead of leads.data??[]){
    const items=leadMap.get(lead.candidate_id)??[];
    items.push(lead);
    leadMap.set(lead.candidate_id,items);
  }
  const candidateMap=new Map((suggestions.data??[]).map(x=>[x.id,{
    ...x, producerEvidenceLeads:leadMap.get(x.id)??[],
  }]));
  const items=raws.flatMap(raw=>{
    const identity=identities.get(raw.source_identity_id);
    const source=identity?sources.get(identity.source_id):null;
    const resolution=resolutions.get(raw.id);
    if(!identity||!source||identity.platform!=='WEB'||Number(source.authority_tier)>2||
        !['PRODUCTION_HOUSE','OTT_PLATFORM','FILM_OFFICIAL','PROJECT_OFFICIAL'].includes(source.source_role)||
        !resolution||!['UNRESOLVED','AMBIGUOUS'].includes(resolution.resolution_state)) return [];
    const candidate=candidateMap.get(evidenceByRaw.get(raw.id)??'')??null;
    return [{
      rawItem:raw, source:{name:source.display_name,authorityTier:source.authority_tier,role:source.source_role},
      resolution, typedSuggestion:candidate,
      reviewStatus:candidate?'TYPED_CANDIDATE_REVIEW':'MANUAL_TITLE_REVIEW',
      needsHumanReview:true,
    }];
  }).slice(0,bounded);
  return {generatedAt:new Date().toISOString(), items};
}

/**
 * All pending catalogue candidates, including YouTube and RSS discoveries.
 * The separate officialArticleReviewQueue is intentionally WEB_ARTICLE-only.
 * Operator-authenticated, read-only: NO changes to candidate status,
 * evidence counts, raw items, events, promotion or notifications.
 */
/**
 * Operator-only ACTIVE catalogue audit. Source records and event links stay
 * unchanged. We scan the complete small catalogue in pages rather than
 * silently inspecting only the 100 most recent entities.
 */
async function activeCatalogueQualityAudit(limit: number) {
  const bound = Math.max(1,Math.min(100,Number.isFinite(limit)?Math.trunc(limit):50));
  const pageSize = 500;
  const maxScanned = 5000;
  const active: Array<{id:string;entity_type:string;canonical_name:string;status:string;primary_language:string|null;country_code:string|null;created_at:string}> = [];
  let scanComplete = false;
  for (let offset=0;offset<maxScanned;offset+=pageSize) {
    const { data, error } = await admin.from('entities')
      .select('id,entity_type,canonical_name,status,primary_language,country_code,created_at')
      .eq('status','ACTIVE')
      .in('entity_type',['MOVIE','SERIES'])
      .order('id',{ascending:true}).range(offset,offset+pageSize-1);
    if(error) throw error;
    const page = data ?? [];
    active.push(...page);
    if(page.length<pageSize){scanComplete=true;break;}
  }
  const flagged=active.map(entity=>({
    ...entity,warnings:activeCatalogueTitleWarnings(entity.canonical_name,entity.entity_type)
  })).filter(entity=>entity.warnings.length>0);
  if(!flagged.length){
    return {generatedAt:new Date().toISOString(), scannedActiveEntities:active.length,
      scanComplete,totalFlagged:0,eventCountsComplete:true,evidenceLinksComplete:true,items:[]};
  }
  // Cap a single operator response; never pretend truncated results are complete.
  // A large future catalogue can be audited in independently paginated batches.
  const inspected = flagged.slice(0,250);
  const ids=inspected.map(x=>x.id);
  const [evResult,promotedResult]=await Promise.all([
    admin.from('events')
      .select('id,primary_entity_id,event_type,headline,status,detected_at,occurred_at')
      .eq('status','ACTIVE').in('primary_entity_id',ids)
      .order('detected_at',{ascending:false}).limit(2000),
    admin.from('entity_discovery_candidates')
      .select('id,promoted_entity_id,proposed_name,status,confidence,review_reason')
      .eq('status','PROMOTED').in('promoted_entity_id',ids).limit(500),
  ]);
  if(evResult.error)throw evResult.error;
  if(promotedResult.error)throw promotedResult.error;
  const events=evResult.data??[];
  const promoted=promotedResult.data??[];
  const eventsComplete=events.length<2000;
  const candidatesComplete=promoted.length<500;
  const eventIds=events.map(x=>x.id);
  const candidateIds=promoted.map(x=>x.id);
  const [eventLinksResult,candidateLinksResult]=await Promise.all([
    eventIds.length
      ? admin.from('event_evidence').select('event_id,raw_item_id').in('event_id',eventIds).limit(3000)
      : Promise.resolve({data:[],error:null}),
    candidateIds.length
      ? admin.from('entity_discovery_evidence').select('candidate_id,raw_item_id').in('candidate_id',candidateIds).limit(1500)
      : Promise.resolve({data:[],error:null}),
  ]);
  if(eventLinksResult.error)throw eventLinksResult.error;
  if(candidateLinksResult.error)throw candidateLinksResult.error;
  const eventLinks=eventLinksResult.data??[];
  const candidateLinks=candidateLinksResult.data??[];
  const linkScanComplete=eventLinks.length<3000&&candidateLinks.length<1500;
  const rawIds=[...new Set([...eventLinks,...candidateLinks].map(x=>x.raw_item_id).filter((x):x is string=>typeof x==='string'))];
  const rawResult=rawIds.length
    ? await admin.from('raw_items')
      .select('id,raw_title,canonical_url,published_at,source_identity_id')
      .in('id',rawIds).limit(3000)
    : {data:[],error:null};
  if(rawResult.error)throw rawResult.error;
  const raws=rawResult.data??[];
  const sourceIdentityIds=[...new Set(raws.map(x=>x.source_identity_id).filter((x):x is string=>typeof x==='string'))];
  const identitiesResult=sourceIdentityIds.length
    ? await admin.from('source_identities').select('id,source_id,platform').in('id',sourceIdentityIds)
    : {data:[],error:null};
  if(identitiesResult.error)throw identitiesResult.error;
  const identityMap=new Map((identitiesResult.data??[]).map(x=>[x.id,x]));
  const sourceIds=[...new Set((identitiesResult.data??[]).map(x=>x.source_id))];
  const sourceResult=sourceIds.length
    ? await admin.from('sources').select('id,display_name').in('id',sourceIds)
    : {data:[],error:null};
  if(sourceResult.error)throw sourceResult.error;
  const sourceMap=new Map((sourceResult.data??[]).map(x=>[x.id,x.display_name]));
  const rawMap=new Map(raws.map(x=>[x.id,x]));

  const eventEntityMap=new Map(events.map(ev=>[ev.id,ev.primary_entity_id]));
  const candidateEntityMap=new Map(promoted.map(c=>[c.id,c.promoted_entity_id]));
  const linked=new Map<string,Set<string>>();
  for(const link of eventLinks){
    const id=eventEntityMap.get(link.event_id);
    if(!id||!link.raw_item_id)continue;
    const set=linked.get(id)??new Set<string>();set.add(link.raw_item_id);linked.set(id,set);
  }
  for(const link of candidateLinks){
    const id=candidateEntityMap.get(link.candidate_id);
    if(!id||!link.raw_item_id)continue;
    const set=linked.get(id)??new Set<string>();set.add(link.raw_item_id);linked.set(id,set);
  }
  const eventGroups=new Map<string,typeof events>();
  for(const ev of events){
    const list=eventGroups.get(ev.primary_entity_id)??[];
    list.push(ev);eventGroups.set(ev.primary_entity_id,list);
  }
  const promotedGroups=new Map<string,typeof promoted>();
  for(const candidate of promoted){
    if(!candidate.promoted_entity_id)continue;
    const list=promotedGroups.get(candidate.promoted_entity_id)??[];
    list.push(candidate);promotedGroups.set(candidate.promoted_entity_id,list);
  }
  const items=sortActiveCatalogueImpact(inspected.map(entity=>{
    const matchingEvents=eventGroups.get(entity.id)??[];
    const rawEvidence=[...(linked.get(entity.id)??new Set<string>())]
      .map(rawId=>rawMap.get(rawId)).filter((x):x is NonNullable<typeof x>=>Boolean(x))
      .sort((a,b)=>(b.published_at??'').localeCompare(a.published_at??''))
      .slice(0,6).map(raw=>{
        const identity=identityMap.get(raw.source_identity_id);
        return {rawItemId:raw.id,rawTitle:raw.raw_title,
          sourceUrl:raw.canonical_url,publishedAt:raw.published_at,
          platform:identity?.platform??'UNKNOWN',
          sourceName:identity?sourceMap.get(identity.source_id)??'Unknown source':'Unknown source'};
      });
    return {
      ...entity,
      activeEventCount:matchingEvents.length,
      eventSamples:matchingEvents.slice(0,6).map(ev=>({
        id:ev.id,eventType:ev.event_type,headline:ev.headline,
        detectedAt:ev.detected_at,occurredAt:ev.occurred_at
      })),
      sourceEvidence:rawEvidence,
      linkedPromotedCandidates:(promotedGroups.get(entity.id)??[]).map(c=>({
        id:c.id,proposedName:c.proposed_name,status:c.status,
        confidence:c.confidence,reviewReason:c.review_reason
      })),
    };
  })).slice(0,bound);

  return {
    generatedAt:new Date().toISOString(),
    scannedActiveEntities:active.length,
    scanComplete,
    totalFlagged:flagged.length,
    eventCountsComplete:eventsComplete&&inspected.length===flagged.length,
    evidenceLinksComplete:linkScanComplete&&raws.length===rawIds.length&&candidatesComplete&&inspected.length===flagged.length,
    items,
  };
}

async function pendingCatalogueReviewQueue(limit: number) {
  const bounded = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 50));
  const { data: candidates, error: candidateError } = await admin.from('entity_discovery_candidates')
    .select('id,proposed_name,proposed_entity_type,status,confidence,evidence_count,source_count,first_party_source_count,primary_language,country_code,metadata,last_seen_at')
    .eq('status', 'PENDING')
    .in('proposed_entity_type', ['MOVIE','SERIES'])
    .order('last_seen_at', { ascending: false })
    .limit(bounded);
  if (candidateError) throw candidateError;
  if (!candidates?.length) return { generatedAt: new Date().toISOString(), items: [] };

  const candidateIds = candidates.map(candidate => candidate.id);
  const { data: evidences, error: evidenceError } = await admin.from('entity_discovery_evidence')
    .select('id,candidate_id,raw_item_id,source_identity_id,evidence_role,match_method,is_first_party,observed_at')
    .in('candidate_id', candidateIds)
    .order('observed_at', { ascending: false })
    .limit(1000);
  if (evidenceError) throw evidenceError;
  const rawIds = [...new Set((evidences ?? []).map(x => x.raw_item_id))];
  const identityIds = [...new Set((evidences ?? []).map(x => x.source_identity_id))];
  const [rawResult, identityResult] = await Promise.all([
    rawIds.length
      ? admin.from('raw_items').select('id,raw_title,canonical_url,published_at,item_type').in('id', rawIds)
      : Promise.resolve({ data: [], error: null }),
    identityIds.length
      ? admin.from('source_identities').select('id,source_id,platform').in('id', identityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rawResult.error) throw rawResult.error;
  if (identityResult.error) throw identityResult.error;
  const raws = new Map((rawResult.data ?? []).map(x => [x.id,x]));
  const identities = new Map((identityResult.data ?? []).map(x => [x.id,x]));
  const sourceIds = [...new Set((identityResult.data ?? []).map(x => x.source_id))];
  const [sourceResult,ownerResult] = await Promise.all([
    sourceIds.length
      ? admin.from('sources').select('id,display_name,source_role').in('id', sourceIds)
      : Promise.resolve({ data: [], error: null }),
    sourceIds.length
      ? admin.from('source_corporate_owner_memberships').select('source_id,owner_id').in('source_id', sourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceResult.error) throw sourceResult.error;
  if (ownerResult.error) throw ownerResult.error;
  const sources = new Map((sourceResult.data ?? []).map(x => [x.id,x]));
  const owners = new Map((ownerResult.data ?? []).map(x => [x.source_id,x.owner_id]));

  const grouped = new Map<string,Array<Record<string,unknown>>>();
  const ownerGroups = new Map<string,Set<string>>();
  for (const evidence of evidences ?? []) {
    const raw = raws.get(evidence.raw_item_id);
    const identity = identities.get(evidence.source_identity_id);
    const source = identity ? sources.get(identity.source_id) : null;
    // Mirror the DB's corporate-owner grouping: a known common parent is
    // one corroborating group, however many channel/feed identities it has.
    // Unknown parents fall back to source IDs, not identities.
    if (identity) {
      const key = candidateOwnerGroupKey(
        String(identity.source_id),
        owners.has(identity.source_id) ? String(owners.get(identity.source_id)) : null,
      );
      const groups = ownerGroups.get(evidence.candidate_id) ?? new Set<string>();
      groups.add(key);
      ownerGroups.set(evidence.candidate_id,groups);
    }
    const list = grouped.get(evidence.candidate_id) ?? [];
    list.push({
      id: evidence.id,
      rawTitle: raw?.raw_title ?? null,
      sourceUrl: raw?.canonical_url ?? null,
      publishedAt: raw?.published_at ?? null,
      itemType: raw?.item_type ?? null,
      sourceName: source?.display_name ?? 'Unknown source',
      sourceRole: source?.source_role ?? null,
      platform: identity?.platform ?? 'UNKNOWN',
      isFirstParty: evidence.is_first_party,
      matchMethod: evidence.match_method,
    });
    grouped.set(evidence.candidate_id,list);
  }

  return {
    generatedAt: new Date().toISOString(),
    items: candidates.map(candidate => ({
      ...candidate,
      independent_owner_count: ownerGroups.get(candidate.id)?.size ?? 0,
      owner_count_complete: (evidences ?? []).length < 1000 &&
        (grouped.get(candidate.id)?.length ?? 0) >= candidate.evidence_count,
      evidence: grouped.get(candidate.id) ?? [],
    })),
  };
}

/** Operator-only, read-only dry run for a specific suspected catalogue correction.
 * Does NOT invent a target, create aliases, transfer records or send alerts. */
async function catalogueCorrectionImpactPreview(
  sourceEntityId:string,targetEntityId:string|null,expectedType:'MOVIE'|'SERIES',
){
  if(targetEntityId===sourceEntityId)throw new Error('source_and_target_must_differ');
  const ids=targetEntityId?[sourceEntityId,targetEntityId]:[sourceEntityId];
  const {data:entities,error:entityError}=await admin.from('entities')
    .select('id,canonical_name,entity_type,status,slug,primary_language,country_code')
    .in('id',ids);
  if(entityError)throw entityError;
  const source=entities?.find(x=>x.id===sourceEntityId);
  const target=targetEntityId?entities?.find(x=>x.id===targetEntityId):null;
  if(!source||source.status!=='ACTIVE'||!['MOVIE','SERIES'].includes(source.entity_type))
    throw new Error('active_source_movie_or_series_required');
  if(targetEntityId&&(!target||target.status!=='ACTIVE'||!['MOVIE','SERIES'].includes(target.entity_type)))
    throw new Error('active_target_movie_or_series_required');
  const [
    eventsResult,releasesResult,candidatesResult,aliasesResult,
    claimsResult,followersResult,relationshipsResult,resolutionsResult
  ]=await Promise.all([
    admin.from('events').select('id,primary_entity_id,event_type,status,headline')
      .in('primary_entity_id',ids).limit(250),
    admin.from('ott_releases')
      .select('id,entity_id,provider_id,territory,release_type,release_date,date_precision,state,evidence_status')
      .in('entity_id',ids).limit(150),
    admin.from('entity_discovery_candidates')
      .select('id,promoted_entity_id,proposed_name,status')
      .in('promoted_entity_id',ids).limit(150),
    admin.from('entity_aliases').select('entity_id,alias,alias_type')
      .in('entity_id',ids).limit(150),
    admin.from('claims').select('subject_entity_id',{count:'exact',head:false})
      .in('subject_entity_id',ids).limit(250),
    admin.from('user_entity_follows').select('entity_id,active')
      .in('entity_id',ids).limit(250),
    admin.from('source_entity_relationship_proposals').select('entity_id',{count:'exact',head:false})
      .in('entity_id',ids).limit(250),
    admin.from('entity_resolution_results').select('entity_id',{count:'exact',head:false})
      .in('entity_id',ids).limit(250),
  ]);
  for(const result of [eventsResult,releasesResult,candidatesResult,aliasesResult,
    claimsResult,followersResult,relationshipsResult,resolutionsResult]){
    if(result.error)throw result.error;
  }
  const events=eventsResult.data??[];
  const releases=releasesResult.data??[];
  const candidates=candidatesResult.data??[];
  const aliases=aliasesResult.data??[];
  const follows=followersResult.data??[];
  const eventIds=events.map(e=>e.id);
  const deliveryResult=eventIds.length
    ? await admin.from('alert_deliveries').select('event_id,status,sent_at')
      .in('event_id',eventIds).limit(300)
    : {data:[],error:null};
  if(deliveryResult.error)throw deliveryResult.error;
  const deliveries=deliveryResult.data??[];
  const referenceScanComplete=
    events.length<250 && releases.length<150 && candidates.length<150 &&
    aliases.length<150 && (claimsResult.data??[]).length<250 &&
    follows.length<250 && (relationshipsResult.data??[]).length<250 &&
    (resolutionsResult.data??[]).length<250 && deliveries.length<300;

  const infoFor=(entityId:string)=>({
    activeEvents:events.filter(e=>e.primary_entity_id===entityId&&e.status==='ACTIVE').length,
    historicalEvents:events.filter(e=>e.primary_entity_id===entityId).length,
    ottReleaseRows:releases.filter(o=>o.entity_id===entityId).length,
    promotedCandidates:candidates.filter(c=>c.promoted_entity_id===entityId).length,
    aliases:aliases.filter(a=>a.entity_id===entityId).map(a=>a.alias),
    claims:(claimsResult.data??[]).filter(x=>x.subject_entity_id===entityId).length,
    activeFollowers:follows.filter(x=>x.entity_id===entityId&&x.active).length,
    relationshipProposals:(relationshipsResult.data??[]).filter(x=>x.entity_id===entityId).length,
    resolutionLinks:(resolutionsResult.data??[]).filter(x=>x.entity_id===entityId).length,
    alertDeliveries:deliveries.filter(d=>events.some(e=>e.id===d.event_id&&e.primary_entity_id===entityId)).length,
    sentAlerts:deliveries.filter(d=>d.sent_at&&events.some(e=>e.id===d.event_id&&e.primary_entity_id===entityId)).length,
    releaseRows:releases.filter(o=>o.entity_id===entityId).map(o=>({
      id:o.id,providerId:o.provider_id,territory:o.territory,
      releaseType:o.release_type,date:o.release_date,precision:o.date_precision,
      state:o.state,evidenceStatus:o.evidence_status,
    })),
    eventSamples:events.filter(e=>e.primary_entity_id===entityId).slice(0,10).map(e=>({
      id:e.id,type:e.event_type,status:e.status,headline:e.headline,
    })),
  });
  const risk=assessCorrectionRisk(
    source as CorrectionEntity,target as CorrectionEntity|null,expectedType,
    releases as CorrectionRelease[],
  );
  if(!referenceScanComplete)risk.warnings.push('One or more reference queries hit their cap: impact counts may be incomplete');
  return {generatedAt:new Date().toISOString(),referenceScanComplete,
    expectedType,source,target,
    sourceImpact:infoFor(sourceEntityId),
    targetImpact:targetEntityId?infoFor(targetEntityId):null,
    risk};
}

async function entitySearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return { items: [] };
  const pattern = `%${q.slice(0, 80)}%`;
  const [{ data: direct, error: directError }, { data: aliases, error: aliasError }] = await Promise.all([
    admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').eq('status', 'ACTIVE').in('entity_type', ['MOVIE', 'SERIES', 'SEASON']).ilike('canonical_name', pattern).limit(20),
    admin.from('entity_aliases').select('entity_id,alias').ilike('alias', pattern).limit(40),
  ]);
  if (directError) throw directError;
  if (aliasError) throw aliasError;
  const aliasEntityIds = [...new Set((aliases ?? []).map((row) => row.entity_id).filter(Boolean))];
  const { data: aliasEntities, error: aliasEntityError } = aliasEntityIds.length
    ? await admin.from('entities').select('id,entity_type,canonical_name,primary_language,country_code,status').eq('status', 'ACTIVE').in('entity_type', ['MOVIE', 'SERIES', 'SEASON']).in('id', aliasEntityIds)
    : { data: [], error: null };
  if (aliasEntityError) throw aliasEntityError;
  const map = new Map<string, Record<string, unknown>>();
  for (const row of [...(direct ?? []), ...(aliasEntities ?? [])]) map.set(String(row.id), row as Record<string, unknown>);
  return { items: [...map.values()].slice(0, 30) };
}

async function reviewBootstrap(limit: number) {
  const [queue, typesResult, auditResult] = await Promise.all([
    reviewQueue(limit),
    admin.from('event_types').select('code,family,default_importance,taxonomy_version').eq('active', true).order('family').order('code'),
    admin.from('audit_actions').select('id,actor_type,actor_id,action_type,target_type,target_id,before_json,after_json,reason,created_at').eq('actor_type', 'ADMIN').order('created_at', { ascending: false }).limit(50),
  ]);
  if (typesResult.error) throw typesResult.error;
  if (auditResult.error) throw auditResult.error;
  return { ...queue, eventTypes: typesResult.data ?? [], audit: auditResult.data ?? [] };
}

async function rpcAction(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function reasonOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : null;
}

Deno.serve(async (request): Promise<Response> => {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...corsHeaders, allow: 'POST, OPTIONS' } });
    const auth = await requireOperator(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'bootstrap') return json(200, await reviewBootstrap(Number(body.limit ?? 100)));
    if (action === 'entitySearch') return json(200, await entitySearch(typeof body.query === 'string' ? body.query : ''));
    if (action === 'officialArticleReviewQueue') return json(200, await officialArticleReviewQueue(Number(body.limit ?? 50)));
    if (action === 'pendingCatalogueReviewQueue') return json(200, await pendingCatalogueReviewQueue(Number(body.limit ?? 50)));
    if (action === 'activeCatalogueQualityAudit') return json(200, await activeCatalogueQualityAudit(Number(body.limit ?? 50)));
    if (action === 'catalogueCorrectionImpactPreview'){
      if(!validUuid(body.sourceEntityId) || (body.targetEntityId!=null&&!validUuid(body.targetEntityId))) return json(400,{error:'invalid_entity_id'});
      if(body.expectedType!=='MOVIE'&&body.expectedType!=='SERIES')return json(400,{error:'invalid_expected_type'});
      return json(200,await catalogueCorrectionImpactPreview(body.sourceEntityId,body.targetEntityId??null,body.expectedType));
    }
    if(action === 'submitProducerEvidenceLead'){
      if(!validUuid(body.candidateId)) return json(400,{error:'invalid_candidate_id'});
      const sourceUrl=typeof body.sourceUrl==='string'?body.sourceUrl.trim():'';
      const ownerName=typeof body.claimedOwnerName==='string'?body.claimedOwnerName.trim():'';
      const evidenceNote=typeof body.evidenceNote==='string'?body.evidenceNote.trim():'';
      if(sourceUrl.length>650||ownerName.length>120||evidenceNote.length>1200)
        return json(400,{error:'producer_evidence_input_too_long'});
      const result=await rpcAction('operator_submit_producer_evidence_lead',{
        p_actor_id:auth.user.id,p_candidate_id:body.candidateId,
        p_source_url:sourceUrl,p_claimed_owner_name:ownerName,p_evidence_note:evidenceNote,
      });
      return json(200,{ok:true,result});
    }

    const reason = reasonOf(body.reason);
    if (!reason && ['resolveRawItem', 'clearResolutionOverride', 'suppressEvent', 'reclassifyEvent', 'mergeEvents'].includes(action)) {
      return json(400, { error: 'valid_reason_required' });
    }

    if (action === 'resolveRawItem') {
      if (!validUuid(body.rawItemId)) return json(400, { error: 'invalid_raw_item_id' });
      const entityId = validUuid(body.entityId) ? body.entityId : null;
      const newEntityName = typeof body.newEntityName === 'string' ? body.newEntityName.trim() : null;
      if (!entityId && !newEntityName) return json(400, { error: 'entity_selection_required' });
      const result = await rpcAction('operator_resolve_raw_item', {
        p_actor_id: auth.user.id,
        p_raw_item_id: body.rawItemId,
        p_reason: reason,
        p_entity_id: entityId,
        p_new_entity_name: newEntityName,
        p_new_entity_type: typeof body.newEntityType === 'string' ? body.newEntityType : 'MOVIE',
        p_primary_language: typeof body.primaryLanguage === 'string' ? body.primaryLanguage : null,
        p_country_code: typeof body.countryCode === 'string' ? body.countryCode : null,
      });
      return json(200, { ok: true, result });
    }

    if (action === 'clearResolutionOverride') {
      if (!validUuid(body.rawItemId)) return json(400, { error: 'invalid_raw_item_id' });
      return json(200, { ok: true, result: await rpcAction('operator_clear_resolution_override', { p_actor_id: auth.user.id, p_raw_item_id: body.rawItemId, p_reason: reason }) });
    }

    if (action === 'suppressEvent') {
      if (!validUuid(body.eventId)) return json(400, { error: 'invalid_event_id' });
      return json(200, { ok: true, result: await rpcAction('operator_suppress_event', { p_actor_id: auth.user.id, p_event_id: body.eventId, p_reason: reason }) });
    }

    if (action === 'reclassifyEvent') {
      if (!validUuid(body.eventId) || typeof body.eventType !== 'string') return json(400, { error: 'invalid_reclassification' });
      return json(200, { ok: true, result: await rpcAction('operator_reclassify_event', { p_actor_id: auth.user.id, p_event_id: body.eventId, p_event_type: body.eventType, p_reason: reason }) });
    }

    if (action === 'mergeEvents') {
      if (!validUuid(body.fromEventId) || !validUuid(body.intoEventId)) return json(400, { error: 'invalid_merge_event_ids' });
      return json(200, { ok: true, result: await rpcAction('operator_merge_events', { p_actor_id: auth.user.id, p_from_event_id: body.fromEventId, p_into_event_id: body.intoEventId, p_reason: reason }) });
    }

    return json(400, { error: 'unsupported_action' });
  } catch (error) {
    console.error('cinerelay-review-api failure', error);
    const message = error instanceof Error ? error.message : 'review_action_failed';
    return json(400, { error: 'review_action_failed', message });
  }
});
