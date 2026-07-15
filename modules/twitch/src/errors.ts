export type TwitchErrorCode =
  | 'authentication_failed'
  | 'channel_not_found'
  | 'invalid_channel_input'
  | 'invalid_eventsub_headers'
  | 'invalid_eventsub_json'
  | 'invalid_eventsub_payload'
  | 'invalid_eventsub_signature'
  | 'stale_eventsub_message'
  | 'twitch_api_error'
  | 'twitch_rate_limited';

export class TwitchError extends Error {
  public constructor(
    message: string,
    public readonly code: TwitchErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'TwitchError';
  }
}

export interface TwitchRateLimit {
  readonly limit?: number;
  readonly remaining?: number;
  readonly resetAt?: Date;
}

export class TwitchApiError extends TwitchError {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly rateLimit: TwitchRateLimit,
    options?: ErrorOptions,
  ) {
    super(message, status === 429 ? 'twitch_rate_limited' : 'twitch_api_error', options);
    this.name = 'TwitchApiError';
  }
}

export class TwitchAuthenticationError extends TwitchError {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, 'authentication_failed', options);
    this.name = 'TwitchAuthenticationError';
  }
}

export class TwitchChannelInputError extends TwitchError {
  public constructor(message: string) {
    super(message, 'invalid_channel_input');
    this.name = 'TwitchChannelInputError';
  }
}

export class TwitchChannelNotFoundError extends TwitchError {
  public constructor(public readonly login: string) {
    super(`The Twitch channel "${login}" was not found.`, 'channel_not_found');
    this.name = 'TwitchChannelNotFoundError';
  }
}

export class TwitchEventSubError extends TwitchError {
  public constructor(
    message: string,
    code:
      | 'invalid_eventsub_headers'
      | 'invalid_eventsub_json'
      | 'invalid_eventsub_payload'
      | 'invalid_eventsub_signature'
      | 'stale_eventsub_message',
    public readonly httpStatus: 400 | 403,
    options?: ErrorOptions,
  ) {
    super(message, code, options);
    this.name = 'TwitchEventSubError';
  }
}
