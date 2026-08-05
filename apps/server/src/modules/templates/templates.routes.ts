import { Router } from 'express';
import { templatesController } from './templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import { createTemplateSchema, fromProjectPageSchema, fromProjectSchema, idParamSchema, setDefaultSchema, updateTemplateSchema } from './templates.schema';

const router = Router();

// 所有模版操作均需登录。
router.use(authenticate);

// 列表 + 详情：已登录用户均可（service 内按角色过滤草稿/已发布）。
router.get('/', templatesController.list);
router.get('/:id', validate({ params: idParamSchema }), templatesController.get);

// 写操作（增删改 + 复制）：仅 ADMIN。
router.post('/', requireRole('ADMIN'), validate({ body: createTemplateSchema }), templatesController.create);

// 从项目页面创建模板（ADMIN）：支持将项目中某一页保存为可复用模板。
router.post(
  '/from-project-page',
  requireRole('ADMIN'),
  validate({ body: fromProjectPageSchema }),
  templatesController.createFromProjectPage,
);

// 从整个项目创建模板（ADMIN）：将项目中所有页面保存为可复用模板。
router.post(
  '/from-project',
  requireRole('ADMIN'),
  validate({ body: fromProjectSchema }),
  templatesController.createFromProject,
);
router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  templatesController.update,
);
router.delete('/:id', requireRole('ADMIN'), validate({ params: idParamSchema }), templatesController.remove);
router.post('/:id/duplicate', requireRole('ADMIN'), validate({ params: idParamSchema }), templatesController.duplicate);
router.patch(
  '/:id/default',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: setDefaultSchema }),
  templatesController.setDefault,
);

export const templatesRoutes = router;
