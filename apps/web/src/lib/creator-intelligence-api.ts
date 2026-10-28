import { z } from 'zod';
import { supabase } from './supabase';

const State=z.enum(['AWAITING_VERIFIED_CHANNELS','AWAITING_VIDEOS','AWAITING_SNAPSHOTS','OBSERVING']);
const Channel=z.object({
 channelId:z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
 title:z.string(),handle:z.string().nullable(),language:z.string(),niche:z.string(),
 verifiedAt:z.string(),reviewState:z.enum(['REVIEW_PENDING','APPROVED','REJECTED']),
 monitoringEnabled:z.boolean(),metadataRefreshedAt:z.string(),
});
const Overview=z.object({
 generatedAt:z.string(),state:State,
 totals:z.object({channels:z.number().int().nonnegative(),monitored:z.number().int().nonnegative(),
   videos:z.number().int().nonnegative(),samplesLast30Days:z.number().int().nonnegative()}),
 hasMoreChannels:z.boolean(),channels:z.array(Channel),
});
const Detail=z.object({
 generatedAt:z.string(),state:State,channel:Channel,
 videos:z.array(z.object({videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),
   publishedAt:z.string(),format:z.enum(['LONG','SHORT','LIVE','UNKNOWN'])})),
 samples:z.array(z.object({
   videoId:z.string(),observedAt:z.string(),
   viewCount:z.string().regex(/^\d+$/).nullable(),
   likeCount:z.string().regex(/^\d+$/).nullable(),
   commentCount:z.string().regex(/^\d+$/).nullable(),
 })),
 samplesTruncated:z.boolean(),
});
export type CreatorOverview=z.infer<typeof Overview>;
export type CreatorDetail=z.infer<typeof Detail>;
export type CreatorObservation=CreatorDetail['samples'][number];
async function invokeCreator<T>(body:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
 const {data,error}=await supabase.functions.invoke('cinerelay-creator-intelligence-api',{body});
 if(error)throw new Error('Creator Intelligence service unavailable. This feature may not be deployed yet.');
 if(data && typeof data==='object' && 'error' in data){
   const value=String((data as {error:unknown}).error);
   if(value==='CREATOR_STORAGE_NOT_DEPLOYED')
     throw new Error('Creator Intelligence storage has not been deployed.');
   if(value==='ACTIVE_OPERATOR_REQUIRED')throw new Error('Active CineRelay operator access required.');
   throw new Error('Creator Intelligence service could not load data.');
 }
 return schema.parse(data);
}
export function fetchCreatorOverview():Promise<CreatorOverview>{
 return invokeCreator({action:'overview'},Overview);
}
export function fetchCreatorDetail(channelId:string):Promise<CreatorDetail>{
 if(!/^UC[A-Za-z0-9_-]{22}$/.test(channelId))return Promise.reject(new Error('Invalid creator channel ID'));
 return invokeCreator({action:'channel',channelId},Detail);
}

const ComparisonStatus=z.object({enabled:z.boolean(),policy:z.string()});
const ComparableVideo=z.object({
 channelId:z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),channelTitle:z.string(),
 videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),publishedAt:z.string(),
 format:z.enum(['LONG','SHORT','LIVE','UNKNOWN']),
 samples:z.array(z.object({
  observedAt:z.string(),viewCount:z.string().regex(/^\\d+$/).nullable(),
  likeCount:z.string().regex(/^\\d+$/).nullable(),commentCount:z.string().regex(/^\\d+$/).nullable(),
 })),
});
const ComparisonResponse=z.object({
 generatedAt:z.string(),policy:z.literal('YOUTUBE_ANALYTICS_APPROVED_OPERATOR_ONLY'),
 a:ComparableVideo,b:ComparableVideo,
});
export type CreatorComparisonResponse=z.infer<typeof ComparisonResponse>;
export function fetchCreatorComparisonStatus():Promise<z.infer<typeof ComparisonStatus>>{
 return invokeCreator({action:'comparisonStatus'},ComparisonStatus);
}
export function fetchCreatorComparison(input:{
 aChannelId:string;bChannelId:string;aVideoId:string;bVideoId:string;
}):Promise<CreatorComparisonResponse>{
 if(!/^UC[A-Za-z0-9_-]{22}$/.test(input.aChannelId)||
 !/^UC[A-Za-z0-9_-]{22}$/.test(input.bChannelId)||
 !/^[A-Za-z0-9_-]{11}$/.test(input.aVideoId)||
 !/^[A-Za-z0-9_-]{11}$/.test(input.bVideoId)||
 input.aChannelId===input.bChannelId || input.aVideoId===input.bVideoId)
  return Promise.reject(new Error('Invalid two-creator video pair'));
 return invokeCreator({action:'comparison',...input},ComparisonResponse);
}
