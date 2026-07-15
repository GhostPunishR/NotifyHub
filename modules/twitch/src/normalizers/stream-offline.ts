import type { SocialEvent } from '@notifyhub/core';
import type { StreamOfflineEventPayload } from '../schemas/twitch-schemas.js';

export function normalizeStreamOffline(input: {
  readonly messageId: string;
  readonly messageTimestamp: Date;
  readonly subscriptionId: string;
  readonly event: StreamOfflineEventPayload;
}): SocialEvent {
  return {
    id: `twitch:eventsub:${input.messageId}`,
    network: 'twitch',
    type: 'stream.ended',
    source: {
      externalId: input.event.broadcaster_user_id,
      username: input.event.broadcaster_user_login,
      displayName: input.event.broadcaster_user_name,
    },
    content: {
      url: `https://www.twitch.tv/${input.event.broadcaster_user_login}`,
    },
    occurredAt: input.messageTimestamp,
    metadata: {
      eventSubMessageId: input.messageId,
      eventSubSubscriptionId: input.subscriptionId,
    },
  };
}
