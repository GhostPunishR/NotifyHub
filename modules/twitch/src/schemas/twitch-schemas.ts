import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const isoTimestamp = z.iso.datetime({ offset: true });

export const appTokenResponseSchema = z.object({
  access_token: nonEmptyString,
  expires_in: z.number().int().positive(),
  token_type: z.literal('bearer'),
});

export const twitchApiErrorSchema = z.object({
  error: z.string().optional(),
  status: z.number().int().optional(),
  message: z.string().optional(),
});

export const helixUserResponseSchema = z.object({
  data: z.array(
    z.object({
      id: nonEmptyString,
      login: nonEmptyString,
      display_name: nonEmptyString,
      profile_image_url: z.string().url(),
    }),
  ),
});

export const helixStreamResponseSchema = z.object({
  data: z.array(
    z.object({
      id: nonEmptyString,
      user_id: nonEmptyString,
      user_login: nonEmptyString,
      user_name: nonEmptyString,
      game_name: z.string(),
      title: z.string(),
      started_at: isoTimestamp,
      thumbnail_url: z.string().url(),
    }),
  ),
});

const eventSubTransportSchema = z.object({
  method: z.literal('webhook'),
  callback: z.string().url(),
});

export const eventSubSubscriptionSchema = z.object({
  id: nonEmptyString,
  status: nonEmptyString,
  type: z.enum(['stream.online', 'stream.offline', 'channel.update']),
  version: nonEmptyString,
  condition: z.object({ broadcaster_user_id: nonEmptyString }),
  transport: eventSubTransportSchema,
  created_at: isoTimestamp,
  cost: z.number().int().nonnegative(),
});

export const eventSubSubscriptionsResponseSchema = z.object({
  data: z.array(eventSubSubscriptionSchema),
});

export const eventSubVerificationSchema = z.object({
  challenge: z.string(),
  subscription: eventSubSubscriptionSchema,
});

export const eventSubRevocationSchema = z.object({
  subscription: eventSubSubscriptionSchema,
});

const broadcasterSchema = z.object({
  broadcaster_user_id: nonEmptyString,
  broadcaster_user_login: nonEmptyString,
  broadcaster_user_name: nonEmptyString,
});

export const streamOnlineEventSchema = broadcasterSchema.extend({
  id: nonEmptyString,
  type: z.string(),
  started_at: isoTimestamp,
});

export const streamOfflineEventSchema = broadcasterSchema;

export const channelUpdateEventSchema = broadcasterSchema.extend({
  title: z.string(),
  language: z.string(),
  category_id: z.string(),
  category_name: z.string(),
  content_classification_labels: z.array(z.string()).optional(),
});

export const eventSubNotificationEnvelopeSchema = z.object({
  subscription: eventSubSubscriptionSchema,
  event: z.unknown(),
});

export type AppTokenResponse = z.infer<typeof appTokenResponseSchema>;
export type EventSubSubscriptionPayload = z.infer<typeof eventSubSubscriptionSchema>;
export type StreamOnlineEventPayload = z.infer<typeof streamOnlineEventSchema>;
export type StreamOfflineEventPayload = z.infer<typeof streamOfflineEventSchema>;
export type ChannelUpdateEventPayload = z.infer<typeof channelUpdateEventSchema>;
