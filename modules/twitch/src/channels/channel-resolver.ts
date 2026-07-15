import type { SourceReference, SourceResolver } from '@notifyhub/core';
import type { TwitchHelixClient } from '../client/helix-client.js';
import { TwitchChannelInputError, TwitchChannelNotFoundError } from '../errors.js';

const TWITCH_LOGIN_PATTERN = /^[A-Za-z0-9_]{4,25}$/;

export class TwitchChannelResolver implements SourceResolver {
  public constructor(private readonly client: TwitchHelixClient) {}

  public async resolveSource(input: string): Promise<SourceReference> {
    const login = parseTwitchLogin(input);
    const user = await this.client.getUserByLogin(login);

    if (user === null) throw new TwitchChannelNotFoundError(login);

    return {
      network: 'twitch',
      externalId: user.id,
      username: user.login,
      displayName: user.displayName,
      avatarUrl: user.profileImageUrl,
      url: `https://www.twitch.tv/${user.login}`,
    };
  }
}

export function parseTwitchLogin(input: string): string {
  const trimmed = input.trim();
  let login = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new TwitchChannelInputError('The Twitch channel URL is malformed.');
    }

    if (
      url.protocol !== 'https:' ||
      !['twitch.tv', 'www.twitch.tv'].includes(url.hostname.toLowerCase()) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.port.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      throw new TwitchChannelInputError('Only canonical HTTPS Twitch channel URLs are supported.');
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) {
      throw new TwitchChannelInputError('The Twitch URL must point directly to a channel.');
    }
    login = segments[0] ?? '';
  }

  if (!TWITCH_LOGIN_PATTERN.test(login)) {
    throw new TwitchChannelInputError('The Twitch channel login is malformed.');
  }

  return login.toLowerCase();
}
