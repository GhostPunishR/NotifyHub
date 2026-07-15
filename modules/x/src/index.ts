import type { NetworkManifest, NetworkModule } from '@notifyhub/core';

export const manifest = {
  id: 'x',
  displayName: 'X',
  version: '0.1.0',
  status: 'planned',
  capabilities: ['oauth', 'polling', 'post'],
} as const satisfies NetworkManifest;

export const xModule: NetworkModule = {
  manifest,
  async start(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
  async stop(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
};
