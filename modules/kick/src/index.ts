import type { NetworkManifest, NetworkModule } from '@notifyhub/core';

export const manifest = {
  id: 'kick',
  displayName: 'Kick',
  version: '0.1.0',
  status: 'planned',
  capabilities: ['polling', 'live'],
} as const satisfies NetworkManifest;

export const kickModule: NetworkModule = {
  manifest,
  async start(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
  async stop(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
};
