import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './logger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true, // refresh token cookie 跨子域
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // 健康检查打点（探活无需鉴权）。
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
