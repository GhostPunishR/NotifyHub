import 'dotenv/config';
import { z } from 'zod';

const optionalSnowflake = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^\d{17,20}$/)
    .optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required.'),
  DISCORD_CLIENT_ID: z
    .string()
    .regex(/^\d{17,20}$/, 'DISCORD_CLIENT_ID must be a Discord snowflake.'),
  DISCORD_GUILD_ID: optionalSnowflake,
  DEFAULT_LOCALE: z.enum(['en', 'fr']).default('en'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}
