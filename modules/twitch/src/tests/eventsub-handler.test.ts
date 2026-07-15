import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchEventSubError } from '../errors.js';
import { TwitchEventSubHandler } from '../eventsub/eventsub-handler.js';
import type { TwitchEventSubMessageType } from '../eventsub/eventsub-types.js';
import { TwitchEventSubVerifier } from '../eventsub/eventsub-verifier.js';
import {
  channelUpdatePayload,
  EVENTSUB_MESSAGE_ID,
  EVENTSUB_NOW,
  EVENTSUB_TEST_SECRET,
  EVENTSUB_TIMESTAMP,
  revocationPayload,
  streamOfflinePayload,
  streamOnlinePayload,
  verificationPayload,
} from './fixtures/eventsub.js';

describe('Twitch EventSub handling', () => {
  it('returns the callback verification challenge exactly', async () => {
    const result = await createHandler().handle(
      signedRequest('webhook_callback_verification', verificationPayload),
    );

    assert.equal(result.type, 'verification');
    if (result.type === 'verification') {
      assert.equal(result.challenge, verificationPayload.challenge);
    }
  });

  it('normalizes stream.online and enriches it with current stream data', async () => {
    const result = await createHandler().handle(signedRequest('notification', streamOnlinePayload));

    assert.equal(result.type, 'notification');
    if (result.type === 'notification') {
      assert.equal(result.event.id, `twitch:eventsub:${EVENTSUB_MESSAGE_ID}`);
      assert.equal(result.event.type, 'stream.started');
      assert.equal(result.event.source.username, 'notifyhubtest');
      assert.equal(result.event.content.title, 'A sanitized live stream');
      assert.equal(result.event.content.category, 'Science & Technology');
      assert.equal(result.event.content.thumbnailUrl, 'https://static.example.com/1280x720.jpg');
      assert.equal(result.event.occurredAt.toISOString(), '2026-07-15T11:59:00.000Z');
      assert.equal('rawPayload' in result.event, false);
    }
  });

  it('normalizes stream.offline', async () => {
    const result = await createHandler().handle(
      signedRequest('notification', streamOfflinePayload),
    );

    assert.equal(result.type, 'notification');
    if (result.type === 'notification') {
      assert.equal(result.event.type, 'stream.ended');
      assert.equal(result.event.occurredAt.toISOString(), EVENTSUB_TIMESTAMP);
      assert.equal(result.event.content.url, 'https://www.twitch.tv/notifyhubtest');
    }
  });

  it('normalizes channel.update', async () => {
    const result = await createHandler().handle(
      signedRequest('notification', channelUpdatePayload),
    );

    assert.equal(result.type, 'notification');
    if (result.type === 'notification') {
      assert.equal(result.event.type, 'stream.updated');
      assert.equal(result.event.content.title, 'Building a safe EventSub integration');
      assert.equal(result.event.content.category, 'Just Chatting');
    }
  });

  it('handles revocations explicitly', async () => {
    const result = await createHandler().handle(signedRequest('revocation', revocationPayload));

    assert.equal(result.type, 'revocation');
    if (result.type === 'revocation') {
      assert.equal(result.subscription.status, 'authorization_revoked');
      assert.equal(result.subscription.id, 'sanitized-subscription-id');
    }
  });

  it('rejects an invalid signature', async () => {
    const request = signedRequest('notification', streamOfflinePayload);
    request.headers['twitch-eventsub-message-signature'] = `sha256=${'0'.repeat(64)}`;

    await assertEventSubRejection(createHandler().handle(request), 'invalid_eventsub_signature');
  });

  it('rejects a stale timestamp', async () => {
    const request = signedRequest('notification', streamOfflinePayload, '2026-07-15T11:40:00.000Z');

    await assertEventSubRejection(createHandler().handle(request), 'stale_eventsub_message');
  });

  it('rejects missing and duplicated required headers', async () => {
    const missing = signedRequest('notification', streamOfflinePayload);
    delete missing.headers['twitch-eventsub-message-id'];
    await assertEventSubRejection(createHandler().handle(missing), 'invalid_eventsub_headers');

    const duplicated = signedRequest('notification', streamOfflinePayload);
    duplicated.headers['twitch-eventsub-message-id'] = ['first', 'second'];
    await assertEventSubRejection(createHandler().handle(duplicated), 'invalid_eventsub_headers');
  });

  it('rejects malformed JSON after signature verification', async () => {
    const request = signedRawRequest('notification', Buffer.from('{not-json'));
    await assertEventSubRejection(createHandler().handle(request), 'invalid_eventsub_json');
  });

  it('rejects malformed Twitch payloads', async () => {
    const malformed = {
      ...streamOfflinePayload,
      event: { broadcaster_user_id: '123456' },
    };
    await assertEventSubRejection(
      createHandler().handle(signedRequest('notification', malformed)),
      'invalid_eventsub_payload',
    );
  });
});

function createHandler(): TwitchEventSubHandler {
  const injectedFetch: typeof fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.hostname === 'id.twitch.tv') {
      return Promise.resolve(
        jsonResponse({ access_token: 'token-1', expires_in: 3600, token_type: 'bearer' }),
      );
    }
    return Promise.resolve(
      jsonResponse({
        data: [
          {
            id: 'stream-001',
            user_id: '123456',
            user_login: 'notifyhubtest',
            user_name: 'NotifyHubTest',
            game_name: 'Science & Technology',
            title: 'A sanitized live stream',
            started_at: '2026-07-15T11:59:00.000Z',
            thumbnail_url: 'https://static.example.com/{width}x{height}.jpg',
          },
        ],
      }),
    );
  };
  const tokenProvider = new TwitchAppTokenProvider({
    clientId: 'clientid',
    clientSecret: 'sanitized-client-secret',
    fetch: injectedFetch,
    now: () => EVENTSUB_NOW,
  });
  const client = new TwitchHelixClient({
    clientId: 'clientid',
    tokenProvider,
    fetch: injectedFetch,
  });
  const verifier = new TwitchEventSubVerifier({
    secret: EVENTSUB_TEST_SECRET,
    now: () => EVENTSUB_NOW,
  });
  return new TwitchEventSubHandler(verifier, client);
}

function signedRequest(
  messageType: TwitchEventSubMessageType,
  payload: unknown,
  timestamp = EVENTSUB_TIMESTAMP,
): {
  headers: Record<string, string | readonly string[] | undefined>;
  rawBody: Uint8Array;
} {
  return signedRawRequest(messageType, Buffer.from(JSON.stringify(payload)), timestamp);
}

function signedRawRequest(
  messageType: TwitchEventSubMessageType,
  rawBody: Uint8Array,
  timestamp = EVENTSUB_TIMESTAMP,
): {
  headers: Record<string, string | readonly string[] | undefined>;
  rawBody: Uint8Array;
} {
  const signature = createHmac('sha256', EVENTSUB_TEST_SECRET)
    .update(EVENTSUB_MESSAGE_ID)
    .update(timestamp)
    .update(rawBody)
    .digest('hex');

  return {
    headers: {
      'twitch-eventsub-message-id': EVENTSUB_MESSAGE_ID,
      'twitch-eventsub-message-timestamp': timestamp,
      'twitch-eventsub-message-signature': `sha256=${signature}`,
      'twitch-eventsub-message-type': messageType,
    },
    rawBody,
  };
}

async function assertEventSubRejection(
  promise: Promise<unknown>,
  code: TwitchEventSubError['code'],
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof TwitchEventSubError);
    assert.equal(error.code, code);
    return true;
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
