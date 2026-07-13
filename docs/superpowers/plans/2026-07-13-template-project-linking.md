# 模板分类关联 + 业务线驱动默认套用 Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给模板加「模版类型」分类(场景下细分),让新建项目在选定业务线/场景/模版类型后自动套用对应默认模板的页面骨架与样式。

**Architecture:** 全部新增字段落在 `meta` JSON(零 Prisma 迁移)。`Template` 与 `Project` 复用 `projectMetaSchema`;模板侧额外 `extends` 出 `templateMetaSchema`(加 `isDefault`)。新建项目时服务端按 `(businessLine, scenario, templateType, isDefault=true, PUBLISHED)` 查默认模板,命中则深拷贝其 `pages`+`width/height`+`meta.theme` 作为骨架。设默认用独立 `setDefault` 端点,事务内清同格其它默认。

**Tech Stack:** Node/Express + Prisma(MySQL) + Zod(server);React + Vite + Zustand + axios(web);共享类型 `@mediakit/shared`;测试 vitest(server 走真实测试库 supertest;web 走 jsdom + Testing Library)。

**Spec:** `docs/superpowers/specs/2026-07-13-template-project-linking-design.md`(在 `design/template-project-linking` 分支)。

**Execution context:** 实现前先用 `superpowers:using-git-worktrees` 开独立 worktree,基线用 `head`(当前 `design/template-project-linking` 分支,含 spec)。每个任务一个原子提交(`git add <具体文件> && git commit`,一条命令内完成——IDE 会跨调用清空暂存区)。

**测试库前置:** server 测试需要测试库 `mysql://mediakit:mediakit_pw@localhost:3317/mediakit_test`(global-setup 自动建库 + migrate deploy)。确认 MySQL 容器在跑。

**与 spec 的偏离(已定):** spec §6.1 原写「TemplateFormDialog 复选框设默认」。规划阶段改为更简洁的**列表行「设为默认/取消默认」按钮**(Task 6),避开「新建即 DRAFT 不能设默认」的表单状态复杂度。设默认的约束(需 PUBLISHED + 三字段齐全 + 事务清同格)不变。

---

## File Structure(改动地图)

**新建**
- `apps/server/tests/templates.test.ts` — setDefault + 列表过滤的集成测试

**修改 · 共享类型**
- `packages/shared/src/types/theme.ts` — `ProjectMeta` 加 `templateType`
- `packages/shared/src/types/template.ts` — 新增 `TemplateMeta` 类型,`TemplateSummary/Detail.meta` 改用之

**修改 · server**
- `apps/server/src/modules/projects/projects.schema.ts` — `projectMetaSchema` 加 `templateType`;导出 `templateMetaSchema`(extends + `isDefault`);导出 `setDefaultSchema`
- `apps/server/src/modules/templates/templates.schema.ts` — `create/updateTemplateSchema` 改用 `templateMetaSchema`;加 `setDefaultSchema`(如未在 projects.schema 导出)
- `apps/server/src/modules/templates/templates.service.ts` — `list` 加 `templateType/isDefault` 过滤(并修 `meta` 被覆盖的 latent bug);新增 `setDefault`
- `apps/server/src/modules/templates/templates.controller.ts` — `list` 透传新过滤参数;新增 `setDefault`
- `apps/server/src/modules/templates/templates.routes.ts` — `PATCH /:id/default`
- `apps/server/src/modules/projects/projects.service.ts` — `create()` 解析默认模板并套骨架;返回 `{ detail, seeded }`
- `apps/server/src/modules/projects/projects.controller.ts` — `create` 透传 `seeded`
- `apps/server/tests/setup.ts` — `afterEach` 增加 `TRUNCATE TABLE Template`(模板测试隔离)
- `apps/server/tests/projects.schema.test.ts` — `templateType/isDefault` 校验用例
- `apps/server/tests/projects.test.ts` — 套用默认模板用例

**修改 · web**
- `apps/web/src/projectsMeta.ts` — `TEMPLATE_TYPES` / `TEMPLATE_TYPE_LABELS`
- `apps/web/src/api/templates.ts` — `list` 参数加 `templateType/isDefault`;新增 `setDefault`
- `apps/web/src/api/projects.ts` — `create` 返回 `{ project, seeded }`
- `apps/web/src/components/TemplateFormDialog.tsx` — 模版类型级联下拉
- `apps/web/src/components/CreateProjectDialog.tsx` — 业务线顶层必填 + 模版类型级联(campaign-report 双写 scenarioSub)
- `apps/web/src/components/CreateFromTemplateDialog.tsx` — 业务线/场景/模版类型过滤 + 默认徽标
- `apps/web/src/routes/Templates.tsx` — 模版类型筛选列 + 默认徽标 + 设/取消默认按钮;`toInitial` 带 templateType
- `apps/web/src/routes/Projects.tsx` — `handleCreate` 消费 `{project, seeded}`;套用提示

---

## Task 1: 共享类型 + server schema(templateType / TemplateMeta / isDefault)

**Files:**
- Modify: `packages/shared/src/types/theme.ts`(`ProjectMeta`)
- Modify: `packages/shared/src/types/template.ts`(`TemplateMeta` + Summary/Detail)
- Modify: `apps/server/src/modules/projects/projects.schema.ts`
- Modify: `apps/server/src/modules/templates/templates.schema.ts`
- Test: `apps/server/tests/projects.schema.test.ts`

- [ ] **Step 1: 写失败测试** — 在 `apps/server/tests/projects.schema.test.ts` 末尾追加:

```ts
import { createTemplateSchema } from '../src/modules/templates/templates.schema';

describe('projectMetaSchema — templateType / isDefault', () => {
  it('createProjectSchema 接受 meta.templateType(任意字符串)', () => {
    const out = createProjectSchema.parse({ name: 'n', meta: { templateType: 'weekly' } });
    expect(out.meta?.templateType).toBe('weekly');
  });

  it('createProjectSchema 不强求 templateType(向后兼容)', () => {
    const out = createProjectSchema.parse({ name: 'n', meta: { businessLine: 'FT' } });
    expect(out.meta?.templateType).toBeUndefined();
  });

  it('createTemplateSchema 接受 meta.isDefault', () => {
    const out = createTemplateSchema.parse({
      name: 't',
      meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
    });
    expect(out.meta?.isDefault).toBe(true);
  });

  it('createProjectSchema 剥离 isDefault(项目不持有该字段)', () => {
    // projectMetaSchema 不含 isDefault → Zod 默认 strip 未知键。
    const out = createProjectSchema.parse({
      name: 'n',
      meta: { businessLine: 'FT', isDefault: true } as never,
    });
    expect((out.meta as { isDefault?: boolean })?.isDefault).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server test tests/projects.schema.test.ts`
Expected: FAIL — `templateType`/`isDefault` 解析为 undefined(字段未声明)。

- [ ] **Step 3: 共享类型** — `packages/shared/src/types/theme.ts` 的 `ProjectMeta`(约 140-157 行),在 `scenarioSub` 后插入 `templateType`:

```ts
export interface ProjectMeta {
  /** 业务线:FT/SM/CX/DG/KN/DM 等。 */
  businessLine?: string;
  /** 创建人。 */
  creator?: string;
  scenario?: Scenario;
  /** Campaign 报告子类(仅 scenario=campaign-report)。 */
  scenarioSub?: ScenarioSub;
  /** 模版类型:场景下的细分(周报/月报/总结 等),与模板对应。campaign-report 时与 scenarioSub 同值。 */
  templateType?: string;
  /** 广告主。 */
  advertiser?: string;
  /** 选中的上游 campaign id(campaign 类型场景)。 */
  campaignId?: string;
  campaignInfo?: CampaignInfo;
  /** 报告主题(品牌色等)。 */
  theme?: ProjectTheme;
  /** 报告全局数据上下文(Campaign + 达人),「数据配置」面板编辑,随项目保存。 */
  reportData?: ReportDataContext;
}
```

- [ ] **Step 4: 模板 meta 类型** — `packages/shared/src/types/template.ts` 顶部 import 后加 `TemplateMeta`,并把两个 interface 的 `meta?: ProjectMeta` 改成 `meta?: TemplateMeta`:

```ts
import type { ProjectMeta } from './theme';
import type { Page } from './page';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

/**
 * 模板元数据:在 ProjectMeta 基础上增加 isDefault(仅模板有意义)。
 * isDefault 标记该模板为 (businessLine×scenario×templateType) 格的默认模板,
 * 新建项目时按此格自动套用骨架。Project 不使用该字段。
 */
export type TemplateMeta = ProjectMeta & { isDefault?: boolean };

export interface TemplateSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  pageCount: number;
  meta?: TemplateMeta;
  status: TemplateStatus;
  /** 设计师备注(仅管理后台可见)。 */
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  meta?: TemplateMeta;
  status: TemplateStatus;
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 5: server schema** — `apps/server/src/modules/projects/projects.schema.ts`,把 `projectMetaSchema`(约 240-253 行)重构成「字段对象 + 两个 schema」:

```ts
/** 项目/模板共用的 meta 字段集合(templateType 为本期新增)。 */
const projectMetaFields = {
  businessLine: z.string().max(40).optional(),
  creator: z.string().max(80).optional(),
  scenario: z.enum(['campaign-report', 'campaign-proposal', 'media-kit']).optional(),
  scenarioSub: z.enum(['weekly', 'monthly', 'wrap-up']).optional(),
  /** 模版类型:场景下细分,松字符串,取值由前端字典约束。 */
  templateType: z.string().max(40).optional(),
  advertiser: z.string().max(120).optional(),
  campaignId: z.string().max(120).optional(),
  campaignInfo: campaignInfoSchema,
  theme: projectThemeSchema,
  reportData: reportDataContextSchema,
};

/** 项目元数据 schema(Template 与 Project 共用同一 meta 结构)。 */
export const projectMetaSchema = z.object(projectMetaFields).optional();

/** 模板 meta:在项目 meta 基础上增加 isDefault(默认模板标记,仅模板用)。 */
export const templateMetaSchema = z
  .object({ ...projectMetaFields, isDefault: z.boolean().optional() })
  .optional();

/** 设/取消默认模板的 body 校验。 */
export const setDefaultSchema = z.object({ value: z.boolean() });
```

> 同时删掉原 `projectMetaSchema` 的整块 `z.object({...}).optional()` 定义(被上面替代)。`createProjectSchema`/`updateProjectSchema` 里 `meta: projectMetaSchema` 引用保持不变。

- [ ] **Step 6: templates.schema 改用 templateMetaSchema** — `apps/server/src/modules/templates/templates.schema.ts`:

```ts
import { z } from 'zod';
import { pageSchema, templateMetaSchema, setDefaultSchema } from '../projects/projects.schema';

export const templateStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  width: z.number().int().min(1).max(8192).optional(),
  height: z.number().int().min(1).max(8192).optional(),
  pages: z.array(pageSchema).optional(),
  meta: templateMetaSchema,
  note: z.string().max(1000).optional(),
});

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    width: z.number().int().min(1).max(8192).optional(),
    height: z.number().int().min(1).max(8192).optional(),
    pages: z.array(pageSchema).optional(),
    meta: templateMetaSchema,
    note: z.string().max(1000).nullable().optional(),
    status: templateStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const idParamSchema = z.object({ id: z.string().min(1) });

export { setDefaultSchema };

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
```

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server test tests/projects.schema.test.ts`
Expected: PASS(含新 4 条)。

- [ ] **Step 8: typecheck**

Run: `pnpm --filter @mediakit/server typecheck && pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 9: 提交**

```bash
git add packages/shared/src/types/theme.ts packages/shared/src/types/template.ts apps/server/src/modules/projects/projects.schema.ts apps/server/src/modules/templates/templates.schema.ts apps/server/tests/projects.schema.test.ts && git commit -m "feat(schema): add templateType + TemplateMeta/isDefault to project/template meta" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: server — setDefault 端点 + list 过滤 + 模板表清理

**Files:**
- Modify: `apps/server/tests/setup.ts`
- Modify: `apps/server/src/modules/templates/templates.service.ts`
- Modify: `apps/server/src/modules/templates/templates.controller.ts`
- Modify: `apps/server/src/modules/templates/templates.routes.ts`
- Create: `apps/server/tests/templates.test.ts`

- [ ] **Step 1: 写失败测试** — 新建 `apps/server/tests/templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

async function setupAdmin(email: string) {
  const u = await createUser({ email, role: 'ADMIN' });
  const { accessToken } = await login(app(), u.email);
  return { user: u, h: authHeader(accessToken) };
}

const CELL = { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' };

/** 建模板(默认 DRAFT)→ 按需发布 → 返回 id。 */
async function mkTemplate(
  h: Record<string, string>,
  name: string,
  meta: object = CELL,
  publish = true,
): Promise<string> {
  const created = await request(app()).post('/api/v1/templates').set(h).send({ name, meta });
  const id = created.body.template.id;
  if (publish) {
    await request(app()).patch(`/api/v1/templates/${id}`).set(h).send({ status: 'PUBLISHED' });
  }
  return id;
}

describe('templates — default + filter', () => {
  it('设默认:同格其它默认被清零', async () => {
    const { h } = await setupAdmin('tpl-a@x.com');
    const t1 = await mkTemplate(h, 'T1');
    const t2 = await mkTemplate(h, 'T2');

    await request(app()).patch(`/api/v1/templates/${t1}/default`).set(h).send({ value: true });
    await request(app()).patch(`/api/v1/templates/${t2}/default`).set(h).send({ value: true });

    const t1b = await request(app()).get(`/api/v1/templates/${t1}`).set(h);
    const t2b = await request(app()).get(`/api/v1/templates/${t2}`).set(h);
    expect(t1b.body.template.meta.isDefault).toBe(false);
    expect(t2b.body.template.meta.isDefault).toBe(true);
  });

  it('DRAFT 模板设默认 → 400', async () => {
    const { h } = await setupAdmin('tpl-b@x.com');
    const t = await mkTemplate(h, 'D', CELL, false); // 不发布
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    expect(res.status).toBe(400);
  });

  it('缺 templateType 设默认 → 400', async () => {
    const { h } = await setupAdmin('tpl-c@x.com');
    const t = await mkTemplate(h, 'NT', { businessLine: 'FT', scenario: 'campaign-report' });
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    expect(res.status).toBe(400);
  });

  it('取消默认:isDefault 置 false', async () => {
    const { h } = await setupAdmin('tpl-d@x.com');
    const t = await mkTemplate(h, 'U');
    await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: false });
    expect(res.status).toBe(200);
    expect(res.body.template.meta.isDefault).toBe(false);
  });

  it('list 按 templateType + isDefault 过滤', async () => {
    const { h } = await setupAdmin('tpl-e@x.com');
    const t = await mkTemplate(h, 'F');
    await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    // 另一个同场景不同模版类型、非默认
    await mkTemplate(h, 'G', { ...CELL, templateType: 'monthly' });

    const res = await request(app())
      .get('/api/v1/templates')
      .set(h)
      .query({ templateType: 'weekly', isDefault: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0].id).toBe(t);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server test tests/templates.test.ts`
Expected: FAIL — `PATCH /templates/:id/default` 返回 404(路由未注册)。

- [ ] **Step 3: setup.ts 增加模板表清理** — `apps/server/tests/setup.ts` 的 `afterEach` 加一行 `TRUNCATE TABLE Template`:

```ts
afterEach(async () => {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE Project');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE Template');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE User');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  await redis.flushdb();
});
```

- [ ] **Step 4: service — list 过滤 + setDefault** — `apps/server/src/modules/templates/templates.service.ts`:

import 行(顶部 type 引入)加 `TemplateMeta`:

```ts
import type {
  Page,
  ProjectMeta,
  TemplateDetail,
  TemplateMeta,
  TemplateSummary,
} from '@mediakit/shared';
```

替换 `list` 方法(整块替换原 `list`,修掉 `where.meta` 被后写覆盖的 bug):

```ts
  /**
   * 列表:ADMIN 看全部(含草稿),普通用户只看已发布。
   * 支持按 status / businessLine / scenario / templateType / isDefault 过滤。
   */
  async list(
    requesterRole: 'ADMIN' | 'USER',
    filters?: {
      status?: TemplateStatus;
      businessLine?: string;
      scenario?: string;
      templateType?: string;
      isDefault?: boolean;
    },
  ) {
    const where: Prisma.TemplateWhereInput = {};
    if (requesterRole !== 'ADMIN') {
      where.status = 'PUBLISHED';
    } else if (filters?.status) {
      where.status = filters.status;
    }
    const metaAnd: Prisma.TemplateWhereInput[] = [];
    if (filters?.businessLine)
      metaAnd.push({ meta: { path: '$.businessLine', string_contains: filters.businessLine } });
    if (filters?.scenario)
      metaAnd.push({ meta: { path: '$.scenario', string_contains: filters.scenario } });
    if (filters?.templateType)
      metaAnd.push({ meta: { path: '$.templateType', string_contains: filters.templateType } });
    if (filters?.isDefault !== undefined)
      metaAnd.push({ meta: { path: '$.isDefault', equals: filters.isDefault } });
    if (metaAnd.length) where.AND = metaAnd;

    const templates = await prisma.template.findMany({ where, orderBy: { updatedAt: 'desc' } });
    return templates.map(toSummary);
  },
```

在 `duplicate` 方法之后、`getPublishedOrThrow` 之前插入 `setDefault`:

```ts
  /**
   * 设/取消某模板为 (businessLine×scenario×templateType) 格的默认模板。
   * 设默认(value=true):要求 PUBLISHED + 三字段齐全;事务内先清同格其它默认,再置本模板。
   * 取消默认(value=false):仅置本模板 isDefault=false。
   */
  async setDefault(ownerId: string, id: string, value: boolean): Promise<TemplateDetail> {
    const tpl = await this.getOwnedOrThrow(ownerId, id);
    const m = (tpl.meta as unknown as TemplateMeta | null) ?? {};
    if (value) {
      if (tpl.status !== 'PUBLISHED') {
        throw ApiError.badRequest('发布后才能设为默认模板');
      }
      const { businessLine, scenario, templateType } = m;
      if (!businessLine || !scenario || !templateType) {
        throw ApiError.badRequest('请先选择业务线 / 场景 / 模版类型');
      }
      await prisma.$transaction(async (tx) => {
        // 同格其它已发布默认清零。
        const others = await tx.template.findMany({
          where: {
            id: { not: id },
            status: 'PUBLISHED',
            AND: [
              { meta: { path: '$.businessLine', equals: businessLine } },
              { meta: { path: '$.scenario', equals: scenario } },
              { meta: { path: '$.templateType', equals: templateType } },
              { meta: { path: '$.isDefault', equals: true } },
            ],
          },
          select: { id: true, meta: true },
        });
        for (const o of others) {
          const om = (o.meta as Record<string, unknown> | null) ?? {};
          await tx.template.update({ where: { id: o.id }, data: { meta: { ...om, isDefault: false } } });
        }
        await tx.template.update({ where: { id }, data: { meta: { ...m, isDefault: true } } });
      });
    } else {
      await prisma.template.update({ where: { id }, data: { meta: { ...m, isDefault: false } } });
    }
    return toDetail(await this.getOwnedOrThrow(ownerId, id));
  },
```

- [ ] **Step 5: controller** — `apps/server/src/modules/templates/templates.controller.ts`:

替换 `list` 的 `filters`,并在 `duplicate` 后加 `setDefault`:

```ts
  list: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: (req.query.status as TemplateStatus | undefined) ?? undefined,
      businessLine: (req.query.businessLine as string | undefined) ?? undefined,
      scenario: (req.query.scenario as string | undefined) ?? undefined,
      templateType: (req.query.templateType as string | undefined) ?? undefined,
      isDefault:
        req.query.isDefault === undefined ? undefined : req.query.isDefault === 'true',
    };
    res.json({ templates: await templatesService.list(role(req), filters) });
  }),
```

```ts
  setDefault: asyncHandler(async (req: Request, res: Response) => {
    const { value } = req.body as { value: boolean };
    res.json({ template: await templatesService.setDefault(owner(req), req.params.id, value) });
  }),
```

- [ ] **Step 6: route** — `apps/server/src/modules/templates/templates.routes.ts`,import 加 `setDefaultSchema`,并在 `duplicate` 路由后加:

```ts
import { createTemplateSchema, idParamSchema, setDefaultSchema, updateTemplateSchema } from './templates.schema';
```

```ts
router.patch(
  '/:id/default',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: setDefaultSchema }),
  templatesController.setDefault,
);
```

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server test tests/templates.test.ts`
Expected: PASS(5 条)。

- [ ] **Step 8: 提交**

```bash
git add apps/server/tests/setup.ts apps/server/tests/templates.test.ts apps/server/src/modules/templates/templates.service.ts apps/server/src/modules/templates/templates.controller.ts apps/server/src/modules/templates/templates.routes.ts && git commit -m "feat(templates): add setDefault endpoint + list filter by templateType/isDefault" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: server — 新建项目按默认模板套骨架 + seeded 标记

**Files:**
- Modify: `apps/server/src/modules/projects/projects.service.ts`
- Modify: `apps/server/src/modules/projects/projects.controller.ts`
- Modify: `apps/server/tests/projects.test.ts`

- [ ] **Step 1: 写失败测试** — 在 `apps/server/tests/projects.test.ts` 的 `describe('projects CRUD', ...)` 内追加(顶部已有 `import { app, createUser, login, authHeader } from './helpers';`):

```ts
async function setupAdmin(email: string) {
  const u = await createUser({ email, role: 'ADMIN' });
  const { accessToken } = await login(app(), u.email);
  return { h: authHeader(accessToken) };
}

/** 建一个带 2 页 + theme 的已发布默认模板(属于给定 cell)。 */
async function mkDefaultTemplate(
  h: Record<string, string>,
  cell: { businessLine: string; scenario: string; templateType: string },
) {
  const created = await request(app()).post('/api/v1/templates').set(h).send({
    name: 'TPL',
    width: 1920,
    height: 1080,
    pages: [
      { id: 'x1', name: '封面', components: [] },
      { id: 'x2', name: '数据', components: [] },
    ],
    meta: {
      ...cell,
      theme: {
        color: { primary: '#FF5C00', secondary: '#3B82F6', chartPalette: ['#FF5C00'], neutralText: '#111', neutralBg: '#FFF' },
        font: { text: 'inter', number: 'inter' },
        density: 'standard',
        radius: 'small',
      },
    },
  });
  const id = created.body.template.id;
  await request(app()).patch(`/api/v1/templates/${id}`).set(h).send({ status: 'PUBLISHED' });
  await request(app()).patch(`/api/v1/templates/${id}/default`).set(h).send({ value: true });
  return id;
}

it('create 命中默认模板 → 套用 pages/尺寸/theme, seeded=true', async () => {
  const admin = await setupAdmin('seed-admin@x.com');
  await mkDefaultTemplate(admin.h, { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' });
  const { h } = await setupOwner('seed-user@x.com');

  const res = await request(app())
    .post('/api/v1/projects')
    .set(h)
    .send({ name: 'P', meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' } });

  expect(res.status).toBe(201);
  expect(res.body.seeded).toBe(true);
  expect(res.body.project.pages).toHaveLength(2); // 来自模板
  expect(res.body.project.width).toBe(1920);
  expect(res.body.project.meta.theme.color.primary).toBe('#FF5C00');
  // 业务线/场景/模版类型仍是项目自报值(不被模板覆盖)
  expect(res.body.project.meta.businessLine).toBe('FT');
  expect(res.body.project.meta.scenario).toBe('campaign-report');
});

it('create 无匹配默认模板 → 空白页, seeded=false', async () => {
  const { h } = await setupOwner('seed-user2@x.com');
  const res = await request(app())
    .post('/api/v1/projects')
    .set(h)
    .send({ name: 'P', meta: { businessLine: 'CX', scenario: 'media-kit', templateType: 'brand' } });
  expect(res.status).toBe(201);
  expect(res.body.seeded).toBe(false);
  expect(res.body.project.pages).toHaveLength(1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server test tests/projects.test.ts`
Expected: FAIL — `res.body.seeded` 为 undefined;pages 仍为 1。

- [ ] **Step 3: service — create 套骨架** — `apps/server/src/modules/projects/projects.service.ts`,整块替换 `create` 方法(签名返回值改为 `{ detail, seeded }`):

```ts
  async create(
    ownerId: string,
    input: {
      name: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
    },
  ): Promise<{ detail: ProjectDetail; seeded: boolean }> {
    const meta = input.meta;
    const seedKey =
      meta && meta.businessLine && meta.scenario && meta.templateType
        ? {
            businessLine: meta.businessLine,
            scenario: meta.scenario,
            templateType: meta.templateType,
          }
        : null;

    let pages = input.pages;
    let width = input.width;
    let height = input.height;
    let theme = meta?.theme;
    let seeded = false;

    // 仅当调用方未自带 pages 且三字段齐全时,尝试套用默认模板骨架。
    if (seedKey && !input.pages) {
      const tpl = await prisma.template.findFirst({
        where: {
          status: 'PUBLISHED',
          AND: [
            { meta: { path: '$.businessLine', equals: seedKey.businessLine } },
            { meta: { path: '$.scenario', equals: seedKey.scenario } },
            { meta: { path: '$.templateType', equals: seedKey.templateType } },
            { meta: { path: '$.isDefault', equals: true } },
          ],
        },
      });
      if (tpl) {
        pages = JSON.parse(JSON.stringify(tpl.pages)) as Page[];
        width = tpl.width;
        height = tpl.height;
        const tplMeta = (tpl.meta as unknown as ProjectMeta | null) ?? {};
        theme = tplMeta.theme ?? theme;
        seeded = true;
      }
    }

    const finalMeta: ProjectMeta | undefined = meta
      ? { ...meta, ...(theme !== undefined ? { theme } : {}) }
      : undefined;

    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: width ?? 1280,
      height: height ?? 720,
      pages: (pages ?? defaultPages()) as unknown as Prisma.InputJsonValue,
      ...(finalMeta ? { meta: finalMeta as unknown as Prisma.InputJsonValue } : {}),
    };
    const project = await prisma.project.create({ data });
    return { detail: toDetail(project), seeded };
  },
```

- [ ] **Step 4: controller — 透传 seeded** — `apps/server/src/modules/projects/projects.controller.ts` 的 `create`:

```ts
  create: asyncHandler(async (req: Request, res: Response) => {
    const { detail, seeded } = await projectsService.create(owner(req), req.body);
    res.status(201).json({ project: detail, seeded });
  }),
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server test tests/projects.test.ts`
Expected: PASS(含新 2 条;原 CRUD 用例不受影响)。

- [ ] **Step 6: typecheck**

Run: `pnpm --filter @mediakit/server typecheck`
Expected: 无错误(`create` 返回类型变更只有 controller 一个调用方,已同步)。

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/modules/projects/projects.service.ts apps/server/src/modules/projects/projects.controller.ts apps/server/tests/projects.test.ts && git commit -m "feat(projects): seed new project from default template by business-line cell" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: web — projectsMeta 字典 + api 适配(setDefault / seeded)

**Files:**
- Modify: `apps/web/src/projectsMeta.ts`
- Modify: `apps/web/src/api/templates.ts`
- Modify: `apps/web/src/api/projects.ts`
- Modify: `apps/web/src/routes/Projects.tsx`(消费新 create 返回)
- Test: `apps/web/tests/projectsMeta.test.ts`(新建)

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/projectsMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SCENARIOS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@/projectsMeta';

describe('TEMPLATE_TYPES', () => {
  it('每个场景都有模版类型取值', () => {
    for (const s of SCENARIOS) {
      expect(TEMPLATE_TYPES[s.id].length).toBeGreaterThan(0);
    }
  });

  it('campaign-report 取值与 scenarioSub 对齐', () => {
    const ids = TEMPLATE_TYPES['campaign-report'].map(([id]) => id);
    expect(ids).toEqual(['weekly', 'monthly', 'wrap-up']);
  });

  it('TEMPLATE_TYPE_LABELS 含全部 id', () => {
    const all = TEMPLATE_TYPES['campaign-report'].map(([id]) => id);
    for (const id of all) expect(TEMPLATE_TYPE_LABELS[id]).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test tests/projectsMeta.test.ts`
Expected: FAIL — `TEMPLATE_TYPES` 未导出。

- [ ] **Step 3: projectsMeta** — `apps/web/src/projectsMeta.ts` 末尾追加(Scenario 已在顶部 import):

```ts
/**
 * 模版类型:每个场景下的细分取值,与模板对应。
 * 前端下拉据此级联;后端只存字符串,改值不动 schema。
 */
export const TEMPLATE_TYPES: Record<Scenario, [string, string][]> = {
  'campaign-report': [
    ['weekly', '周报'],
    ['monthly', '月报'],
    ['wrap-up', '总结'],
  ],
  'campaign-proposal': [
    ['lite', '简版'],
    ['standard', '标准版'],
    ['full', '完整版'],
  ],
  'media-kit': [
    ['brand', '品牌版'],
    ['creator', '达人版'],
    ['platform', '平台版'],
  ],
};

/** 模版类型标签(扁平查找,供列表/徽标用)。 */
export const TEMPLATE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  (['campaign-report', 'campaign-proposal', 'media-kit'] as Scenario[]).flatMap((s) =>
    TEMPLATE_TYPES[s].map(([id, label]) => [id, label]),
  ),
);
```

- [ ] **Step 4: api/templates.ts** — `list` 参数加 `templateType/isDefault`;末尾 `templatesApi` 对象内 `duplicate` 之后加 `setDefault`:

```ts
  list: (params?: {
    status?: TemplateStatus;
    businessLine?: string;
    scenario?: string;
    templateType?: string;
    isDefault?: boolean;
  }) => api.get<{ templates: TemplateSummary[] }>('/templates', { params }).then((r) => r.data.templates),
```

```ts
  /** 设/取消默认模板(ADMIN)。 */
  setDefault: (id: string, value: boolean) =>
    api.patch<{ template: TemplateDetail }>(`/templates/${id}/default`, { value }).then((r) => r.data.template),
```

- [ ] **Step 5: api/projects.ts** — `create` 返回改为 `{ project, seeded }`:

```ts
  create: (name: string, width?: number, height?: number, meta?: ProjectMeta) =>
    api
      .post<{ project: ProjectDetail; seeded: boolean }>('/projects', { name, width, height, meta })
      .then((r) => ({ project: r.data.project, seeded: r.data.seeded ?? false })),
```

- [ ] **Step 6: Projects.tsx 消费新返回 + 套用提示** — `apps/web/src/routes/Projects.tsx`:

`handleCreate` 改为解构(约 59-71 行):

```ts
  async function handleCreate(values: { name: string; width: number; height: number; meta: import('@mediakit/shared').ProjectMeta }) {
    setCreating(true);
    setCreateError(null);
    try {
      const { project: p, seeded } = await projectsApi.create(values.name, values.width, values.height, values.meta);
      setShowCreate(false);
      setSeededMsg(seeded ? `已套用「${values.meta.businessLine ?? ''}」默认模板` : null);
      navigate(`/projects/${p.id}`);
    } catch {
      setCreateError('创建失败,请重试');
    } finally {
      setCreating(false);
    }
  }
```

顶部 state 区(约 20 行后)加:

```ts
  const [seededMsg, setSeededMsg] = useState<string | null>(null);
```

在「我的项目」标题块下方(约 140 行 `<div className="flex items-center justify-between">...</div>` 之后)插入提示条:

```tsx
      {seededMsg && (
        <div className="mt-3 rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-3 py-2 text-xs text-foreground-secondary">
          {seededMsg}
        </div>
      )}
```

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test tests/projectsMeta.test.ts`
Expected: PASS(3 条)。

- [ ] **Step 8: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误(`projectsApi.create` 调用方仅 `handleCreate`,已同步解构)。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/projectsMeta.ts apps/web/src/api/templates.ts apps/web/src/api/projects.ts apps/web/src/routes/Projects.tsx apps/web/tests/projectsMeta.test.ts && git commit -m "feat(web): add TEMPLATE_TYPES dict + setDefault/seeded api wiring" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: web — TemplateFormDialog 模版类型级联下拉

**Files:**
- Modify: `apps/web/src/components/TemplateFormDialog.tsx`
- Test: `apps/web/tests/TemplateFormDialog.test.tsx`(新建)

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/TemplateFormDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateFormDialog } from '@/components/TemplateFormDialog';

describe('TemplateFormDialog — 模版类型级联', () => {
  it('未选场景时不显示模版类型;选场景后出现对应选项', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    expect(screen.queryByText('模版类型')).not.toBeTruthy();
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    expect(screen.getByText('模版类型')).toBeInTheDocument();
    // media-kit 的取值出现
    expect(screen.getByText('品牌版')).toBeInTheDocument();
  });

  it('提交时 meta 带 templateType', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TemplateFormDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('模板名称'), '周报模板');
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await user.selectOptions(screen.getByLabelText('模版类型'), 'monthly');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.meta.templateType).toBe('monthly');
    expect(values.meta.scenario).toBe('campaign-report');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test tests/TemplateFormDialog.test.tsx`
Expected: FAIL — 无「模版类型」字段。

- [ ] **Step 3: 实现** — `apps/web/src/components/TemplateFormDialog.tsx`:

import 加 `TEMPLATE_TYPES`:

```ts
import { BUSINESS_LINES, SCENARIOS, TEMPLATE_TYPES } from '@/projectsMeta';
```

`TemplateFormInitial` 与 `TemplateFormValues` 已含 `meta: ProjectMeta`(ProjectMeta 现带 templateType),无需改类型。state 区(约 68-73 行)加 `templateType`:

```ts
  const [templateType, setTemplateType] = useState('');
```

先给 `TemplateFormInitial`(约 25-33 行)加可选字段(不破坏现有调用方):

```ts
export interface TemplateFormInitial {
  name: string;
  width: number;
  height: number;
  businessLine?: string;
  scenario?: Scenario;
  templateType?: string;
  note?: string | null;
  status?: TemplateStatus;
}
```

`useEffect` 同步(两处:initial 分支与新建分支,约 78-93 行),在 `setScenario(...)` 后加 `setTemplateType`:

initial 分支:
```ts
      setBusinessLine(initial.businessLine ?? '');
      setScenario(initial.scenario ?? '');
      setTemplateType(initial.templateType ?? '');
```

新建分支:
```ts
      setBusinessLine('');
      setScenario('');
      setTemplateType('');
```

`submit`(约 98-112 行)在 `if (scenario) meta.scenario = ...;` 后加:

```ts
    if (templateType) meta.templateType = templateType;
```

JSX:在「场景」`<label>`(约 162-176 行的 `<div className="grid grid-cols-2 gap-3">...</div>`)之后插入模版类型下拉(仅选了场景才显示):

```tsx
          {scenario && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">模版类型</span>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className={selectCls}
              >
                <option value="">不指定</option>
                {TEMPLATE_TYPES[scenario].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test tests/TemplateFormDialog.test.tsx`
Expected: PASS(2 条)。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/TemplateFormDialog.tsx apps/web/tests/TemplateFormDialog.test.tsx && git commit -m "feat(web): cascade templateType dropdown in TemplateFormDialog" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: web — Templates 列表:模版类型筛选 + 默认徽标 + 设默认按钮

**Files:**
- Modify: `apps/web/src/routes/Templates.tsx`
- Test: `apps/web/tests/Templates.route.test.tsx`(新建)

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/Templates.route.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Templates } from '@/routes/Templates';

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'ADMIN', email: 'a@x.com', name: 'A' } }),
}));

const listMock = vi.fn();
const setDefaultMock = vi.fn(async (_id: string, _v: boolean) => ({}));
vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: async () => ({ id: 't1' }),
    update: async () => ({}),
    remove: async () => ({}),
    duplicate: async () => ({}),
    setStatus: async () => ({}),
    setDefault: (...args: unknown[]) => setDefaultMock(...(args as [string, boolean])),
  },
}));

function renderIt() {
  return render(
    <MemoryRouter>
      <Templates />
    </MemoryRouter>,
  );
}

describe('Templates 路由', () => {
  beforeEach(() => {
    listMock.mockReset();
    setDefaultMock.mockClear();
  });

  it('渲染模板行,已发布默认模板显示「默认」徽标', async () => {
    listMock.mockResolvedValue([
      {
        id: 't1', name: 'FT周报模板', width: 1280, height: 720, pageCount: 3, status: 'PUBLISHED',
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('FT周报模板')).toBeInTheDocument());
    expect(screen.getByText('默认')).toBeInTheDocument();
  });

  it('点「设为默认」调用 templatesApi.setDefault(id, true)', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([
      {
        id: 't1', name: 'FT周报模板', width: 1280, height: 720, pageCount: 3, status: 'PUBLISHED',
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('设为默认')).toBeInTheDocument());
    await user.click(screen.getByText('设为默认'));
    await waitFor(() => expect(setDefaultMock).toHaveBeenCalledWith('t1', true));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test tests/Templates.route.test.tsx`
Expected: FAIL — 无「默认」徽标 / 「设为默认」按钮。

- [ ] **Step 3: 实现** — `apps/web/src/routes/Templates.tsx`:

import 加 `TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS`:

```ts
import { BUSINESS_LINES, SCENARIOS, SCENARIO_LABELS, SCENARIO_SUB_LABELS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@/projectsMeta';
```

state 加模版类型筛选(约 43 行后):

```ts
  const [filterTemplateType, setFilterTemplateType] = useState<string>('');
```

`filtered`(约 50-55 行)加模版类型条件:

```ts
  const filtered = templates.filter(
    (t) =>
      (!filterStatus || t.status === filterStatus) &&
      (!filterBL || t.meta?.businessLine === filterBL) &&
      (!filterScenario || t.meta?.scenario === filterScenario) &&
      (!filterTemplateType || t.meta?.templateType === filterTemplateType),
  );
```

筛选条(约 195-206 行「全部场景」select 之后)插入模版类型 select(选项随 filterScenario 级联):

```tsx
          {filterScenario && (
            <select
              value={filterTemplateType}
              onChange={(e) => setFilterTemplateType(e.target.value)}
              className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-secondary"
            >
              <option value="">全部模版类型</option>
              {TEMPLATE_TYPES[filterScenario].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}
```

清除筛选(约 207-218 行)也清 `filterTemplateType`,在 `setFilterScenario('')` 后加 `setFilterTemplateType('')`。

`handleSetDefault`(新方法,放在 `handleToggleStatus` 之后):

```ts
  async function handleSetDefault(t: TemplateSummary, value: boolean) {
    setTogglingId(t.id);
    try {
      const updated = await templatesApi.setDefault(t.id, value);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, meta: updated.meta } : x)));
    } catch {
      /* 失败静默 */
    } finally {
      setTogglingId(null);
    }
  }
```

需要 import `templatesApi` 已存在(文件顶部已 `import { templatesApi } from '@/api/templates';`)。

`toInitial`(约 366-376 行)带 templateType:

```ts
function toInitial(t: TemplateSummary): TemplateFormInitial {
  return {
    name: t.name,
    width: t.width,
    height: t.height,
    businessLine: t.meta?.businessLine,
    scenario: t.meta?.scenario,
    templateType: t.meta?.templateType,
    note: t.note,
    status: t.status,
  };
}
```

> `TemplateFormInitial` 在 Task 5 已加 `templateType?: string`。

表格行:在「场景」列单元格(约 259 行 `<td>{scenarioText(t.meta)}</td>`)**之后**插一个模版类型列;表头(约 238 行 `<th>场景</th>` 之后)加 `<th className="px-3 py-2 font-medium">模版类型</th>`。模版类型单元格:

```tsx
                  <td className="px-3 py-2 text-foreground-secondary">
                    {t.meta?.templateType ? (TEMPLATE_TYPE_LABELS[t.meta.templateType] ?? t.meta.templateType) : '—'}
                    {t.meta?.isDefault && (
                      <span className="ml-1 inline-block rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
                        默认
                      </span>
                    )}
                  </td>
```

操作列(约 290-297 行「发布/取消发布」按钮之后)加设/取消默认按钮(仅 PUBLISHED + 三字段齐全显示):

```tsx
                    {t.status === 'PUBLISHED' && t.meta?.businessLine && t.meta?.scenario && t.meta?.templateType && (
                      <button
                        onClick={() => void handleSetDefault(t, !t.meta?.isDefault)}
                        disabled={togglingId === t.id}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary disabled:opacity-50"
                        title={t.meta?.isDefault ? '取消默认模板' : '设为该业务线×场景×模版类型的默认模板'}
                      >
                        {t.meta?.isDefault ? '取消默认' : '设为默认'}
                      </button>
                    )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test tests/Templates.route.test.tsx`
Expected: PASS(2 条)。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/routes/Templates.tsx apps/web/tests/Templates.route.test.tsx && git commit -m "feat(web): templateType filter + default badge + set-default action in Templates list" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: web — CreateProjectDialog:业务线顶层必填 + 模版类型级联(双写 scenarioSub)

**Files:**
- Modify: `apps/web/src/components/CreateProjectDialog.tsx`
- Test: `apps/web/tests/CreateProjectDialog.test.tsx`(新建)

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/CreateProjectDialog.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';

vi.mock('@/api/campaigns', () => ({ listCampaigns: async () => [] }));

describe('CreateProjectDialog — 业务线必填 + 模版类型', () => {
  it('业务线选择始终可见', () => {
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('业务线')).toBeInTheDocument();
  });

  it('未填业务线时不能提交', () => {
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onSubmit={onSubmit} onCancel={() => {}} />);
    // 提交按钮禁用(canSubmit=false)
    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
  });

  it('campaign-report:报告类型取值来自模版类型(周报/月报/总结)', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    const reportSelect = screen.getByText('报告类型').parentElement!.querySelector('select')!;
    const labels = Array.from(reportSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['周报', '月报', '总结']));
  });

  it('media-kit:模版类型下拉出现 品牌版/达人版/平台版(无报告类型)', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    expect(screen.queryByText('报告类型')).not.toBeTruthy();
    const ttSelect = screen.getByText('模版类型').parentElement!.querySelector('select')!;
    const labels = Array.from(ttSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['品牌版', '达人版', '平台版']));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test tests/CreateProjectDialog.test.ts`
Expected: FAIL — 业务线非顶层;模版类型下拉不存在。

- [ ] **Step 3: 实现** — `apps/web/src/components/CreateProjectDialog.tsx`。改动较多,按以下定点编辑:

(a) import 加 `TEMPLATE_TYPES`:

```ts
import {
  ADVERTISERS,
  BUSINESS_LINES,
  isCampaignScenario,
  SCENARIOS,
  TEMPLATE_TYPES,
} from '@/projectsMeta';
```

(b) state(约 64-82 行):把 `mkBusinessLine` 改成顶层 `businessLine`,并加 `templateType`。把原 `const [mkBusinessLine, setMkBusinessLine] = useState('');` 替换为:

```ts
  // 业务线(顶层必填;campaign 场景由 campaign 自动回填,可改)
  const [businessLine, setBusinessLine] = useState('');
  // 模版类型(场景下细分;campaign-report 与 scenarioSub 同值)
  const [templateType, setTemplateType] = useState<string>('');
```

(c) `useEffect` 初始化(约 87-110 行):在 `setScenarioSub(...)` 后加 businessLine/templateType 初始化。把:
```ts
    setMkBusinessLine(m?.businessLine ?? '');
    setMkAdvertiser(m?.advertiser ?? '');
```
替换为:
```ts
    setBusinessLine(m?.businessLine ?? '');
    setMkAdvertiser(m?.advertiser ?? '');
    setTemplateType(m?.templateType ?? (m?.scenario === 'campaign-report' ? m?.scenarioSub ?? '' : ''));
```

(d) campaign 选中自动回填业务线:在 `selectedCampaign` 派生(约 85 行)后加一个 effect,选了 campaign 且业务线为空时回填:

```ts
  useEffect(() => {
    if (selectedCampaign && !businessLine) {
      setBusinessLine(selectedCampaign.businessLine);
    }
  }, [selectedCampaign, businessLine]);
```

(e) 场景切换时重置 templateType(约 199-202 行 scenario `onChange`):把:
```ts
              onChange={(e) => {
                setScenario(e.target.value as Scenario | '');
                setCampaignId('');
              }}
```
替换为:
```ts
              onChange={(e) => {
                const next = e.target.value as Scenario | '';
                setScenario(next);
                setCampaignId('');
                setTemplateType('');
              }}
```

(f) `canSubmit`(约 131-132 行)加业务线必填:
```ts
  const canSubmit =
    !!name.trim() &&
    !!businessLine &&
    (!scenario || !isCampaignScenario(scenario as Scenario) || !!campaignId);
```

(g) `submit`(约 134-164 行)重写 meta 构造,把:
```ts
    const meta: ProjectMeta = {
      creator: creator || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      scenarioSub: scenario === 'campaign-report' ? scenarioSub : undefined,
    };

    if (isCampaignScenario(scenario as Scenario) && selectedCampaign) {
      meta.campaignId = selectedCampaign.id;
      meta.businessLine = selectedCampaign.businessLine;
      meta.advertiser = selectedCampaign.advertiser;
      meta.campaignInfo = { ... };
    } else if (scenario === 'media-kit') {
      meta.businessLine = mkBusinessLine || undefined;
      meta.advertiser = mkAdvertiser || undefined;
    }
```
替换为:
```ts
    // campaign-report 的模版类型取值与 scenarioSub 同集合;报告类型下拉双写两者。
    // reportSub 兜底取 scenarioSub(默认 'weekly'),保证即使用户没动报告类型也带 templateType。
    const reportSub: ScenarioSub | undefined =
      scenario === 'campaign-report' ? ((templateType || scenarioSub) as ScenarioSub) : undefined;
    const meta: ProjectMeta = {
      creator: creator || undefined,
      businessLine: businessLine || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      templateType: (templateType || reportSub) || undefined,
      scenarioSub: reportSub,
    };

    if (isCampaignScenario(scenario as Scenario) && selectedCampaign) {
      meta.campaignId = selectedCampaign.id;
      meta.advertiser = selectedCampaign.advertiser;
      meta.campaignInfo = {
        campaignName: selectedCampaign.name,
        platform: selectedCampaign.platform,
        startDate: selectedCampaign.startDate,
        endDate: selectedCampaign.endDate,
        budget: selectedCampaign.budget,
      };
    } else if (scenario === 'media-kit') {
      meta.advertiser = mkAdvertiser || undefined;
    }
```

(h) JSX:在「场景」select 块(约 192-211 行 `</label>`)**之后**插入顶层「业务线」select(始终可见):

```tsx
          {/* 业务线(必填) */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block font-medium">业务线</span>
            <select
              className={selectCls}
              value={businessLine}
              onChange={(e) => setBusinessLine(e.target.value)}
            >
              <option value="">（请选择业务线）</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          {/* 模版类型(选了场景才出现,按场景级联) */}
          {scenario && (
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block font-medium">模版类型</span>
              <select
                className={selectCls}
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
              >
                <option value="">（请选择模版类型）</option>
                {TEMPLATE_TYPES[scenario as Scenario].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
```

(i) 删掉 media-kit 的业务线 select(业务线已提升为顶层必填)。把 media-kit 整块(约 268-293 行 `{scenario === 'media-kit' && (...)}`)替换为只剩广告主的单标签:

```tsx
          {/* media-kit:广告主(选填);业务线已在上层必填 */}
          {scenario === 'media-kit' && (
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">广告主</span>
              <select className={selectCls} value={mkAdvertiser} onChange={(e) => setMkAdvertiser(e.target.value)}>
                <option value="">（选填）</option>
                {ADVERTISERS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
```

(j) campaign-report 的「报告类型」下拉(约 248-263 行)仍用 `scenarioSub`,但因其取值与模版类型相同,保持不变即可;不过为统一,把它的 `value/onChange` 也接到 templateType:把:
```ts
                  <select
                    className={selectCls}
                    value={scenarioSub}
                    onChange={(e) => setScenarioSub(e.target.value as ScenarioSub)}
                  >
```
替换为:
```ts
                  <select
                    className={selectCls}
                    value={templateType || scenarioSub}
                    onChange={(e) => {
                      const v = e.target.value as ScenarioSub;
                      setScenarioSub(v);
                      setTemplateType(v);
                    }}
                  >
```
(这样 campaign-report 选「报告类型」会同时写 templateType;模版类型下拉在 campaign-report 下也可省略显示——因报告类型已等价。为避免重复,在 (h) 的模版类型块加条件 `scenario !== 'campaign-report'`,即 campaign-report 不额外显示模版类型下拉,统一走报告类型。)

修订 (h) 的条件为:
```tsx
          {scenario && scenario !== 'campaign-report' && (
            ...模版类型下拉...
          )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test tests/CreateProjectDialog.test.ts`
Expected: PASS(3 条)。

- [ ] **Step 5: typecheck + 全量 web 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/CreateProjectDialog.tsx apps/web/tests/CreateProjectDialog.test.ts && git commit -m "feat(web): require business-line + cascade templateType in CreateProjectDialog" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: web — CreateFromTemplateDialog:过滤 + 默认徽标

**Files:**
- Modify: `apps/web/src/components/CreateFromTemplateDialog.tsx`
- Test: `apps/web/tests/CreateFromTemplateDialog.test.tsx`(新建)

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/CreateFromTemplateDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';

const listMock = vi.fn();
vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: (...args: unknown[]) => listMock(...(args as [object?])),
  },
}));

describe('CreateFromTemplateDialog', () => {
  it('默认模板行显示「默认」徽标', async () => {
    listMock.mockResolvedValue([
      {
        id: 't1', name: '周报', width: 1280, height: 720, pageCount: 3,
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(screen.getByText('周报')).toBeInTheDocument());
    expect(screen.getByText('默认')).toBeInTheDocument();
  });

  it('选业务线后,list 带上 businessLine 参数', async () => {
    listMock.mockResolvedValue([]);
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    listMock.mockClear();
    // 业务线筛选存在
    expect(screen.getByText('业务线')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test tests/CreateFromTemplateDialog.test.tsx`
Expected: FAIL — 无默认徽标 / 无业务线筛选。

- [ ] **Step 3: 实现** — `apps/web/src/components/CreateFromTemplateDialog.tsx`:

import 加:

```ts
import { BUSINESS_LINES, SCENARIOS, TEMPLATE_TYPES, SCENARIO_LABELS } from '@/projectsMeta';
import type { Scenario } from '@mediakit/shared';
```

state 加筛选(约 21-24 行后):

```ts
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');
  const [filterTemplateType, setFilterTemplateType] = useState<string>('');
```

把打开时拉取的 `useEffect`(约 27-39 行)改为依赖筛选:

```ts
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    templatesApi
      .list({
        status: 'PUBLISHED',
        ...(filterBL ? { businessLine: filterBL } : {}),
        ...(filterScenario ? { scenario: filterScenario } : {}),
        ...(filterTemplateType ? { templateType: filterTemplateType } : {}),
      })
      .then((list) => {
        setTemplates(list);
        setSelectedId(list[0]?.id ?? '');
      })
      .catch(() => setTemplates([]))
      .finally(() => setFetching(false));
  }, [open, filterBL, filterScenario, filterTemplateType]);
```

JSX:在 `<p>...选择一个已发布模板...</p>`(约 64 行)之后插入筛选条:

```tsx
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={filterBL}
            onChange={(e) => setFilterBL(e.target.value)}
            className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
          >
            <option value="">全部业务线</option>
            {BUSINESS_LINES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filterScenario}
            onChange={(e) => {
              setFilterScenario(e.target.value as Scenario | '');
              setFilterTemplateType('');
            }}
            className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
          >
            <option value="">全部场景</option>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {filterScenario && (
            <select
              value={filterTemplateType}
              onChange={(e) => setFilterTemplateType(e.target.value)}
              className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
            >
              <option value="">全部模版类型</option>
              {TEMPLATE_TYPES[filterScenario].map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          )}
        </div>
```

模板行(约 84-91 行 `{t.meta?.businessLine ? ... : ''}` 那段 span)加默认徽标,在 `{t.width}×{t.height}` 之前插:

```tsx
                        {t.meta?.isDefault && (
                          <span className="ml-1 inline-block rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
                            默认
                          </span>
                        )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test tests/CreateFromTemplateDialog.test.tsx`
Expected: PASS(2 条)。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/CreateFromTemplateDialog.tsx apps/web/tests/CreateFromTemplateDialog.test.tsx && git commit -m "feat(web): add filters + default badge in CreateFromTemplateDialog" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 全量验证

- [ ] **Step 1: server 全量测试 + typecheck**

Run: `pnpm --filter @mediakit/server typecheck && pnpm --filter @mediakit/server test`
Expected: 全绿(含 projects.schema / templates / projects 全部用例)。

- [ ] **Step 2: web 全量测试 + typecheck**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: 全绿。

- [ ] **Step 3: shared 构建(确认类型导出无误)**

Run: `pnpm --filter @mediakit/shared build` (若无 build 脚本,跳过——typecheck 已由 web/server 覆盖)
Expected: 成功。

- [ ] **Step 4: 人工冒烟(可选,在 worktree 跑 dev)**

1. 管理员登录 → 模板管理 → 新建模板(选 FT / campaign-report / 周报)→ 进编辑器搭 2 页 + 设主题 → 发布 → 列表点「设为默认」。
2. BD 登录 → 我的项目 → +新建项目 → 选 campaign-report + FT + 选 campaign → 报告类型=周报 → 创建 → 进入编辑器应已带模板的 2 页 + 主题;列表上方出现「已套用 FT 默认模板」提示。
3. 换一个没默认模板的 cell(如 CX / media-kit / 品牌版)→ 创建 → 空白页 + 无套用提示。

- [ ] **Step 5: 收尾**

确认 worktree 内 `git log --oneline` 有 8 个 feature 提交;按 `superpowers:finishing-a-development-branch` 决定合并/PR。
