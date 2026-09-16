import { z } from 'zod';
import { supabase } from './supabase';

const CandidateSchema = z.object({
  id: z.string().uuid(),
  candidate_url: z.string().url(),
  normalized_url: z.string().url(),
  display_name: z.string().nullable(),
  candidate_kind: z.enum(['YOUTUBE_CHANNEL', 'RSS_ATOM', 'PUBLIC_WEB', 'INSTAGRAM_PROFILE', 'THREADS_PROFILE', 'X_PROFILE', 'OTHER']),
  discovery_method: z.enum(['OPERATOR', 'OFFICIAL_LINK', 'CONNECTOR_HINT', 'IMPORT']),
  discovered_from_source_identity_id: z.string().uuid().nullable(),
  proposed_source_role: z.string().nullable(),
  territory: z.string().nullable(),
  languages: z.array(z.string()),
  confidence: z.coerce.number(),
  status: z.enum(['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'PROMOTED']),
  duplicate_of_source_identity_id: z.string().uuid().nullable(),
  promoted_source_identity_id: z.string().uuid().nullable(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  review_reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

const EvidenceSchema = z.object({
  id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  evidence_type: z.string(),
  evidence_url: z.string().url().nullable(),
  note: z.string().nullable(),
  observed_at: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

const RegistryMatchSchema = z.object({
  identity: z.object({
    id: z.string().uuid(),
    source_id: z.string().uuid(),
    platform: z.string(),
    canonical_url: z.string(),
    connector_type: z.string(),
    access_mode: z.string(),
    active: z.boolean(),
  }),
  source: z.object({
    id: z.string().uuid(),
    display_name: z.string(),
    authority_tier: z.number(),
    source_role: z.string().nullable(),
    territory: z.string().nullable(),
    active: z.boolean(),
  }).nullable(),
});

const BootstrapSchema = z.object({
  generatedAt: z.string(),
  items: z.array(z.object({
    candidate: CandidateSchema,
    evidence: z.array(EvidenceSchema),
    exactRegistryMatches: z.array(RegistryMatchSchema),
  })),
});

const ActionSchema = z.object({
  ok: z.literal(true),
  result: z.record(z.string(), z.unknown()),
});

export type SourceDiscoveryBootstrap = z.infer<typeof BootstrapSchema>;
export type SourceDiscoveryItem = SourceDiscoveryBootstrap['items'][number];
export type CandidateKind = z.infer<typeof CandidateSchema>['candidate_kind'];
export type CandidateReviewStatus = 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE';
export type MediaAuthorityTier = 3 | 4;
export type MediaPollClass = 'ACTIVE_15M' | 'NORMAL_60M' | 'COLD_6H' | 'DAILY';

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cinerelay-source-discovery-api', { body });
  if (error) throw error;
  return schema.parse(data);
}

export function fetchSourceDiscoveryBootstrap(status?: string) {
  return invoke({ action: 'bootstrap', limit: 150, ...(status ? { status } : {}) }, BootstrapSchema);
}

export function submitSourceCandidate(input: {
  candidateUrl: string;
  candidateKind: CandidateKind;
  displayName?: string;
  proposedSourceRole?: string;
  territory?: string;
  languages?: string[];
  confidence?: number;
  evidenceType?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
}) {
  return invoke({
    action: 'submit',
    discoveryMethod: 'OPERATOR',
    ...input,
  }, ActionSchema);
}

export function reviewSourceCandidate(input: {
  candidateId: string;
  status: CandidateReviewStatus;
  reason: string;
  duplicateSourceIdentityId?: string;
}) {
  return invoke({ action: 'review', ...input }, ActionSchema);
}

export function promoteMediaFeedCandidate(input: {
  candidateId: string;
  authorityTier: MediaAuthorityTier;
  pollClass: MediaPollClass;
  reason: string;
}) {
  return invoke({ action: 'promoteMediaFeed', ...input }, ActionSchema);
}
