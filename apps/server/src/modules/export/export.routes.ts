import { Router } from 'express';
import { exportController } from './export.controller';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '../projects/projects.schema';

/**
 * 导出路由（需认证）。挂在 projectsRoutes 下（`router.use('/', exportRoutes)`），
 * authenticate 由 projectsRoutes 的 `router.use(authenticate)` 提供。
 * 最终路径：POST /projects/:id/export
 */
const router = Router();

router.post('/:id/export', validate({ params: idParamSchema }), exportController.exportProject);

export const exportRoutes = router;
