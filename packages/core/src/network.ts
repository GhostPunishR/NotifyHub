import type { SocialEvent } from './social-event.js';

export const NETWORK_IDS = ['twitch', 'kick', 'youtube', 'tiktok', 'x', 'bluesky'] as const;

export type NetworkId = (typeof NETWORK_IDS)[number];
export type NetworkStatus = 'planned' | 'experimental' | 'stable';
export type NetworkCapability = 'oauth' | 'webhook' | 'polling' | 'live' | 'video' | 'post';

export interface NetworkManifest {
  readonly id: NetworkId;
  readonly displayName: string;
  readonly version: string;
  readonly status: NetworkStatus;
  readonly capabilities: readonly NetworkCapability[];
}

export interface ModuleContext {
  readonly signal: AbortSignal;
}

export interface NetworkModule {
  readonly manifest: NetworkManifest;
  start(context: ModuleContext): Promise<void>;
  stop(): Promise<void>;
}

export interface SourceReference {
  readonly network: NetworkId;
  readonly externalId: string;
  readonly username: string;
  readonly displayName: string;
  readonly url: string;
  readonly avatarUrl?: string;
}

export interface SourceResolver {
  resolveSource(input: string): Promise<SourceReference>;
}

export interface WebhookRequest {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly rawBody: Uint8Array;
}

export interface WebhookProvider {
  registerWebhook(source: SourceReference): Promise<void>;
  unregisterWebhook(source: SourceReference): Promise<void>;
  handleWebhook(request: WebhookRequest): Promise<readonly SocialEvent[]>;
}

export interface PollingProvider {
  poll(source: SourceReference): Promise<readonly SocialEvent[]>;
}
