import type { TwitchHelixClient } from '../client/helix-client.js';
import type { TwitchEventSubSubscription } from '../client/helix-types.js';
import { TwitchEventSubError } from '../errors.js';
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
import type { EventSubHandleResult, TwitchEventSubRequest } from './eventsub-types.js';
import type { TwitchEventSubVerifier } from './eventsub-verifier.js';

export class TwitchEventSubHandler {
  public constructor(
    private readonly verifier: TwitchEventSubVerifier,
    private readonly client: TwitchHelixClient,
  ) {}

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
            const stream = await this.client.getStreamByUserId(event.broadcaster_user_id);
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
