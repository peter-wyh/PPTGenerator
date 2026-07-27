import { Router } from 'express';
import { schemesController } from './schemes.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createSchemeSchema,
  idParamSchema,
  codeParamSchema,
  updateSchemeSchema,
} from './schemes.schema';

const router = Router();

// 所有方案操作均需登录。
router.use(authenticate);

// 列表（支持 businessLineCode / enabled 查询参数过滤）。
router.get('/', schemesController.list);

// 按 code 获取（便于前端按 code 查找，放在 /:id 之前避免被当作 id）。
router.get('/code/:code', validate({ params: codeParamSchema }), schemesController.getByCode);

// 按 id 获取。
router.get('/:id', validate({ params: idParamSchema }), schemesController.get);

// 写操作（增删改）：仅 ADMIN。
router.post('/', requireRole('ADMIN'), validate({ body: createSchemeSchema }), schemesController.create);
router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateSchemeSchema }),
  schemesController.update,
);
router.delete('/:id', requireRole('ADMIN'), validate({ params: idParamSchema }), schemesController.remove);

export const schemesRoutes = router;
