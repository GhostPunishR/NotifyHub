import pino, { type Logger } from 'pino';

export interface LoggerOptions {
  readonly level: string;
  readonly service: string;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    level: options.level,
    base: {
      service: options.service,
      environment: process.env.NODE_ENV ?? 'development',
    },
    redact: {
      paths: [
        'token',
        '*.token',
        'accessToken',
        '*.accessToken',
        'refreshToken',
        '*.refreshToken',
        'authorization',
        '*.authorization',
        'clientSecret',
        '*.clientSecret',
        'eventSubSecret',
        '*.eventSubSecret',
        'signature',
        '*.signature',
      ],
      censor: '[REDACTED]',
    },
  });
}
