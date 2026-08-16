import { Router } from 'express';
import { shareController } from './share.controller';
import { shareLimiter } from '../../middleware/rate-limit';

/**
 * 公开分享路由 — 故意不挂 authenticate（与 /health 同级模式）。
 * 挂载点：apiRouter.use('/share', shareRoutes)（见 src/routes/index.ts）。
 * 挂 shareLimiter（120 次/5min/IP）防公开 token 被爬。
 */
const router = Router();

router.get('/:token', shareLimiter, shareController.getByToken);

export const shareRoutes = router;
