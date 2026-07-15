import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchEventSubError } from '../errors.js';
import { TwitchEventSubHandler } from '../eventsub/eventsub-handler.js';
import type {
  TwitchEventSubMessageType,
  TwitchStreamEnrichmentFailure,
} from '../eventsub/eventsub-types.js';
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
    const failures: TwitchStreamEnrichmentFailure[] = [];
    const result = await createHandler({ failures }).handle(
      signedRequest('notification', streamOnlinePayload),
    );

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
    assert.deepEqual(failures, []);
  });

  it('normalizes stream.online without optional fields when no stream is current', async () => {
    const failures: TwitchStreamEnrichmentFailure[] = [];
    const result = await createHandler({
      failures,
      streamRequest: () => Promise.resolve(jsonResponse({ data: [] })),
    }).handle(signedRequest('notification', streamOnlinePayload));

    assertFallbackStreamOnline(result);
    assert.deepEqual(failures, []);
  });

  const fallbackScenarios: readonly {
    readonly name: string;
    readonly streamRequest: () => Promise<Response>;
    readonly expected: Pick<TwitchStreamEnrichmentFailure, 'reason'> &
      Partial<Pick<TwitchStreamEnrichmentFailure, 'status' | 'retryable'>>;
    readonly timeoutMs?: number;
  }[] = [
    {
      name: 'dedicated enrichment timeout',
      streamRequest: () => new Promise<Response>(() => {}),
      expected: { reason: 'timeout' },
      timeoutMs: 5,
    },
    {
      name: 'transport failure',
      streamRequest: () => Promise.reject(new Error('sanitized transport failure')),
      expected: { reason: 'helix_error', status: 0, retryable: true },
    },
    {
      name: 'HTTP 429',
      streamRequest: () =>
        Promise.resolve(
          jsonResponse(
            { error: 'Too Many Requests', status: 429, message: 'Rate limit exceeded' },
            429,
            { 'ratelimit-remaining': '0', 'ratelimit-reset': '1784117100' },
          ),
        ),
      expected: { reason: 'helix_error', status: 429, retryable: true },
    },
    {
      name: 'HTTP 5xx',
      streamRequest: () => Promise.resolve(jsonResponse({ message: 'Twitch unavailable' }, 503)),
      expected: { reason: 'helix_error', status: 503, retryable: true },
    },
    {
      name: 'malformed Helix response',
      streamRequest: () => Promise.resolve(jsonResponse({ data: [{ id: 'incomplete' }] })),
      expected: { reason: 'helix_error', status: 200, retryable: false },
    },
  ];

  for (const scenario of fallbackScenarios) {
    it(`falls back to the signed stream.online event after ${scenario.name}`, async () => {
      const failures: TwitchStreamEnrichmentFailure[] = [];
      const result = await createHandler({
        failures,
        streamRequest: scenario.streamRequest,
        ...(scenario.timeoutMs === undefined ? {} : { timeoutMs: scenario.timeoutMs }),
      }).handle(signedRequest('notification', streamOnlinePayload));

      assertFallbackStreamOnline(result);
      assert.equal(failures.length, 1);
      assert.deepEqual(failures[0], {
        eventSubMessageId: EVENTSUB_MESSAGE_ID,
        eventSubSubscriptionId: 'sanitized-subscription-id',
        broadcasterUserId: '123456',
        ...scenario.expected,
      });
      assert.equal(JSON.stringify(failures).includes(EVENTSUB_TEST_SECRET), false);
      assert.equal(JSON.stringify(failures).includes('token-1'), false);
      assert.equal(JSON.stringify(failures).includes('rawBody'), false);
      assert.equal(JSON.stringify(failures).includes('signature'), false);
    });
  }

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

function createHandler(
  options: {
    readonly streamRequest?: () => Promise<Response>;
    readonly timeoutMs?: number;
    readonly failures?: TwitchStreamEnrichmentFailure[];
  } = {},
): TwitchEventSubHandler {
  const injectedFetch: typeof fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.hostname === 'id.twitch.tv') {
      return Promise.resolve(
        jsonResponse({ access_token: 'token-1', expires_in: 3600, token_type: 'bearer' }),
      );
    }
    return (
      options.streamRequest?.() ??
      Promise.resolve(
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
      )
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
  return new TwitchEventSubHandler(verifier, client, {
    ...(options.timeoutMs === undefined ? {} : { streamEnrichmentTimeoutMs: options.timeoutMs }),
    onStreamEnrichmentFailure(failure) {
      options.failures?.push(failure);
    },
  });
}

function assertFallbackStreamOnline(
  result: Awaited<ReturnType<TwitchEventSubHandler['handle']>>,
): void {
  assert.equal(result.type, 'notification');
  if (result.type !== 'notification') return;

  assert.equal(result.event.id, `twitch:eventsub:${EVENTSUB_MESSAGE_ID}`);
  assert.equal(result.event.type, 'stream.started');
  assert.deepEqual(result.event.source, {
    externalId: '123456',
    username: 'notifyhubtest',
    displayName: 'NotifyHubTest',
  });
  assert.deepEqual(result.event.content, { url: 'https://www.twitch.tv/notifyhubtest' });
  assert.equal(result.event.occurredAt.toISOString(), '2026-07-15T11:59:00.000Z');
  assert.deepEqual(result.event.metadata, {
    eventSubMessageId: EVENTSUB_MESSAGE_ID,
    eventSubSubscriptionId: 'sanitized-subscription-id',
    streamId: 'stream-001',
    streamType: 'live',
  });
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
