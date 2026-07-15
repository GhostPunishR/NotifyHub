import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createTwitchConfig } from '../config.js';

it('validates Twitch secrets and the exact secure callback route', () => {
  const validInput = {
    clientId: 'clientid',
    clientSecret: 'sanitized-client-secret',
    eventSubSecret: 'sanitized-eventsub-test-secret',
    eventSubCallbackUrl: 'https://example.com/webhooks/twitch/eventsub',
  } as const;

  assert.equal(createTwitchConfig(validInput).requestTimeoutMs, 10_000);
  assert.throws(() =>
    createTwitchConfig({
      ...validInput,
      eventSubCallbackUrl: 'http://example.com/webhooks/twitch/eventsub',
    }),
  );
  assert.throws(() =>
    createTwitchConfig({ ...validInput, eventSubCallbackUrl: 'https://example.com/another-path' }),
  );
  assert.throws(() => createTwitchConfig({ ...validInput, eventSubSecret: 'too-short' }));
});
