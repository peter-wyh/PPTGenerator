# HTML 报告编辑 + 数据替换 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 HTML 报告加上"模板化报告"路径(recipe),支持数据替换 + 文案/风格/结构编辑,与现有 AI 自由报告并存;废弃未使用的 template mode。

**Architecture:** recipe(已在 worktree 实现)从代码四件套升级为"可编辑配置"——HtmlVersion 加 4 列存 recipe 配置,template.hbs 拆 partial + manifest 驱动支持结构编辑,render 吃 tokenOverrides/manifestOverrides/reportContent 覆盖。AI 自由报告(mode:'ai')完全不动。

**Tech Stack:** TypeScript / Express / Prisma(MySQL)/ Handlebars / React + Vite / Vitest

**Spec:** `docs/superpowers/specs/2026-08-05-html-edit-and-data-rebind-design.md`

---

## 前置(执行前必做)

- [ ] **建隔离 worktree**(用户工作区并发 dirty):用 `superpowers:using-git-worktrees` 建,设 `worktree.baseRef=head`;symlink node_modules(见记忆 `worktree-node-modules-symlink`)。
- [ ] **recipe 源**:`.claude/worktrees/report-recipe/`(基于 `da3cb26`,本计划把它搬到当前 main 基线)。
- [ ] **不要 git-add 整个 dirty 文件**(记忆 `isolate-feature-work-in-worktree`);只 add 本计划改的具体文件。

---

## File Structure

### 新增 — recipe 子系统(从 worktree 搬)
- `apps/server/src/modules/html-templates/recipe/index.ts` — 注册表 `getRecipe(id)`
- `apps/server/src/modules/html-templates/recipe/types.ts` — `Recipe` / `RenderInput`
- `apps/server/src/modules/html-templates/recipe/campaign-report/{schema,mapper,narrative,render,template.hbs,tokens,index}.ts` + 4 测试 + `__snapshots__/`

### 新增 — 本方案新代码
- `apps/server/src/modules/html-templates/recipe/campaign-report/partials/{_header,_kpi,_trend,_publishers,_insights,_actionable}.hbs` — template.hbs 拆分后的组件
- `apps/server/src/modules/html-templates/recipe/campaign-report/manifest.ts` — 默认 manifest + `applyManifest`
- `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` — 改:吃覆盖 + manifest 驱动
- `apps/server/src/modules/html-templates/recipe/overrides.ts` — `mergeTokens` / `pickReportContent` 工具
- `apps/web/src/editor/components/recipe-editor/{RecipeEditor,DataPanel,ContentPanel,StylePanel,StructurePanel}.tsx` — 四层编辑器

### 修改
- `apps/server/prisma/schema.prisma` — HtmlVersion 加 4 列
- `apps/server/prisma/migrations/2026MMDD000000_html_version_recipe/migration.sql` — 加列 SQL
- `apps/server/src/modules/html-templates/html-templates.schema.ts` — mode enum + recipe 输入 schema
- `apps/server/src/modules/html-templates/html-templates.controller.ts` — 删 template 分支,加 recipe 分支 + 配置保存/重渲染端点
- `apps/server/src/modules/html-templates/html-templates.service.ts` — 删 `generateFromTemplate`,加 `saveRecipeConfig` / `reRenderRecipe`
- `apps/server/package.json` — `handlebars` + `@types/handlebars`
- `apps/web/src/api/htmlTemplates.ts` — 加 recipe 配置 API + Mode 类型改
- `apps/web/src/routes/HtmlStudio.tsx` — 按 recipeId 切换面板
- `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx` — Mode 类型 + 移除模板下拉

---

## Task 1: rebase recipe 子系统 + 废弃 template mode(后端)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/`(整目录,从 worktree 搬)
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: 搬 recipe 子系统**

```bash
cp -R .claude/worktrees/report-recipe/apps/server/src/modules/html-templates/recipe \
      apps/server/src/modules/html-templates/recipe
```
确认 12 个文件就位:`recipe/{index,types}.ts` + `recipe/campaign-report/{schema,mapper,narrative,render,template.hbs,tokens,index}.ts` + 4 个 `*.test.ts` + `__snapshots__/render.test.ts.snap`。

- [ ] **Step 2: 加 handlebars 依赖**

```bash
cd apps/server && pnpm add handlebars && pnpm add -D @types/handlebars
```

- [ ] **Step 3: 改 mode enum + recipe 输入**(`html-templates.schema.ts`)

把 `generateHtmlSchema`(约 line 25-38)改为:
```ts
export const generateHtmlSchema = z.object({
  /** 生成模式:ai = AI 提示词生成;recipe = 模板化数据驱动(可换数据) */
  mode: z.enum(['ai', 'recipe']),
  /** recipe 模式:使用指定 recipe id(默认 'campaign-report') */
  recipeId: z.string().optional(),
  /** ai 模式:提示词 */
  prompt: z.string().optional(),
  campaignId: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  designMd: z.string().optional(),
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
});
```
(删除 `templateId` 字段)

- [ ] **Step 4: 改 controller.generate — 删 template 分支,加 recipe 分支**

替换 `generate: asyncHandler(...)` 整个函数体为:
```ts
  generate: asyncHandler(async (req: Request, res: Response) => {
    const { mode, recipeId, prompt, campaignId, reportPeriod } = req.body;
    let html: string;
    if (mode === 'recipe') {
      const { getRecipe } = await import('./recipe');
      html = await getRecipe(recipeId ?? 'campaign-report').render({ campaignId, reportPeriod });
    } else {
      // ai mode(现状,不动)
      html = await aiGenerateService.generateHtml({
        campaignId,
        prompt: prompt || 'Generate a comprehensive campaign performance report',
        designMd: req.body.designMd,
        reportPeriod,
      });
    }
    res.json({ html });
  }),
```

- [ ] **Step 5: 删 generateFromTemplate**(`html-templates.service.ts`)

删除 `generateFromTemplate` 方法(约 line 136-149)和它独有的 `flattenObject`(约 line 437-450,若确认仅它使用;若 generateFromTemplate 之外无引用则删,否则保留)。同时删 controller 里对它的 import(若 Step 4 已不引用则跳过)。

- [ ] **Step 6: 跑 recipe 测试(验证搬运正确)**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe
```
Expected: 31 passed(含 render 快照、mapper、narrative、schema、format)。

- [ ] **Step 7: typecheck**

```bash
cd apps/server && pnpm typecheck
```
Expected: 无错。若有"templateId not found"残留引用,按报错清理。

- [ ] **Step 8: commit**

```bash
git add apps/server/src/modules/html-templates/recipe \
        apps/server/src/modules/html-templates/html-templates.schema.ts \
        apps/server/src/modules/html-templates/html-templates.controller.ts \
        apps/server/src/modules/html-templates/html-templates.service.ts \
        apps/server/package.json pnpm-lock.yaml
git commit -m "feat(html-templates): rebase recipe 子系统 + 废弃 template mode"
```

---

## Task 2: DB 迁移 — HtmlVersion 加 4 列

**Files:**
- Modify: `apps/server/prisma/schema.prisma`(HtmlVersion model)
- Create: `apps/server/prisma/migrations/2026MMDD000000_html_version_recipe/migration.sql`

- [ ] **Step 1: 改 Prisma schema**(`schema.prisma` 的 `model HtmlVersion`)

在 `source String?` 之后、`isActive` 之前加 4 列:
```prisma
  source        String?
  /// recipe 报告:用哪套 recipe(ai 报告为 null)
  recipeId      String?
  /// recipe 报告:渲染用数据快照(CampaignReportContent)
  reportContent Json?
  /// recipe 报告:配色/字体覆盖(只存改过的 key)
  tokenOverrides Json?
  /// recipe 报告:组件顺序 + 显隐 { order: string[], hidden: string[] }
  manifestOverrides Json?
  isActive      Boolean  @default(false)
```

- [ ] **Step 2: 手写 migration SQL**(dev DB 无 shadow DB,见记忆 `prisma-migrate-dev-needs-shadow-db`)

建 `apps/server/prisma/migrations/2026MMDD000000_html_version_recipe/migration.sql`(把 MMDD 换成当天,确保时间戳晚于已有迁移):
```sql
-- AddColumn: HtmlVersion recipe 配置(模板化报告专用,ai 报告保持 null)
ALTER TABLE `HtmlVersion` ADD COLUMN `recipeId` VARCHAR(191) NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `reportContent` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `tokenOverrides` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `manifestOverrides` JSON NULL;
```

- [ ] **Step 3: 应用到本地 DB**

```bash
cd apps/server
./node_modules/.bin/prisma migrate resolve --applied 2026MMDD000000_html_version_recipe
# 直接 ALTER 本地库(可空列,现有数据自动 null)
docker exec mediakit-mysql-1 mysql -uroot -pmediakit_root mediakit -e \
  "ALTER TABLE \`HtmlVersion\` ADD COLUMN \`recipeId\` VARCHAR(191) NULL; \
   ALTER TABLE \`HtmlVersion\` ADD COLUMN \`reportContent\` JSON NULL; \
   ALTER TABLE \`HtmlVersion\` ADD COLUMN \`tokenOverrides\` JSON NULL; \
   ALTER TABLE \`HtmlVersion\` ADD COLUMN \`manifestOverrides\` JSON NULL;"
./node_modules/.bin/prisma generate
```

- [ ] **Step 4: 验证**

```bash
cd apps/server && ./node_modules/.bin/prisma migrate status
```
Expected: `Database schema is up to date!`,10+1 迁移全 applied。

- [ ] **Step 5: commit**

```bash
git add apps/server/prisma/schema.prisma \
        apps/server/prisma/migrations/2026MMDD000000_html_version_recipe/migration.sql
git commit -m "feat(db): HtmlVersion 加 recipe 配置 4 列(recipeId/reportContent/tokenOverrides/manifestOverrides)"
```

---

## Task 3: template.hbs 拆 partial + manifest 驱动

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_header.hbs`(及 _kpi/_trend/_publishers/_insights/_actionable)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs`(改成 layout)
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/manifest.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`(已有快照,验证不回归)

- [ ] **Step 1: 先确保现有快照测试锁定基线**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: PASS(拆分前的基线,拆分后必须仍 PASS)。

- [ ] **Step 2: 拆 template.hbs 成 6 个 partial**

把现有 `template.hbs`(282 行)按组件边界切成 6 个文件到 `partials/` 目录:
- `partials/_header.hbs` — `<header>...</header>` 段(brand logo / merchant / period)
- `partials/_kpi.hbs` — KPI 卡片网格段(`{{#each kpis}}`)
- `partials/_trend.hbs` — Performance Trend 的 card + `<canvas>` + Chart.js init
- `partials/_publishers.hbs` — Publisher Performance 表格段
- `partials/_insights.hbs` — Insight Modules(`{{#if insights...}}` 守卫的几个子卡)
- `partials/_actionable.hbs` — Actionable Insights(`{{#each actionable}}`)

每个 partial 内容 = 原 template.hbs 里对应组件的 HTML(原样切出,占位符不动)。`<head>` 里的 `<style>` / `tailwind.config` / 字体 / Chart.js CDN 留在 layout(它们是全局的,不随 manifest 显隐)。

- [ ] **Step 3: template.hbs 改成 layout(动态 partial 循环)**

把 `template.hbs` 的 `<body>` 内容换成:
```hbs
<body>
  {{#each components}}
    {{> (lookup . "partial") . }}
  {{/each}}
</body>
```
`<head>`(style/tailwind config/字体/CDN)保持不变。每个 partial 第一行需要标注它期望的数据上下文(因为 layout 用 `.` 传整个 content + tokens,partial 内 `{{header.brand.name}}` / `{{tokens.brandPrimary}}` 都能访问)。

- [ ] **Step 4: 注册 partial + 写 manifest.ts**

`manifest.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';

const here = dirname(fileURLToPath(import.meta.url));

/** 注册 6 个组件 partial(模块加载时一次性注册) */
for (const name of ['header', 'kpi', 'trend', 'publishers', 'insights', 'actionable']) {
  const src = readFileSync(join(here, 'partials', `_${name}.hbs`), 'utf8');
  Handlebars.registerPartial(name, src);
}

export type ComponentId = 'header' | 'kpi' | 'trend' | 'publishers' | 'insights' | 'actionable';

export const DEFAULT_MANIFEST: { order: ComponentId[]; hidden: ComponentId[] } = {
  order: ['header', 'kpi', 'trend', 'publishers', 'insights', 'actionable'],
  hidden: [],
};

export interface ManifestOverrides { order?: string[]; hidden?: string[] }

/** 合并默认 manifest + 覆盖,返回按顺序排列、过滤 hidden 的组件数组(每元素带 partial 名) */
export function applyManifest(overrides?: ManifestOverrides): { partial: string }[] {
  const order = overrides?.order ?? DEFAULT_MANIFEST.order;
  const hidden = new Set(overrides?.hidden ?? []);
  return order
    .filter((id) => !hidden.has(id))
    .map((id) => ({ partial: id }));
}
```

- [ ] **Step 5: render.ts 用 manifest 构造 components 数组**

把 `render.ts` 的 `return compiled({ ...content, tokens: dgTokens })` 改为:
```ts
import { applyManifest } from './manifest';
// ...在 render 内部:
const components = applyManifest(input.manifestOverrides);
return compiled({ ...content, tokens: mergedTokens, components });
```
(`mergedTokens` 见 Task 4;此 Task 暂用 `const mergedTokens = dgTokens;`,Task 4 再接 tokenOverrides。)

- [ ] **Step 6: 跑快照测试验证不回归**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: PASS(默认 manifest 下输出与拆分前完全一致 —— 验证拆分无回归)。**若快照不匹配**,检查 partial 切割是否漏了空白/换行 —— 修 partial 而非更新快照(快照是 DG 保真基线,不能漂移)。

- [ ] **Step 7: 加 manifest 覆盖测试**(`render.test.ts` 追加)

```ts
it('manifestOverrides.hidden 隐藏组件', async () => {
  const html = await render({ campaignId: 'camp-everyday-bf', manifestOverrides: { hidden: ['insights'] } });
  expect(html).not.toContain('Insight Modules');  // insights 段不渲染
  expect(html).toContain('KPI Overview');          // 其余仍在
});

it('manifestOverrides.order 调整组件顺序', async () => {
  const html = await render({ campaignId: 'camp-everyday-bf', manifestOverrides: { order: ['header', 'publishers', 'kpi', 'trend', 'actionable'] } });
  const publishersIdx = html.indexOf('Publisher Performance');
  const kpiIdx = html.indexOf('KPI Overview');
  expect(publishersIdx).toBeGreaterThan(0);
  expect(publishersIdx).toBeLessThan(kpiIdx);  // publishers 在 kpi 之前
});
```

- [ ] **Step 8: 跑测试 + typecheck + commit**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe && pnpm typecheck
git add apps/server/src/modules/html-templates/recipe/campaign-report/{template.hbs,partials,manifest.ts,render.ts,render.test.ts}
git commit -m "feat(recipe): template 拆 partial + manifest 驱动(支持结构编辑)"
```

---

## Task 4: render 吃覆盖(tokenOverrides / reportContent)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/overrides.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/types.ts`(`RenderInput` 加字段)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(导出类型)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`

- [ ] **Step 1: 写失败测试**(render.test.ts 追加)

```ts
it('tokenOverrides 覆盖主色', async () => {
  const html = await render({
    campaignId: 'camp-everyday-bf',
    tokenOverrides: { brandPrimary: '#3b82f6' },
  });
  expect(html).toContain('#3b82f6');
  expect(html).not.toContain('#ff099e');  // 默认 DG 粉被覆盖
});

it('reportContent 快照优先于 mapCampaign', async () => {
  const customContent = await render({ campaignId: 'camp-everyday-bf' });
  // 用一份手改过的 reportContent(改 KPI 标签)
  const base = await import('./mapper').then(m => m.mapCampaign('camp-everyday-bf'));
  base.kpis[0].label = '总收入(手改)';
  const html = await render({ campaignId: 'camp-everyday-bf', reportContent: base });
  expect(html).toContain('总收入(手改)');
});
```

- [ ] **Step 2: 跑测试验证失败**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: FAIL(`tokenOverrides` / `reportContent` 参数未被 render 识别。

- [ ] **Step 3: 写 overrides.ts**

```ts
import { dgTokens } from './campaign-report/tokens';

/** 合并默认 tokens + 用户覆盖(只覆盖提供的 key) */
export function mergeTokens(overrides?: Record<string, any>): Record<string, any> {
  return { ...dgTokens, ...(overrides ?? {}) };
}
```

- [ ] **Step 4: 扩展 RenderInput(types.ts)**

```ts
export interface RenderInput {
  campaignId?: string;
  reportPeriod?: { startDate: string; endDate: string };
  reportContent?: any;          // 直接用数据快照(跳过 mapCampaign)
  tokenOverrides?: Record<string, any>;
  manifestOverrides?: { order?: string[]; hidden?: string[] };
}
```

- [ ] **Step 5: render.ts 接覆盖**

```ts
import { mergeTokens } from '../overrides';
import { mapCampaign } from './mapper';
import { fillActionable } from './narrative';
import { applyManifest } from './manifest';

export async function render(input: RenderInput): Promise<string> {
  if (!input.campaignId && !input.reportContent) {
    throw ApiError.badRequest('recipe 需要 campaignId 或 reportContent');
  }
  let content = input.reportContent ?? await mapCampaign(input.campaignId!, input.reportPeriod);
  content.actionable = await fillActionable(content);
  const tokens = mergeTokens(input.tokenOverrides);
  const components = applyManifest(input.manifestOverrides);
  return compiled({ ...content, tokens, components });
}
```

- [ ] **Step 6: 跑测试验证通过**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: PASS(含新加的 tokenOverrides / reportContent 测试 + 原快照)。

- [ ] **Step 7: typecheck + commit**

```bash
cd apps/server && pnpm typecheck
git add apps/server/src/modules/html-templates/recipe/{overrides.ts,types.ts,campaign-report/render.ts,campaign-report/render.test.ts}
git commit -m "feat(recipe): render 吃 tokenOverrides/reportContent 覆盖"
```

---

## Task 5: 后端端点 — 配置保存 + 重渲染

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`(加 schema)
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(加 handler)
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`(加 service 方法)
- Modify: `apps/server/src/modules/html-templates/html-templates.routes.ts`(加路由)
- Test: `apps/server/src/modules/html-templates/html-templates.service.test.ts`

- [ ] **Step 1: 写失败测试**(service.test.ts 追加)

```ts
it('saveRecipeConfig 写 HtmlVersion 4 字段 + 重渲染 html', async () => {
  // 先建一个 recipe 报告(HtmlVersion)
  const project = await htmlTemplateService.saveHtmlAsNewProject(adminId, { html: '<html></html>', campaignId: 'camp-everyday-bf', name: 'recipe test' });
  const version = await prisma.htmlVersion.create({ data: { projectId: project.id, name: 'v1', html: '<html></html>', source: 'recipe', ownerId: adminId, recipeId: 'campaign-report' } });

  await htmlTemplateService.saveRecipeConfig(version.id, {
    reportContent: { /* CampaignReportContent */ } as any,
    tokenOverrides: { brandPrimary: '#3b82f6' },
    manifestOverrides: { hidden: ['insights'] },
  });
  const updated = await prisma.htmlVersion.findUnique({ where: { id: version.id } });
  expect(updated?.tokenOverrides).toMatchObject({ brandPrimary: '#3b82f6' });
  expect(updated?.manifestOverrides).toMatchObject({ hidden: ['insights'] });
  expect(updated?.html).toContain('#3b82f6');        // 重渲染过
  expect(updated?.html).not.toContain('Insight Modules'); // insights 隐藏
});
```

- [ ] **Step 2: 跑测试验证失败**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/html-templates.service.test.ts
```
Expected: FAIL(`saveRecipeConfig` 不存在。

- [ ] **Step 3: 加输入 schema**(`html-templates.schema.ts` 追加)

```ts
export const saveRecipeConfigSchema = z.object({
  reportContent: z.any().optional(),
  tokenOverrides: z.record(z.any()).optional(),
  manifestOverrides: z.object({ order: z.array(z.string()).optional(), hidden: z.array(z.string()).optional() }).optional(),
});
```

- [ ] **Step 4: 加 service 方法**(`html-templates.service.ts`)

```ts
import { getRecipe } from './recipe';

async saveRecipeConfig(versionId: string, cfg: { reportContent?: any; tokenOverrides?: Record<string, any>; manifestOverrides?: any }): Promise<void> {
  const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
  if (!version) throw ApiError.notFound('HTML 版本不存在');
  if (!version.recipeId) throw ApiError.badRequest('该版本不是 recipe 报告');

  const reportContent = cfg.reportContent ?? version.reportContent;
  const tokenOverrides = cfg.tokenOverrides ?? (version.tokenOverrides as Record<string, any> | undefined);
  const manifestOverrides = cfg.manifestOverrides ?? (version.manifestOverrides as any | undefined);

  // 用合并后的配置重渲染
  const html = await getRecipe(version.recipeId).render({
    campaignId: (version.reportContent as any)?.campaignId,  // 或从 Project.meta 取
    reportContent,
    tokenOverrides,
    manifestOverrides,
  });

  await prisma.htmlVersion.update({
    where: { id: versionId },
    data: { reportContent, tokenOverrides, manifestOverrides, html },
  });
}
```
(注意:`campaignId` 优先从 `Project.meta.campaignId` 取 —— 实现时从 `version.projectId` 反查 Project 拿 meta,见 Step 5 注释。)

- [ ] **Step 5: 加 controller handler + 路由**

`html-templates.controller.ts` 追加:
```ts
  saveRecipeConfig: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    await htmlTemplateService.saveRecipeConfig(versionId, req.body);
    res.json({ ok: true });
  }),

  /** 重渲染但不保存(编辑器实时预览用) */
  reRender: asyncHandler(async (req: Request, res: Response) => {
    const { recipeId, campaignId, reportContent, tokenOverrides, manifestOverrides } = req.body;
    const { getRecipe } = await import('./recipe');
    const html = await getRecipe(recipeId ?? 'campaign-report').render({
      campaignId, reportContent, tokenOverrides, manifestOverrides,
    });
    res.json({ html });
  }),
```

`html-templates.routes.ts` 追加:
```ts
// recipe 配置保存(写 HtmlVersion 4 字段 + 重渲染)
router.patch(
  '/html-versions/:versionId/recipe-config',
  validate({ body: saveRecipeConfigSchema }),
  htmlTemplateController.saveRecipeConfig,
);
// recipe 实时重渲染(不保存,编辑器预览用)
router.post('/recipe/render', validate({ body: z.any() }), htmlTemplateController.reRender);
```

- [ ] **Step 6: 跑测试验证通过**

```bash
cd apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/html-templates.service.test.ts
```
Expected: PASS。

- [ ] **Step 7: typecheck + commit**

```bash
cd apps/server && pnpm typecheck
git add apps/server/src/modules/html-templates/{html-templates.schema.ts,html-templates.controller.ts,html-templates.service.ts,html-templates.routes.ts,html-templates.service.test.ts}
git commit -m "feat(html-templates): recipe 配置保存 + 实时重渲染端点"
```

---

## Task 6: 前端编辑器(HtmlStudio 内类型切换 + 四层)

**Files:**
- Create: `apps/web/src/editor/components/recipe-editor/RecipeEditor.tsx`
- Create: `apps/web/src/editor/components/recipe-editor/{DataPanel,ContentPanel,StylePanel,StructurePanel}.tsx`
- Modify: `apps/web/src/api/htmlTemplates.ts`(加 recipe API + Mode 类型)
- Modify: `apps/web/src/routes/HtmlStudio.tsx`(按 recipeId 切换面板)
- Modify: `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx`(Mode 类型 + 移除模板下拉)
- Test: `apps/web/tests/recipe-editor.test.tsx`

> **注**:`HtmlStudio.tsx` 用户在并发改。实现时先读当前文件,把"按 recipeId 切换面板"的分支插到现有 handleGenerate 附近,不动 Agent/textarea 区。

- [ ] **Step 1: 写失败测试**(recipe-editor.test.tsx)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeEditor } from '@/editor/components/recipe-editor/RecipeEditor';

vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    reRender: vi.fn().mockResolvedValue('<html><body>rendered</body></html>'),
    saveRecipeConfig: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

it('改主色 → debounce 后重渲染预览', async () => {
  render(<RecipeEditor versionId="v1" recipeId="campaign-report" campaignId="camp-everyday-bf" reportContent={{}} tokenOverrides={{}} manifestOverrides={{}} />);
  fireEvent.change(screen.getByLabelText('主色'), { target: { value: '#3b82f6' } });
  // debounce 500ms 后调 reRender
  expect(await screen.findByText(/rendered/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑测试验证失败**

```bash
cd apps/web && ./node_modules/.bin/vitest run tests/recipe-editor.test.tsx
```
Expected: FAIL(`RecipeEditor` 未定义。

- [ ] **Step 3: 改 api/htmlTemplates.ts — Mode 类型 + recipe API**

```ts
// Mode 类型改
export type GenerateMode = 'ai' | 'recipe';  // 删 'template'

export const htmlTemplatesApi = {
  // ...现有方法...
  /** recipe 实时重渲染(不保存) */
  reRender: (input: { recipeId?: string; campaignId?: string; reportContent?: any; tokenOverrides?: Record<string, any>; manifestOverrides?: { order?: string[]; hidden?: string[] } }) =>
    api.post<{ html: string }>('/html-templates/recipe/render', input).then(r => r.data.html),
  /** recipe 配置保存(写 HtmlVersion 4 字段 + 重渲染) */
  saveRecipeConfig: (versionId: string, cfg: { reportContent?: any; tokenOverrides?: Record<string, any>; manifestOverrides?: any }) =>
    api.patch(`/html-templates/html-versions/${versionId}/recipe-config`, cfg).then(r => r.data),
};
```

- [ ] **Step 4: 写 RecipeEditor.tsx(组合四层 + 预览)**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { htmlTemplatesApi } from '@/api/htmlTemplates';
import { DataPanel } from './DataPanel';
import { ContentPanel } from './ContentPanel';
import { StylePanel } from './StylePanel';
import { StructurePanel } from './StructurePanel';

interface Props {
  versionId: string;
  recipeId: string;
  campaignId?: string;
  reportContent: any;
  tokenOverrides: Record<string, any>;
  manifestOverrides: { order?: string[]; hidden?: string[] };
  onSaved?: () => void;
}

export function RecipeEditor(props: Props) {
  const [content, setContent] = useState(props.reportContent);
  const [tokens, setTokens] = useState(props.tokenOverrides);
  const [manifest, setManifest] = useState(props.manifestOverrides);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);

  // debounce 重渲染(500ms)
  useEffect(() => {
    const t = setTimeout(async () => {
      const html = await htmlTemplatesApi.reRender({
        recipeId: props.recipeId, campaignId: props.campaignId,
        reportContent: content, tokenOverrides: tokens, manifestOverrides: manifest,
      });
      setPreviewHtml(html);
    }, 500);
    return () => clearTimeout(t);
  }, [content, tokens, manifest, props.recipeId, props.campaignId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await htmlTemplatesApi.saveRecipeConfig(props.versionId, {
        reportContent: content, tokenOverrides: tokens, manifestOverrides: manifest,
      });
      props.onSaved?.();
    } finally { setSaving(false); }
  }, [content, tokens, manifest, props.versionId]);

  return (
    <div className="flex flex-col gap-4">
      <DataPanel campaignId={props.campaignId} onReload={setContent} />
      <ContentPanel content={content} onChange={setContent} />
      <StylePanel tokens={tokens} onChange={setTokens} />
      <StructurePanel manifest={manifest} onChange={setManifest} />
      <button onClick={handleSave} disabled={saving}>💾 保存</button>
      <iframe srcDoc={previewHtml} sandbox="allow-same-origin allow-scripts" className="w-full h-[600px]" />
    </div>
  );
}
```

- [ ] **Step 5: 写四个 Panel(骨架,各自管一层 state)**

`StylePanel.tsx`(主色/字体,示范;其余三个结构类似):
```tsx
interface Props { tokens: Record<string, any>; onChange: (t: Record<string, any>) => void }

const DG_TOKEN_META = [
  { key: 'brandPrimary', label: '主色', type: 'color' },
  { key: 'bgLayout', label: '背景色', type: 'color' },
  { key: 'bgCard', label: '卡片色', type: 'color' },
  { key: 'fontBody', label: '正文字体', type: 'text' },
];

export function StylePanel({ tokens, onChange }: Props) {
  return (
    <fieldset className="border p-3 rounded">
      <legend>风格</legend>
      {DG_TOKEN_META.map(m => (
        <label key={m.key} className="block text-sm">
          {m.label}: <input
            aria-label={m.label}
            type={m.type}
            value={tokens[m.key] ?? ''}
            onChange={e => onChange({ ...tokens, [m.key]: e.target.value })}
          />
        </label>
      ))}
    </fieldset>
  );
}
```
- `DataPanel`:Campaign 选择 + reportPeriod + "重新拉取数据"按钮(调 `htmlTemplatesApi.generate({mode:'recipe', campaignId})` 拿新 content,或新加 `mapCampaign` 端点;v1 可复用 generate 返回的 html 不够,需另加 `POST /recipe/map` 端点返回 content —— **若 spec 未覆盖,此 Panel v1 用手动重选 campaign 重新生成整份报告代替**)。
- `ContentPanel`:手写常用字段(KPI label/value 表格、达人 name 表格、actionable title/items)onChange 改 content;高级折叠 raw JSON。
- `StructurePanel`:6 个组件 checkbox + 拖拽调序(用 `@dnd-kit` 或简单的上下移动按钮),改 manifest.order / hidden。

- [ ] **Step 6: HtmlStudio.tsx 按 recipeId 切换面板**

在 `HtmlStudio` 里判断当前版本:`const isRecipe = !!version?.recipeId`。若 isRecipe 渲染 `<RecipeEditor .../>`,否则渲染现有 Agent + textarea(不动)。读当前 `HtmlStudio.tsx` 找到 version 加载处(`projectsApi.getHtml` / HtmlVersion 加载),插入分支。

- [ ] **Step 7: GenerateHtmlReportOverlay.tsx — Mode 类型 + 移除模板下拉**

`type Mode = 'template' | 'ai'` → `'ai' | 'recipe'`。移除模板选择下拉(line 341-352 的 `templates.length === 0` / `templates.map` 块)和 `selectedTpl` 状态。`mode === 'template'` 分支改成 `mode === 'recipe'`(调 `generate({mode:'recipe', campaignId})`)。

- [ ] **Step 8: 跑测试 + typecheck**

```bash
cd apps/web && ./node_modules/.bin/vitest run tests/recipe-editor.test.tsx
cd apps/web && ./node_modules/.bin/tsc --noEmit
```
Expected: 测试 PASS,typecheck 无错。

- [ ] **Step 9: commit**

```bash
git add apps/web/src/editor/components/recipe-editor \
        apps/web/src/api/htmlTemplates.ts \
        apps/web/src/routes/HtmlStudio.tsx \
        apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx \
        apps/web/tests/recipe-editor.test.tsx
git commit -m "feat(web): recipe 报告四层编辑器 + HtmlStudio 类型切换 + 移除 template mode UI"
```

---

## Task 7: 回归验证(AI 报告不回归 + 全流程)

**Files:** 无(验证任务)

- [ ] **Step 1: server 全测试**

```bash
cd apps/server && ./node_modules/.bin/vitest run
```
Expected: 全 PASS(含 recipe 31 + html-templates service + 其它)。无 `templateId` / `generateFromTemplate` 残留引用报错。

- [ ] **Step 2: web 全测试 + typecheck**

```bash
cd apps/web && ./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit
```
Expected: 全 PASS。

- [ ] **Step 3: 手动验证 AI 报告不回归**

```bash
# 起 server + web,登录,用 mode:'ai' 生成一份报告 → 确认 Agent 编辑 + textarea + 保存都正常
```
Expected: AI 报告全流程不变。

- [ ] **Step 4: 手动验证 recipe 报告全流程**

```
1. mode:'recipe' 生成 camp-everyday-bf 报告 → HTML 出来
2. 进 HtmlStudio → 看到 RecipeEditor(四层)
3. 改主色 → 预览刷新(主色变)
4. 隐藏 insights 组件 → 预览刷新(insights 段消失)
5. 换 campaignId 为 camp-nova-home-618 → 数据全变,结构/风格不变
6. 保存 → HtmlVersion 4 字段写入
7. 重新打开 → 配置恢复,预览正确
```

- [ ] **Step 5: 最终 commit(若有遗漏清理)**

```bash
# 确认 git status 干净(本计划文件除外)
git status
```

---

## Self-Review 结果(写计划后自查)

**Spec coverage:**
- §1-2 背景/目标 → Task 1(废弃)+ 全计划 ✓
- §4 决策 1(废弃 template)→ Task 1 Step 3-5 ✓
- §4 决策 2(HtmlVersion 加 4 列)→ Task 2 ✓
- §4 决策 3(template 拆 partial + manifest)→ Task 3 ✓
- §4 决策 4(HtmlStudio 内切换)→ Task 6 Step 6 ✓
- §6 数据模型 → Task 2 ✓
- §7 render 改动 → Task 3(manifest)+ Task 4(覆盖)✓
- §8 编辑器四层 → Task 6 ✓
- §9 AI 报告不动 → Task 7 Step 3 验证 ✓
- §10 错误降级 → recipe 已有(Task 1 搬入)+ Task 5 端点复用 ✓
- §11 rebase → Task 1 ✓
- §12 测试 → 各 Task 内 TDD ✓

**Placeholder scan:** Task 6 Step 5 的 DataPanel 标注了"v1 用手动重选代替 mapCampaign 端点"(因 spec 未覆盖 map 端点)—— 这是明确的 v1 简化,非 TBD。ContentPanel/StructurePanel 给了骨架 + 示范(StylePanel 完整),实现时按骨架扩展。无 "TODO/TBD"。

**Type consistency:** `RenderInput`(reportContent/tokenOverrides/manifestOverrides)、`saveRecipeConfig` 签名、`htmlTemplatesApi.reRender/saveRecipeConfig` 前后端命名一致。`manifestOverrides` 形状 `{order?, hidden?}` 全链路一致。`ComponentId` / `DEFAULT_MANIFEST.order` 用同一组 6 个 id。
