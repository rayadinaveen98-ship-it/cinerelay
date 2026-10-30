// C13 pure parser. No network, keys, DB, logs or side effects.
const UC=/^UC[A-Za-z0-9_-]{22}$/;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const DECIMAL=/^(?:0|[1-9][0-9]{0,19})$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/;

export function validChannelId(value){
 return typeof value==='string' && UC.test(value);
}
export function authorizedTarget(channelId,allowlist,nowISO,expiresISO){
 if(!validChannelId(channelId)||typeof allowlist!=='string'||
    typeof nowISO!=='string'||typeof expiresISO!=='string')return false;
 const expiry=Date.parse(expiresISO),now=Date.parse(nowISO);
 if(!Number.isFinite(expiry)||!Number.isFinite(now)||expiry<=now||
    expiry-now>7*86400000)return false;
 const ids=allowlist.split(',').map(x=>x.trim());
 if(ids.length<1||ids.length>20||ids.some(x=>!validChannelId(x))||
    new Set(ids).size!==ids.length)return false;
 return ids.includes(channelId);
}
export function parseC13Channel(body,requestedChannelId){
 if(!validChannelId(requestedChannelId)||!body||!Array.isArray(body.items)||
    body.items.length!==1)throw Error('C13_CHANNEL_RESPONSE_UNEXPECTED');
 const channel=body.items[0];
 const uploads='UU'+requestedChannelId.slice(2);
 if(!channel||channel.id!==requestedChannelId||
    channel.contentDetails?.relatedPlaylists?.uploads!==uploads)
  throw Error('C13_CHANNEL_IDENTITY_MISMATCH');
 const stats=channel.statistics;
 if(!stats||typeof stats.hiddenSubscriberCount!=='boolean')
  throw Error('C13_PUBLIC_SUBSCRIBER_VISIBILITY_UNKNOWN');
 const subscribers=stats.hiddenSubscriberCount?null:
  typeof stats.subscriberCount==='string'&&DECIMAL.test(stats.subscriberCount)?stats.subscriberCount:null;
 const videos=typeof stats.videoCount==='string'&&DECIMAL.test(stats.videoCount)?stats.videoCount:null;
 if(videos===null)throw Error('C13_INVALID_PUBLIC_VIDEO_COUNT');
 return {uploads,subscriberCount:subscribers,subscribersHidden:stats.hiddenSubscriberCount,publicVideoCount:videos};
}
export function parseC13Uploads(body,nowISO){
 if(!body||!Array.isArray(body.items)||body.items.length>3||
    !Number.isFinite(Date.parse(nowISO)))throw Error('C13_INVALID_PLAYLIST_RESPONSE');
 const seen=new Set(),items=[];
 for(const x of body.items){
  const id=x?.contentDetails?.videoId;
  const stamp=x?.contentDetails?.videoPublishedAt;
  if(typeof id!=='string'||!VIDEO.test(id)||seen.has(id)||
     (stamp!==undefined&&stamp!==null&&
      (typeof stamp!=='string'||!UTC.test(stamp)||!Number.isFinite(Date.parse(stamp))||
        Date.parse(stamp)>Date.parse(nowISO)+120000)))
    throw Error('C13_INVALID_PUBLIC_VIDEO_ITEM');
  seen.add(id);
  items.push({videoId:id,publishedAt:stamp==null?null:new Date(stamp).toISOString()});
 }
 return items;
}
export function createC13Record(channelId,channel,uploads,observedAt){
 if(!validChannelId(channelId)||!channel||!Array.isArray(uploads)||uploads.length>3||
    !Number.isFinite(Date.parse(observedAt)))throw Error('C13_INVALID_RECORD');
 const when=new Date(observedAt);
 return {
  channel_id:channelId,
  observed_at:when.toISOString(),
  expires_at:new Date(when.getTime()+28*86400000).toISOString(),
  subscriber_count:channel.subscriberCount,
  subscribers_hidden:channel.subscribersHidden,
  public_video_count:channel.publicVideoCount,
  recent_public_uploads:uploads,
 };
}
