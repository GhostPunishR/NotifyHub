import type { NetworkId } from './network.js';

export const SOCIAL_EVENT_TYPES = [
  'stream.started',
  'stream.ended',
  'stream.updated',
  'video.published',
  'video.premiere',
  'post.published',
] as const;

export type SocialEventType = (typeof SOCIAL_EVENT_TYPES)[number];

export interface SocialEvent {
  readonly id: string;
  readonly network: NetworkId;
  readonly type: SocialEventType;
  readonly source: {
    readonly externalId: string;
    readonly username: string;
    readonly displayName: string;
    readonly avatarUrl?: string;
  };
  readonly content: {
    readonly title?: string;
    readonly description?: string;
    readonly url: string;
    readonly thumbnailUrl?: string;
    readonly category?: string;
  };
  readonly occurredAt: Date;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}
