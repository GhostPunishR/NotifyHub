export interface TwitchUser {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly profileImageUrl: string;
}

export interface TwitchStream {
  readonly id: string;
  readonly userId: string;
  readonly userLogin: string;
  readonly userName: string;
  readonly title: string;
  readonly category: string;
  readonly thumbnailUrl: string;
  readonly startedAt: Date;
}

export const TWITCH_EVENTSUB_TYPES = ['stream.online', 'stream.offline', 'channel.update'] as const;

export type TwitchEventSubType = (typeof TWITCH_EVENTSUB_TYPES)[number];

export interface TwitchEventSubSubscription {
  readonly id: string;
  readonly status: string;
  readonly type: TwitchEventSubType;
  readonly version: string;
  readonly broadcasterUserId: string;
  readonly callbackUrl: string;
  readonly createdAt: Date;
}

export interface TwitchEventSubSubscriptionPage {
  readonly subscriptions: readonly TwitchEventSubSubscription[];
  readonly cursor?: string;
}
