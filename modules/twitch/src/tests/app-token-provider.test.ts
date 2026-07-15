import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchAuthenticationError } from '../errors.js';

describe('TwitchAppTokenProvider', () => {
  it('sends client credentials in a form-encoded POST body and caches the token', async () => {
    const clientId = 'clientid';
    const clientSecret = 'sanitized secret&value';
    let requests = 0;
    const provider = new TwitchAppTokenProvider({
      clientId,
      clientSecret,
      now: () => 1_000,
      fetch: (input, init) => {
        requests += 1;
        const url = new URL(input instanceof Request ? input.url : input.toString());
        const headers = new Headers(init?.headers);
        assert.ok(init?.body instanceof URLSearchParams);
        const body = init.body;

        assert.equal(url.toString(), 'https://id.twitch.tv/oauth2/token');
        assert.equal(url.search, '');
        assert.equal(url.toString().includes(clientId), false);
        assert.equal(url.toString().includes(clientSecret), false);
        assert.equal(init?.method, 'POST');
        assert.equal(headers.get('content-type'), 'application/x-www-form-urlencoded');
        assert.equal(body.get('client_id'), clientId);
        assert.equal(body.get('client_secret'), clientSecret);
        assert.equal(body.get('grant_type'), 'client_credentials');

        return Promise.resolve(
          jsonResponse({ access_token: 'token-1', expires_in: 3600, token_type: 'bearer' }),
        );
      },
    });

    const first = await provider.getToken();
    const second = await provider.getToken();

    assert.equal(first.value, 'token-1');
    assert.equal(second, first);
    assert.equal(requests, 1);
  });

  it('refreshes a token before expiry and coalesces concurrent refreshes', async () => {
    let now = 1_000;
    let requests = 0;
    const provider = new TwitchAppTokenProvider({
      clientId: 'clientid',
      clientSecret: 'sanitized-client-secret',
      now: () => now,
      refreshSkewMs: 1_000,
      fetch: async () => {
        requests += 1;
        await Promise.resolve();
        return jsonResponse({
          access_token: `token-${String(requests)}`,
          expires_in: 2,
          token_type: 'bearer',
        });
      },
    });

    assert.equal((await provider.getToken()).value, 'token-1');
    now = 2_100;
    const [first, second] = await Promise.all([provider.getToken(), provider.getToken()]);

    assert.equal(first.value, 'token-2');
    assert.equal(second.value, 'token-2');
    assert.equal(requests, 2);
  });

  it('throws a typed error without retaining credentials or provider response details', async () => {
    const clientSecret = 'sanitized-client-secret-that-must-not-leak';
    const provider = new TwitchAppTokenProvider({
      clientId: 'clientid',
      clientSecret,
      fetch: () => Promise.resolve(jsonResponse({ message: `Unauthorized: ${clientSecret}` }, 401)),
    });

    await assert.rejects(provider.getToken(), (error: unknown) => {
      assert.ok(error instanceof TwitchAuthenticationError);
      assert.equal(inspect(error, { depth: 5 }).includes(clientSecret), false);
      assert.equal(JSON.stringify(error).includes(clientSecret), false);
      return true;
    });
  });

  it('does not retain a transport error that may contain credentials', async () => {
    const clientSecret = 'sanitized-transport-secret-that-must-not-leak';
    const provider = new TwitchAppTokenProvider({
      clientId: 'clientid',
      clientSecret,
      fetch: () => Promise.reject(new Error(`transport failed with ${clientSecret}`)),
    });

    await assert.rejects(provider.getToken(), (error: unknown) => {
      assert.ok(error instanceof TwitchAuthenticationError);
      assert.equal(inspect(error, { depth: 5 }).includes(clientSecret), false);
      assert.equal(error.cause, undefined);
      return true;
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
