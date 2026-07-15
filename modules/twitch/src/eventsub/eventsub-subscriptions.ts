import type { TwitchHelixClient } from '../client/helix-client.js';
import type { TwitchEventSubSubscription, TwitchEventSubType } from '../client/helix-types.js';

export interface TwitchEventSubSubscriptionManager {
  ensureSubscription(
    type: TwitchEventSubType,
    broadcasterUserId: string,
  ): Promise<TwitchEventSubSubscription>;
  deleteSubscription(subscriptionId: string): Promise<void>;
}

export class TwitchEventSubSubscriptions implements TwitchEventSubSubscriptionManager {
  public constructor(
    private readonly client: TwitchHelixClient,
    private readonly callbackUrl: string,
    private readonly secret: string,
  ) {}

  public async ensureSubscription(
    type: TwitchEventSubType,
    broadcasterUserId: string,
  ): Promise<TwitchEventSubSubscription> {
    const subscriptions = await this.client.listEventSubSubscriptions(type);
    const existing = subscriptions.find(
      (subscription) =>
        subscription.broadcasterUserId === broadcasterUserId &&
        subscription.callbackUrl === this.callbackUrl &&
        subscription.status === 'enabled',
    );

    return (
      existing ??
      this.client.createEventSubSubscription({
        type,
        broadcasterUserId,
        callbackUrl: this.callbackUrl,
        secret: this.secret,
      })
    );
  }

  public async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.client.deleteEventSubSubscription(subscriptionId);
  }
}
