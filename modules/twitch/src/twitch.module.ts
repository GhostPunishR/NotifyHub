import type {
  ModuleContext,
  NetworkManifest,
  NetworkModule,
  SourceReference,
  SourceResolver,
} from '@notifyhub/core';
import { TwitchAppTokenProvider } from './auth/app-token-provider.js';
import { TwitchChannelResolver } from './channels/channel-resolver.js';
import { TwitchHelixClient } from './client/helix-client.js';
import type { TwitchConfig } from './config.js';
import { TwitchEventSubHandler } from './eventsub/eventsub-handler.js';
import {
  TwitchEventSubSubscriptions,
  type TwitchEventSubSubscriptionManager,
} from './eventsub/eventsub-subscriptions.js';
import type {
  EventSubHandleResult,
  TwitchEventSubRequest,
  TwitchStreamEnrichmentFailure,
} from './eventsub/eventsub-types.js';
import { TwitchEventSubVerifier } from './eventsub/eventsub-verifier.js';

export const manifest = {
  id: 'twitch',
  displayName: 'Twitch',
  version: '0.1.0',
  status: 'experimental',
  capabilities: ['oauth', 'webhook', 'live'],
} as const satisfies NetworkManifest;

export interface TwitchModuleDependencies {
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly streamEnrichmentTimeoutMs?: number;
  readonly onStreamEnrichmentFailure?: (failure: TwitchStreamEnrichmentFailure) => void;
}

export class TwitchModule implements NetworkModule, SourceResolver {
  public readonly manifest = manifest;
  public readonly subscriptions: TwitchEventSubSubscriptionManager;
  readonly #channelResolver: TwitchChannelResolver;
  readonly #eventSubHandler: TwitchEventSubHandler;

  public constructor(config: TwitchConfig, dependencies: TwitchModuleDependencies = {}) {
    const tokenProvider = new TwitchAppTokenProvider({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      requestTimeoutMs: config.requestTimeoutMs,
      ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }),
      ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
    });
    const client = new TwitchHelixClient({
      clientId: config.clientId,
      tokenProvider,
      requestTimeoutMs: config.requestTimeoutMs,
      ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }),
    });

    this.#channelResolver = new TwitchChannelResolver(client);
    this.#eventSubHandler = new TwitchEventSubHandler(
      new TwitchEventSubVerifier({
        secret: config.eventSubSecret,
        ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      }),
      client,
      {
        ...(dependencies.streamEnrichmentTimeoutMs === undefined
          ? {}
          : { streamEnrichmentTimeoutMs: dependencies.streamEnrichmentTimeoutMs }),
        ...(dependencies.onStreamEnrichmentFailure === undefined
          ? {}
          : { onStreamEnrichmentFailure: dependencies.onStreamEnrichmentFailure }),
      },
    );
    this.subscriptions = new TwitchEventSubSubscriptions(
      client,
      config.eventSubCallbackUrl,
      config.eventSubSecret,
    );
  }

  public start(context: ModuleContext): Promise<void> {
    void context;
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public async resolveSource(input: string): Promise<SourceReference> {
    return this.#channelResolver.resolveSource(input);
  }

  public async handleEventSub(request: TwitchEventSubRequest): Promise<EventSubHandleResult> {
    return this.#eventSubHandler.handle(request);
  }
}

export function createTwitchModule(
  config: TwitchConfig,
  dependencies?: TwitchModuleDependencies,
): TwitchModule {
  return new TwitchModule(config, dependencies);
}
