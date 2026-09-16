import {
  buildWebSubRequest,
  deriveWebSubCredential,
  sha256Hex,
} from './index.js';

// Keep this declaration self-contained. Deno type-checks the compiled Edge Function
// graph and must not depend on a type-only export erased from index.js at runtime.
type SubscriptionWebSubMode = 'subscribe' | 'unsubscribe';

export type SubscriptionPlan = {
  mode: SubscriptionWebSubMode;
  generation: number;
  state: 'PENDING' | 'RENEWING' | 'UNSUBSCRIBING';
  callbackUrl: string;
  callbackTokenHash: string;
  hubSecret: string;
  topicUrl: string;
  hubRequest: { url: string; headers: Record<string, string>; body: string; topic: string };
};

export const HUB_RETRY_POLICY = Object.freeze({
  maxAttempts: 3,
  delaysMs: [250, 750] as const,
  failedRenewalBackoffMs: 30 * 60 * 1000,
});

const RETRYABLE_HUB_STATUSES = new Set([429, 500, 502, 503, 504]);

export type HubRetryDecision = {
  retry: boolean;
  delayMs: number;
};

export function decideHubRetry(input: { attempt: number; status: number }): HubRetryDecision {
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1) throw new Error('Hub retry attempt must be a positive integer');
  if (!Number.isSafeInteger(input.status) || input.status < 100 || input.status > 599) throw new Error('Invalid hub HTTP status');
  if (!RETRYABLE_HUB_STATUSES.has(input.status) || input.attempt >= HUB_RETRY_POLICY.maxAttempts) {
    return { retry: false, delayMs: 0 };
  }
  const delayMs = HUB_RETRY_POLICY.delaysMs[Math.min(input.attempt - 1, HUB_RETRY_POLICY.delaysMs.length - 1)] ?? 0;
  return { retry: true, delayMs };
}

export function failedRenewalRetryAt(now: Date): string {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid failed-renewal clock');
  return new Date(timestamp + HUB_RETRY_POLICY.failedRenewalBackoffMs).toISOString();
}

function callbackUrlWithToken(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('Public WebSub callback must use HTTPS');
  url.searchParams.set('token', token);
  return url.toString();
}

export async function planSubscription(input: {
  sourceIdentityId: string;
  channelId: string;
  currentGeneration: number;
  callbackBaseUrl: string;
  masterSecret: string;
  requestedLeaseSeconds?: number;
}): Promise<SubscriptionPlan> {
  if (!Number.isSafeInteger(input.currentGeneration) || input.currentGeneration < 0) throw new Error('Invalid current generation');
  const generation = input.currentGeneration + 1;
  const callbackToken = await deriveWebSubCredential(input.masterSecret, input.sourceIdentityId, generation, 'callback-token');
  const hubSecret = await deriveWebSubCredential(input.masterSecret, input.sourceIdentityId, generation, 'hub-secret');
  const callbackUrl = callbackUrlWithToken(input.callbackBaseUrl, callbackToken);
  const hubRequest = buildWebSubRequest({
    mode: 'subscribe',
    channelId: input.channelId,
    callbackUrl,
    secret: hubSecret,
    ...(input.requestedLeaseSeconds === undefined ? {} : { leaseSeconds: input.requestedLeaseSeconds }),
  });
  return {
    mode: 'subscribe',
    generation,
    state: input.currentGeneration === 0 ? 'PENDING' : 'RENEWING',
    callbackUrl,
    callbackTokenHash: await sha256Hex(callbackToken),
    hubSecret,
    topicUrl: hubRequest.topic,
    hubRequest,
  };
}

export async function planUnsubscription(input: {
  sourceIdentityId: string;
  channelId: string;
  generation: number;
  callbackBaseUrl: string;
  masterSecret: string;
}): Promise<SubscriptionPlan> {
  if (!Number.isSafeInteger(input.generation) || input.generation < 1) throw new Error('Invalid subscription generation');
  const callbackToken = await deriveWebSubCredential(input.masterSecret, input.sourceIdentityId, input.generation, 'callback-token');
  const hubSecret = await deriveWebSubCredential(input.masterSecret, input.sourceIdentityId, input.generation, 'hub-secret');
  const callbackUrl = callbackUrlWithToken(input.callbackBaseUrl, callbackToken);
  const hubRequest = buildWebSubRequest({ mode: 'unsubscribe', channelId: input.channelId, callbackUrl, secret: hubSecret });
  return {
    mode: 'unsubscribe',
    generation: input.generation,
    state: 'UNSUBSCRIBING',
    callbackUrl,
    callbackTokenHash: await sha256Hex(callbackToken),
    hubSecret,
    topicUrl: hubRequest.topic,
    hubRequest,
  };
}
