import { TwitchAuthenticationError } from '../errors.js';
import { appTokenResponseSchema } from '../schemas/twitch-schemas.js';

export interface TwitchAccessToken {
  readonly value: string;
  readonly expiresAt: Date;
}

export interface AppTokenProviderOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch?: typeof fetch;
  readonly requestTimeoutMs?: number;
  readonly refreshSkewMs?: number;
  readonly now?: () => number;
}

export class TwitchAppTokenProvider {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #fetch: typeof fetch;
  readonly #requestTimeoutMs: number;
  readonly #refreshSkewMs: number;
  readonly #now: () => number;
  #cachedToken: TwitchAccessToken | undefined;
  #refreshPromise: Promise<TwitchAccessToken> | undefined;

  public constructor(options: AppTokenProviderOptions) {
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#fetch = options.fetch ?? fetch;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.#refreshSkewMs = options.refreshSkewMs ?? 60_000;
    this.#now = options.now ?? Date.now;
  }

  public async getToken(): Promise<TwitchAccessToken> {
    if (
      this.#cachedToken !== undefined &&
      this.#cachedToken.expiresAt.getTime() - this.#refreshSkewMs > this.#now()
    ) {
      return this.#cachedToken;
    }

    this.#refreshPromise ??= this.#requestToken().finally(() => {
      this.#refreshPromise = undefined;
    });

    this.#cachedToken = await this.#refreshPromise;
    return this.#cachedToken;
  }

  public invalidate(tokenValue?: string): void {
    if (tokenValue === undefined || this.#cachedToken?.value === tokenValue) {
      this.#cachedToken = undefined;
    }
  }

  async #requestToken(): Promise<TwitchAccessToken> {
    const url = new URL('https://id.twitch.tv/oauth2/token');
    const body = new URLSearchParams({
      client_id: this.#clientId,
      client_secret: this.#clientSecret,
      grant_type: 'client_credentials',
    });

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      });
    } catch {
      throw new TwitchAuthenticationError('The Twitch app token request failed.');
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new TwitchAuthenticationError(
        `The Twitch app token request returned HTTP ${String(response.status)}.`,
      );
    }

    const parsed = appTokenResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new TwitchAuthenticationError('The Twitch app token response was malformed.');
    }

    return {
      value: parsed.data.access_token,
      expiresAt: new Date(this.#now() + parsed.data.expires_in * 1_000),
    };
  }
}
