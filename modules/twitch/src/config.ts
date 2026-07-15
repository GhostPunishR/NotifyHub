import { z } from 'zod';

const callbackUrlSchema = z
  .string()
  .url('The Twitch EventSub callback URL is malformed.')
  .superRefine((value, context) => {
    const url = new URL(value);

    if (
      url.protocol !== 'https:' ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.hash.length > 0 ||
      url.search.length > 0 ||
      url.pathname !== '/webhooks/twitch/eventsub' ||
      (url.port.length > 0 && url.port !== '443')
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'The Twitch EventSub callback URL must use HTTPS on port 443 with the expected webhook path.',
      });
    }
  });

const twitchConfigSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9]{1,100}$/, 'The Twitch client ID is malformed.'),
  clientSecret: z.string().min(1, 'The Twitch client secret is required.'),
  eventSubSecret: z
    .string()
    .regex(
      /^[\x20-\x7E]{10,100}$/,
      'The Twitch EventSub secret must contain 10 to 100 printable ASCII characters.',
    ),
  eventSubCallbackUrl: callbackUrlSchema,
  requestTimeoutMs: z.number().int().min(100).max(30_000).default(10_000),
});

export interface TwitchConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly eventSubSecret: string;
  readonly eventSubCallbackUrl: string;
  readonly requestTimeoutMs: number;
}

export function createTwitchConfig(input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly eventSubSecret: string;
  readonly eventSubCallbackUrl: string;
  readonly requestTimeoutMs?: number;
}): TwitchConfig {
  return twitchConfigSchema.parse(input);
}
