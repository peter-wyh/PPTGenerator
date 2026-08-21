import { Router } from 'express';
import { htmlTemplateController } from './html-templates.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import { aiGenerateLimiter } from '../../middleware/rate-limit';
import {
  createHtmlTemplateSchema,
  updateHtmlTemplateSchema,
  idParamSchema,
  generateHtmlSchema,
  saveHtmlAsProjectSchema,
  agentEditSchema,
  saveRecipeConfigSchema,
  reRenderSchema,
  createRecipeVersionSchema,
  recomputeSchema,
} from './html-templates.schema';

const router = Router();

// GET /system-prompt — 需登录（业务 know-how，不再公开；仍须在 /:id 之前注册）
router.get('/system-prompt', authenticate, htmlTemplateController.getSystemPrompt);

// 所有其他操作需登录
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
// POST /api/v1/html-templates/generate — 模板模式或 AI 模式（限流：20 次/小时/用户，防滥用烧钱）
router.post(
  '/generate',
  aiGenerateLimiter,
  validate({ body: generateHtmlSchema }),
  htmlTemplateController.generate,
);

// POST /api/v1/html-templates/generate-stream — SSE 流式 AI 生成（reasoning + content 实时转发）
router.post(
  '/generate-stream',
  aiGenerateLimiter,
  htmlTemplateController.generateStream,
);

// POST /api/v1/html-templates/agent-edit — Agent 增量编辑现有 HTML
router.post(
  '/agent-edit',
  aiGenerateLimiter,
  validate({ body: agentEditSchema }),
  htmlTemplateController.agentEdit,
);

// POST /api/v1/html-templates/agent-edit-stream — SSE 流式 Agent 编辑
router.post(
  '/agent-edit-stream',
  aiGenerateLimiter,
  htmlTemplateController.agentEditStream,
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

// POST /api/v1/html-templates/projects/:projectId/recipe-version — 创建 recipe 版本(G1)
router.post(
  '/projects/:projectId/recipe-version',
  requireRole('ADMIN'),
  validate({ body: createRecipeVersionSchema }),
  htmlTemplateController.createRecipeVersion,
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

// PATCH /api/v1/html-templates/html-versions/:versionId/recipe-config
//   保存 recipe 配置(reportContent/tokenOverrides/manifestOverrides) + 重渲染写回 html
router.patch(
  '/html-versions/:versionId/recipe-config',
  validate({ body: saveRecipeConfigSchema }),
  htmlTemplateController.saveRecipeConfig,
);

// POST /api/v1/html-templates/html-versions/:versionId/recompute — 换时间段重算(G2)
router.post(
  '/html-versions/:versionId/recompute',
  validate({ body: recomputeSchema }),
  htmlTemplateController.recompute,
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

// GET /api/v1/html-templates/campaign/:campaignId/module-coverage — ★ 模块级数据覆盖预检
//   生成前展示哪些模块有数据/缺数据(query: startDate/endDate 可选,报告周期)
router.get(
  '/campaign/:campaignId/module-coverage',
  htmlTemplateController.getModuleCoverage,
);

// POST /api/v1/html-templates/recipe/render — 实时重渲染(不保存,编辑器预览用)
router.post(
  '/recipe/render',
  validate({ body: reRenderSchema }),
  htmlTemplateController.reRender,
);

export const htmlTemplateRoutes = router;
