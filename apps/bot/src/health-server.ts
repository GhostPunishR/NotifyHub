import { createServer, type Server } from 'node:http';

export interface HealthServerOptions {
  readonly port: number;
  readonly isDiscordReady: () => boolean;
  readonly moduleCount: number;
}

export async function startHealthServer(options: HealthServerOptions): Promise<Server> {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (request.url === '/health') {
      const discordReady = options.isDiscordReady();
      response.statusCode = discordReady ? 200 : 503;
      response.end(
        JSON.stringify({
          status: 'ok',
          discordReady,
          modules: options.moduleCount,
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
  });

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
