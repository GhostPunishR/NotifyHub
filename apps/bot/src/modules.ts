import type { NetworkModule } from '@notifyhub/core';
import { blueskyModule } from '@notifyhub/module-bluesky';
import { kickModule } from '@notifyhub/module-kick';
import { tiktokModule } from '@notifyhub/module-tiktok';
import { twitchModule } from '@notifyhub/module-twitch';
import { xModule } from '@notifyhub/module-x';
import { youtubeModule } from '@notifyhub/module-youtube';

export const networkModules: readonly NetworkModule[] = [
  twitchModule,
  kickModule,
  youtubeModule,
  tiktokModule,
  xModule,
  blueskyModule,
];
