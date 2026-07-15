import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchChannelResolver } from '../channels/channel-resolver.js';
import { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchApiError, TwitchChannelNotFoundError } from '../errors.js';

describe('Twitch channel resolution and Helix errors', () => {
  it('resolves a login and supported Twitch URL to a normalized source', async () => {
    const client = createClient((url) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      assert.equal(url.searchParams.get('login'), 'notifyhubtest');
      return jsonResponse({
        data: [
          {
            id: '123456',
            login: 'notifyhubtest',
            display_name: 'NotifyHubTest',
            profile_image_url: 'https://static.example.com/profile.png',
          },
        ],
      });
    });
    const resolver = new TwitchChannelResolver(client);

    const source = await resolver.resolveSource('https://www.twitch.tv/NotifyHubTest');

    assert.deepEqual(source, {
      network: 'twitch',
      externalId: '123456',
      username: 'notifyhubtest',
      displayName: 'NotifyHubTest',
      avatarUrl: 'https://static.example.com/profile.png',
      url: 'https://www.twitch.tv/notifyhubtest',
    });
  });

  it('throws a typed error when a channel is not found', async () => {
    const client = createClient((url) =>
      url.hostname === 'id.twitch.tv' ? tokenResponse() : jsonResponse({ data: [] }),
    );

    await assert.rejects(
      new TwitchChannelResolver(client).resolveSource('missing_user'),
      TwitchChannelNotFoundError,
    );
  });

  it('exposes Twitch rate-limit headers without retrying the request', async () => {
    let helixRequests = 0;
    const client = createClient((url) => {
      if (url.hostname === 'id.twitch.tv') return tokenResponse();
      helixRequests += 1;
      return jsonResponse(
        { error: 'Too Many Requests', status: 429, message: 'Rate limit exceeded' },
        429,
        {
          'ratelimit-limit': '800',
          'ratelimit-remaining': '0',
          'ratelimit-reset': '1784117100',
        },
      );
    });

    await assert.rejects(client.getUserByLogin('notifyhubtest'), (error: unknown) => {
      assert.ok(error instanceof TwitchApiError);
      assert.equal(error.status, 429);
      assert.equal(error.retryable, true);
      assert.equal(error.rateLimit.limit, 800);
      assert.equal(error.rateLimit.remaining, 0);
      assert.equal(error.rateLimit.resetAt?.toISOString(), '2026-07-15T12:05:00.000Z');
      return true;
    });
    assert.equal(helixRequests, 1);
  });

  it('invalidates an unauthorized token and retries exactly once', async () => {
    let tokenRequests = 0;
    let helixRequests = 0;
    const client = createClient((url) => {
      if (url.hostname === 'id.twitch.tv') {
        tokenRequests += 1;
        return jsonResponse({
          access_token: `token-${String(tokenRequests)}`,
          expires_in: 3600,
          token_type: 'bearer',
        });
      }
      helixRequests += 1;
      return helixRequests === 1
        ? jsonResponse({ message: 'Invalid OAuth token' }, 401)
        : jsonResponse({ data: [] });
    });

    assert.equal(await client.getUserByLogin('notifyhubtest'), null);
    assert.equal(tokenRequests, 2);
    assert.equal(helixRequests, 2);
  });
});

function createClient(
  fetchImplementation: (url: URL) => Response | Promise<Response>,
): TwitchHelixClient {
  const injectedFetch = (input: string | URL | Request): Promise<Response> =>
    Promise.resolve(
      fetchImplementation(new URL(input instanceof Request ? input.url : input.toString())),
    );
  const tokenProvider = new TwitchAppTokenProvider({
    clientId: 'clientid',
    clientSecret: 'sanitized-client-secret',
    fetch: injectedFetch,
  });
  return new TwitchHelixClient({ clientId: 'clientid', tokenProvider, fetch: injectedFetch });
}

function tokenResponse(): Response {
  return jsonResponse({ access_token: 'token-1', expires_in: 3600, token_type: 'bearer' });
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
