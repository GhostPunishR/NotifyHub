import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { createAboutMessage, createPingMessage } from '@notifyhub/discord-ui';
import { translate } from '@notifyhub/i18n';

export interface CommandContext {
  readonly moduleCount: number;
}

export interface NotifyHubCommand {
  readonly data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
}

const pingCommand: NotifyHubCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription(translate('en', 'commands.ping.description'))
    .setDescriptionLocalizations({ fr: translate('fr', 'commands.ping.description') }),
  async execute(interaction, context) {
    await interaction.reply(
      createPingMessage({
        locale: interaction.locale,
        latency: Math.max(0, Math.round(interaction.client.ws.ping)),
        moduleCount: context.moduleCount,
      }),
    );
  },
};

const aboutCommand: NotifyHubCommand = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription(translate('en', 'commands.about.description'))
    .setDescriptionLocalizations({ fr: translate('fr', 'commands.about.description') }),
  async execute(interaction) {
    await interaction.reply(createAboutMessage(interaction.locale));
  },
};

export const commands: readonly NotifyHubCommand[] = [pingCommand, aboutCommand];
export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
