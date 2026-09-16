import { z } from 'zod';
import { supabase } from './supabase';

const NumericSchema = z.union([z.number(), z.string()]);
const JsonObjectSchema = z.record(z.string(), z.unknown());

const OverviewSchema = z.object({
  generatedAt: z.string(),
  operator: z.object({ userId: z.string().uuid(), email: z.string().email().nullable(), displayName: z.string().nullable() }),
  counts: z.object({ rawItems: z.number().int().nonnegative(), events: z.number().int().nonnegative(), sources: z.number().int().nonnegative(), unresolved: z.number().int().nonnegative() }),
  health: z.object({ healthy: z.number().int().nonnegative(), degraded: z.number().int().nonnegative(), rateLimited: z.number().int().nonnegative(), budgetExhausted: z.number().int().nonnegative(), gapSources: z.number().int().nonnegative() }),
});

const FeedItemSchema = z.object({
  id: z.string().uuid(), entityName: z.string().nullable(), eventType: z.string(), verificationState: z.string(), priorityBand: z.string(), headline: z.string(), summary: z.string().nullable(), status: z.string(), detectedAt: z.string(), announcedAt: z.string().nullable(), occurredAt: z.string().nullable(), structuredData: JsonObjectSchema,
  evidence: z.object({ role: z.string().nullable(), weight: NumericSchema.nullable(), sourceName: z.string().nullable(), platform: z.string().nullable(), rawTitle: z.string().nullable(), platformItemId: z.string().nullable(), canonicalUrl: z.string().url().nullable(), publishedAt: z.string().nullable() }).nullable(),
});
const FeedSchema = z.object({ generatedAt: z.string(), items: z.array(FeedItemSchema) });

const TimelineItemSchema = z.object({ id: z.string().uuid(), event_type: z.string(), verification_state: z.string(), priority_band: z.string(), headline: z.string(), summary: z.string().nullable(), status: z.string(), detected_at: z.string(), announced_at: z.string().nullable(), occurred_at: z.string().nullable() });
const RevisionSchema = z.object({ id: z.string().uuid(), raw_item_id: z.string().uuid(), observed_at: z.string(), title: z.string().nullable(), text: z.string().nullable(), metadata: JsonObjectSchema, content_fingerprint: z.string(), change_kind: z.string() });
const ClaimSchema = z.object({
  id: z.string().uuid(), subject_entity_id: z.string().uuid(), predicate: z.string(), value_json: z.unknown(), qualifiers_json: z.unknown(), claim_time: z.string().nullable(), extraction_confidence: NumericSchema.nullable(), engine_version: z.string(), created_at: z.string(),
  evidencePointers: z.array(z.object({ claim_id: z.string().uuid(), raw_item_id: z.string().uuid(), raw_item_revision_id: z.string().uuid().nullable(), evidence_role: z.string(), text_span_or_pointer: z.unknown() })),
});
const EventDetailSchema = z.object({
  generatedAt: z.string(),
  event: z.object({ id: z.string().uuid(), primary_entity_id: z.string().uuid(), event_type: z.string(), event_schema_version: z.number().int(), occurred_at: z.string().nullable(), announced_at: z.string().nullable(), detected_at: z.string(), verification_state: z.string(), verification_confidence: NumericSchema.nullable(), priority_score: NumericSchema, priority_band: z.string(), headline: z.string(), summary: z.string().nullable(), structured_data: JsonObjectSchema, dedupe_key: z.string(), status: z.string(), supersedes_event_id: z.string().uuid().nullable(), classifier_version: z.string(), created_at: z.string(), updated_at: z.string() }),
  entity: z.object({ id: z.string().uuid(), entity_type: z.string(), canonical_name: z.string(), slug: z.string().nullable(), primary_language: z.string().nullable(), country_code: z.string().nullable(), status: z.string(), created_at: z.string(), updated_at: z.string() }).nullable(),
  evidence: z.array(z.object({
    role: z.string(), weight: NumericSchema, addedAt: z.string(),
    rawItem: z.object({ id: z.string().uuid(), platformItemId: z.string().nullable(), canonicalUrl: z.string().url(), publishedAt: z.string().nullable(), firstSeenAt: z.string(), lastSeenAt: z.string(), itemType: z.string(), rawTitle: z.string().nullable(), rawText: z.string().nullable(), languageCode: z.string().nullable(), mediaType: z.string().nullable(), metadata: JsonObjectSchema, contentFingerprint: z.string(), unavailableAt: z.string().nullable(), currentRevisionId: z.string().uuid().nullable(), revisions: z.array(RevisionSchema) }).nullable(),
    source: z.object({ name: z.string(), authorityTier: z.number().int(), sourceRole: z.string().nullable(), territory: z.string().nullable(), languages: z.array(z.string()), platform: z.string(), platformIdentityId: z.string().nullable(), handle: z.string().nullable(), canonicalUrl: z.string().url(), connectorType: z.string(), pollClass: z.string(), accessMode: z.string(), active: z.boolean() }).nullable(),
    claim: ClaimSchema.nullable(),
  })),
  timeline: z.array(TimelineItemSchema),
});

const RegistryEntrySchema = z.object({
  source: z.object({ id: z.string().uuid(), display_name: z.string(), authority_tier: z.number().int(), source_role: z.string().nullable(), territory: z.string().nullable(), languages: z.array(z.string()), active: z.boolean(), created_at: z.string(), updated_at: z.string() }).nullable(),
  identity: z.object({ id: z.string().uuid(), source_id: z.string().uuid(), platform: z.string(), platform_identity_id: z.string().nullable(), handle: z.string().nullable(), canonical_url: z.string().url(), connector_type: z.string(), poll_class: z.string(), access_mode: z.string(), active: z.boolean(), created_at: z.string(), updated_at: z.string() }),
  health: z.object({ source_identity_id: z.string().uuid(), health_state: z.string(), last_attempt_at: z.string().nullable(), last_success_at: z.string().nullable(), last_item_at: z.string().nullable(), next_due_at: z.string().nullable(), consecutive_failures: z.number().int(), last_http_status: z.number().int().nullable(), last_error_code: z.string().nullable(), last_error_message: z.string().nullable(), rate_limited_until: z.string().nullable(), subscription_expires_at: z.string().nullable(), parser_version: z.string().nullable(), updated_at: z.string() }).nullable(),
  youtube: z.object({ source_identity_id: z.string().uuid(), channel_id: z.string(), uploads_playlist_id: z.string().nullable(), latest_known_video_id: z.string().nullable(), last_websub_at: z.string().nullable(), last_enriched_at: z.string().nullable(), last_fallback_check_at: z.string().nullable(), next_fallback_check_at: z.string().nullable(), fallback_gap_count: z.number().int(), consecutive_websub_events: z.number().int(), updated_at: z.string() }).nullable(),
  subscription: z.object({ id: z.string().uuid(), source_identity_id: z.string().uuid(), provider: z.string(), generation: z.number().int(), signature_required: z.boolean(), state: z.string(), lease_seconds: z.number().int().nullable(), requested_at: z.string(), verified_at: z.string().nullable(), expires_at: z.string().nullable(), renew_after: z.string().nullable(), denied_at: z.string().nullable(), last_error: z.string().nullable(), updated_at: z.string() }).nullable(),
});

const OperationsSchema = z.object({
  generatedAt: z.string(),
  registry: z.array(RegistryEntrySchema),
  scheduler: z.array(z.object({ job_id: NumericSchema, job_name: z.string(), schedule: z.string(), active: z.boolean(), latest_status: z.string().nullable(), return_message: z.string().nullable(), latest_start_at: z.string().nullable(), latest_end_at: z.string().nullable() })),
  quota: z.object({ usageDay: z.string().nullable(), methods: z.array(z.object({ provider: z.string(), quotaBucket: z.string(), method: z.string(), units: z.number(), requests: z.number().int() })) }),
  receipts: z.array(z.object({ provider: z.string(), source_identity_id: z.string().uuid().nullable(), external_key: z.string(), received_at: z.string(), processed_at: z.string().nullable(), status: z.string(), error_message: z.string().nullable(), metadata: JsonObjectSchema })),
  jobs: z.object({
    recent: z.array(z.object({ job_type: z.string(), state: z.string(), attempt_count: z.number().int(), max_attempts: z.number().int(), run_after: z.string(), last_error: z.string().nullable(), created_at: z.string(), completed_at: z.string().nullable() })),
    stateCounts: z.array(z.object({ jobType: z.string(), state: z.string(), count: z.number().int() })),
  }),
});

export type ConsoleOverview = z.infer<typeof OverviewSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type ConsoleFeed = z.infer<typeof FeedSchema>;
export type EventDetail = z.infer<typeof EventDetailSchema>;
export type ConsoleOperations = z.infer<typeof OperationsSchema>;

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cinerelay-console-api', { body });
  if (error) throw error;
  return schema.parse(data);
}

export function fetchConsoleOverview(): Promise<ConsoleOverview> { return invoke({ action: 'overview' }, OverviewSchema); }
export function fetchConsoleFeed(limit = 25): Promise<ConsoleFeed> { return invoke({ action: 'feed', limit }, FeedSchema); }
export function fetchEventDetail(eventId: string): Promise<EventDetail> { return invoke({ action: 'eventDetail', eventId }, EventDetailSchema); }
export function fetchConsoleOperations(): Promise<ConsoleOperations> { return invoke({ action: 'operations' }, OperationsSchema); }
