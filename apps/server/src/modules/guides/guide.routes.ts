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
  distillSchema,
} from './guide.schema';
import { distillGuideFromHtml } from './guide-distill.service';
import { asyncHandler } from '../../utils/asyncHandler';

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

// ★ g6 参考文件回显:按 revision assets 的 ref 读文本资产内容(sample 类为外链,前端直接开)。
router.get('/:id/revisions/:version/assets', validate({ params: revisionParamsSchema }), guideController.listRevisionAssets);
router.get('/:id/revisions/:version/asset-content', validate({ params: revisionParamsSchema }), guideController.getRevisionAssetContent);

// ★ P1 指南提炼:从 HTML 样例提炼结构指南草稿(不入库,返回给编辑页人工修订)。
//    html 直接传或 businessLineId 自动取该业务线最近生成的报告。
router.post('/distill', validate({ body: distillSchema }), asyncHandler(async (req, res) => {
  const result = await distillGuideFromHtml(req.body as { html?: string; businessLineId?: string; guideName?: string });
  res.json(result);
}));

export const guideRoutes = router;
