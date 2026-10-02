import { z } from 'zod';
import { supabase } from './supabase';

const ProposalSchema = z.object({
  id: z.string().uuid(),
  source_identity_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  relationship: z.literal('PROJECT_COVERAGE'),
  confidence: z.coerce.number(),
  evidence_count: z.coerce.number(),
  recommended_valid_days: z.coerce.number(),
  status: z.enum(['OPEN', 'STALE', 'APPROVED', 'REJECTED']),
  rationale: z.record(z.string(), z.unknown()),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  review_reason: z.string().nullable(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const SourceIdentitySchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  platform: z.string(),
  platform_identity_id: z.string().nullable(),
  handle: z.string().nullable(),
  canonical_url: z.string().url(),
  connector_type: z.string(),
  poll_class: z.string(),
  access_mode: z.string(),
  active: z.boolean(),
}).nullable();

const SourceSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  authority_tier: z.number(),
  source_role: z.string().nullable(),
  territory: z.string().nullable(),
  languages: z.array(z.string()),
  active: z.boolean(),
}).nullable();

const EntitySchema = z.object({
  id: z.string().uuid(),
  entity_type: z.string(),
  canonical_name: z.string(),
  slug: z.string().nullable(),
  primary_language: z.string().nullable(),
  country_code: z.string().nullable(),
  status: z.string(),
}).nullable();

const EvidenceSchema = z.object({
  proposal_id: z.string().uuid(),
  raw_item_id: z.string().uuid(),
  resolution_result_id: z.string().uuid(),
  resolution_score: z.coerce.number(),
  observed_at: z.string(),
  rawItem: z.object({
    id: z.string().uuid(),
    canonical_url: z.string().url(),
    published_at: z.string().nullable(),
    first_seen_at: z.string(),
    raw_title: z.string().nullable(),
    item_type: z.string(),
  }).nullable(),
});

const BootstrapSchema = z.object({
  generatedAt: z.string(),
  summary: z.object({
    open: z.number(),
    stale: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
  items: z.array(z.object({
    proposal: ProposalSchema,
    sourceIdentity: SourceIdentitySchema,
    source: SourceSchema,
    entity: EntitySchema,
    evidence: z.array(EvidenceSchema),
  })),
});

const ActionSchema = z.object({
  ok: z.literal(true),
  result: z.record(z.string(), z.unknown()),
});

export type SourceRelationshipBootstrap = z.infer<typeof BootstrapSchema>;
export type SourceRelationshipItem = SourceRelationshipBootstrap['items'][number];
export type SourceRelationshipStatus = SourceRelationshipItem['proposal']['status'];
export type SourceRelationshipDecision = 'APPROVE' | 'REJECT';

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cinerelay-source-relationship-api', { body });
  if (error) throw error;
  return schema.parse(data);
}

export function fetchSourceRelationshipBootstrap(status?: SourceRelationshipStatus) {
  return invoke({ action: 'bootstrap', limit: 150, ...(status ? { status } : {}) }, BootstrapSchema);
}

export function reviewSourceRelationship(input: {
  proposalId: string;
  decision: SourceRelationshipDecision;
  reason: string;
  validDays?: number;
}) {
  return invoke({ action: 'review', ...input }, ActionSchema);
}
