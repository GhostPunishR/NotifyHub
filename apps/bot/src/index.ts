import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { loadEnvironment } from '@notifyhub/config';
import { translate } from '@notifyhub/i18n';
import { createLogger } from '@notifyhub/logger';
import { commandMap, commands } from './commands.js';
import { startHealthServer, stopHealthServer } from './health-server.js';
import { networkModules } from './modules.js';

const environment = loadEnvironment();
const logger = createLogger({ level: environment.LOG_LEVEL, service: 'notifyhub-bot' });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const moduleAbortController = new AbortController();
let shuttingDown = false;

const healthServer = await startHealthServer({
  port: environment.PORT,
  isDiscordReady: () => client.isReady(),
  moduleCount: networkModules.length,
});

logger.info({ port: environment.PORT }, 'Health server started.');

client.once(Events.ClientReady, async (readyClient) => {
  if (readyClient.application.id !== environment.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID does not match the authenticated bot application.');
  }

  const commandPayloads = commands.map((command) => command.data.toJSON());

  if (environment.DISCORD_GUILD_ID) {
    await readyClient.application.commands.set(commandPayloads, environment.DISCORD_GUILD_ID);
  } else {
    await readyClient.application.commands.set(commandPayloads);
  }

  await Promise.all(
    networkModules.map((networkModule) =>
      networkModule.start({ signal: moduleAbortController.signal }),
    ),
  );

  logger.info(
    {
      user: readyClient.user.tag,
      modules: networkModules.map((networkModule) => networkModule.manifest.id),
      commandScope: environment.DISCORD_GUILD_ID ? 'guild' : 'global',
    },
    'NotifyHub is ready.',
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { moduleCount: networkModules.length });
  } catch (error) {
    logger.error({ error, command: interaction.commandName }, 'Command execution failed.');

    const payload = {
      content: translate(interaction.locale, 'common.unknownError'),
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started.');

  moduleAbortController.abort();
  await Promise.allSettled(networkModules.map((networkModule) => networkModule.stop()));
  await client.destroy();
  await stopHealthServer(healthServer);

  logger.info('Graceful shutdown completed.');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}

process.on('unhandledRejection', (error) => {
  logger.fatal({ error }, 'Unhandled promise rejection.');
  void shutdown('SIGTERM').finally(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception.');
  void shutdown('SIGTERM').finally(() => process.exit(1));
});

try {
  await client.login(environment.DISCORD_TOKEN);
} catch (error) {
  logger.fatal({ error }, 'Discord login failed.');
  await shutdown('SIGTERM');
  process.exit(1);
}
