import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'mediakit-server' },
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
});

export type Logger = typeof logger;
