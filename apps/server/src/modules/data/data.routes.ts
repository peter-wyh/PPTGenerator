import { Router } from 'express';
import { dataController } from './data.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParamSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
  listQuerySchema,
  clearQuerySchema,
} from './data.schema';

const router = Router();

// 所有数据管理操作均需登录(全员可管,无角色门槛)。
router.use(authenticate);

router.get('/', validate({ query: listQuerySchema }), dataController.list);
router.get('/:id', validate({ params: idParamSchema }), dataController.get);
router.post('/', validate({ body: createDataSchema }), dataController.create);
router.post('/import', validate({ body: importDataSchema }), dataController.import);
router.patch('/:id', validate({ params: idParamSchema, body: updateDataSchema }), dataController.update);
router.delete('/:id', validate({ params: idParamSchema }), dataController.remove);
router.delete('/', validate({ query: clearQuerySchema }), dataController.clear);

export const dataRoutes = router;
