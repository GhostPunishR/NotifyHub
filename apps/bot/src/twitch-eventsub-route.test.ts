import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { it } from 'node:test';
import { createTwitchConfig, createTwitchModule } from '@notifyhub/module-twitch';
import { startHealthServer, stopHealthServer } from './health-server.js';
import { createTwitchEventSubRoute } from './twitch-eventsub-route.js';

it('serves Twitch callback verification on the existing HTTP server', async () => {
  const secret = 'sanitized-eventsub-test-secret';
  const timestamp = '2026-07-15T12:00:00.000Z';
  const messageId = 'sanitized-route-message-id';
  const challenge = 'sanitized-route-challenge';
  const rawBody = JSON.stringify({
    challenge,
    subscription: {
      id: 'subscription-001',
      status: 'webhook_callback_verification_pending',
      type: 'stream.online',
      version: '1',
      condition: { broadcaster_user_id: '123456' },
      transport: {
        method: 'webhook',
        callback: 'https://example.com/webhooks/twitch/eventsub',
      },
      created_at: '2026-07-15T11:00:00.000Z',
      cost: 0,
    },
  });
  const signature = createHmac('sha256', secret)
    .update(messageId)
    .update(timestamp)
    .update(rawBody)
    .digest('hex');
  const twitch = createTwitchModule(
    createTwitchConfig({
      clientId: 'clientid',
      clientSecret: 'sanitized-client-secret',
      eventSubSecret: secret,
      eventSubCallbackUrl: 'https://example.com/webhooks/twitch/eventsub',
    }),
    { now: () => Date.parse(timestamp) },
  );
  const route = createTwitchEventSubRoute({
    twitch,
    async onEvent() {},
    async onRevocation() {},
    onError(error) {
      throw error;
    },
  });
  const server = await startHealthServer({
    port: 0,
    isDiscordReady: () => true,
    moduleCount: 6,
    twitchEventSubRoute: route,
  });

  try {
    const address = server.address();
    assert.ok(typeof address === 'object' && address !== null);
    const origin = `http://127.0.0.1:${String(address.port)}`;
    const verificationResponse = await fetch(`${origin}/webhooks/twitch/eventsub`, {
      method: 'POST',
      headers: {
        'Twitch-Eventsub-Message-Id': messageId,
        'Twitch-Eventsub-Message-Timestamp': timestamp,
        'Twitch-Eventsub-Message-Signature': `sha256=${signature}`,
        'Twitch-Eventsub-Message-Type': 'webhook_callback_verification',
      },
      body: rawBody,
    });
    const healthResponse = await fetch(`${origin}/health`);

    assert.equal(verificationResponse.status, 200);
    assert.equal(await verificationResponse.text(), challenge);
    assert.equal(healthResponse.status, 200);
  } finally {
    await stopHealthServer(server);
  }
});
