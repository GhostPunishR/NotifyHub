import type { SocialEvent } from '@notifyhub/core';
import type { ChannelUpdateEventPayload } from '../schemas/twitch-schemas.js';

export function normalizeChannelUpdate(input: {
  readonly messageId: string;
  readonly messageTimestamp: Date;
  readonly subscriptionId: string;
  readonly event: ChannelUpdateEventPayload;
}): SocialEvent {
  return {
    id: `twitch:eventsub:${input.messageId}`,
    network: 'twitch',
    type: 'stream.updated',
    source: {
      externalId: input.event.broadcaster_user_id,
      username: input.event.broadcaster_user_login,
      displayName: input.event.broadcaster_user_name,
    },
    content: {
      title: input.event.title,
      category: input.event.category_name,
      url: `https://www.twitch.tv/${input.event.broadcaster_user_login}`,
    },
    occurredAt: input.messageTimestamp,
    metadata: {
      eventSubMessageId: input.messageId,
      eventSubSubscriptionId: input.subscriptionId,
      categoryId: input.event.category_id,
      language: input.event.language,
    },
  };
}
