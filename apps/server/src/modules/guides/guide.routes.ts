import { Router } from 'express';
import { guideController } from './guide.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParamSchema, createGuideSchema, updateGuideSchema, listGuidesQuerySchema } from './guide.schema';

const router = Router();

// 全部端点需登录。
router.use(authenticate);

router.get('/', validate({ query: listGuidesQuerySchema }), guideController.list);
router.post('/', validate({ body: createGuideSchema }), guideController.create);
router.patch('/:id', validate({ params: idParamSchema, body: updateGuideSchema }), guideController.update);

export const guideRoutes = router;
