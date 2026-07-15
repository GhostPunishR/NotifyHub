import { createHmac, timingSafeEqual } from 'node:crypto';
import { TwitchEventSubError } from '../errors.js';
import type {
  TwitchEventSubMessageType,
  TwitchEventSubRequest,
  VerifiedEventSubRequest,
} from './eventsub-types.js';

const MESSAGE_ID_HEADER = 'twitch-eventsub-message-id';
const MESSAGE_TIMESTAMP_HEADER = 'twitch-eventsub-message-timestamp';
const MESSAGE_SIGNATURE_HEADER = 'twitch-eventsub-message-signature';
const MESSAGE_TYPE_HEADER = 'twitch-eventsub-message-type';
const MESSAGE_TYPES: readonly TwitchEventSubMessageType[] = [
  'webhook_callback_verification',
  'notification',
  'revocation',
];

export interface EventSubVerifierOptions {
  readonly secret: string;
  readonly now?: () => number;
  readonly maximumAgeMs?: number;
  readonly maximumFutureSkewMs?: number;
}

export class TwitchEventSubVerifier {
  readonly #secret: string;
  readonly #now: () => number;
  readonly #maximumAgeMs: number;
  readonly #maximumFutureSkewMs: number;

  public constructor(options: EventSubVerifierOptions) {
    this.#secret = options.secret;
    this.#now = options.now ?? Date.now;
    this.#maximumAgeMs = options.maximumAgeMs ?? 10 * 60 * 1_000;
    this.#maximumFutureSkewMs = options.maximumFutureSkewMs ?? 60 * 1_000;
  }

  public verify(request: TwitchEventSubRequest): VerifiedEventSubRequest {
    const messageId = getRequiredHeader(request.headers, MESSAGE_ID_HEADER);
    const timestampValue = getRequiredHeader(request.headers, MESSAGE_TIMESTAMP_HEADER);
    const signatureValue = getRequiredHeader(request.headers, MESSAGE_SIGNATURE_HEADER);
    const messageTypeValue = getRequiredHeader(request.headers, MESSAGE_TYPE_HEADER);

    if (!MESSAGE_TYPES.includes(messageTypeValue as TwitchEventSubMessageType)) {
      throw new TwitchEventSubError(
        'The Twitch EventSub message type is unsupported.',
        'invalid_eventsub_headers',
        400,
      );
    }

    const timestamp = new Date(timestampValue);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        timestampValue,
      ) ||
      !Number.isFinite(timestamp.getTime())
    ) {
      throw new TwitchEventSubError(
        'The Twitch EventSub timestamp is malformed.',
        'invalid_eventsub_headers',
        400,
      );
    }

    const ageMs = this.#now() - timestamp.getTime();
    if (ageMs > this.#maximumAgeMs || ageMs < -this.#maximumFutureSkewMs) {
      throw new TwitchEventSubError(
        'The Twitch EventSub message timestamp is outside the accepted window.',
        'stale_eventsub_message',
        403,
      );
    }

    if (!/^sha256=[a-f0-9]{64}$/.test(signatureValue)) {
      throwInvalidSignature();
    }

    const expected = createHmac('sha256', this.#secret)
      .update(messageId)
      .update(timestampValue)
      .update(request.rawBody)
      .digest();
    const received = Buffer.from(signatureValue.slice('sha256='.length), 'hex');

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throwInvalidSignature();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(request.rawBody)) as unknown;
    } catch (error) {
      throw new TwitchEventSubError(
        'The Twitch EventSub request body is not valid JSON.',
        'invalid_eventsub_json',
        400,
        { cause: error },
      );
    }

    return {
      messageId,
      messageTimestamp: timestamp,
      messageType: messageTypeValue as TwitchEventSubMessageType,
      payload,
    };
  }
}

function getRequiredHeader(
  headers: TwitchEventSubRequest['headers'],
  expectedName: string,
): string {
  const matches = Object.entries(headers).filter(
    ([name, value]) => name.toLowerCase() === expectedName && value !== undefined,
  );

  if (matches.length !== 1) {
    throwInvalidHeaders(expectedName);
  }

  const value = matches[0]?.[1];
  if (typeof value !== 'string' || value.length === 0) {
    throwInvalidHeaders(expectedName);
  }

  return value;
}

function throwInvalidHeaders(name: string): never {
  throw new TwitchEventSubError(
    `The required Twitch EventSub header "${name}" is missing or duplicated.`,
    'invalid_eventsub_headers',
    400,
  );
}

function throwInvalidSignature(): never {
  throw new TwitchEventSubError(
    'The Twitch EventSub signature is invalid.',
    'invalid_eventsub_signature',
    403,
  );
}
