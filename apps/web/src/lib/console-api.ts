import { z } from 'zod';
import { supabase } from './supabase';

const OverviewSchema = z.object({
  generatedAt: z.string(),
  operator: z.object({
    userId: z.string().uuid(),
    email: z.string().email().nullable(),
    displayName: z.string().nullable(),
  }),
  counts: z.object({
    rawItems: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
  }),
  health: z.object({
    healthy: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
    rateLimited: z.number().int().nonnegative(),
    budgetExhausted: z.number().int().nonnegative(),
    gapSources: z.number().int().nonnegative(),
  }),
});

const FeedItemSchema = z.object({
  id: z.string().uuid(),
  entityName: z.string().nullable(),
  eventType: z.string(),
  verificationState: z.string(),
  priorityBand: z.string(),
  headline: z.string(),
  summary: z.string().nullable(),
  status: z.string(),
  detectedAt: z.string(),
  announcedAt: z.string().nullable(),
  occurredAt: z.string().nullable(),
  structuredData: z.record(z.string(), z.unknown()),
  evidence: z.object({
    role: z.string().nullable(),
    weight: z.union([z.number(), z.string()]).nullable(),
    sourceName: z.string().nullable(),
    platform: z.string().nullable(),
    rawTitle: z.string().nullable(),
    platformItemId: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
    publishedAt: z.string().nullable(),
  }).nullable(),
});

const FeedSchema = z.object({
  generatedAt: z.string(),
  items: z.array(FeedItemSchema),
});

export type ConsoleOverview = z.infer<typeof OverviewSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type ConsoleFeed = z.infer<typeof FeedSchema>;

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cinerelay-console-api', { body });
  if (error) throw error;
  return schema.parse(data);
}

export function fetchConsoleOverview(): Promise<ConsoleOverview> {
  return invoke({ action: 'overview' }, OverviewSchema);
}

export function fetchConsoleFeed(limit = 25): Promise<ConsoleFeed> {
  return invoke({ action: 'feed', limit }, FeedSchema);
}
