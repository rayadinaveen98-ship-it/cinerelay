/**
 * REVIEW safety gate: a historical or undated first-party WEB_ARTICLE may be
 * identified and added to catalogue by a real operator, but must not be
 * reprocessed into a fresh-looking event or notification.
 *
 * Normal unreviewed new article ingestion is intentionally unchanged.
 */
export const RAW_ITEM_SELECT_COLUMNS =
  'id,source_identity_id,platform_item_id,canonical_url,item_type,published_at,first_seen_at,raw_title,raw_text,normalized_text,content_fingerprint,metadata';

export type ReviewedArticleHoldReason =
  | 'UNKNOWN_DISCOVERY_TIME'
  | 'STALE_DISCOVERY'
  | 'UNCONFIRMED_PUBLICATION_TIME'
  | 'STALE_PUBLICATION'
  | 'FUTURE_SOURCE_TIMESTAMP';

export function reviewedArticleHoldReason(input: {
  operatorOverride: boolean;
  itemType: string;
  sourcePlatform?: string;
  firstSeenAt?: string | null;
  publishedAt?: string | null;
}, now = new Date()): ReviewedArticleHoldReason | null {
  if (!input.operatorOverride || input.itemType !== 'WEB_ARTICLE' || input.sourcePlatform !== 'WEB') return null;
  const firstMs=input.firstSeenAt ? Date.parse(input.firstSeenAt) : NaN;
  if(!Number.isFinite(firstMs)) return 'UNKNOWN_DISCOVERY_TIME';
  const nowMs=now.getTime();
  if(!Number.isFinite(nowMs)||firstMs>nowMs+5*60_000) return 'FUTURE_SOURCE_TIMESTAMP';
  const maxAge=48*60*60_000;
  if(nowMs-firstMs>maxAge) return 'STALE_DISCOVERY';
  const publishedMs=input.publishedAt ? Date.parse(input.publishedAt) : NaN;
  if(!Number.isFinite(publishedMs)) return 'UNCONFIRMED_PUBLICATION_TIME';
  if(publishedMs>nowMs+5*60_000) return 'FUTURE_SOURCE_TIMESTAMP';
  if(nowMs-publishedMs>maxAge) return 'STALE_PUBLICATION';
  return null;
}
