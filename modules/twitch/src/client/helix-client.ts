import type { ZodType } from 'zod';
import type { TwitchAppTokenProvider } from '../auth/app-token-provider.js';
import { TwitchApiError } from '../errors.js';
import {
  eventSubSubscriptionsResponseSchema,
  helixStreamResponseSchema,
  helixUserResponseSchema,
  twitchApiErrorSchema,
} from '../schemas/twitch-schemas.js';
import type {
  TwitchEventSubSubscription,
  TwitchEventSubSubscriptionPage,
  TwitchEventSubType,
  TwitchStream,
  TwitchUser,
} from './helix-types.js';

export interface TwitchHelixClientOptions {
  readonly clientId: string;
  readonly tokenProvider: TwitchAppTokenProvider;
  readonly fetch?: typeof fetch;
  readonly requestTimeoutMs?: number;
}

interface HelixRequestOptions<T> {
  readonly method?: 'GET' | 'POST' | 'DELETE';
  readonly query?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
  readonly expectedStatuses: readonly number[];
  readonly schema?: ZodType<T>;
}

export class TwitchHelixClient {
  readonly #clientId: string;
  readonly #tokenProvider: TwitchAppTokenProvider;
  readonly #fetch: typeof fetch;
  readonly #requestTimeoutMs: number;

  public constructor(options: TwitchHelixClientOptions) {
    this.#clientId = options.clientId;
    this.#tokenProvider = options.tokenProvider;
    this.#fetch = options.fetch ?? fetch;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  public async getUserByLogin(login: string): Promise<TwitchUser | null> {
    const response = await this.#request('/users', {
      query: { login },
      expectedStatuses: [200],
      schema: helixUserResponseSchema,
    });
    const user = response.data[0];

    return user === undefined
      ? null
      : {
          id: user.id,
          login: user.login,
          displayName: user.display_name,
          profileImageUrl: user.profile_image_url,
        };
  }

  public async getStreamByUserId(userId: string): Promise<TwitchStream | null> {
    const response = await this.#request('/streams', {
      query: { user_id: userId },
      expectedStatuses: [200],
      schema: helixStreamResponseSchema,
    });
    const stream = response.data[0];

    return stream === undefined
      ? null
      : {
          id: stream.id,
          userId: stream.user_id,
          userLogin: stream.user_login,
          userName: stream.user_name,
          title: stream.title,
          category: stream.game_name,
          thumbnailUrl: stream.thumbnail_url,
          startedAt: new Date(stream.started_at),
        };
  }

  public async listEventSubSubscriptions(
    type: TwitchEventSubType,
    cursor?: string,
  ): Promise<TwitchEventSubSubscriptionPage> {
    const response = await this.#request('/eventsub/subscriptions', {
      query: { type, after: cursor },
      expectedStatuses: [200],
      schema: eventSubSubscriptionsResponseSchema,
    });

    return {
      subscriptions: response.data.map(toEventSubSubscription),
      ...(response.pagination?.cursor === undefined ? {} : { cursor: response.pagination.cursor }),
    };
  }

  public async createEventSubSubscription(input: {
    readonly type: TwitchEventSubType;
    readonly broadcasterUserId: string;
    readonly callbackUrl: string;
    readonly secret: string;
  }): Promise<TwitchEventSubSubscription> {
    const response = await this.#request('/eventsub/subscriptions', {
      method: 'POST',
      body: {
        type: input.type,
        version: '1',
        condition: { broadcaster_user_id: input.broadcasterUserId },
        transport: {
          method: 'webhook',
          callback: input.callbackUrl,
          secret: input.secret,
        },
      },
      expectedStatuses: [202],
      schema: eventSubSubscriptionsResponseSchema,
    });
    const subscription = response.data[0];

    if (subscription === undefined) {
      throw new TwitchApiError(
        'Twitch accepted the EventSub subscription without returning it.',
        202,
        false,
        {},
      );
    }

    return toEventSubSubscription(subscription);
  }

  public async deleteEventSubSubscription(subscriptionId: string): Promise<void> {
    await this.#request('/eventsub/subscriptions', {
      method: 'DELETE',
      query: { id: subscriptionId },
      expectedStatuses: [204],
    });
  }

  async #request<T>(path: string, options: HelixRequestOptions<T>): Promise<T> {
    const firstToken = await this.#tokenProvider.getToken();
    const firstResponse = await this.#send(path, options, firstToken.value);

    if (firstResponse.status !== 401) {
      return this.#parseResponse(firstResponse, options);
    }

    await firstResponse.body?.cancel();
    this.#tokenProvider.invalidate(firstToken.value);
    const refreshedToken = await this.#tokenProvider.getToken();
    const secondResponse = await this.#send(path, options, refreshedToken.value);
    return this.#parseResponse(secondResponse, options);
  }

  async #send<T>(
    path: string,
    options: HelixRequestOptions<T>,
    accessToken: string,
  ): Promise<Response> {
    const url = new URL(path.replace(/^\//, ''), 'https://api.twitch.tv/helix/');
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    try {
      return await this.#fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.#clientId,
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      });
    } catch (error) {
      throw new TwitchApiError('The Twitch Helix request failed.', 0, true, {}, { cause: error });
    }
  }

  async #parseResponse<T>(response: Response, options: HelixRequestOptions<T>): Promise<T> {
    const limit = parseIntegerHeader(response.headers.get('ratelimit-limit'));
    const remaining = parseIntegerHeader(response.headers.get('ratelimit-remaining'));
    const resetAt = parseResetHeader(response.headers.get('ratelimit-reset'));
    const rateLimit = {
      ...(limit === undefined ? {} : { limit }),
      ...(remaining === undefined ? {} : { remaining }),
      ...(resetAt === undefined ? {} : { resetAt }),
    };

    if (!options.expectedStatuses.includes(response.status)) {
      const payload: unknown = await response.json().catch(() => undefined);
      const apiError = twitchApiErrorSchema.safeParse(payload);
      const apiMessage = apiError.success ? apiError.data.message : undefined;
      const statusDescription = describeStatus(response.status);
      const message = apiMessage
        ? `${statusDescription}: ${apiMessage.slice(0, 200)}`
        : statusDescription;

      throw new TwitchApiError(
        message,
        response.status,
        response.status === 429 || response.status >= 500,
        rateLimit,
      );
    }

    if (options.schema === undefined) return undefined as T;

    const payload: unknown = await response.json().catch(() => undefined);
    const parsed = options.schema.safeParse(payload);
    if (!parsed.success) {
      throw new TwitchApiError(
        'Twitch returned a malformed Helix response.',
        response.status,
        false,
        rateLimit,
      );
    }

    return parsed.data;
  }
}

function parseIntegerHeader(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function parseResetHeader(value: string | null): Date | undefined {
  const seconds = parseIntegerHeader(value);
  return seconds === undefined ? undefined : new Date(seconds * 1_000);
}

function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Twitch rejected the refreshed app access token (HTTP 401)';
    case 403:
      return 'Twitch denied the Helix request (HTTP 403)';
    case 404:
      return 'The Twitch Helix resource was not found (HTTP 404)';
    case 429:
      return 'The Twitch Helix rate limit was exceeded (HTTP 429)';
    default:
      return status >= 500
        ? `Twitch Helix is unavailable (HTTP ${String(status)})`
        : `The Twitch Helix request failed (HTTP ${String(status)})`;
  }
}

function toEventSubSubscription(subscription: {
  readonly id: string;
  readonly status: string;
  readonly type: TwitchEventSubType;
  readonly version: string;
  readonly condition: { readonly broadcaster_user_id: string };
  readonly transport: { readonly callback: string };
  readonly created_at: string;
}): TwitchEventSubSubscription {
  return {
    id: subscription.id,
    status: subscription.status,
    type: subscription.type,
    version: subscription.version,
    broadcasterUserId: subscription.condition.broadcaster_user_id,
    callbackUrl: subscription.transport.callback,
    createdAt: new Date(subscription.created_at),
  };
}
