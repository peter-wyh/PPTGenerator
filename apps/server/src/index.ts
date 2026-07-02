import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { disconnectPrisma } from './prisma';
import { disconnectRedis } from './redis';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`mediakit-server listening on :${config.port} (${config.env})`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export { app, server };
