export type { TwitchEventSubSubscription, TwitchEventSubType } from './client/helix-types.js';
export { createTwitchConfig, type TwitchConfig } from './config.js';
export {
  TwitchApiError,
  TwitchAuthenticationError,
  TwitchChannelInputError,
  TwitchChannelNotFoundError,
  TwitchError,
  TwitchEventSubError,
} from './errors.js';
export type { TwitchEventSubSubscriptionManager } from './eventsub/eventsub-subscriptions.js';
export type {
  EventSubHandleResult,
  TwitchEventSubRequest,
  TwitchStreamEnrichmentFailure,
} from './eventsub/eventsub-types.js';
export {
  createTwitchModule,
  manifest,
  TwitchModule,
  type TwitchModuleDependencies,
} from './twitch.module.js';
