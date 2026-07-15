import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  type InteractionReplyOptions,
} from 'discord.js';
import { translate } from '@notifyhub/i18n';

const BRAND_COLOR = 0x5865f2;

function createContainer(title: string, lines: readonly string[]): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));

  if (lines.length > 0) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  }

  return container;
}

export function createPingMessage(input: {
  readonly locale: string;
  readonly latency: number;
  readonly moduleCount: number;
}): InteractionReplyOptions {
  return {
    components: [
      createContainer(translate(input.locale, 'commands.ping.title'), [
        translate(input.locale, 'commands.ping.latency', { latency: input.latency }),
        translate(input.locale, 'commands.ping.modules', { count: input.moduleCount }),
      ]),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function createAboutMessage(locale: string): InteractionReplyOptions {
  return {
    components: [
      createContainer(translate(locale, 'commands.about.title'), [
        translate(locale, 'commands.about.body'),
        translate(locale, 'commands.about.languages'),
        translate(locale, 'commands.about.license'),
      ]),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}
