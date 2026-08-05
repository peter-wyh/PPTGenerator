import { Router } from 'express';
import { htmlTemplateController } from './html-templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createHtmlTemplateSchema,
  updateHtmlTemplateSchema,
  idParamSchema,
  generateHtmlSchema,
  saveHtmlAsProjectSchema,
  agentEditSchema,
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

// POST /api/v1/html-templates/agent-edit — Agent 增量编辑现有 HTML
router.post(
  '/agent-edit',
  validate({ body: agentEditSchema }),
  htmlTemplateController.agentEdit,
);

// PATCH /api/v1/html-templates/projects/:projectId/html — 保存生成的 HTML（覆盖/新增版本）
router.patch(
  '/projects/:projectId/html',
  htmlTemplateController.saveHtml,
);

// PATCH /api/v1/html-templates/projects/:projectId/auto-save — Agent 模式自动保存（无版本管理）
router.patch(
  '/projects/:projectId/auto-save',
  htmlTemplateController.autoSave,
);

// GET /api/v1/html-templates/projects/:projectId/html-versions — 列出所有版本
router.get(
  '/projects/:projectId/html-versions',
  htmlTemplateController.listHtmlVersions,
);

// POST /api/v1/html-templates/projects/:projectId/html-versions — 新增版本
router.post(
  '/projects/:projectId/html-versions',
  htmlTemplateController.saveHtml,
);

// GET /api/v1/html-templates/html-versions/:versionId — 获取单个版本
router.get(
  '/html-versions/:versionId',
  htmlTemplateController.getHtmlVersion,
);

// PATCH /api/v1/html-templates/html-versions/:versionId — 更新版本
router.patch(
  '/html-versions/:versionId',
  htmlTemplateController.updateHtmlVersion,
);

// DELETE /api/v1/html-templates/html-versions/:versionId — 删除版本
router.delete(
  '/html-versions/:versionId',
  htmlTemplateController.deleteHtmlVersion,
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
