import { z } from 'zod';
import { supabase } from './supabase';

const EntitySchema = z.object({
  id: z.string().uuid(),
  entity_type: z.string(),
  canonical_name: z.string(),
  primary_language: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  status: z.string(),
});

const ReviewItemSchema = z.object({
  resolution: z.object({
    id: z.string().uuid(),
    raw_item_id: z.string().uuid(),
    entity_id: z.string().uuid().nullable(),
    score: z.coerce.number(),
    resolution_state: z.enum(['UNRESOLVED', 'AMBIGUOUS']),
    methods: z.array(z.unknown()),
    engine_version: z.string(),
    created_at: z.string(),
  }),
  rawItem: z.object({
    id: z.string().uuid(),
    source_identity_id: z.string().uuid(),
    platform_item_id: z.string().nullable(),
    canonical_url: z.string(),
    published_at: z.string().nullable(),
    first_seen_at: z.string(),
    raw_title: z.string().nullable(),
    raw_text: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
  }).nullable(),
  source: z.object({
    name: z.string(),
    authorityTier: z.number(),
    sourceRole: z.string().nullable(),
    platform: z.string(),
    handle: z.string().nullable(),
    canonicalUrl: z.string(),
    connectorType: z.string(),
    accessMode: z.string(),
  }).nullable(),
  resolvedEntity: EntitySchema.nullable(),
  override: z.object({
    id: z.string().uuid(),
    raw_item_id: z.string().uuid(),
    entity_id: z.string().uuid(),
    active: z.boolean(),
    reason: z.string(),
    created_by: z.string().uuid().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    entity: EntitySchema.nullable(),
  }).nullable(),
});

const BootstrapSchema = z.object({
  generatedAt: z.string(),
  items: z.array(ReviewItemSchema),
  eventTypes: z.array(z.object({
    code: z.string(),
    family: z.string(),
    default_importance: z.string(),
    taxonomy_version: z.number(),
  })),
  audit: z.array(z.object({
    id: z.string().uuid(),
    actor_type: z.string(),
    actor_id: z.string().uuid().nullable(),
    action_type: z.string(),
    target_type: z.string(),
    target_id: z.string().uuid().nullable(),
    before_json: z.unknown().nullable(),
    after_json: z.unknown().nullable(),
    reason: z.string().nullable(),
    created_at: z.string(),
  })),
});

const SearchSchema = z.object({ items: z.array(EntitySchema) });
const ActionSchema = z.object({ ok: z.literal(true), result: z.record(z.string(), z.unknown()) });

export type ReviewBootstrap = z.infer<typeof BootstrapSchema>;
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
export type ReviewEntity = z.infer<typeof EntitySchema>;

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cinerelay-review-api', { body });
  if (error) throw error;
  return schema.parse(data);
}

export function fetchReviewBootstrap(limit = 100) {
  return invoke({ action: 'bootstrap', limit }, BootstrapSchema);
}

export function searchReviewEntities(query: string) {
  return invoke({ action: 'entitySearch', query }, SearchSchema);
}

export function resolveReviewItem(input: {
  rawItemId: string;
  reason: string;
  entityId?: string;
  newEntityName?: string;
  newEntityType?: 'MOVIE' | 'SERIES' | 'SEASON';
  primaryLanguage?: string;
  countryCode?: string;
}) {
  return invoke({ action: 'resolveRawItem', ...input }, ActionSchema);
}

export function clearReviewOverride(rawItemId: string, reason: string) {
  return invoke({ action: 'clearResolutionOverride', rawItemId, reason }, ActionSchema);
}

export function suppressEvent(eventId: string, reason: string) {
  return invoke({ action: 'suppressEvent', eventId, reason }, ActionSchema);
}

export function reclassifyEvent(eventId: string, eventType: string, reason: string) {
  return invoke({ action: 'reclassifyEvent', eventId, eventType, reason }, ActionSchema);
}

export function mergeEvents(fromEventId: string, intoEventId: string, reason: string) {
  return invoke({ action: 'mergeEvents', fromEventId, intoEventId, reason }, ActionSchema);
}
