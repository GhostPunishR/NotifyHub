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

export interface TwitchStreamEnrichmentFailure {
  readonly eventSubMessageId: string;
  readonly eventSubSubscriptionId: string;
  readonly broadcasterUserId: string;
  readonly reason: 'timeout' | 'helix_error' | 'unexpected_error';
  readonly status?: number;
  readonly retryable?: boolean;
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
