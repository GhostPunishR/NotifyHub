import type { NetworkManifest, NetworkModule } from '@notifyhub/core';

export const manifest = {
  id: 'tiktok',
  displayName: 'TikTok',
  version: '0.1.0',
  status: 'planned',
  capabilities: ['oauth', 'webhook', 'polling', 'live', 'video'],
} as const satisfies NetworkManifest;

export const tiktokModule: NetworkModule = {
  manifest,
  async start(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
  async stop(): Promise<void> {
    // Provider lifecycle implementation will be added with the integration.
  },
};
