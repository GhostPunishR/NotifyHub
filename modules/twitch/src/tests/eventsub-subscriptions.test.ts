import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchEventSubSubscriptions } from '../eventsub/eventsub-subscriptions.js';

const callbackUrl = 'https://example.com/webhooks/twitch/eventsub';

describe('TwitchEventSubSubscriptions', () => {
  it('reuses an enabled matching subscription', async () => {
    let postRequests = 0;
    const manager = createManager((url, init) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      if (init?.method === 'POST') postRequests += 1;
      return subscriptionResponse('enabled');
    });

    const subscription = await manager.ensureSubscription('stream.online', '123456');

    assert.equal(subscription.id, 'subscription-001');
    assert.equal(postRequests, 0);
  });

  it('creates a missing subscription and deletes it by ID', async () => {
    const methods: string[] = [];
    const manager = createManager((url, init) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      const method = init?.method ?? 'GET';
      methods.push(method);
      if (method === 'GET') return jsonResponse({ data: [] });
      if (method === 'POST')
        return subscriptionResponse('webhook_callback_verification_pending', 202);
      return new Response(null, { status: 204 });
    });

    const subscription = await manager.ensureSubscription('channel.update', '123456');
    await manager.deleteSubscription(subscription.id);

    assert.equal(subscription.status, 'webhook_callback_verification_pending');
    assert.deepEqual(methods, ['GET', 'POST', 'DELETE']);
  });
});

function createManager(
  implementation: (url: URL, init?: RequestInit) => Response | Promise<Response>,
): TwitchEventSubSubscriptions {
  const injectedFetch: typeof fetch = (input, init) =>
    Promise.resolve(
      implementation(new URL(input instanceof Request ? input.url : input.toString()), init),
    );
  const tokenProvider = new TwitchAppTokenProvider({
    clientId: 'clientid',
    clientSecret: 'sanitized-client-secret',
    fetch: injectedFetch,
  });
  const client = new TwitchHelixClient({
    clientId: 'clientid',
    tokenProvider,
    fetch: injectedFetch,
  });
  return new TwitchEventSubSubscriptions(client, callbackUrl, 'sanitized-eventsub-test-secret');
}

function tokenResponse(): Response {
  return jsonResponse({ access_token: 'token-1', expires_in: 3600, token_type: 'bearer' });
}

function subscriptionResponse(status: string, responseStatus = 200): Response {
  return jsonResponse(
    {
      data: [
        {
          id: 'subscription-001',
          status,
          type: 'stream.online',
          version: '1',
          condition: { broadcaster_user_id: '123456' },
          transport: { method: 'webhook', callback: callbackUrl },
          created_at: '2026-07-15T11:00:00.000Z',
          cost: 0,
        },
      ],
    },
    responseStatus,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
