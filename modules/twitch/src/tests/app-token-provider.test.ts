import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchAuthenticationError } from '../errors.js';

describe('TwitchAppTokenProvider', () => {
  it('acquires and caches an app access token', async () => {
    let requests = 0;
    const provider = new TwitchAppTokenProvider({
      clientId: 'clientid',
      clientSecret: 'sanitized-client-secret',
      now: () => 1_000,
      fetch: () => {
        requests += 1;
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

  it('throws a typed error when token acquisition fails', async () => {
    const provider = new TwitchAppTokenProvider({
      clientId: 'clientid',
      clientSecret: 'sanitized-client-secret',
      fetch: () => Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401)),
    });

    await assert.rejects(provider.getToken(), TwitchAuthenticationError);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
