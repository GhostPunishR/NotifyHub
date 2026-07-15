import type { Environment } from '@notifyhub/config';
import type { NetworkModule } from '@notifyhub/core';
import { blueskyModule } from '@notifyhub/module-bluesky';
import { kickModule } from '@notifyhub/module-kick';
import { tiktokModule } from '@notifyhub/module-tiktok';
import {
  createTwitchConfig,
  createTwitchModule,
  type TwitchModule,
} from '@notifyhub/module-twitch';
import { xModule } from '@notifyhub/module-x';
import { youtubeModule } from '@notifyhub/module-youtube';

export interface ApplicationModules {
  readonly networkModules: readonly NetworkModule[];
  readonly twitch: TwitchModule;
}

export function createApplicationModules(environment: Environment): ApplicationModules {
  const twitch = createTwitchModule(
    createTwitchConfig({
      clientId: environment.TWITCH_CLIENT_ID,
      clientSecret: environment.TWITCH_CLIENT_SECRET,
      eventSubSecret: environment.TWITCH_EVENTSUB_SECRET,
      eventSubCallbackUrl: environment.TWITCH_EVENTSUB_CALLBACK_URL,
    }),
  );

  return {
    twitch,
    networkModules: [twitch, kickModule, youtubeModule, tiktokModule, xModule, blueskyModule],
  };
}
