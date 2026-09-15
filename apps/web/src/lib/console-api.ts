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

export type ConsoleOverview = z.infer<typeof OverviewSchema>;

export async function fetchConsoleOverview(): Promise<ConsoleOverview> {
  const { data, error } = await supabase.functions.invoke('cinerelay-console-api', {
    body: { action: 'overview' },
  });
  if (error) throw error;
  return OverviewSchema.parse(data);
}
