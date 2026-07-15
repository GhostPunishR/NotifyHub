import type { SocialEvent } from '@notifyhub/core';
import type { TwitchStream } from '../client/helix-types.js';
import type { StreamOnlineEventPayload } from '../schemas/twitch-schemas.js';

export function normalizeStreamOnline(input: {
  readonly messageId: string;
  readonly subscriptionId: string;
  readonly event: StreamOnlineEventPayload;
  readonly stream: TwitchStream | null;
}): SocialEvent {
  const stream = input.stream;

  return {
    id: `twitch:eventsub:${input.messageId}`,
    network: 'twitch',
    type: 'stream.started',
    source: {
      externalId: input.event.broadcaster_user_id,
      username: input.event.broadcaster_user_login,
      displayName: input.event.broadcaster_user_name,
    },
    content: {
      url: `https://www.twitch.tv/${input.event.broadcaster_user_login}`,
      ...(stream?.title ? { title: stream.title } : {}),
      ...(stream?.category ? { category: stream.category } : {}),
      ...(stream?.thumbnailUrl ? { thumbnailUrl: renderThumbnailUrl(stream.thumbnailUrl) } : {}),
    },
    occurredAt: new Date(input.event.started_at),
    metadata: {
      eventSubMessageId: input.messageId,
      eventSubSubscriptionId: input.subscriptionId,
      streamId: input.event.id,
      streamType: input.event.type,
    },
  };
}

function renderThumbnailUrl(template: string): string {
  return template.replace('{width}', '1280').replace('{height}', '720');
}
