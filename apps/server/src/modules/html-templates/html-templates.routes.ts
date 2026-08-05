import { Router } from 'express';
import { z } from 'zod';
import { htmlTemplateController } from './html-templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createHtmlTemplateSchema,
  updateHtmlTemplateSchema,
  idParamSchema,
  generateHtmlSchema,
  saveHtmlAsProjectSchema,
} from './html-templates.schema';

const router = Router();

// 所有操作需登录
router.use(authenticate);

// HTML 模板列表 + 详情：已登录用户均可（service 按角色过滤草稿/已发布）
router.get('/', htmlTemplateController.list);
router.get('/:id', validate({ params: idParamSchema }), htmlTemplateController.get);

// 写操作：仅 ADMIN
router.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: createHtmlTemplateSchema }),
  htmlTemplateController.create,
);
router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateHtmlTemplateSchema }),
  htmlTemplateController.update,
);
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema }),
  htmlTemplateController.remove,
);

// ─── AI 生成 HTML 报告 ───
// POST /api/v1/html-templates/generate — 模板模式或 AI 模式
router.post(
  '/generate',
  validate({ body: generateHtmlSchema }),
  htmlTemplateController.generate,
);

// PATCH /api/v1/html-templates/projects/:projectId/html — 保存生成的 HTML 到已有报告
router.patch(
  '/projects/:projectId/html',
  validate({ body: z.object({ html: z.string().min(1) }) }),
  htmlTemplateController.saveHtml,
);

// POST /api/v1/html-templates/projects/html — 从 Campaign 创建新报告并保存 HTML
router.post(
  '/projects/html',
  validate({ body: saveHtmlAsProjectSchema }),
  htmlTemplateController.saveHtmlAsProject,
);

// GET /api/v1/html-templates/campaign/:campaignId/design-guide — 获取业务线 design.md
router.get(
  '/campaign/:campaignId/design-guide',
  htmlTemplateController.getDesignGuide,
);

export const htmlTemplateRoutes = router;
