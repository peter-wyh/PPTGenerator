import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './logger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter } from './middleware/rate-limit';

export function createApp(): express.Express {
  const app = express();

  // 限流/日志里的 req.ip 要反映真实客户端 IP（见 config.trustProxy 注释）。
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true, // refresh token cookie 跨子域
    }),
  );
  // 放宽图片来源：允许 blob（裁剪预览）、data、任意 https（OSS / 外链图片）。
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: { imgSrc: ["'self'", 'data:', 'blob:', 'https:'] },
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // 健康检查打点（探活无需鉴权）。
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  // 本地上传文件静态托管（OSS 驱动下不依赖此路径）。
  app.use('/uploads', express.static(config.storage.uploadDir));

  app.use('/api/v1', globalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
