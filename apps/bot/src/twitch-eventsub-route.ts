import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SocialEvent } from '@notifyhub/core';
import { TwitchEventSubError, type TwitchModule } from '@notifyhub/module-twitch';

const MAXIMUM_BODY_BYTES = 1_048_576;

export interface TwitchEventSubRouteOptions {
  readonly twitch: TwitchModule;
  readonly onEvent: (event: SocialEvent) => Promise<void>;
  readonly onRevocation: (subscription: {
    readonly id: string;
    readonly type: string;
    readonly status: string;
  }) => Promise<void>;
  readonly onError: (error: unknown) => void;
}

export type TwitchEventSubRoute = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<boolean>;

export function createTwitchEventSubRoute(
  options: TwitchEventSubRouteOptions,
): TwitchEventSubRoute {
  return async (request, response) => {
    if (request.url !== '/webhooks/twitch/eventsub') return false;

    response.setHeader('cache-control', 'no-store');
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.setHeader('allow', 'POST');
      response.end();
      return true;
    }

    try {
      const rawBody = await readBody(request);
      const result = await options.twitch.handleEventSub({
        headers: normalizeHeaders(request),
        rawBody,
      });

      switch (result.type) {
        case 'verification':
          response.statusCode = 200;
          response.setHeader('content-type', 'text/plain; charset=utf-8');
          response.end(result.challenge);
          break;
        case 'notification':
          await options.onEvent(result.event);
          response.statusCode = 204;
          response.end();
          break;
        case 'revocation':
          await options.onRevocation(result.subscription);
          response.statusCode = 204;
          response.end();
          break;
      }
    } catch (error) {
      options.onError(error);
      response.statusCode = error instanceof TwitchEventSubError ? error.httpStatus : 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Twitch EventSub request rejected' }));
    }

    return true;
  };
}

async function readBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAXIMUM_BODY_BYTES) {
      throw new TwitchEventSubError(
        'The Twitch EventSub request body is too large.',
        'invalid_eventsub_payload',
        400,
      );
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function normalizeHeaders(
  request: IncomingMessage,
): Readonly<Record<string, string | readonly string[] | undefined>> {
  return Object.fromEntries(
    Object.entries(request.headersDistinct).map(([name, values]) => [
      name,
      values === undefined || values.length !== 1 ? values : values[0],
    ]),
  );
}
