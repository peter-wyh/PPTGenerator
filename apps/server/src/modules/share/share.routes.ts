import { Router } from 'express';
import { shareController } from './share.controller';

/**
 * 公开分享路由 — 故意不挂 authenticate（与 /health 同级模式）。
 * 挂载点：apiRouter.use('/share', shareRoutes)（见 src/routes/index.ts）。
 */
const router = Router();

router.get('/:token', shareController.getByToken);

export const shareRoutes = router;
