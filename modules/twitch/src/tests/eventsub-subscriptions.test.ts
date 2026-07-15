import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchApiError } from '../errors.js';
import { TwitchEventSubSubscriptions } from '../eventsub/eventsub-subscriptions.js';

const callbackUrl = 'https://example.com/webhooks/twitch/eventsub';

describe('TwitchEventSubSubscriptions', () => {
  for (const status of ['enabled', 'webhook_callback_verification_pending']) {
    it(`reuses a matching ${status} subscription on the first page`, async () => {
      const methods: string[] = [];
      const manager = createManager((url, init) => {
        if (url.hostname === 'id.twitch.tv') return tokenResponse();
        methods.push(init?.method ?? 'GET');
        assert.equal(url.searchParams.get('after'), null);
        return subscriptionsResponse([subscriptionData(status)]);
      });

      const subscription = await manager.ensureSubscription('stream.online', '123456');

      assert.equal(subscription.id, 'subscription-001');
      assert.equal(subscription.status, status);
      assert.deepEqual(methods, ['GET']);
    });
  }

  it('reuses a matching subscription on a later page', async () => {
    const cursors: Array<string | null> = [];
    const manager = createManager((url) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      const cursor = url.searchParams.get('after');
      cursors.push(cursor);
      return cursor === null
        ? subscriptionsResponse([subscriptionData('authorization_revoked')], 'next-page-cursor')
        : subscriptionsResponse([
            subscriptionData('webhook_callback_verification_pending', 'subscription-002'),
          ]);
    });

    const subscription = await manager.ensureSubscription('stream.online', '123456');

    assert.equal(subscription.id, 'subscription-002');
    assert.deepEqual(cursors, [null, 'next-page-cursor']);
  });

  it('creates a subscription only after all pages have no reusable match', async () => {
    const methods: string[] = [];
    const manager = createManager((url, init) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      const method = init?.method ?? 'GET';
      methods.push(method);
      if (method === 'POST') {
        return subscriptionsResponse(
          [subscriptionData('webhook_callback_verification_pending', 'subscription-new')],
          undefined,
          202,
        );
      }
      return url.searchParams.get('after') === null
        ? subscriptionsResponse([subscriptionData('notification_failures_exceeded')], 'second-page')
        : subscriptionsResponse([subscriptionData('authorization_revoked')]);
    });

    const subscription = await manager.ensureSubscription('stream.online', '123456');

    assert.equal(subscription.id, 'subscription-new');
    assert.deepEqual(methods, ['GET', 'GET', 'POST']);
  });

  for (const status of ['authorization_revoked', 'notification_failures_exceeded']) {
    it(`does not reuse a matching ${status} subscription`, async () => {
      let postRequests = 0;
      const manager = createManager((url, init) => {
        if (url.hostname === 'id.twitch.tv') return tokenResponse();
        if (init?.method === 'POST') {
          postRequests += 1;
          return subscriptionsResponse(
            [subscriptionData('webhook_callback_verification_pending', 'subscription-new')],
            undefined,
            202,
          );
        }
        return subscriptionsResponse([subscriptionData(status)]);
      });

      assert.equal(
        (await manager.ensureSubscription('stream.online', '123456')).id,
        'subscription-new',
      );
      assert.equal(postRequests, 1);
    });
  }

  it('rejects a malformed pagination cursor without creating a subscription', async () => {
    let postRequests = 0;
    const manager = createManager((url, init) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      if (init?.method === 'POST') postRequests += 1;
      return jsonResponse({ data: [], pagination: { cursor: '' } });
    });

    await assert.rejects(manager.ensureSubscription('stream.online', '123456'), (error) => {
      assert.ok(error instanceof TwitchApiError);
      assert.equal(error.retryable, false);
      assert.match(error.message, /malformed Helix response/);
      return true;
    });
    assert.equal(postRequests, 0);
  });

  it('rejects a repeated pagination cursor without creating a subscription', async () => {
    let getRequests = 0;
    let postRequests = 0;
    const manager = createManager((url, init) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      if (init?.method === 'POST') postRequests += 1;
      else getRequests += 1;
      return subscriptionsResponse([], 'repeated-cursor');
    });

    await assert.rejects(manager.ensureSubscription('stream.online', '123456'), (error) => {
      assert.ok(error instanceof TwitchApiError);
      assert.equal(error.retryable, false);
      assert.match(error.message, /repeated EventSub pagination cursor/);
      return true;
    });
    assert.equal(getRequests, 2);
    assert.equal(postRequests, 0);
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

function subscriptionData(status: string, id = 'subscription-001'): Record<string, unknown> {
  return {
    id,
    status,
    type: 'stream.online',
    version: '1',
    condition: { broadcaster_user_id: '123456' },
    transport: { method: 'webhook', callback: callbackUrl },
    created_at: '2026-07-15T11:00:00.000Z',
    cost: 0,
  };
}

function subscriptionsResponse(
  data: readonly Record<string, unknown>[],
  cursor?: string,
  status = 200,
): Response {
  return jsonResponse(
    {
      data,
      pagination: cursor === undefined ? {} : { cursor },
    },
    status,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
