import 'dotenv/config';
import { z } from 'zod';

const optionalSnowflake = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^\d{17,20}$/)
    .optional(),
);

const twitchCallbackUrl = z
  .string()
  .url('TWITCH_EVENTSUB_CALLBACK_URL must be a valid URL.')
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
          'TWITCH_EVENTSUB_CALLBACK_URL must use HTTPS on port 443 with the /webhooks/twitch/eventsub path and no credentials, query, or fragment.',
      });
    }
  });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required.'),
  DISCORD_CLIENT_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'DISCORD_CLIENT_ID must be a Discord snowflake.'),
  DISCORD_GUILD_ID: optionalSnowflake,
  TWITCH_CLIENT_ID: z.string().regex(/^[A-Za-z0-9]{1,100}$/, 'TWITCH_CLIENT_ID is malformed.'),
  TWITCH_CLIENT_SECRET: z.string().min(1, 'TWITCH_CLIENT_SECRET is required.'),
  TWITCH_EVENTSUB_SECRET: z
    .string()
    .regex(
      /^[\x20-\x7E]{10,100}$/,
      'TWITCH_EVENTSUB_SECRET must contain 10 to 100 printable ASCII characters.',
    ),
  TWITCH_EVENTSUB_CALLBACK_URL: twitchCallbackUrl,
  DEFAULT_LOCALE: z.enum(['en', 'fr']).default('en'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}
