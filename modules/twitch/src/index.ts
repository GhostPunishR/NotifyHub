import type { NetworkManifest, NetworkModule } from '@notifyhub/core';

export const manifest = {
  id: 'twitch',
  displayName: 'Twitch',
  version: '0.1.0',
  status: 'experimental',
  capabilities: ['oauth', 'webhook', 'live'],
} as const satisfies NetworkManifest;

export const twitchModule: NetworkModule = {
  manifest,
  async start(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
  async stop(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
};
