import type { TwitchHelixClient } from '../client/helix-client.js';
import type { TwitchEventSubSubscription, TwitchStream } from '../client/helix-types.js';
import { TwitchApiError, TwitchEventSubError } from '../errors.js';
import { normalizeChannelUpdate } from '../normalizers/channel-update.js';
import { normalizeStreamOffline } from '../normalizers/stream-offline.js';
import { normalizeStreamOnline } from '../normalizers/stream-online.js';
import {
  channelUpdateEventSchema,
  eventSubNotificationEnvelopeSchema,
  eventSubRevocationSchema,
  eventSubVerificationSchema,
  streamOfflineEventSchema,
  streamOnlineEventSchema,
  type EventSubSubscriptionPayload,
} from '../schemas/twitch-schemas.js';
import type {
  EventSubHandleResult,
  TwitchEventSubRequest,
  TwitchStreamEnrichmentFailure,
} from './eventsub-types.js';
import type { TwitchEventSubVerifier } from './eventsub-verifier.js';

const DEFAULT_STREAM_ENRICHMENT_TIMEOUT_MS = 1_500;

export interface TwitchEventSubHandlerOptions {
  readonly streamEnrichmentTimeoutMs?: number;
  readonly onStreamEnrichmentFailure?: (failure: TwitchStreamEnrichmentFailure) => void;
}

export class TwitchEventSubHandler {
  readonly #streamEnrichmentTimeoutMs: number;
  readonly #onStreamEnrichmentFailure:
    ((failure: TwitchStreamEnrichmentFailure) => void) | undefined;

  public constructor(
    private readonly verifier: TwitchEventSubVerifier,
    private readonly client: TwitchHelixClient,
    options: TwitchEventSubHandlerOptions = {},
  ) {
    this.#streamEnrichmentTimeoutMs =
      options.streamEnrichmentTimeoutMs ?? DEFAULT_STREAM_ENRICHMENT_TIMEOUT_MS;
    this.#onStreamEnrichmentFailure = options.onStreamEnrichmentFailure;

    if (!Number.isInteger(this.#streamEnrichmentTimeoutMs) || this.#streamEnrichmentTimeoutMs < 1) {
      throw new TypeError('The Twitch stream enrichment timeout must be a positive integer.');
    }
  }

  public async handle(request: TwitchEventSubRequest): Promise<EventSubHandleResult> {
    const verified = this.verifier.verify(request);

    switch (verified.messageType) {
      case 'webhook_callback_verification': {
        const payload = parsePayload(eventSubVerificationSchema, verified.payload);
        return {
          type: 'verification',
          challenge: payload.challenge,
          subscription: toSubscription(payload.subscription),
        };
      }
      case 'revocation': {
        const payload = parsePayload(eventSubRevocationSchema, verified.payload);
        return { type: 'revocation', subscription: toSubscription(payload.subscription) };
      }
      case 'notification': {
        const payload = parsePayload(eventSubNotificationEnvelopeSchema, verified.payload);
        const subscription = toSubscription(payload.subscription);

        switch (payload.subscription.type) {
          case 'stream.online': {
            const event = parsePayload(streamOnlineEventSchema, payload.event);
            const stream = await this.#enrichStream({
              messageId: verified.messageId,
              subscriptionId: subscription.id,
              broadcasterUserId: event.broadcaster_user_id,
            });
            return {
              type: 'notification',
              subscription,
              event: normalizeStreamOnline({
                messageId: verified.messageId,
                subscriptionId: subscription.id,
                event,
                stream,
              }),
            };
          }
          case 'stream.offline': {
            const event = parsePayload(streamOfflineEventSchema, payload.event);
            return {
              type: 'notification',
              subscription,
              event: normalizeStreamOffline({
                messageId: verified.messageId,
                messageTimestamp: verified.messageTimestamp,
                subscriptionId: subscription.id,
                event,
              }),
            };
          }
          case 'channel.update': {
            const event = parsePayload(channelUpdateEventSchema, payload.event);
            return {
              type: 'notification',
              subscription,
              event: normalizeChannelUpdate({
                messageId: verified.messageId,
                messageTimestamp: verified.messageTimestamp,
                subscriptionId: subscription.id,
                event,
              }),
            };
          }
        }
      }
    }
  }

  async #enrichStream(input: {
    readonly messageId: string;
    readonly subscriptionId: string;
    readonly broadcasterUserId: string;
  }): Promise<TwitchStream | null> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        this.client.getStreamByUserId(input.broadcasterUserId),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new StreamEnrichmentTimeoutError()),
            this.#streamEnrichmentTimeoutMs,
          );
        }),
      ]);
    } catch (error) {
      this.#reportEnrichmentFailure(toEnrichmentFailure(input, error));
      return null;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  #reportEnrichmentFailure(failure: TwitchStreamEnrichmentFailure): void {
    try {
      this.#onStreamEnrichmentFailure?.(failure);
    } catch {
      // Diagnostic observers must not turn optional enrichment into a webhook failure.
    }
  }
}

class StreamEnrichmentTimeoutError extends Error {}

function toEnrichmentFailure(
  input: {
    readonly messageId: string;
    readonly subscriptionId: string;
    readonly broadcasterUserId: string;
  },
  error: unknown,
): TwitchStreamEnrichmentFailure {
  const identity = {
    eventSubMessageId: input.messageId,
    eventSubSubscriptionId: input.subscriptionId,
    broadcasterUserId: input.broadcasterUserId,
  };

  if (error instanceof StreamEnrichmentTimeoutError) {
    return { ...identity, reason: 'timeout' };
  }
  if (error instanceof TwitchApiError) {
    return {
      ...identity,
      reason: 'helix_error',
      status: error.status,
      retryable: error.retryable,
    };
  }
  return { ...identity, reason: 'unexpected_error' };
}

function parsePayload<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false; error: Error };
  },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new TwitchEventSubError(
      'The Twitch EventSub payload does not match the expected schema.',
      'invalid_eventsub_payload',
      400,
    );
  }
  return parsed.data;
}

function toSubscription(payload: EventSubSubscriptionPayload): TwitchEventSubSubscription {
  return {
    id: payload.id,
    status: payload.status,
    type: payload.type,
    version: payload.version,
    broadcasterUserId: payload.condition.broadcaster_user_id,
    callbackUrl: payload.transport.callback,
    createdAt: new Date(payload.created_at),
  };
}
