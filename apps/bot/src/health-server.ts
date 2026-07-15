import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface HealthServerOptions {
  readonly port: number;
  readonly isDiscordReady: () => boolean;
  readonly moduleCount: number;
  readonly twitchEventSubRoute?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<boolean>;
}

export async function startHealthServer(options: HealthServerOptions): Promise<Server> {
  const server = createServer((request, response) => {
    void handleRequest(request, response, options);
  });

  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    serverOptions: HealthServerOptions,
  ): Promise<void> {
    if (
      serverOptions.twitchEventSubRoute &&
      (await serverOptions.twitchEventSubRoute(request, response))
    ) {
      return;
    }

    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (request.url === '/health') {
      const discordReady = serverOptions.isDiscordReady();
      response.statusCode = discordReady ? 200 : 503;
      response.end(
        JSON.stringify({
          status: 'ok',
          discordReady,
          modules: serverOptions.moduleCount,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (request.url === '/') {
      response.statusCode = 200;
      response.end(JSON.stringify({ name: 'NotifyHub', status: 'running' }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return server;
}

export async function stopHealthServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
