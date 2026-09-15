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
