import { Router } from 'express';
import { guideController } from './guide.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParamSchema,
  createGuideSchema,
  updateGuideSchema,
  listGuidesQuerySchema,
  saveRevisionSchema,
  activateRevisionSchema,
  revisionParamsSchema,
  dryRunSchema,
} from './guide.schema';

const router = Router();

// 全部端点需登录。
router.use(authenticate);

router.get('/', validate({ query: listGuidesQuerySchema }), guideController.list);
router.post('/', validate({ body: createGuideSchema }), guideController.create);
router.patch('/:id', validate({ params: idParamSchema, body: updateGuideSchema }), guideController.update);

// S1 版本管理:保存新版本 / 列表 / 单版本 / 激活(回滚=激活旧版本)。
router.get('/:id/revisions', validate({ params: idParamSchema }), guideController.listRevisions);
router.get('/:id/revisions/:version', validate({ params: revisionParamsSchema }), guideController.getRevision);
router.post('/:id/revisions', validate({ params: idParamSchema, body: saveRevisionSchema }), guideController.saveRevision);
router.post('/:id/revisions/activate', validate({ params: idParamSchema, body: activateRevisionSchema }), guideController.activateRevision);

// S2 干跑校验:保存前对 checks 做 lint + 对样张/最近生成执行断言。
router.post('/:id/revisions/dry-run', validate({ params: idParamSchema, body: dryRunSchema }), guideController.dryRunChecks);

export const guideRoutes = router;
