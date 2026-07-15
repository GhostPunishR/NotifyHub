import type { TwitchHelixClient } from '../client/helix-client.js';
import type { TwitchEventSubSubscription, TwitchEventSubType } from '../client/helix-types.js';
import { TwitchApiError } from '../errors.js';

const MAXIMUM_SUBSCRIPTION_PAGES = 100;
const REUSABLE_SUBSCRIPTION_STATUSES = new Set([
  'enabled',
  'webhook_callback_verification_pending',
]);

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
    const cursors = new Set<string>();
    let cursor: string | undefined;

    for (let pageNumber = 0; pageNumber < MAXIMUM_SUBSCRIPTION_PAGES; pageNumber += 1) {
      const page = await this.client.listEventSubSubscriptions(type, cursor);
      const existing = page.subscriptions.find(
        (subscription) =>
          subscription.type === type &&
          subscription.broadcasterUserId === broadcasterUserId &&
          subscription.callbackUrl === this.callbackUrl &&
          REUSABLE_SUBSCRIPTION_STATUSES.has(subscription.status),
      );

      if (existing !== undefined) return existing;
      if (page.cursor === undefined) {
        return this.client.createEventSubSubscription({
          type,
          broadcasterUserId,
          callbackUrl: this.callbackUrl,
          secret: this.secret,
        });
      }

      if (cursors.has(page.cursor)) {
        throw paginationError('Twitch returned a repeated EventSub pagination cursor.');
      }
      cursors.add(page.cursor);
      cursor = page.cursor;
    }

    throw paginationError('Twitch exceeded the EventSub subscription pagination limit.');
  }

  public async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.client.deleteEventSubSubscription(subscriptionId);
  }
}

function paginationError(message: string): TwitchApiError {
  return new TwitchApiError(message, 200, false, {});
}
