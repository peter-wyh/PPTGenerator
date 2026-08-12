# recipe 模式补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 html-studio 报告成为真 recipe 版本（数据驱动、改时间段秒级重算并落库），并修掉 DB 鉴权定时炸弹。

**Architecture:** 补全 main 里已有的 recipe 脚手架——新增后端 `createRecipeVersion`（建带 `recipeId` 的 active 版本）+ `recomputeRecipe`（换时间段重跑 `mapCampaign` 并落库）两条路径，前端生成入口/重算入口改调它们；先用 ops 修 `mediaket@%` 的 `sha256_password` 鉴权（否则 server 重启即断）。

**Tech Stack:** Express + Prisma + Zod（server）、React + Vite + axios（web）、vitest（测试）。recipe：`mapCampaign`（mapper.ts）+ `getRecipe().render`（recipe/index.ts）。

**Spec:** `docs/superpowers/specs/2026-08-12-recipe-mode-completion-design.md`

---

## 隔离策略（替代 spec §9 的 worktree）

经查本次改动文件（`html-templates.service/controller/routes/schema.ts`、`HtmlStudio.tsx`、`recipe-editor/DataPanel.tsx`、`api/htmlTemplates.ts`）与 main 树现有 WIP（`projects.*` / `docs/DATABASE_MIGRATION.sql` / `Projects.tsx` / `api/projects.ts`）**完全不相交**。本 repo 的 worktree 有「HEAD 引用未跟踪 grafted 文件、干净 worktree 跑不起来」的坑（记忆 `worktree-broken-head-snapshot-baseline`），代价高于收益。**改为在 main 直接开发，每个 task 用文件级 `git add <具体文件>` 原子提交**，与 WIP 天然隔离（记忆 `ff-merge-to-main-with-dirty-tree` / `graft-disjoint-regions`）。

---

## File Map

- **Modify** `apps/server/src/modules/html-templates/html-templates.service.ts` — 加 `createRecipeVersion` + `recomputeRecipe` 两个方法；加 `mapCampaign` import。
- **Modify** `apps/server/src/modules/html-templates/html-templates.service.test.ts` — 扩 prismaMock + mapCampaign mock，加两组用例。
- **Modify** `apps/server/src/modules/html-templates/html-templates.schema.ts` — 加 `createRecipeVersionSchema` + `recomputeSchema`。
- **Modify** `apps/server/src/modules/html-templates/html-templates.controller.ts` — 加 `createRecipeVersion` + `recompute` 两个 handler。
- **Modify** `apps/server/src/modules/html-templates/html-templates.routes.ts` — 加两条 POST 路由。
- **Modify** `apps/web/src/api/htmlTemplates.ts` — 加 `createRecipeVersion` + `recomputeRecipe` 方法。
- **Modify** `apps/web/src/routes/HtmlStudio.tsx` — `handleGenerate` recipe 分支改走 `createRecipeVersion`；RecipeEditor 加 `key` 强制 reload 重挂。
- **Modify** `apps/web/src/editor/components/recipe-editor/DataPanel.tsx` — 加 `versionId` prop，「重新生成」改走 `recomputeRecipe`。
- **Modify** `apps/web/src/editor/components/recipe-editor/RecipeEditor.tsx` — 透传 `versionId`，重算成功触发 `onSaved` 重载。

---

## Task 1: G3 — 修复 mediaket DB 鉴权（ops 前提，最先做）

**Why first:** 后端代码可用 vitest mock 测，但要**重启 server 部署 / 手动验证 / G4 转换**都必须新建 DB 连接，而 `mediaket@%` 现在是 `sha256_password`，prisma 5.22 新连接全挂。

- [ ] **Step 1: 修 docker CLI 脱节**

当前 `docker ps` 列不出 `mediaket-mysql-1`（虽 :3317 LISTEN、server 旧池活着）。先让 CLI 重新看到容器：

```bash
docker context use default
docker ps --format '{{.Names}}\t{{.Status}}' | grep mediaket-mysql
```

Expected: 看到 `mediaket-mysql-1  Up ... (healthy)`。若仍看不到，重启 Docker Desktop 后重试。

- [ ] **Step 2: 取容器 id**

```bash
CID=$(docker ps -q --filter name=mediaket-mysql)
echo "$CID"   # 应输出一串容器 id
```

- [ ] **Step 3: 改 auth 插件为 caching_sha2_password**

```bash
docker exec -e MYSQL_PWD=mediaket_root "$CID" mysql -uroot -h127.0.0.1 -N \
  -e "ALTER USER 'mediaket'@'%' IDENTIFIED WITH caching_sha2_password BY 'mediaket_pw'; FLUSH PRIVILEGES; SELECT user,host,plugin FROM mysql.user WHERE user='mediaket';"
```

Expected: 一行 `mediaket	%	caching_sha2_password`（密码仍 `mediaket_pw`，与 `apps/server/.env` 的 `DATABASE_URL` 一致）。

- [ ] **Step 4: 验证新 prisma 连接成功**

写一次性探针 `apps/server/prisma/_probe.ts`：
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
const n = await prisma.project.count();
console.log('FRESH PRISMA OK — project count:', n);
await prisma.$disconnect();
```
运行后删除：
```bash
DATABASE_URL="mysql://mediaket:mediaket_pw@localhost:3317/mediaket" \
  apps/server/node_modules/.bin/tsx apps/server/prisma/_probe.ts
rm apps/server/prisma/_probe.ts
```
Expected: `FRESH PRISMA OK — project count: <N>`，不再报 `Unknown authentication plugin 'sha256_password'`。

> 无代码改动，无需 commit。server 旧池不受影响；此步后 server 可安全重启。

---

## Task 2: G1 后端 service — `createRecipeVersion`（TDD）

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`（加 import + 在对象末尾 `saveRecipeConfig` 后加方法）
- Test: `apps/server/src/modules/html-templates/html-templates.service.test.ts`

- [ ] **Step 1: 扩测试 mock（prisma + mapCampaign）**

在 `html-templates.service.test.ts` 顶部，把现有 `prismaMock` 改为（加 `project.update`、`htmlVersion.create`、`htmlVersion.updateMany`）：
```ts
const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  campaign: { findUnique: vi.fn() },
  htmlVersion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

// mapCampaign 打桩:createRecipeVersion/recomputeRecipe 依赖它,避免真查 campaign
const mapCampaignMock = vi.hoisted(() => vi.fn());
vi.mock('./recipe/campaign-report/mapper', () => ({ mapCampaign: mapCampaignMock }));
```
（保留原有 `fakeRender` / `vi.spyOn(recipeMod, 'getRecipe')` 段落不动。）

- [ ] **Step 2: 写失败用例**

在 `beforeEach` 内加 `mapCampaignMock.mockReset();`，并在文件末尾追加：
```ts
describe('html-templates.service · createRecipeVersion', () => {
  it('无 campaignId → 400,不建版本', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ meta: {} });
    await expect(
      htmlTemplateService.createRecipeVersion('prj1', 'u1', {
        reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mapCampaignMock).not.toHaveBeenCalled();
    expect(prismaMock.htmlVersion.create).not.toHaveBeenCalled();
  });

  it('有 campaignId → 停用旧 active + 建 recipe 版本 + 同步 meta.reportPeriod', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ meta: { campaignId: 'camp-x' } });
    mapCampaignMock.mockResolvedValue({ header: { period: { start: '2026-08-01', end: '2026-08-11' } } });
    prismaMock.project.update.mockResolvedValue({});
    prismaMock.htmlVersion.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.htmlVersion.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'ver_new', ...(data as object) }),
    );

    const res = await htmlTemplateService.createRecipeVersion('prj1', 'u1', {
      reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' },
    });

    expect(res).toEqual({ versionId: 'ver_new' });
    expect(mapCampaignMock).toHaveBeenCalledWith('camp-x', { startDate: '2026-08-01', endDate: '2026-08-11' });
    expect(prismaMock.htmlVersion.updateMany).toHaveBeenCalledWith({
      where: { projectId: 'prj1', isActive: true },
      data: { isActive: false },
    });
    expect(prismaMock.htmlVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'prj1',
        ownerId: 'u1',
        recipeId: 'campaign-report',
        isActive: true,
      }),
    });
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: 'prj1' },
      data: { meta: expect.objectContaining({ campaignId: 'camp-x', reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' } }) },
    });
  });

  it('未传 reportPeriod → 沿用 meta.reportPeriod 兜底', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      meta: { campaignId: 'camp-x', reportPeriod: { startDate: '2026-07-01', endDate: '2026-07-31' } },
    });
    mapCampaignMock.mockResolvedValue({});
    prismaMock.project.update.mockResolvedValue({});
    prismaMock.htmlVersion.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.htmlVersion.create.mockResolvedValue({ id: 'ver2' });

    await htmlTemplateService.createRecipeVersion('prj1', 'u1', {});
    expect(mapCampaignMock).toHaveBeenCalledWith('camp-x', { startDate: '2026-07-01', endDate: '2026-07-31' });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/html-templates.service.test.ts -t createRecipeVersion
```
Expected: FAIL（`htmlTemplateService.createRecipeVersion is not a function`）。

- [ ] **Step 4: 实现 service 方法**

在 `html-templates.service.ts` 顶部 import 段加：
```ts
import { mapCampaign } from './recipe/campaign-report/mapper';
```
在对象末尾 `saveRecipeConfig` 方法后（闭合 `},` 之后、最终 `};` 之前）加：
```ts
  /**
   * 创建一个 recipe 版本并设为 active:跑 mapCampaign → reportContent,
   * render → html,停用同 project 其它 active 版本后建版本,同步 meta.reportPeriod。
   */
  async createRecipeVersion(
    projectId: string,
    ownerId: string,
    opts: { recipeId?: string; reportPeriod?: { startDate?: string; endDate?: string } },
  ): Promise<{ versionId: string }> {
    const recipeId = opts.recipeId ?? 'campaign-report';
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { meta: true },
    });
    if (!project) throw ApiError.notFound('报告不存在');
    const meta = (project.meta as Record<string, unknown> | null) ?? {};
    const campaignId = meta.campaignId as string | undefined;
    if (!campaignId) {
      throw ApiError.badRequest('报告未绑定 Campaign,无法生成 recipe 报告');
    }
    const reportPeriod =
      opts.reportPeriod ?? (meta.reportPeriod as { startDate?: string; endDate?: string } | undefined);

    const reportContent = await mapCampaign(campaignId, reportPeriod);
    const html = await getRecipe(recipeId).render({ campaignId, reportContent });

    await prisma.htmlVersion.updateMany({
      where: { projectId, isActive: true },
      data: { isActive: false },
    });
    const version = await prisma.htmlVersion.create({
      data: { projectId, ownerId, name: 'Recipe 版本', recipeId, reportContent, html, isActive: true },
    });
    const newMeta = reportPeriod ? { ...meta, reportPeriod } : meta;
    await prisma.project.update({ where: { id: projectId }, data: { meta: newMeta } });
    return { versionId: version.id };
  },
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/html-templates.service.test.ts -t createRecipeVersion
```
Expected: 3 passed。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.service.ts apps/server/src/modules/html-templates/html-templates.service.test.ts
git commit -m "feat(html-templates): createRecipeVersion service 建 recipe 版本(G1)"
```

---

## Task 3: G1 后端 schema + controller + route

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.routes.ts`

- [ ] **Step 1: 加 schema**

在 `html-templates.schema.ts` 末尾加：
```ts
export const createRecipeVersionSchema = z.object({
  recipeId: z.string().optional(),
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
});

export const recomputeSchema = z.object({
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }),
});
```
（文件顶部已 `import { z } from 'zod'`，复用。）

- [ ] **Step 2: 加 controller handler**

在 `html-templates.controller.ts` 顶部 import 段把两个新 schema 加入已有的 `import { ... } from './html-templates.schema'`：
```ts
  createRecipeVersionSchema,
  recomputeSchema,
```
在 `autoSave` handler 后加：
```ts
  /** 创建 recipe 版本并设为 active(G1) */
  createRecipeVersion: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { projectId } = req.params;
    const { recipeId, reportPeriod } = req.body;
    const result = await htmlTemplateService.createRecipeVersion(projectId, auth.id, {
      recipeId,
      reportPeriod,
    });
    res.status(201).json(result);
  }),
```

- [ ] **Step 3: 加路由**

在 `html-templates.routes.ts` 顶部 schema import 段加 `createRecipeVersionSchema`，并在 `auto-save` 路由（`/projects/:projectId/auto-save`）后加：
```ts
// POST /api/v1/html-templates/projects/:projectId/recipe-version — 创建 recipe 版本(G1)
router.post(
  '/projects/:projectId/recipe-version',
  requireRole('ADMIN'),
  validate({ body: createRecipeVersionSchema }),
  htmlTemplateController.createRecipeVersion,
);
```

- [ ] **Step 4: 类型检查**

```bash
apps/server/node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit
```
Expected: exit 0。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.schema.ts apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/html-templates.routes.ts
git commit -m "feat(html-templates): POST /projects/:id/recipe-version 路由(G1)"
```

---

## Task 4: G2 后端 service — `recomputeRecipe`（TDD）

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`
- Test: `apps/server/src/modules/html-templates/html-templates.service.test.ts`

- [ ] **Step 1: 写失败用例**

在 `html-templates.service.test.ts` 追加：
```ts
describe('html-templates.service · recomputeRecipe', () => {
  it('非 recipe 版本 → 400', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue({ id: 'v1', projectId: 'prj1', recipeId: null });
    await expect(
      htmlTemplateService.recomputeRecipe('v1', { startDate: '2026-08-01', endDate: '2026-08-11' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mapCampaignMock).not.toHaveBeenCalled();
  });

  it('recipe 版本 → 重跑 mapCampaign 覆盖 reportContent/html + 同步 meta.reportPeriod', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue({ id: 'v1', projectId: 'prj1', recipeId: 'campaign-report' });
    prismaMock.project.findUnique.mockResolvedValue({ meta: { campaignId: 'camp-x' } });
    mapCampaignMock.mockResolvedValue({ header: { period: { start: '2026-08-01', end: '2026-08-11' } } });
    prismaMock.htmlVersion.update.mockResolvedValue({});
    prismaMock.project.update.mockResolvedValue({});

    const res = await htmlTemplateService.recomputeRecipe('v1', { startDate: '2026-08-01', endDate: '2026-08-11' });

    expect(res).toEqual({ versionId: 'v1' });
    expect(mapCampaignMock).toHaveBeenCalledWith('camp-x', { startDate: '2026-08-01', endDate: '2026-08-11' });
    expect(prismaMock.htmlVersion.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { reportContent: expect.any(Object), html: expect.any(String) },
    });
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: 'prj1' },
      data: { meta: expect.objectContaining({ campaignId: 'camp-x', reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' } }) },
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/html-templates.service.test.ts -t recomputeRecipe
```
Expected: FAIL（`recomputeRecipe is not a function`）。

- [ ] **Step 3: 实现 service 方法**

在 `createRecipeVersion` 方法后加：
```ts
  /**
   * 按新 reportPeriod 重算 recipe 版本:重跑 mapCampaign 覆盖 reportContent + html,
   * 同步 Project.meta.reportPeriod。仅 recipe 版本可用。
   */
  async recomputeRecipe(
    versionId: string,
    reportPeriod: { startDate?: string; endDate?: string },
  ): Promise<{ versionId: string }> {
    const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
    if (!version) throw ApiError.notFound('HTML 版本不存在');
    if (!version.recipeId) throw ApiError.badRequest('该版本不是 recipe 报告');

    const project = await prisma.project.findUnique({
      where: { id: version.projectId },
      select: { meta: true },
    });
    const meta = (project?.meta as Record<string, unknown> | null) ?? {};
    const campaignId = (meta.campaignId as string | undefined) ?? '';
    if (!campaignId) throw ApiError.badRequest('报告未绑定 Campaign,无法重算');

    const reportContent = await mapCampaign(campaignId, reportPeriod);
    const html = await getRecipe(version.recipeId).render({ campaignId, reportContent });

    await prisma.htmlVersion.update({ where: { id: versionId }, data: { reportContent, html } });
    await prisma.project.update({
      where: { id: version.projectId },
      data: { meta: { ...meta, reportPeriod } },
    });
    return { versionId };
  },
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/html-templates.service.test.ts -t recomputeRecipe
```
Expected: 2 passed。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.service.ts apps/server/src/modules/html-templates/html-templates.service.test.ts
git commit -m "feat(html-templates): recomputeRecipe service 换时间段重算落库(G2)"
```

---

## Task 5: G2 后端 controller + route

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.routes.ts`

- [ ] **Step 1: 加 controller handler**

在 `createRecipeVersion` handler 后加：
```ts
  /** 按新时间段重算 recipe 版本(G2) */
  recompute: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    const { reportPeriod } = req.body;
    const result = await htmlTemplateService.recomputeRecipe(versionId, reportPeriod);
    res.json(result);
  }),
```

- [ ] **Step 2: 加路由**

在 `html-templates.routes.ts` 顶部 schema import 段加 `recomputeSchema`，并在 `recipe-config` 路由（`/html-versions/:versionId/recipe-config`）后加：
```ts
// POST /api/v1/html-templates/html-versions/:versionId/recompute — 换时间段重算(G2)
router.post(
  '/html-versions/:versionId/recompute',
  validate({ body: recomputeSchema }),
  htmlTemplateController.recompute,
);
```

- [ ] **Step 3: 类型检查**

```bash
apps/server/node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit
```
Expected: exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/html-templates.routes.ts
git commit -m "feat(html-templates): POST /html-versions/:id/recompute 路由(G2)"
```

---

## Task 6: 后端手动验证（依赖 Task 1 的 DB auth）

- [ ] **Step 1: 重启 server**

DB auth 已修（Task 1），新连接可建立。重启 dev server（按你平时的方式，例如重跑 `pnpm dev` 或重启 IDE 里的 server 进程）。确认 `:4000` 起来、日志无 `sha256_password` / 连接错误。

- [ ] **Step 2: 用 dev token 打 createRecipeVersion**

复用本会话验证过的方法：用 `JWT_ACCESS_SECRET=dev-access-secret-change-me` 给 admin 用户 `cmr48ukqo000014isepy48i6b` 签 access token，然后：
```bash
curl -sS -X POST http://localhost:4000/api/v1/html-templates/projects/cmso5ho500000jatg0hv9vd05/recipe-version \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"reportPeriod":{"startDate":"2026-08-01","endDate":"2026-08-11"}}'
```
Expected: `{"ok":true,"versionId":"..."}`（或 201）。若 500 看 server 日志。

> 生成 token 的 node 片段（HS256）：
> ```js
> const c=require('crypto'),sec='dev-access-secret-change-me',n=Math.floor(Date.now()/1000);
> const p={role:'ADMIN',type:'access',sub:'cmr48ukqo000014isepy48i6b',iat:n,exp:n+900};
> const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
> const h=b({alg:'HS256',typ:'JWT'}),P=b(p),s=c.createHmac('sha256',sec).update(`${h}.${P}`).digest('base64url');
> console.log(`${h}.${P}.${s}`);
> ```

- [ ] **Step 3: 验证版本已建**

```bash
curl -sS http://localhost:4000/api/v1/html-templates/projects/cmso5ho500000jatg0hv9vd05/html-versions \
  -H "Authorization: Bearer <token>"
```
Expected: 列表里有一条 `recipeId: "campaign-report"`、`isActive: true` 的版本。

> 无代码改动。此时该报告已是真 recipe 版本（顺带完成 G4 的核心；G4 task 仅剩 UI 侧确认）。

---

## Task 7: G1 前端 — api 方法 + HtmlStudio 接线

**Files:**
- Modify: `apps/web/src/api/htmlTemplates.ts`
- Modify: `apps/web/src/routes/HtmlStudio.tsx`

- [ ] **Step 1: 加 api 方法**

在 `htmlTemplates.ts` 的 `saveRecipeConfig` 方法后加：
```ts
  /** 创建 recipe 版本并设为 active(G1)。成功后需重载版本列表。 */
  createRecipeVersion: (
    projectId: string,
    input: { recipeId?: string; reportPeriod?: { startDate?: string; endDate?: string } },
  ) =>
    api
      .post<{ ok: boolean; versionId: string }>(
        `/html-templates/projects/${projectId}/recipe-version`,
        input,
      )
      .then((r) => r.data),
```

- [ ] **Step 2: 改 HtmlStudio.handleGenerate 的 recipe 分支**

在 `HtmlStudio.tsx`，把 `handleGenerate` 改为 recipe 模式走 `createRecipeVersion` + 重载版本；AI 分支不动。把现有 `try {` 块内的首行（`const html = await htmlTemplatesApi.generate(...)`）之前插入 recipe 早返回：

定位现有代码（约 158-166 行）：
```tsx
      try {
        const html = await htmlTemplatesApi.generate({
          mode: vals.mode,
          prompt: vals.mode === 'ai' ? vals.prompt : undefined,
          campaignId,
          designMd: vals.mode === 'ai' && vals.designMd.trim() ? vals.designMd.trim() : undefined,
          reportPeriod,
        });
        setGeneratedHtml(html);
```
改为：
```tsx
      try {
        if (vals.mode === 'recipe') {
          // ★ recipe 模式:直接建 recipe 版本(后端 mapCampaign + render),不走 AI
          const { versionId } = await htmlTemplatesApi.createRecipeVersion(id!, { reportPeriod });
          const vs = await htmlTemplatesApi.listHtmlVersions(id!);
          const activeId = vs.find((v) => v.isActive)?.id ?? versionId;
          const v = await htmlTemplatesApi.getHtmlVersion(activeId);
          setActiveVersion(v);
          setGeneratedHtml(v.html);
          setSaved(true);
          void updateAiHtmlStatus('generated');
          setPhase('chat');
          setAgentHistory([
            { role: 'assistant', content: '✨ recipe 报告已生成(数据驱动),可在左侧改时间段/样式秒级重算。', action: 'generate', ts: new Date().toISOString() },
          ]);
          return;
        }
        const html = await htmlTemplatesApi.generate({
          mode: vals.mode,
          prompt: vals.prompt,
          campaignId,
          designMd: vals.designMd.trim() ? vals.designMd.trim() : undefined,
          reportPeriod,
        });
        setGeneratedHtml(html);
```
（recipe 分支不再需要 `autoSave`——版本已建。AI 分支保留其后的 autoSave 逻辑不动。）

- [ ] **Step 3: RecipeEditor 加 key，确保版本重载后重挂**

在 `HtmlStudio.tsx` 渲染 `RecipeEditor` 处（约 306 行 `<RecipeEditor ... />`）加 `key`，让 `reloadVersion` 后 `updatedAt` 变化触发重挂（新 reportContent 注入 state）：
```tsx
          <RecipeEditor
            key={`${activeVersion.id}-${activeVersion.updatedAt}`}
            versionId={activeVersion.id}
            ...
```

- [ ] **Step 4: web 类型检查**

```bash
apps/web/node_modules/.bin/tsc -b --force
```
Expected: exit 0（记忆 `web-tsc-build-is-ci-only-gate`）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/api/htmlTemplates.ts apps/web/src/routes/HtmlStudio.tsx
git commit -m "feat(web): recipe 生成走 createRecipeVersion + RecipeEditor 重载 key(G1)"
```

---

## Task 8: G2 前端 — api 方法 + DataPanel/RecipeEditor 接线

**Files:**
- Modify: `apps/web/src/api/htmlTemplates.ts`
- Modify: `apps/web/src/editor/components/recipe-editor/DataPanel.tsx`
- Modify: `apps/web/src/editor/components/recipe-editor/RecipeEditor.tsx`

- [ ] **Step 1: 加 api 方法**

在 `htmlTemplates.ts` 的 `createRecipeVersion` 后加：
```ts
  /** 按新时间段重算 recipe 版本并落库(G2)。成功后需重载版本。 */
  recomputeRecipe: (versionId: string, reportPeriod: { startDate?: string; endDate?: string }) =>
    api
      .post<{ ok: boolean; versionId: string }>(
        `/html-templates/html-versions/${versionId}/recompute`,
        { reportPeriod },
      )
      .then((r) => r.data),
```

- [ ] **Step 2: DataPanel 加 versionId + 走 recompute**

`DataPanel.tsx` Props 加 `versionId?: string` 与重算完成回调：
```ts
interface Props {
  campaignId?: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  versionId?: string;
  /** recompute 成功(已落库)后回调,父组件重载版本。 */
  onRecomputed?: () => void;
  /** 旧 generate 路径(无 versionId 时)预览回调,保留兼容。 */
  onRegenerated?: (html: string) => void;
}
```
函数签名解构加 `versionId, onRecomputed`：
```tsx
export function DataPanel({ campaignId: initialCampaignId, reportPeriod: initialPeriod, versionId, onRecomputed, onRegenerated }: Props) {
```
`handleRegenerate` 改为优先走 recompute：
```tsx
  const handleRegenerate = async () => {
    if (!campaignId.trim()) { setError('请填写 Campaign ID'); return; }
    setLoading(true); setError('');
    try {
      if (versionId) {
        await htmlTemplatesApi.recomputeRecipe(versionId, {
          reportPeriod: { startDate: startDate || undefined, endDate: endDate || undefined },
        });
        onRecomputed?.();  // 父组件重载版本(新 reportContent 注入)
      } else {
        const html = await htmlTemplatesApi.generate({
          mode: 'recipe',
          campaignId: campaignId.trim(),
          reportPeriod: { startDate: startDate || undefined, endDate: endDate || undefined },
        });
        onRegenerated?.(html);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || '重新生成失败');
    } finally {
      setLoading(false);
    }
  };
```
顶部注释把「v1 不落库」一句更新为「有 versionId 时走 recompute 落库」。

- [ ] **Step 3: RecipeEditor 透传 versionId + onRecomputed→onSaved**

`RecipeEditor.tsx` 渲染 `DataPanel` 处（约 86-90 行）改为：
```tsx
        <DataPanel
          campaignId={props.campaignId}
          reportPeriod={props.reportPeriod}
          versionId={props.versionId}
          onRecomputed={() => props.onSaved?.()}
          onRegenerated={handleRegenerated}
        />
```
（`onRecomputed` 复用 `onSaved` → 父组件 `reloadVersion`；配合 Task 7 的 `key` 重挂，新 reportContent 注入。）

- [ ] **Step 4: web 类型检查**

```bash
apps/web/node_modules/.bin/tsc -b --force
```
Expected: exit 0。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/api/htmlTemplates.ts apps/web/src/editor/components/recipe-editor/DataPanel.tsx apps/web/src/editor/components/recipe-editor/RecipeEditor.tsx
git commit -m "feat(web): DataPanel 重新生成走 recomputeRecipe 落库(G2)"
```

---

## Task 9: CI 门 + 回归

- [ ] **Step 1: server 全量类型检查 + 测试**

```bash
apps/server/node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit
cd apps/server && pnpm vitest run
```
Expected: tsc exit 0；vitest 全绿（含新 createRecipeVersion/recomputeRecipe 用例，原有用例不破）。

- [ ] **Step 2: web 类型检查 + 测试**

```bash
apps/web/node_modules/.bin/tsc -b --force
cd apps/web && pnpm vitest run   # 记忆:从 apps/web 绝对路径跑,避免 root 递归盖掉结果
```
Expected: tsc exit 0；vitest 全绿（recharts mocked，只断言 shell 文本——记忆 `web-chart-test-convention`）。

- [ ] **Step 3: 端到端手测**

1. 重启 server（DB auth 已修）。
2. 浏览器开 `/projects/cmso5ho500000jatg0hv9vd05/html-studio`，刷新 → 应进 RecipeEditor（左四层面板 + 右预览），趋势显示 8/1~8/11。
3. DataPanel 改起止日期（如 2026-07-01~2026-07-31）→ 点「重新生成」→ 预览应秒级换成 7 月数据；刷新页面仍为 7 月（已落库）。
4. AI 模式（重新生成→选 AI）仍可走旧路径（回归不破）。

> 无代码改动。若手测发现回归,回到对应 task 修。

---

## Task 10: G4 — 转换既有 test 报告（若 Task 6 已建版本则仅核对）

- [ ] **Step 1: 确认是否已有 recipe 版本**

```bash
curl -sS http://localhost:4000/api/v1/html-templates/projects/cmso5ho500000jatg0hv9vd05/html-versions \
  -H "Authorization: Bearer <token>" | grep -o 'recipeId":"[^"]*"\|isActive":[a-z]*'
```
若已出现 `recipeId":"campaign-report"` + `isActive":true`（Task 6 Step 2 已建），跳到 Step 3。

- [ ] **Step 2: 否则建 recipe 版本**

```bash
curl -sS -X POST http://localhost:4000/api/v1/html-templates/projects/cmso5ho500000jatg0hv9vd05/recipe-version \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"reportPeriod":{"startDate":"2026-08-01","endDate":"2026-08-11"}}'
```
Expected: `{"ok":true,"versionId":"..."}`。

- [ ] **Step 3: 核对 meta.reportPeriod 与版本数据一致**

```bash
curl -sS http://localhost:4000/api/v1/projects/cmso5ho500000jatg0hv9vd05 -H "Authorization: Bearer <token>" \
  | grep -o 'reportPeriod":{[^}]*}'
```
Expected: `{"startDate":"2026-08-01","endDate":"2026-08-11"}`——标签与数据现在一致（彻底修复的验收点）。

> 无代码改动。

---

## Self-Review（写完后自查,已修正）

1. **Spec 覆盖**:G1→Task 2/3/7;G2→Task 4/5/8;G3→Task 1;G4→Task 6/10;worktree→改为 main 原子提交(§隔离策略,已在 plan 顶部说明对 spec §9 的修正);测试→Task 2/4 单测 + Task 9 CI 门 + 手测。全覆盖。
2. **占位符扫描**:无 TBD/TODO;每步含完整代码或确切命令。
3. **类型一致性**:`createRecipeVersion(projectId, ownerId, opts)` 在 service(Task 2)/controller(Task 3)/api(Task 7) 签名一致;`recomputeRecipe(versionId, reportPeriod)` 在 service(Task 4)/controller(Task 5)/api(Task 8) 一致;路由路径 `/projects/:projectId/recipe-version`、`/html-versions/:versionId/recompute` 前后端一致;DataPanel prop `versionId`/`onRecomputed` 在 DataPanel(Task 8)/RecipeEditor(Task 8) 一致。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-recipe-mode-completion.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 每个 task 派新 subagent,task 间 review,迭代快。
2. **Inline Execution** — 本会话按 executing-plans 批量执行,带 checkpoint。

Which approach?
