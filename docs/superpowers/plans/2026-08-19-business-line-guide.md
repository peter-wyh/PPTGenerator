# 业务线报告指南(Guide)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 业务线报告差异(品牌视觉/章节结构/展示形式/语调术语)统一收敛到 Guide 表,生成时按 businessLine+scenario 匹配一份指南拼进系统提示词,替代 designMd 用户提示词注入路径。

**Architecture:** 三层提示词——SYSTEM_PROMPT(通用 CORE) + 业务线指南(Guide 表动态选中) + 业务事实(署名/logo);guide 查询全链路静默降级(无指南=仅 CORE);recipe 路径仅注入指南「语调与术语」节到洞察文案。spec 见 `docs/superpowers/specs/2026-08-19-business-line-guide-design.md`。

**Tech Stack:** Express + Zod + Prisma(MySQL) + vitest(前端 React+Tailwind 自研组件,无 UI 库)。

**执行注意(本项目特有,务必遵守):**
- 在 worktree 中执行(superpowers:using-git-worktrees)。主树有用户并发未提交改动,禁止 git add 整个脏文件。
- 提交必须 `git add <具体文件> && git commit` 一条原子命令(IDE 会跨调用清 staging)。
- Prisma `migrate dev` 不可用(dev DB 无 shadow DB 权限,P3014)——迁移 SQL 手写 + `prisma migrate deploy`。
- 测试从 apps 目录跑绝对路径 binary(根 `pnpm test` 递归且 server 结果盖 web):server `cd apps/server && pnpm test`;web `cd apps/web && pnpm test`。
- web 类型检查是 CI-only gate:`cd apps/web && ./node_modules/.bin/tsc -b --force` 提交前必跑。
- 迁移目录命名手写日期(先例 `20260820100000_marketing_events`),须排在现有最新之后。

---

## File Structure(全量文件清单)

**Create:**
- `apps/server/prisma/migrations/20260821100000_guides/migration.sql` — 建表
- `apps/server/src/modules/guides/guide.schema.ts` — Zod
- `apps/server/src/modules/guides/guide.service.ts` — pick/resolveForCampaign/extractVoiceSection/pickVoiceForCampaign/CRUD(含 isDefault 互斥事务)
- `apps/server/src/modules/guides/guide.service.test.ts`
- `apps/server/src/modules/guides/guide.controller.ts` — 薄壳
- `apps/server/src/modules/guides/guide.routes.ts` — GET/POST/PATCH(无 DELETE,软停用)
- `apps/server/src/modules/guides/guide.routes.test.ts` — 401 挂载测试
- `apps/server/scripts/migrate-designmd-to-guides.ts` — 一次性幂等迁移
- `apps/web/src/api/guides.ts` — GuideDTO + API
- `apps/web/src/routes/GuidePage.tsx` — 数据管理指南页

**Modify:**
- `apps/server/prisma/schema.prisma` — Guide 模型 + BusinessLine.guides
- `packages/shared/src/types/campaign.ts` — Guide 接口
- `apps/server/src/routes/index.ts` — 挂 /guides
- `apps/server/src/modules/html-templates/ai-generate.service.ts` — buildSystemPrompt、四入口接入、删 DESIGN_GUIDE_SUFFIX 注入
- `apps/server/src/modules/html-templates/ai-generate.service.test.ts` — buildSystemPrompt/generateHtml 测试
- `apps/server/src/modules/html-templates/html-templates.schema.ts` — scenario 字段
- `apps/server/src/modules/html-templates/html-templates.controller.ts` — 传参 + guideUsed 回传 + getDesignGuide 重指向
- `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.ts` — voice 参数
- `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.test.ts`
- `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` — 取指南语调节
- `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`
- `apps/web/src/api/htmlTemplates.ts` — scenario/guideUsed/getDesignGuide 返回类型
- `apps/web/src/editor/components/AiGenerateForm.tsx` — scenario 选择器
- `apps/web/src/editor/components/AiGenerateForm.test.tsx`
- `apps/web/src/routes/HtmlStudio.tsx` — scenario 透传
- `apps/web/src/routes/DataManagement.tsx` — 菜单项
- `apps/web/src/App.tsx` — 路由

**明确不动:** recipe tokens/manifest、模板机制、ai-client 重试、BusinessLine.designMd 字段本身(保留只读)、autoSave 的 meta.designMd 存储。

---

### Task 1: Prisma Guide 模型 + 迁移 SQL + shared 类型

**Files:**
- Modify: `apps/server/prisma/schema.prisma`(MarketingEvent 模型后,L226 之后)
- Create: `apps/server/prisma/migrations/20260821100000_guides/migration.sql`
- Modify: `packages/shared/src/types/campaign.ts`(BusinessLine 接口后,L588 附近)

- [ ] **Step 1: schema.prisma 加 Guide 模型**

在 `model MarketingEvent` 结束(L226 `}`)之后插入:

```prisma
/// 业务线报告指南(AI 提示词层配置:品牌视觉/章节结构/展示形式/语调术语)。
model Guide {
  id             String       @id @default(cuid())
  businessLineId String
  businessLine   BusinessLine @relation(fields: [businessLineId], references: [id])
  /// 报告场景(月报/结案/复盘…),空=通用(仅可作 isDefault 兜底,不参与精确匹配)。
  scenario       String?
  /// 展示名,如 "DG 月报指南"。
  name           String
  /// Markdown 指南正文(约定分节:品牌视觉/章节结构/展示形式偏好/语调与术语)。
  content        String       @db.Text
  /// 业务线默认指南(同业务线唯一,service 写入时互斥)。
  isDefault      Boolean      @default(false)
  /// 停用后不参与匹配(软停用,不物理删除)。
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([businessLineId])
}
```

并在 `model BusinessLine` 的 `campaigns   Campaign[]` 行后加:

```prisma
  guides       Guide[]
```

- [ ] **Step 2: 手写迁移 SQL**

`apps/server/prisma/migrations/20260821100000_guides/migration.sql`(对齐 MarketingEvent 先例:无 FK 约束,仅索引):

```sql
-- Guide: 业务线报告指南(AI 提示词层配置:品牌视觉/章节/展示形式/语调术语)
CREATE TABLE `Guide` (
    `id` VARCHAR(191) NOT NULL,
    `businessLineId` VARCHAR(191) NOT NULL,
    `scenario` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
    `isActive` TINYINT(1) NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Guide_businessLineId_idx`(`businessLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 3: shared 类型**

`packages/shared/src/types/campaign.ts`,在 `export interface BusinessLine` 块之后插入:

```ts
/** 业务线报告指南(AI 提示词层配置:品牌视觉/章节结构/展示形式偏好/语调与术语)。 */
export interface Guide {
  /** 展示名,如 "DG 月报指南"。 */
  name: string;
  /** 报告场景(月报/结案/复盘…),空=通用(仅可作 isDefault 兜底)。 */
  scenario?: string;
  /** Markdown 指南正文。 */
  content: string;
  /** 关联业务线 id。 */
  businessLineId: string;
  /** 业务线默认指南(同业务线唯一)。 */
  isDefault?: boolean;
  /** 停用后不参与匹配。 */
  isActive?: boolean;
}
```

- [ ] **Step 4: 生成 client + 部署迁移**

```bash
cd apps/server && pnpm db:generate && pnpm db:migrate:deploy
```
Expected: `prisma generate` 成功产出 Guide 类型;`migrate deploy` 报 `20260821100000_guides` applied。(若本地 DB 未起,先根目录 `pnpm db:up`。)

- [ ] **Step 5: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/20260821100000_guides/migration.sql packages/shared/src/types/campaign.ts && git commit -m "feat(guides): Guide 模型+迁移+shared 类型——业务线报告指南载体"
```

---

### Task 2: guide.schema.ts(Zod)

**Files:**
- Create: `apps/server/src/modules/guides/guide.schema.ts`
- Test: `apps/server/src/modules/guides/guide.schema.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// guide.schema.test.ts
import { describe, expect, it } from 'vitest';
import { createGuideSchema, updateGuideSchema, listGuidesQuerySchema } from './guide.schema';

describe('guide schemas', () => {
  it('create: 全字段通过', () => {
    const r = createGuideSchema.safeParse({
      businessLineId: 'bl1', name: 'DG 月报指南', scenario: '月报',
      content: '# 指南\n## 语调与术语\n用「推广」', isDefault: true,
    });
    expect(r.success).toBe(true);
  });
  it('create: scenario 可空,content 必填非空', () => {
    expect(createGuideSchema.safeParse({ businessLineId: 'bl1', name: 'n', content: 'x' }).success).toBe(true);
    expect(createGuideSchema.safeParse({ businessLineId: 'bl1', name: 'n', content: '' }).success).toBe(false);
    expect(createGuideSchema.safeParse({ businessLineId: '', name: 'n', content: 'x' }).success).toBe(false);
  });
  it('update: 全部 optional', () => {
    expect(updateGuideSchema.safeParse({ isDefault: false }).success).toBe(true);
    expect(updateGuideSchema.safeParse({}).success).toBe(true);
  });
  it('list query: businessLineId 可选', () => {
    expect(listGuidesQuerySchema.safeParse({}).success).toBe(true);
    expect(listGuidesQuerySchema.safeParse({ businessLineId: 'bl1' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.schema.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

```ts
// guide.schema.ts
import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

export const createGuideSchema = z.object({
  businessLineId: z.string().min(1),
  name: z.string().min(1).max(191),
  scenario: z.string().max(64).optional(),
  content: z.string().min(1),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateGuideSchema = createGuideSchema.partial();

/** GET /api/v1/guides?businessLineId= */
export const listGuidesQuerySchema = z.object({
  businessLineId: z.string().optional(),
});

export { idParamSchema };
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.schema.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/guides/guide.schema.ts apps/server/src/modules/guides/guide.schema.test.ts && git commit -m "feat(guides): Guide CRUD Zod schema"
```

---

### Task 3: guide.service.ts(匹配/解析/CRUD)

**Files:**
- Create: `apps/server/src/modules/guides/guide.service.ts`
- Test: `apps/server/src/modules/guides/guide.service.test.ts`

- [ ] **Step 1: 写失败测试**

Mock 结构对齐 `data.service.test.ts` 先例:

```ts
// guide.service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  guide: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  campaign: { findUnique: vi.fn() },
  businessLine: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { guideService, resolveForCampaign, extractVoiceSection, pickVoiceForCampaign } from './guide.service';

const mkGuide = (over: Record<string, unknown> = {}) => ({
  id: 'g1', businessLineId: 'bl1', scenario: null, name: '默认指南',
  content: '# 指南', isDefault: false, isActive: true,
  createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-01'),
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe('guideService.pick · 匹配优先级', () => {
  it('scenario 精确匹配 > isDefault', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'def', isDefault: true }),
      mkGuide({ id: 'mo', scenario: '月报' }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('mo');
  });
  it('scenario 为 null 的指南不参与精确匹配(通用指南抢不走特定场景)', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'def', isDefault: true, scenario: null }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('def'); // 降级到默认
  });
  it('无 scenario 参数 → 直接走 isDefault', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'mo', scenario: '月报' }),
      mkGuide({ id: 'def', isDefault: true }),
    ]);
    const g = await guideService.pick('bl1');
    expect(g?.id).toBe('def');
  });
  it('同优先级多条 → updatedAt 最新', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'old', scenario: '月报', updatedAt: new Date('2026-08-01') }),
      mkGuide({ id: 'new', scenario: '月报', updatedAt: new Date('2026-08-10') }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('new'); // findMany 按 updatedAt desc 返回,mock 顺序即返回顺序
  });
  it('isActive=false 过滤在 where;content 空串视同无指南', async () => {
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ content: '   ' })]);
    expect(await guideService.pick('bl1')).toBeNull();
    expect(prismaMock.guide.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessLineId: 'bl1', isActive: true } }),
    );
  });
  it('无默认无匹配 → null', async () => {
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ scenario: '月报' })]);
    expect(await guideService.pick('bl1')).toBeNull();
  });
});

describe('guideService CRUD · isDefault 互斥', () => {
  it('create isDefault=true → 事务内清同业务线旧默认再建', async () => {
    prismaMock.guide.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue([1, mkGuide({ isDefault: true })]);
    await guideService.create({ businessLineId: 'bl1', name: 'n', content: 'c', isDefault: true });
    expect(prismaMock.guide.updateMany).toHaveBeenCalledWith({
      where: { businessLineId: 'bl1', isDefault: true },
      data: { isDefault: false },
    });
  });
  it('update 设默认 → 先清后更;getOrThrow 404', async () => {
    prismaMock.guide.findUnique.mockResolvedValue(null);
    await expect(guideService.update('g404', { isDefault: true })).rejects.toThrow('Guide not found');
    prismaMock.guide.findUnique.mockResolvedValue(mkGuide());
    prismaMock.$transaction.mockResolvedValue([1, mkGuide()]);
    await guideService.update('g1', { isDefault: true });
    expect(prismaMock.guide.updateMany).toHaveBeenCalledWith({
      where: { businessLineId: 'bl1', isDefault: true },
      data: { isDefault: false },
    });
  });
});

describe('resolveForCampaign · 静默降级', () => {
  it('campaign 带 businessLine → 返回指南+名称+code', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      businessLineId: 'bl1',
      businessLine: { name: 'DG 好物', code: 'DG' },
    });
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ id: 'def', isDefault: true })]);
    const r = await resolveForCampaign('c1', '月报');
    expect(r.guide?.id).toBe('def');
    expect(r.businessLineName).toBe('DG 好物');
    expect(r.businessLineCode).toBe('DG');
  });
  it('Guide 查询抛错 → guide=null 不抛(生成永不因指南失败)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { name: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockRejectedValue(new Error('db down'));
    const r = await resolveForCampaign('c1');
    expect(r.guide).toBeNull();
    expect(r.businessLineName).toBe('X');
  });
  it('campaign 不存在 → 全空', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    const r = await resolveForCampaign('c404');
    expect(r.guide).toBeNull();
    expect(r.businessLineName).toBe('');
  });
});

describe('extractVoiceSection · 语调与术语截取', () => {
  it('取「## 语调与术语」到下一节之间', () => {
    const md = '# 指南\n## 品牌视觉\n色板\n## 语调与术语\n用「推广」不用「投放」\n自称团队\n## 展示形式偏好\n卡片';
    expect(extractVoiceSection(md)).toBe('用「推广」不用「投放」\n自称团队');
  });
  it('语调节在文末 → 取到结尾', () => {
    const md = '## 语调与术语\n克制';
    expect(extractVoiceSection(md)).toBe('克制');
  });
  it('无该节 → 空串', () => {
    expect(extractVoiceSection('## 品牌视觉\nx')).toBe('');
  });
});

describe('pickVoiceForCampaign', () => {
  it('campaign → 指南 → 语调节字符串;失败降级空串', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { name: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ isDefault: true, content: '## 语调与术语\n用「创作者」' }),
    ]);
    expect(await pickVoiceForCampaign('c1')).toBe('用「创作者」');
    prismaMock.campaign.findUnique.mockRejectedValue(new Error('x'));
    expect(await pickVoiceForCampaign('c1')).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.service.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

```ts
// guide.service.ts
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma, Guide } from '@prisma/client';

/**
 * 指南匹配(确定性,不依赖 AI):
 * scenario 精确匹配 > 业务线 isDefault > null。
 * scenario=null 的指南只能作为 isDefault 参与第二级(通用指南不抢特定场景)。
 * content 空串视同无指南。
 */
export const guideService = {
  async pick(businessLineId: string, scenario?: string): Promise<Guide | null> {
    if (!businessLineId) return null;
    const rows = await prisma.guide.findMany({
      where: { businessLineId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = rows.filter((r) => (r.content ?? '').trim());
    if (!usable.length) return null;
    if (scenario) {
      const exact = usable.filter((r) => r.scenario === scenario);
      if (exact.length) return exact[0]; // findMany 已按 updatedAt desc
    }
    return usable.find((r) => r.isDefault) ?? null;
  },

  async list(opts?: { businessLineId?: string }) {
    const where: Prisma.GuideWhereInput = {};
    if (opts?.businessLineId) where.businessLineId = opts.businessLineId;
    return prisma.guide.findMany({
      where,
      orderBy: [{ businessLineId: 'asc' }, { updatedAt: 'desc' }],
      include: { businessLine: { select: { code: true, name: true } } },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.guide.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Guide not found');
    return rec;
  },

  async create(data: { businessLineId: string; name: string; scenario?: string; content: string; isDefault?: boolean; isActive?: boolean }) {
    if (data.isDefault) {
      // 同业务线 isDefault 唯一:事务内清旧默认再建
      return prisma.$transaction([
        prisma.guide.updateMany({
          where: { businessLineId: data.businessLineId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.guide.create({ data }),
      ]).then(([, created]) => created);
    }
    return prisma.guide.create({ data });
  },

  async update(id: string, data: Partial<{ businessLineId: string; name: string; scenario: string | null; content: string; isDefault: boolean; isActive: boolean }>) {
    const rec = await this.getOrThrow(id);
    if (data.isDefault === true) {
      const blId = data.businessLineId ?? rec.businessLineId;
      return prisma.$transaction([
        prisma.guide.updateMany({
          where: { businessLineId: blId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.guide.update({ where: { id }, data }),
      ]).then(([, updated]) => updated);
    }
    return prisma.guide.update({ where: { id }, data });
  },
  // 无 remove:软停用走 PATCH isActive=false(指南被线上报告引用过,留痕)。
};

/**
 * 生成链路统一入口:campaign → businessLine → 匹配指南。
 * 任何失败静默降级(指南是增强不是依赖,生成永不因它失败)。
 */
export async function resolveForCampaign(
  campaignId: string,
  scenario?: string,
): Promise<{ guide: Guide | null; businessLineName: string; businessLineCode: string }> {
  try {
    const camp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { businessLine: true },
    });
    const businessLineName = camp?.businessLine?.name ?? '';
    const businessLineCode = camp?.businessLine?.code ?? '';
    if (!camp?.businessLineId) return { guide: null, businessLineName, businessLineCode };
    const guide = await guideService.pick(camp.businessLineId, scenario).catch(() => null);
    return { guide, businessLineName, businessLineCode };
  } catch (e) {
    console.warn('[guide] resolveForCampaign 失败,降级为无指南:', (e as Error)?.message ?? e);
    return { guide: null, businessLineName: '', businessLineCode: '' };
  }
}

/** 截取指南「## 语调与术语」节(到下一 ## 或文末)。约定格式,字符串处理,不解析 Markdown。 */
export function extractVoiceSection(guideContent: string): string {
  const m = guideContent.match(/^##\s*语调与术语\s*$/m);
  if (!m?.index) return '';
  const rest = guideContent.slice(m.index + m[0].length);
  const next = rest.match(/^##\s/m);
  return (next?.index != null ? rest.slice(0, next.index) : rest).trim();
}

/** recipe 洞察文案用:campaign → 指南 → 语调节。失败降级空串。 */
export async function pickVoiceForCampaign(campaignId: string): Promise<string> {
  try {
    const { guide } = await resolveForCampaign(campaignId);
    return guide ? extractVoiceSection(guide.content) : '';
  } catch {
    return '';
  }
}
```

注:`ApiError.notFound` 若签名不同(如 `ApiError.notFound(msg)` 返回实例),以 `apps/server/src/utils/ApiError.ts` 实际为准对齐 lookup.service.ts 的用法。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.service.test.ts
```
Expected: PASS 全绿。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/guides/guide.service.ts apps/server/src/modules/guides/guide.service.test.ts && git commit -m "feat(guides): 指南匹配/resolveForCampaign/语调截取/CRUD isDefault 互斥"
```

---

### Task 4: controller + routes + 挂载

**Files:**
- Create: `apps/server/src/modules/guides/guide.controller.ts`
- Create: `apps/server/src/modules/guides/guide.routes.ts`
- Modify: `apps/server/src/routes/index.ts`
- Test: `apps/server/src/modules/guides/guide.routes.test.ts`

- [ ] **Step 1: 写失败测试(401 挂载,对齐 lookup.routes.test 先例)**

```ts
// guide.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('guides routes · 鉴权与挂载', () => {
  it('未登录 GET /api/v1/guides → 401(不是 404)', async () => {
    const res = await request(createApp()).get('/api/v1/guides');
    expect(res.status).toBe(401);
  });
  it('未登录 POST /api/v1/guides → 401', async () => {
    const res = await request(createApp()).post('/api/v1/guides').send({ name: 'x', content: 'y', businessLineId: 'z' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.routes.test.ts
```
Expected: FAIL 404(路由未挂)。

- [ ] **Step 3: 实现 controller + routes + 挂载**

`guide.controller.ts`(薄壳,对齐 lookup.controller):

```ts
import { asyncHandler } from '../../utils/asyncHandler';
import type { Request, Response } from 'express';
import { guideService } from './guide.service';

export const guideController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { businessLineId } = req.query as { businessLineId?: string };
    res.json({ guides: await guideService.list({ businessLineId }) });
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ guide: await guideService.create(req.body) });
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ guide: await guideService.update(req.params.id, req.body) });
  }),
};
```

`guide.routes.ts`(无 DELETE;`asyncHandler` 路径以 lookup.controller.ts 实际 import 为准):

```ts
import { Router } from 'express';
import { guideController } from './guide.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParamSchema, createGuideSchema, updateGuideSchema, listGuidesQuerySchema } from './guide.schema';

const router = Router();
router.use(authenticate);

router.get('/guides', validate({ query: listGuidesQuerySchema }), guideController.list);
router.post('/guides', validate({ body: createGuideSchema }), guideController.create);
router.patch('/guides/:id', validate({ params: idParamSchema, body: updateGuideSchema }), guideController.update);

export const guideRoutes = router;
```

`apps/server/src/routes/index.ts`:import 处加 `import { guideRoutes } from '../modules/guides/guide.routes';`,挂载处(对齐 `apiRouter.use('/lookup', lookupRoutes)` 一行后)加:

```ts
apiRouter.use('/guides', guideRoutes);
```

- [ ] **Step 4: 跑测试确认通过 + typecheck**

```bash
cd apps/server && pnpm vitest run src/modules/guides/guide.routes.test.ts && pnpm typecheck
```
Expected: PASS;tsc 无错。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/guides/guide.controller.ts apps/server/src/modules/guides/guide.routes.ts apps/server/src/modules/guides/guide.routes.test.ts apps/server/src/routes/index.ts && git commit -m "feat(guides): /api/v1/guides CRUD 路由(软停用无 DELETE)"
```

---

### Task 5: buildSystemPrompt + SYSTEM_PROMPT 去业务化

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试(追加到现有测试文件末尾)**

先在文件顶部 prismaMock 增加指南表(mock 面向 Task 6,buildSystemPrompt 本身纯函数不需要,但提前加齐避免后续重复改):

```ts
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  guide: { findMany: vi.fn() },
}));
```

import 行改为:

```ts
import { aiGenerateService, buildSystemPrompt, rewriteExternalAssets, SYSTEM_PROMPT, SYSTEM_PROMPT_DISPLAY } from './ai-generate.service';
```

新增 describe:

```ts
describe('buildSystemPrompt · 三层拼装', () => {
  const guide = '# DG 报告指南\n## 品牌视觉\n主色 #ff099e\n## 语调与术语\n用「创作者」';

  it('无指南无业务线名 → 等于 CORE 原文', () => {
    expect(buildSystemPrompt({})).toBe(SYSTEM_PROMPT);
  });
  it('有指南 → 追加 BUSINESS LINE GUIDE 段,含指南原文与覆盖规则', () => {
    const s = buildSystemPrompt({ guideContent: guide });
    expect(s).toContain(SYSTEM_PROMPT);
    expect(s).toContain('BUSINESS LINE GUIDE');
    expect(s).toContain('#ff099e');
    expect(s.indexOf('BUSINESS LINE GUIDE')).toBeGreaterThan(SYSTEM_PROMPT.length); // 拼在 CORE 之后
  });
  it('指南空串 → 视同无指南', () => {
    expect(buildSystemPrompt({ guideContent: '   ' })).toBe(SYSTEM_PROMPT);
  });
  it('businessLineName → 业务事实段含 Prepared by <名称>', () => {
    const s = buildSystemPrompt({ businessLineName: 'DG 好物' });
    expect(s).toContain('Prepared by DG 好物');
  });
  it('CORE 无业务词残留:不含 "Prepared by" 字面量(署名示例已移入业务事实段)', () => {
    expect(SYSTEM_PROMPT).not.toContain('Prepared by');
  });
  it('EDIT 基座:EDIT_SYSTEM_PROMPT + 指南', () => {
    const s = buildSystemPrompt({ base: 'EDIT_BASE', guideContent: guide });
    expect(s.startsWith('EDIT_BASE')).toBe(true);
    expect(s).toContain('BUSINESS LINE GUIDE');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ai-generate.service.test.ts
```
Expected: FAIL(buildSystemable 未导出;"Prepared by" 残留断言失败)。

- [ ] **Step 3: 实现**

(a) `SYSTEM_PROMPT` L77 行去掉署名示例,改为:

```
2. The footer should show ONLY: brand attribution + report date.
   Do NOT add taglines like "Built with [X]", "Generated by [Y]", or infrastructure references.
```
(即删掉 `(e.g. "Prepared by [Business Line Name]")`,其余保留。)

(b) 在 `DESIGN_GUIDE_SUFFIX` 常量位置(L472-488)**整体替换**为(删除旧常量,注入路径废除):

```ts
/** 业务线指南拼进 system prompt 的段(替代原 DESIGN_GUIDE_SUFFIX 的用户提示词注入) */
const GUIDE_SYSTEM_SUFFIX = `

═══════════════════════════════════════════════════════════
★★★ BUSINESS LINE GUIDE (MANDATORY — OVERRIDES CORE DEFAULTS) ★★★
═══════════════════════════════════════════════════════════
The guide below defines this business line's EXACT visual language, section structure, presentation preferences, and voice/terminology. You MUST:
1. VISUAL: extract every hex color value and font family and apply them to Tailwind config, CSS classes, and inline styles — they override ALL defaults in this system prompt.
2. STRUCTURE: include/exclude sections and their ordering exactly as the guide specifies.
3. PRESENTATION: its enumerated component-selection rules (e.g. creator list as card grid vs table) are HARD CONSTRAINTS, not suggestions.
4. VOICE: apply its terminology and tone rules to ALL narrative text you write (insight cards, creator commentary, summaries).
If the guide conflicts with this system prompt's defaults, the guide wins. Where the guide is silent, follow this system prompt.

BUSINESS LINE GUIDE:
{{GUIDE}}`;

/** 业务事实段:值从 campaign 数据渲染(规则在 CORE,事实在此) */
const BUSINESS_FACTS_SUFFIX = (businessLineName: string) => `

═══ BUSINESS FACTS (from campaign data) ═══
- Footer attribution MUST read exactly: "Prepared by ${businessLineName}" + the campaign period.
- Header logos: use campaign.businessLine.logoUrl and campaign.advertiser.logoUrl from the campaign JSON exactly as provided.`;

/**
 * 三层系统提示词拼装:CORE(base,默认 SYSTEM_PROMPT) + 业务线指南(0..1) + 业务事实。
 * generateHtml / generateHtmlStream / editHtml / editHtmlStream 四入口共用。
 */
export function buildSystemPrompt(opts: {
  base?: string;
  businessLineName?: string;
  guideContent?: string;
}): string {
  let s = opts.base ?? SYSTEM_PROMPT;
  if (opts.guideContent?.trim()) {
    s += GUIDE_SYSTEM_SUFFIX.replace('{{GUIDE}}', opts.guideContent.trim());
  }
  if (opts.businessLineName) {
    s += BUSINESS_FACTS_SUFFIX(opts.businessLineName);
  }
  return s;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ai-generate.service.test.ts
```
Expected: PASS(新增 describe 全绿 + 原有 rewriteExternalAssets/buildCampaignContext 不受影响)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts && git commit -m "feat(guides): buildSystemPrompt 三层拼装——指南进 system prompt,CORE 去署名示例"
```

---

### Task 6: generateHtml(非流式)接入指南 + guideUsed 回传

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(L1071-1135 区域 + 返回处)
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`(L25-36)
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(L76-92)
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

ai-generate.service.test.ts 顶部加 ai-client mock(hoisted,现有测试不经网络,不受影响):

```ts
const aiClientMock = vi.hoisted(() => ({ fetchChatCompletionWithRetry: vi.fn() }));
vi.mock('./ai-client', () => aiClientMock);
```

新增 describe:

```ts
describe('generateHtml · 指南接入与 guideUsed 回传', () => {
  const okResp = {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '<!DOCTYPE html><html><body>ok</body></html>' } }] }),
  } as any;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    aiClientMock.fetchChatCompletionWithRetry.mockReset().mockResolvedValue({ response: okResp, attempts: 1 });
  });

  it('campaign 带 businessLineId → system 含指南,pick 用 scenario;返回 guideUsed', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      businessLineId: 'bl1',
      businessLine: { name: 'DG 好物', code: 'DG' },
    });
    prismaMock.guide.findMany.mockResolvedValue([
      { id: 'g-mo', scenario: '月报', name: 'DG 月报指南', content: '## 语调与术语\n用「创作者」', isDefault: false, isActive: true },
    ]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p', scenario: '月报' });
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.guideUsed).toEqual({ id: 'g-mo', name: 'DG 月报指南' });
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toContain('BUSINESS LINE GUIDE');
    expect(sys).toContain('用「创作者」');
    expect(sys).toContain('Prepared by DG 好物');
    expect(sys).not.toContain('{{GUIDE}}'); // 占位符已替换
  });

  it('无匹配指南 → system 等于 CORE,guideUsed=null,user prompt 不再拼设计指南', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { name: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockResolvedValue([]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toBeNull();
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toBe(SYSTEM_PROMPT);
    const user = body.messages.find((m: any) => m.role === 'user').content as string;
    expect(user).not.toContain('BRAND DESIGN GUIDE'); // 旧注入路径已废除
  });

  it('Guide 查询抛错 → 静默降级无指南,不阻断生成', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { name: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockRejectedValue(new Error('db down'));
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toBeNull();
    expect(out.html).toContain('<!DOCTYPE html>');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ai-generate.service.test.ts -t 'generateHtml'
```
Expected: FAIL(签名无 scenario/返回值无对象)。

- [ ] **Step 3: 实现**

(a) `generateHtml` 签名与指南解析(L1071-1103)替换为:

```ts
  async generateHtml(params: {
    campaignId?: string;
    prompt: string;
    scenario?: string;
    reportPeriod?: { startDate?: string; endDate?: string };
  }): Promise<{ html: string; guideUsed: { id: string; name: string } | null }> {
```

designMd 查询块(L1085-1094)与 DESIGN_GUIDE_SUFFIX 拼接(L1100-1103)整体替换为:

```ts
    // 业务线指南:Guide 表按 businessLine+scenario 匹配,拼进 system prompt(替代 designMd 用户提示词注入)
    const { guide, businessLineName } = params.campaignId
      ? await resolveForCampaign(params.campaignId, params.scenario)
      : { guide: null, businessLineName: '' };
    const guideUsed = guide ? { id: guide.id, name: guide.name } : null;
    const systemPrompt = buildSystemPrompt({ businessLineName, guideContent: guide?.content });
```

messages(L1127-1130)system 行改 `content: systemPrompt`。

文件末尾 return(L1459 `return content;`)改为:

```ts
    return { html: content, guideUsed };
```

顶部加 import:

```ts
import { resolveForCampaign } from '../guides/guide.service';
```

(b) `generateHtmlSchema`(html-templates.schema.ts L25-36):删 `designMd: z.string().optional(),` 行,加 `scenario: z.string().max(64).optional(),`。

(c) controller `generate`(L76-92)ai 分支改为:

```ts
    let html: string;
    let guideUsed: { id: string; name: string } | null = null;
    if (mode === 'recipe') {
      const { getRecipe } = await import('./recipe');
      html = await getRecipe(recipeId ?? 'campaign-report').render({ campaignId, theme, reportPeriod });
    } else {
      const out = await aiGenerateService.generateHtml({
        campaignId,
        prompt: prompt || 'Generate a comprehensive campaign performance report',
        scenario: req.body.scenario,
        reportPeriod,
      });
      html = out.html;
      guideUsed = out.guideUsed;
    }
    res.json({ html, guideUsed });
```

(recipe 分支不再传 designMd——recipe RenderInput 的 designMd 本就"v1 保留未用"。)

- [ ] **Step 4: 跑测试确认通过 + typecheck**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ && pnpm typecheck
```
Expected: PASS(generateHtml describe + 既有测试全绿;generateHtmlStream 尚未接入,见 Task 7)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts apps/server/src/modules/html-templates/html-templates.schema.ts apps/server/src/modules/html-templates/html-templates.controller.ts && git commit -m "feat(guides): generateHtml 接入业务线指南+guideUsed 回传,废除 designMd 注入"
```

---

### Task 7: generateHtmlStream(流式)接入 + done chunk 带 guideUsed

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(L1467-1593 + StreamChunk L546-550)
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(L172-187)

- [ ] **Step 1: 实现流式入口(与 Task 6 同构,无独立网络测试——复用 resolveForCampaign/buildSystemPrompt 已测单元,手动验收覆盖)**

(a) `StreamChunk` done 分支(L549)加字段:

```ts
  | { type: 'done'; html: string; truncated: boolean; usage?: StreamUsage; dataCoverage?: DoneDataCoverage; guideUsed?: { id: string; name: string } | null }
```

(b) `generateHtmlStream` 签名(L1467-1473):`designMd?: string;` 改为 `scenario?: string;`。

(c) designMd 块(L1486-1500)替换为:

```ts
    const { guide, businessLineName } = params.campaignId
      ? await resolveForCampaign(params.campaignId, params.scenario)
      : { guide: null, businessLineName: '' };
    const guideUsed = guide ? { id: guide.id, name: guide.name } : null;
    const systemPrompt = buildSystemPrompt({ businessLineName, guideContent: guide?.content });

    let userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{PROMPT}}', params.prompt?.trim() || '(No additional user instructions — use autonomous mode: analyze the campaign data and choose the best 4-8 modules and visualizations.)')
      .replace('{{CAMPAIGN_DATA}}', campaignData);
```

messages(L1513-1516)system 行改 `content: systemPrompt`。

done yield(L1593)改为:

```ts
    yield { type: 'done', html: processedHtml, truncated, usage: endUsage, guideUsed, ...(dataCoverage ? { dataCoverage } : {}) };
```

(d) controller `generateStream`(L173-187):

```ts
    const { prompt, campaignId, reportPeriod, scenario } = req.body;
```
传参处 `designMd,` 改 `scenario,`(generate-stream 路由无 validate,body 字段直读,Zod 校验由 /generate 端 schema 同构保证)。

- [ ] **Step 2: 跑全量测试确认无回归 + typecheck**

```bash
cd apps/server && pnpm test && pnpm typecheck
```
Expected: 全绿(流式改动无既有测试覆盖,靠 typecheck + Task 14 手动验收)。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/html-templates.controller.ts && git commit -m "feat(guides): 流式生成接入指南,done chunk 带 guideUsed"
```

---

### Task 8: EDIT 路径接入(editHtml/editHtmlStream + agentEdit controller)

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(L1321-1340, L1601-1623)
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`(agentEditSchema L51-61)
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(L156-169, L209-230)
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('editHtml · 编辑续写带指南(风格一致)', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    aiClientMock.fetchChatCompletionWithRetry.mockReset().mockResolvedValue({
      response: {
        ok: true, status: 200,
        json: async () => ({ choices: [{ message: { content: '<!DOCTYPE html><html><body>edited</body></html>' } }] }),
      } as any,
      attempts: 1,
    });
  });

  it('传 guideContent+businessLineName → system = EDIT 基座 + 指南 + 业务事实', async () => {
    const html = await aiGenerateService.editHtml({
      currentHtml: '<!DOCTYPE html><html><body>x</body></html>',
      instruction: '改标题',
      guideContent: '## 语调与术语\n克制',
      businessLineName: 'DG 好物',
    });
    expect(html).toContain('edited');
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toContain('You are an HTML editor agent'); // EDIT 基座
    expect(sys).toContain('BUSINESS LINE GUIDE');
    expect(sys).toContain('克制');
  });

  it('不传指南 → system 等于 EDIT_SYSTEM_PROMPT 原文', async () => {
    await aiGenerateService.editHtml({ currentHtml: '<!DOCTYPE html><html></html>', instruction: 'i' });
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).not.toContain('BUSINESS LINE GUIDE');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ai-generate.service.test.ts -t 'editHtml'
```
Expected: FAIL(参数无 guideContent)。

- [ ] **Step 3: 实现**

(a) `editHtml`(L1321-1326)签名加两个可选参:

```ts
  async editHtml(params: {
    currentHtml: string;
    instruction: string;
    images?: string[];
    dataContext?: string;
    guideContent?: string;
    businessLineName?: string;
  }): Promise<string> {
```

L1371 `content: EDIT_SYSTEM_PROMPT` 改:

```ts
          content: buildSystemPrompt({ base: EDIT_SYSTEM_PROMPT, guideContent: params.guideContent, businessLineName: params.businessLineName }),
```

(b) `editHtmlStream`(L1601-1607)同样加 `guideContent?: string; businessLineName?: string;`,L1647 同样改 system 行。

(c) `agentEditSchema` 加 `scenario: z.string().max(64).optional(),`。

(d) controller `agentEdit`(L156-169):

```ts
  agentEdit: asyncHandler(async (req: Request, res: Response) => {
    const { currentHtml, instruction, images, campaignId, reportPeriod, scenario } = req.body;
    // ★ ④ 数据上下文 + 业务线指南:有 campaignId → 注入真实 DB 数据与指南(编辑风格与首稿一致)
    const [{ dataContext, guide, businessLineName }, _] = await Promise.all([
      campaignId
        ? aiGenerateService.buildCampaignContext(campaignId, reportPeriod)
            .then((dc) => ({ dataContext: dc, guide: null as null, businessLineName: '' }))
            .catch(() => ({ dataContext: undefined, guide: null as null, businessLineName: '' }))
        : Promise.resolve({ dataContext: undefined, guide: null as null, businessLineName: '' }),
      campaignId
        ? resolveForCampaign(campaignId, scenario)
        : Promise.resolve({ guide: null, businessLineName: '' }),
    ]);
    const html = await aiGenerateService.editHtml({
      currentHtml,
      instruction,
      images,
      dataContext,
      guideContent: guide?.content,
      businessLineName,
    });
    res.json({ html, guideUsed: guide ? { id: guide.id, name: guide.name } : null });
  }),
```

顶部 import 加 `import { resolveForCampaign } from '../guides/guide.service';`(若 Task 6 未加在 controller)。

(e) `agentEditStream`(L209-230):同样在 dataContext 旁解析指南(非流式 controller 的简化写法——串行即可):

```ts
    const { currentHtml, instruction, images, campaignId, reportPeriod, scenario } = req.body;
    ...
    const dataContext = campaignId
      ? await aiGenerateService.buildCampaignContext(campaignId, reportPeriod).catch(() => undefined)
      : undefined;
    const { guide, businessLineName } = campaignId
      ? await resolveForCampaign(campaignId, scenario)
      : { guide: null, businessLineName: '' };
    for await (const chunk of aiGenerateService.editHtmlStream({
      currentHtml,
      instruction,
      images,
      dataContext,
      guideContent: guide?.content,
      businessLineName,
      signal: abortCtrl.signal,
    })) {
```

- [ ] **Step 4: 跑测试确认通过 + typecheck**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/ai-generate.service.test.ts && pnpm typecheck
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts apps/server/src/modules/html-templates/html-templates.schema.ts apps/server/src/modules/html-templates/html-templates.controller.ts && git commit -m "feat(guides): Agent 编辑续写带业务线指南,风格与首稿一致"
```

---

### Task 9: recipe 洞察文案注入「语调与术语」

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.test.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`

- [ ] **Step 1: 写失败测试**

narrative.test.ts 追加:

```ts
describe('fillActionable · 业务线语调注入', () => {
  it('传 voice → prompt 含语调节;不传 → 不含 VOICE 段', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([])));
    await fillActionable(content, '用「创作者」自称「团队」');
    let body = (fetch as any).mock.calls[0][1].body;
    expect(body).toContain('用「创作者」');
    (fetch as any).mockClear();
    await fillActionable(content);
    body = (fetch as any).mock.calls[0][1].body;
    expect(body).not.toContain('VOICE & TERMINOLOGY');
  });
});
```

render.test.ts:顶部 prismaMock 扩 guide 表与 campaign 行带 businessLineId,narrative mock 断言收到 voice:

```ts
const prismaMock = vi.hoisted(() => ({ campaign: { findUnique: vi.fn() }, guide: { findMany: vi.fn() } }));
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));
```

(原 campaignRow 保留不动;beforeEach 里补 `prismaMock.guide.findMany.mockResolvedValue([]);` 默认无指南。)

```ts
describe('render · 指南语调节传给洞察文案', () => {
  it('campaign 有指南 → fillActionable 收到语调节字符串', async () => {
    prismaMock.campaign.findUnique.mockImplementation(async () => ({
      ...campaignRow, businessLineId: 'bl1',
      businessLine: { name: 'DG', code: 'DG' },
    }));
    prismaMock.guide.findMany.mockResolvedValue([
      { id: 'g1', scenario: null, name: '默认', content: '## 语调与术语\n用「创作者」', isDefault: true, isActive: true, businessLineId: 'bl1' },
    ]);
    const { fillActionable } = await import('./narrative');
    await render({ campaignId: 'c1' });
    const call = (fillActionable as any).mock.calls.at(-1);
    expect(call?.[1]).toContain('用「创作者」');
  });
  it('无指南 → fillActionable 第二参为空串', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ ...campaignRow, businessLineId: 'bl1', businessLine: { name: 'DG', code: 'DG' } });
    prismaMock.guide.findMany.mockResolvedValue([]);
    await render({ campaignId: 'c1' });
    const call = (fillActionable as any).mock.calls.at(-1);
    expect(call?.[1]).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/recipe/campaign-report/narrative.test.ts src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: FAIL(fillActionable 无第二参)。

- [ ] **Step 3: 实现**

narrative.ts — `buildPrompt` 与 `fillActionable` 加 voice:

```ts
function buildPrompt(c: CampaignReportContent, voice?: string): string {
  const topPublishers = [...c.publishers].slice(0, 5).map((p) => `${p.name} (${p.type.label}, revenue ${p.revenue}, clicks ${p.clicks}, orders ${p.orders})`);
  const kpis = c.kpis.map((k) => `${k.label}: ${k.value}`).join('; ');
  const voiceSection = voice?.trim()
    ? `\nVOICE & TERMINOLOGY (from business line guide — MUST follow for ALL card text):\n${voice.trim()}\n`
    : '';
  return `Campaign KPIs: ${kpis}.
Top publishers: ${topPublishers.join(' | ') || 'n/a'}.
Trend points: ${c.trend.labels.length}.${voiceSection}

Return a JSON array (5 cards, in this order): "Top Performers", "High Traffic / Low CVR", "Best Performing Placement", "Creative Insight", "Action Required".
Each card: { icon (font-awesome name, e.g. trophy), color (one of: green, orange, blue, purple, red), title, items: [{text, sub?}], footer }.
Output ONLY the JSON array, no markdown fences, no prose.`;
}
```

`callDeepSeek(c)` → `callDeepSeek(c, voice?)`(messages user 行 `buildPrompt(c, voice)`);`fillActionable(c)` → `fillActionable(c: CampaignReportContent, voice?: string)`,两处 `callDeepSeek(c)` 改 `callDeepSeek(c, voice)`。

render.ts — 顶部加 import,`content.actionable` 行(L41)改为:

```ts
import { pickVoiceForCampaign } from '../../../guides/guide.service';
// ...
  // 业务线指南「语调与术语」节注入洞察文案(recipe 视觉/章节不动,仅对齐语调;查询失败降级空串)
  const voice = input.campaignId ? await pickVoiceForCampaign(input.campaignId) : '';
  content.actionable = await fillActionable(content, voice);
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/server && pnpm vitest run src/modules/html-templates/recipe/
```
Expected: PASS(narrative/render 新旧全绿)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/narrative.ts apps/server/src/modules/html-templates/recipe/campaign-report/narrative.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts && git commit -m "feat(guides): recipe 洞察文案注入业务线「语调与术语」节"
```

---

### Task 10: getDesignGuide 重指向 Guide + SYSTEM_PROMPT_DISPLAY 补记

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(L270-290)
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(SYSTEM_PROMPT_DISPLAY,头注后追加一节)

- [ ] **Step 1: 实现**

getDesignGuide(L270-290)整体替换(字段名 designMd 保留——前端 AiGenerateForm 不改就读得到):

```ts
  /** 获取 Campaign 匹配的业务线指南(供前端回显:指南名/内容/业务线) */
  getDesignGuide: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const { guide, businessLineName, businessLineCode } = await resolveForCampaign(campaignId);
    res.json({
      designMd: guide?.content ?? '',          // 兼容旧字段名:现指南全文
      guideName: guide?.name ?? '',
      guideId: guide?.id ?? null,
      businessLineName,
      businessLineCode,
    });
  }),
```

SYSTEM_PROMPT_DISPLAY(`> 以下为后端…` 引用块后)插入一节:

```markdown
## 📎 业务线指南(Guide)

系统提示词按请求拼装:\`SYSTEM_PROMPT\`(上方通用规则)+ **业务线指南**(Guide 表按 campaign 的业务线+报告场景匹配一份,含品牌视觉/章节结构/展示形式偏好/语调与术语四节,指南冲突时以指南为准)+ 业务事实(署名 Prepared by {业务线名})。指南在数据管理 → 指南 维护。
```

- [ ] **Step 2: 跑全量测试 + typecheck**

```bash
cd apps/server && pnpm test && pnpm typecheck
```
Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/ai-generate.service.ts && git commit -m "feat(guides): design-guide 端点重指向 Guide 匹配,DISPLAY 补三层说明"
```

---

### Task 11: web 指南管理页(api/guides + GuidePage + 路由菜单)

**Files:**
- Create: `apps/web/src/api/guides.ts`
- Create: `apps/web/src/routes/GuidePage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/routes/DataManagement.tsx`

- [ ] **Step 1: api/guides.ts**

```ts
/**
 * 业务线报告指南 API(AI 提示词层配置)。
 * 对接后端 /api/v1/guides(登录态)。
 */
import { api } from './client';
import type { Guide } from '@mediaket/shared';

export interface GuideDTO extends Guide {
  id: string;
  businessLine?: { code: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export const guidesApi = {
  list: (businessLineId?: string) =>
    api.get<{ guides: GuideDTO[] }>('/guides', { params: { businessLineId } }).then((r) => r.data.guides),
  create: (data: { businessLineId: string; name: string; scenario?: string; content: string; isDefault?: boolean; isActive?: boolean }) =>
    api.post<{ guide: GuideDTO }>('/guides', data).then((r) => r.data.guide),
  update: (id: string, data: Partial<{ name: string; scenario: string | null; content: string; isDefault: boolean; isActive: boolean; businessLineId: string }>) =>
    api.patch<{ guide: GuideDTO }>(`/guides/${id}`, data).then((r) => r.data.guide),
};
```

- [ ] **Step 2: GuidePage.tsx(对齐 MarketingEventPage 结构:列表 + 页内表单模态,自研 Tailwind)**

```tsx
/**
 * 业务线报告指南管理 —— /data/guides。
 * 指南 = 拼进 AI 系统提示词的业务线差异配置(品牌视觉/章节结构/展示形式/语调术语)。
 * 一个业务线可多份(scenario 切分),isDefault 唯一兜底;停用不删除。
 */
import { useCallback, useEffect, useState } from 'react';
import { guidesApi, type GuideDTO } from '@/api/guides';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { toast } from '../components/Toast';

const SCENARIO_OPTIONS = ['', '月报', '结案', '复盘'];

export function GuidePage() {
  const [list, setList] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [businessLines, setBusinessLines] = useState<BusinessLineDTO[]>([]);
  const [filterBl, setFilterBl] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await guidesApi.list(filterBl || undefined));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterBl]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { lookupApi.listBusinessLines().then(setBusinessLines).catch(() => {}); }, []);

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', '指南名称', '业务线', '场景', '默认', '状态', '更新时间', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增指南</button>
        <select value={filterBl} onChange={(e) => setFilterBl(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary">
          <option value="">全部业务线</option>
          {businessLines.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((g, idx) => (
              <tr key={g.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{g.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{g.businessLine?.name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{g.scenario || '通用'}</td>
                <td className="px-3 py-2 text-foreground-secondary">{g.isDefault ? '⭐ 默认' : '—'}</td>
                <td className="px-3 py-2 text-foreground-secondary">{g.isActive ? '启用' : '已停用'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{g.updatedAt ? String(g.updatedAt).slice(0, 10) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => setEditingId(g.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无指南——生成时该业务线将只用通用系统提示词</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && <GuideFormModal businessLines={businessLines} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />}
      {editingId && <GuideFormModal businessLines={businessLines} guideId={editingId} onSaved={async () => { setEditingId(null); await reload(); }} onCancel={() => setEditingId(null)} />}
    </div>
  );
}

function GuideFormModal({ guideId, businessLines, onSaved, onCancel }: {
  guideId?: string; businessLines: BusinessLineDTO[]; onSaved: () => void; onCancel: () => void;
}) {
  const isEdit = !!guideId;
  const [businessLineId, setBusinessLineId] = useState('');
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState('');
  const [customScenario, setCustomScenario] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guideId) return;
    guidesApi.list().then((all) => {
      const g = all.find((x) => x.id === guideId);
      if (!g) { setError('加载失败'); return; }
      setBusinessLineId(g.businessLineId);
      setName(g.name);
      if (g.scenario && !SCENARIO_OPTIONS.includes(g.scenario)) { setScenario('自定义'); setCustomScenario(g.scenario); }
      else setScenario(g.scenario ?? '');
      setContent(g.content ?? '');
      setIsDefault(!!g.isDefault);
      setIsActive(g.isActive !== false);
    }).catch(() => setError('加载失败'));
  }, [guideId]);

  const finalScenario = scenario === '自定义' ? customScenario.trim() : scenario;

  async function save() {
    if (!businessLineId) { setError('请选择业务线'); return; }
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!content.trim()) { setError('指南内容不能为空'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        businessLineId,
        name: name.trim(),
        scenario: finalScenario || undefined,
        content,
        isDefault,
        isActive,
      };
      if (isEdit) await guidesApi.update(guideId!, payload);
      else await guidesApi.create(payload);
      toast.success(isEdit ? '更新成功' : '创建成功');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-[640px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑指南' : '新增指南'}</div>
        {error && <p className="text-xs text-red">{error}</p>}

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            业务线
            <select value={businessLineId} onChange={(e) => setBusinessLineId(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
              <option value="">请选择业务线…</option>
              {businessLines.map((b) => <option key={b.id} value={b.id}>{b.name}（{b.code}）</option>)}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            报告场景（空=通用，仅可作默认兜底）
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
              {SCENARIO_OPTIONS.map((s) => <option key={s} value={s}>{s || '通用'}</option>)}
              <option value="自定义">自定义…</option>
            </select>
          </label>
        </div>
        {scenario === '自定义' && (
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            自定义场景名
            <input value={customScenario} onChange={(e) => setCustomScenario(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          指南名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 DG 月报指南" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          指南内容（Markdown，约定分节：品牌视觉 / 章节结构 / 展示形式偏好 / 语调与术语）
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} spellCheck={false}
            placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
            className="resize-y rounded border border-border-default bg-surface-primary px-2 py-1.5 font-mono text-xs text-foreground-primary" />
        </label>

        <div className="flex gap-4 text-xs text-foreground-secondary">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            业务线默认（同业务线唯一，设为默认会自动取消其他默认）
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            启用（停用后不参与匹配）
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 路由 + 菜单**

App.tsx:lazy import 行(MarketingEventPage 旁)加:

```ts
const GuidePage = lazy(() => import('./routes/GuidePage').then((m) => ({ default: m.GuidePage })));
```
`<Route path="marketing-events" …/>` 行后加:

```tsx
              <Route path="guides" element={<GuidePage />} />
```

DataManagement.tsx MENUS(`{ path: '/data/marketing-events', …}` 行后)加:

```ts
  { path: '/data/guides', label: '指南' },
```

- [ ] **Step 4: 类型检查 + web 测试**

```bash
cd apps/web && ./node_modules/.bin/tsc -b --force && pnpm test
```
Expected: tsc 无错;测试全绿(页面无独立测试,沿 MarketingEventPage 先例)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/guides.ts apps/web/src/routes/GuidePage.tsx apps/web/src/App.tsx apps/web/src/routes/DataManagement.tsx && git commit -m "feat(guides): 数据管理新增指南页——列表/表单/默认互斥提示/软停用"
```

---

### Task 12: 前端生成面板 scenario 选择器 + SSE 类型

**Files:**
- Modify: `apps/web/src/api/htmlTemplates.ts`(L71-75 SSEChunk、L180-192 generateStream、L248-252 getDesignGuide)
- Modify: `apps/web/src/editor/components/AiGenerateForm.tsx`
- Modify: `apps/web/src/routes/HtmlStudio.tsx`(L76、L258、L329-335)
- Test: `apps/web/src/editor/components/AiGenerateForm.test.tsx`

- [ ] **Step 1: 写失败测试(追加到 AiGenerateForm.test.tsx)**

```tsx
it('scenario 选择器:切「月报」→ onGenerate 携带 scenario', async () => {
  const onGenerate = vi.fn();
  render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);
  await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1'));
  fireEvent.change(screen.getByDisplayValue('通用'), { target: { value: '月报' } });
  fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
  const arg = onGenerate.mock.calls[0][0];
  expect(arg.scenario).toBe('月报');
});
```

(需 mock getDesignGuide 返回增加 `guideName: 'DG 默认指南'`——现有 mock 已含 designMd 字段,兼容。)

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web && pnpm vitest run src/editor/components/AiGenerateForm.test.tsx
```
Expected: FAIL(无 scenario 下拉/onGenerate 无该字段)。

- [ ] **Step 3: 实现**

(a) htmlTemplates.ts:
- SSEChunk done 分支加 `guideUsed?: { id: string; name: string } | null;`
- generateStream input 加 `scenario?: string;`
- getDesignGuide 返回类型加 `guideName: string; guideId: string | null;`

(b) AiGenerateForm.tsx:
- Props.onGenerate 类型:`(vals: { mode: Mode; prompt: string; designMd: string; scenario: string }) => void;`
- state:`const [scenario, setScenario] = useState('');`
- 「提示词模板」select 块之后插入:

```tsx
          {/* 报告场景 — 决定匹配哪份业务线指南(无匹配自动降级默认指南) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-muted">报告场景</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            >
              <option value="">通用（默认指南）</option>
              <option value="月报">月报</option>
              <option value="结案">结案</option>
              <option value="复盘">复盘</option>
            </select>
          </div>
```
- handleGenerate 的 onGenerate 调用加 `scenario,`
- designMd 徽标 title 改 `"业务线报告指南自动注入系统提示词"`

(c) HtmlStudio.tsx:
- L76 lastGenParams 类型与 L258 handleGenerate vals 类型:`{ mode: 'ai' | 'recipe'; prompt: string; designMd: string; scenario: string }`
- L329-335 generateStream 传参:`designMd: vals.designMd.trim() || undefined,` 行后加 `scenario: vals.scenario || undefined,`

- [ ] **Step 4: 跑测试 + tsc**

```bash
cd apps/web && pnpm vitest run src/editor/components/AiGenerateForm.test.tsx && ./node_modules/.bin/tsc -b --force
```
Expected: PASS + tsc 无错。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/htmlTemplates.ts apps/web/src/editor/components/AiGenerateForm.tsx apps/web/src/editor/components/AiGenerateForm.test.tsx apps/web/src/routes/HtmlStudio.tsx && git commit -m "feat(guides): 生成面板报告场景选择器——scenario 决定指南匹配"
```

---

### Task 13: designMd → Guide 一次性迁移脚本

**Files:**
- Create: `apps/server/scripts/migrate-designmd-to-guides.ts`

- [ ] **Step 1: 实现(幂等,对齐 scripts/ 直跑先例)**

```ts
/**
 * 一次性迁移:BusinessLine.designMd 非空 → 该业务线一条 isDefault Guide。
 * 幂等:同名迁移指南已存在则跳过。designMd 字段保留(只读),注入路径已在前序 commit 废除。
 * Usage: npx tsx scripts/migrate-designmd-to-guides.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUFFIX = '设计规范(迁移)';

async function main() {
  const bls = await prisma.businessLine.findMany({ where: { designMd: { not: null } } });
  for (const bl of bls) {
    const content = (bl.designMd ?? '').trim();
    if (!content) { console.log(`[skip] ${bl.code} designMd 空白`); continue; }
    const name = `${bl.name} ${SUFFIX}`;
    const exists = await prisma.guide.findFirst({ where: { businessLineId: bl.id, name } });
    if (exists) { console.log(`[skip] ${bl.code} 已迁移(${name})`); continue; }
    await prisma.$transaction([
      prisma.guide.updateMany({ where: { businessLineId: bl.id, isDefault: true }, data: { isDefault: false } }),
      prisma.guide.create({ data: { businessLineId: bl.id, name, content, isDefault: true } }),
    ]);
    console.log(`[migrated] ${bl.code} → "${name}"`);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 跑两遍验证幂等**

```bash
cd apps/server && npx tsx scripts/migrate-designmd-to-guides.ts && npx tsx scripts/migrate-designmd-to-guides.ts
```
Expected: 第一遍有 `[migrated]` 或 `[skip] designMd 空白`;第二遍全部 `[skip]`,无报错。

- [ ] **Step 3: typecheck + Commit**

```bash
cd apps/server && pnpm typecheck
git add apps/server/scripts/migrate-designmd-to-guides.ts && git commit -m "feat(guides): designMd→Guide 一次性幂等迁移脚本"
```

---

### Task 14: 全量验证 + 手动验收

- [ ] **Step 1: 全量测试 + 双端 typecheck**

```bash
cd apps/server && pnpm test && pnpm typecheck
cd ../web && pnpm test && ./node_modules/.bin/tsc -b --force
```
Expected: server/web 测试全绿,tsc 双端无错。

- [ ] **Step 2: 手动验收(dev server 注意:先 lsof 确认 :5173/:3000 进程 cwd 是否为当前 worktree)**

1. 数据管理 → 指南:为 DG 建两份——`DG 月报指南`(scenario=月报,内容含主色 #ff099e + 语调节「用『创作者』」)与 `DG 默认指南`(isDefault)。
2. HtmlStudio 选 DG campaign,AI 模式:场景=通用 生成 → 报告风格按默认指南;场景=月报 生成 → 风格按月报指南(系统提示词面板可展开核对指南段存在)。
3. 无指南业务线(如 FT 未配)的 campaign 生成 → 正常出报告(纯 CORE 风格),无报错。
4. 生成后自然语言编辑(改标题)→ 风格与首稿一致。
5. recipe 模式生成 DG campaign → Actionable 卡文案遵守「语调与术语」。
6. 停用月报指南(isActive=false)→ 再选月报场景 → 降级用默认指南。

- [ ] **Step 3: 收尾(在 worktree 完成后,按 finishing-a-development-branch 流程决定合入;主树脏,禁止整文件 add)**

---

## Self-Review 记录

- **Spec 覆盖**:三层提示词(T5/6/7/8)、Guide 模型+匹配(T1/3)、指南四节规范(GuidePage placeholder+注入规则 T5)、scenario 链路(T6/7/12)、isDefault 互斥(T3)、软停用无 DELETE(T4)、静默降级(T3/6/9)、guideUsed 回传(T6/7/8)、designMd 废除+迁移(T6/13)、后台管理(T11)、recipe 语调(T9)、EDIT 一致性(T8)、DISPLAY 更新(T10)——全部有任务对应。
- **占位符扫描**:无 TBD/TODO;所有代码步骤给全文。
- **类型一致性**:`guideService.pick(businessLineId, scenario?)`、`resolveForCampaign(campaignId, scenario?) → {guide, businessLineName, businessLineCode}`、`buildSystemPrompt({base?, businessLineName?, guideContent?})`、`fillActionable(c, voice?)`、`guideUsed: {id, name} | null` 跨任务一致;`pickVoiceForCampaign(campaignId)` 仅 render.ts 使用。
- **已知取舍**:generateHtmlStream 无自动化网络测试(直连 fetch,流式 mock 成本高;核心逻辑 resolveForCampaign/buildSystemPrompt 均有单测,Task 14 手动验收覆盖);GuidePage 无组件测试(沿 MarketingEventPage 先例,tsc + 手动验收)。
