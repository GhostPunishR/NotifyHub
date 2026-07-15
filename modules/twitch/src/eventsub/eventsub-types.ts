import type { SocialEvent, WebhookRequest } from '@notifyhub/core';
import type { TwitchEventSubSubscription } from '../client/helix-types.js';

export type TwitchEventSubMessageType =
  'webhook_callback_verification' | 'notification' | 'revocation';

export interface VerifiedEventSubRequest {
  readonly messageId: string;
  readonly messageTimestamp: Date;
  readonly messageType: TwitchEventSubMessageType;
  readonly payload: unknown;
}

export type EventSubHandleResult =
  | {
      readonly type: 'verification';
      readonly challenge: string;
      readonly subscription: TwitchEventSubSubscription;
    }
  | {
      readonly type: 'notification';
      readonly event: SocialEvent;
      readonly subscription: TwitchEventSubSubscription;
    }
  | {
      readonly type: 'revocation';
      readonly subscription: TwitchEventSubSubscription;
    };

export type TwitchEventSubRequest = WebhookRequest;
