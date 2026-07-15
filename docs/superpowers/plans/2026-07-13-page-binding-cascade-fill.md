# 页面绑定级联填充（Page-Binding Cascade Fill）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当页面绑定 campaign / 达人后，该页的数据组件自动用对应绑定数据填充（`_dataSource='项目'`），切换绑定时跟随的组件自动更新。

**Architecture:** 新增纯函数模块 `pageBinding.ts`（从 importer 提取 patch 计算 + 绑定解析 + reducer）。store 新增 `applyPageBinding` action，在「新增组件 / 创建页面 / 改页面绑定」三处调用。渲染器零改动——填充只是把数据写进 `comp.data`。

**Tech Stack:** React + Zustand（store.ts）、TypeScript、vitest + jsdom（测试）。复用现有 mock 数据 API（`@/api/affiliate`、`@/api/creatorPerformance`）。

**工作位置：** 在主工作树实现（**不**开 worktree）。本特性直接依赖 `importers.tsx` / `defaults.ts` 中未提交的 creator-avatar 工作——worktree 从 origin/main 拉取会丢失这些依赖，故与该工作进行同一棵树。提交时仅 `git add` 本特性相关文件 / hunk。

**精确的自动填充组件集（与现有 importer 1:1，无 importer 的不参与）：**
- **creator 型**（取 `page.creatorId`）：`creator-avatar-card`、`meta-strip`、`creator-stats-strip`、`creator-fan-gender`、`creator-fan-age`、`creator-works-list`、`work-screenshot`
- **campaign 型**（取 `page.campaignId` → 全局 `reportData.campaign`）：`campaign-summary`、`funnel-chart`、`revenue-timeline`、`publisher-table`、`geo-distribution`、`placement-wide-table`、`placement-type-summary`、`device-breakdown`、`content-topic-performance`、`search-term-table`、`hourly-heatmap`、`kpi-board`

**「跟随页面」判定（简模型）：** `comp.data._dataSource === 'project'`。脱离 = 用户切源到 `manual`/`url`。新增组件直接填（不看源）。

---

## File Structure

- **Create** `apps/web/src/editor/pageBinding.ts` — 纯函数模块：绑定解析、patch 计算、reducer。无 React / store 依赖（只依赖类型 + mock API）。
- **Create** `apps/web/tests/page-binding.test.ts` — 纯函数单测。
- **Create** `apps/web/tests/editor.page-binding.test.tsx` — 集成测试（store action + 触发时机）。
- **Modify** `apps/web/src/editor/property-panel/importers.tsx` — 把私有 `campaignDataPatch` 改为从 `pageBinding` 引入；各 creator importer 的 `apply()` 改为调用 `pageBinding` 的 `creatorPatch`（DRY）。
- **Modify** `apps/web/src/editor/store.ts` — 新增 `applyPageBinding` action；在 `addComponent`/`addComponentAt`/`addPageWithComponents`/`addPagesBatch`/`setPageType` 触发。
- **Modify** `apps/web/src/editor/store-types.ts` — 加 `applyPageBinding` 类型签名。
- **Modify** `apps/web/src/editor/property-panel/PageProperties.tsx` — 改 campaign/creator 后调 `applyPageBinding`。

---

## Task 1: `pageBinding.ts` 骨架——绑定解析 + 分类表

**Files:**
- Create: `apps/web/src/editor/pageBinding.ts`
- Test: `apps/web/tests/page-binding.test.ts`

- [ ] **Step 1: 写失败测试（解析 + 分类）**

```ts
// apps/web/tests/page-binding.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePageCreator, resolvePageCampaign, COMPONENT_BINDING_KIND } from '../src/editor/pageBinding';
import type { Page, ReportDataContext } from '@mediakit/shared';

const rd: ReportDataContext = {
  campaign: { id: 'camp-1', name: 'GlowLab', metrics: [] } as any,
  campaignCreators: [{ id: 'cr-1', name: 'Ada', stats: [] } as any],
  creators: [{ id: 'cr-2', name: 'Bo', stats: [] } as any],
};

describe('resolvePageCreator', () => {
  it('按 page.creatorId 从合并达人列表解析', () => {
    const page = { id: 'p', name: 'n', creatorId: 'cr-2' } as Page;
    expect(resolvePageCreator(page, rd)?.id).toBe('cr-2');
  });
  it('campaignCreators 优先于 creators（同 id 去重）', () => {
    const rd2: ReportDataContext = {
      campaignCreators: [{ id: 'dup', name: 'FromCampaign' } as any],
      creators: [{ id: 'dup', name: 'FromLib' } as any],
    };
    const page = { id: 'p', name: 'n', creatorId: 'dup' } as Page;
    expect(resolvePageCreator(page, rd2)?.name).toBe('FromCampaign');
  });
  it('无绑定 / 找不到 → undefined', () => {
    expect(resolvePageCreator({ id: 'p', name: 'n' } as Page, rd)).toBeUndefined();
    expect(resolvePageCreator({ id: 'p', name: 'n', creatorId: 'nope' } as Page, rd)).toBeUndefined();
  });
});

describe('resolvePageCampaign', () => {
  it('page.campaignId 命中全局 campaign', () => {
    expect(resolvePageCampaign({ id: 'p', name: 'n', campaignId: 'camp-1' } as Page, rd)?.id).toBe('camp-1');
  });
  it('不匹配 → undefined', () => {
    expect(resolvePageCampaign({ id: 'p', name: 'n', campaignId: 'other' } as Page, rd)).toBeUndefined();
  });
});

describe('COMPONENT_BINDING_KIND', () => {
  it('creator 型 / campaign 型 / 其余 undefined', () => {
    expect(COMPONENT_BINDING_KIND['creator-avatar-card']).toBe('creator');
    expect(COMPONENT_BINDING_KIND['kpi-board']).toBe('campaign');
    expect(COMPONENT_BINDING_KIND['text']).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: FAIL（模块不存在 / 导出未定义）

- [ ] **Step 3: 实现骨架**

```ts
// apps/web/src/editor/pageBinding.ts
import type { Page, ReportCampaign, ReportCreator, ReportDataContext } from '@mediakit/shared';
import { allReportCreators } from './store';

/** 组件 → 绑定大类。未登记的组件不参与自动填充。 */
export const COMPONENT_BINDING_KIND: Record<string, 'creator' | 'campaign' | undefined> = {
  // creator 型（取 page.creatorId）
  'creator-avatar-card': 'creator',
  'meta-strip': 'creator',
  'creator-stats-strip': 'creator',
  'creator-fan-gender': 'creator',
  'creator-fan-age': 'creator',
  'creator-works-list': 'creator',
  'work-screenshot': 'creator',
  // campaign 型（取 page.campaignId）
  'campaign-summary': 'campaign',
  'funnel-chart': 'campaign',
  'revenue-timeline': 'campaign',
  'publisher-table': 'campaign',
  'geo-distribution': 'campaign',
  'placement-wide-table': 'campaign',
  'placement-type-summary': 'campaign',
  'device-breakdown': 'campaign',
  'content-topic-performance': 'campaign',
  'search-term-table': 'campaign',
  'hourly-heatmap': 'campaign',
  'kpi-board': 'campaign',
};

/** page.creatorId → 合并达人列表（campaignCreators + creators）中解析。找不到 → undefined。 */
export function resolvePageCreator(page: Page, reportData: ReportDataContext): ReportCreator | undefined {
  if (!page.creatorId) return undefined;
  return allReportCreators(reportData).find((c) => c.id === page.creatorId);
}

/** page.campaignId → 全局 reportData.campaign（唯一）。不匹配 → undefined。 */
export function resolvePageCampaign(page: Page, reportData: ReportDataContext): ReportCampaign | undefined {
  if (!page.campaignId || !reportData.campaign) return undefined;
  return reportData.campaign.id === page.campaignId ? reportData.campaign : undefined;
}
```

> 注：`allReportCreators` 已在 `store.ts:54` 导出，直接复用（它做了去重 + avatar 回填）。`pageBinding.ts` → `store.ts` 的 import 不构成循环（store 不 import pageBinding）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/pageBinding.ts apps/web/tests/page-binding.test.ts
git commit -m "feat(editor): add pageBinding skeleton — resolve page creator/campaign + component kind map"
```

---

## Task 2: `campaignPatch` —— 移入 campaignDataPatch + kpi-board

**Files:**
- Modify: `apps/web/src/editor/pageBinding.ts`（新增 `campaignPatch`）
- Modify: `apps/web/src/editor/property-panel/importers.tsx:935-982`（删除私有 `campaignDataPatch`，改 import）
- Test: `apps/web/tests/page-binding.test.ts`

- [ ] **Step 1: 写失败测试**

追加到 `tests/page-binding.test.ts`：

```ts
import { campaignPatch } from '../src/editor/pageBinding';

const campaign = { id: 'camp-1', name: 'GlowLab', metrics: [{ label: 'Spend', value: '$1k', compare: '' }] } as any;

describe('campaignPatch', () => {
  it('funnel-chart 返回 { steps }', () => {
    expect(campaignPatch('funnel-chart', campaign)).toHaveProperty('steps');
  });
  it('kpi-board 用 metricsToRows 生成 headers/rows', () => {
    const p = campaignPatch('kpi-board', campaign);
    expect(p).toHaveProperty('headers');
    expect(p).toHaveProperty('rows');
  });
  it('无 metrics 的 campaign 对 kpi-board 返回 null', () => {
    expect(campaignPatch('kpi-board', { id: 'c', name: 'n' } as any)).toBeNull();
  });
  it('未登记类型返回 null', () => {
    expect(campaignPatch('text', campaign)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: FAIL（`campaignPatch` 未导出）

- [ ] **Step 3: 把 `campaignDataPatch` 从 importers.tsx 移入 pageBinding.ts 并扩展 kpi-board**

在 `pageBinding.ts` 顶部加 import，并新增 `campaignDataPatch`（从 `importers.tsx:936-982` 原样搬来）+ `campaignPatch` 包装：

```ts
// pageBinding.ts 顶部新增 import
import {
  getCampaignSummary, getConversionFunnel, getRevenueTimeline, getPublishers,
  getGeoPerformance, getPlacementWideRows, getDeviceBreakdown, getContentTopics,
  getSearchTerms, getHourlyPerformance,
} from '@/api/affiliate';
import { listPlacementTypeSummary } from '@/api/creatorPerformance';
import { metricsToRows } from './campaignMetrics';
import type { ReportCampaign } from '@mediakit/shared';

/** 根据 ComponentType 从对应 mock 函数取数据，返回 data patch。从 importers.tsx 迁入。 */
export function campaignDataPatch(compType: string, campaignId: string): Record<string, unknown> | null {
  switch (compType) {
    case 'campaign-summary': {
      const s = getCampaignSummary(campaignId);
      return {
        campaignName: s.campaignName, period: s.period,
        metrics: [
          { label: 'Spend', value: s.totalSpend },
          { label: 'Revenue', value: s.totalRevenue },
          { label: 'ROAS', value: s.roas },
          { label: 'Commission', value: s.totalCommission },
        ],
        customerSplit: {
          newCustomers: s.newCustomers, returningCustomers: s.returningCustomers, newCustomerRate: s.newCustomerRate,
        },
      };
    }
    case 'funnel-chart': return { steps: getConversionFunnel(campaignId) };
    case 'revenue-timeline': return { points: getRevenueTimeline(campaignId, 14) };
    case 'publisher-table': return { rows: getPublishers(campaignId) };
    case 'geo-distribution': return { items: getGeoPerformance(campaignId) };
    case 'placement-wide-table': return { rows: getPlacementWideRows(campaignId) };
    case 'placement-type-summary': return { items: listPlacementTypeSummary(campaignId) };
    case 'device-breakdown': return { items: getDeviceBreakdown(campaignId) };
    case 'content-topic-performance': return { items: getContentTopics(campaignId) };
    case 'search-term-table': return { items: getSearchTerms(campaignId) };
    case 'hourly-heatmap': return { hours: getHourlyPerformance(campaignId) };
    default: return null;
  }
}

/** campaign 型组件填充：campaignDataPatch + kpi-board（metricsToRows）。无数据 → null。 */
export function campaignPatch(compType: string, campaign: ReportCampaign): Record<string, unknown> | null {
  if (compType === 'kpi-board') {
    if (!campaign.metrics?.length) return null;
    return metricsToRows(campaign.metrics);
  }
  return campaignDataPatch(compType, campaign.id);
}
```

- [ ] **Step 4: 让 importers.tsx 复用迁出的 `campaignDataPatch`（DRY）**

`importers.tsx`：删除 `:935-982` 的私有 `campaignDataPatch`；在顶部 import 区（`:8-20` 附近）加：

```ts
import { campaignDataPatch } from '../pageBinding';
```

并删除 `importers.tsx` 现有对 `getCampaignSummary/getConversionFunnel/.../listPlacementTypeSummary` 中**仅被 campaignDataPatch 使用**的 import（保留仍被其他地方使用的）。可用 `cd apps/web && npx tsc --noEmit` 验证未用到的 import 是否报错，按报错清理。

- [ ] **Step 5: 跑测试 + typecheck**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts && npx tsc --noEmit`
Expected: 测试 PASS；typecheck 干净（含 importers.tsx 改动）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/pageBinding.ts apps/web/src/editor/property-panel/importers.tsx apps/web/tests/page-binding.test.ts
git commit -m "refactor(editor): move campaignDataPatch to pageBinding, add campaignPatch with kpi-board"
```

---

## Task 3: `creatorPatch` —— creator 型填充纯函数 + DRY 重构 importer apply()

**Files:**
- Modify: `apps/web/src/editor/pageBinding.ts`（新增 `creatorPatch`）
- Modify: `apps/web/src/editor/property-panel/importers.tsx`（7 个 creator importer 的 `apply()` 改调 `creatorPatch`）
- Test: `apps/web/tests/page-binding.test.ts`

- [ ] **Step 1: 写失败测试**

追加到 `tests/page-binding.test.ts`：

```ts
import { creatorPatch } from '../src/editor/pageBinding';
import type { ReportCreator } from '@mediakit/shared';

const cr = {
  id: 'cr-1', name: 'Ada', handle: '@ada', platform: 'TikTok', tier: 'macro',
  followers: '1M', engagement: '5%', category: 'Beauty', region: 'US', avatar: 'http://x/a.png',
  stats: [{ label: 'Followers', value: '1M', compare: '' }] as any,
  audience: {
    genderSplit: [{ label: 'F', value: 60, color: 'auto' }] as any,
    ageRange: [{ label: '18-24', value: 30, color: 'auto' }] as any,
  },
} as unknown as ReportCreator;

describe('creatorPatch', () => {
  it('creator-avatar-card 填 7 字段', () => {
    const p = creatorPatch('creator-avatar-card', cr, 'camp-1') as any;
    expect(p).toMatchObject({ name: 'Ada', handle: '@ada', followers: '1M', avatar: 'http://x/a.png' });
    expect(p.intro).toContain('Beauty');
  });
  it('creator-stats-strip 镜像 stats（无 stats → null）', () => {
    expect(creatorPatch('creator-stats-strip', cr, 'camp-1')).toHaveProperty('stats');
    expect(creatorPatch('creator-stats-strip', { ...cr, stats: [] } as any, 'camp-1')).toBeNull();
  });
  it('creator-fan-gender / fan-age 从 audience 取', () => {
    expect(creatorPatch('creator-fan-gender', cr, 'camp-1')).toHaveProperty('slices');
    expect(creatorPatch('creator-fan-age', cr, 'camp-1')).toHaveProperty('bars');
  });
  it('creator-fan-gender 无 audience 数据 → null', () => {
    expect(creatorPatch('creator-fan-gender', { ...cr, audience: {} } as any, 'camp-1')).toBeNull();
  });
  it('meta-strip 生成 rows（至少 1 行）', () => {
    const p = creatorPatch('meta-strip', cr, 'camp-1') as any;
    expect(p.rows.length).toBeGreaterThanOrEqual(1);
  });
  it('未登记类型 → null', () => {
    expect(creatorPatch('text', cr, 'camp-1')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: FAIL（`creatorPatch` 未导出）

- [ ] **Step 3: 实现 `creatorPatch`**

在 `pageBinding.ts` 加 import + 函数（逻辑逐字段对照 importers.tsx 各 `apply()`）：

```ts
// pageBinding.ts 顶部新增 import
import { campaignCreatorWorks } from '@/api/creatorPerformance';
import type { ReportCreator, WorkScreenshotItem } from '@mediakit/shared';

const cap = (s?: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * creator 型组件填充。逻辑与各 creator importer 的 apply() 1:1（DRY：importer 改调本函数）。
 * campaignId 仅 creator-works-list / work-screenshot 需要（限定该 campaign 下作品）。
 * 无可用数据 → null（调用方跳过）。
 */
export function creatorPatch(
  compType: string,
  cr: ReportCreator,
  campaignId: string,
): Record<string, unknown> | null {
  switch (compType) {
    case 'creator-avatar-card':
      return {
        name: cr.name,
        platform: (cr.platform ?? 'TikTok') as string,
        handle: cr.handle,
        followers: cr.followers,
        engagement: cr.engagement,
        avatar: cr.avatar ?? '',
        intro: cr.category ? `${cr.category} · ${cr.region ?? ''}`.trim() : '',
      };
    case 'meta-strip': {
      const rows: string[][] = [];
      if (cr.category) rows.push(['tag', 'CATEGORY', cr.category]);
      if (cr.region) rows.push(['target', 'REGION', cr.region]);
      if (cr.tier) rows.push(['trophy', 'TIER', cap(cr.tier)]);
      if (rows.length === 0) rows.push(['tag', 'NAME', cr.name]);
      return { rows };
    }
    case 'creator-stats-strip':
      if (!cr.stats?.length) return null;
      return { stats: cr.stats.map((s) => ({ ...s })) };
    case 'creator-fan-gender':
      if (!cr.audience?.genderSplit?.length) return null;
      return { slices: cr.audience.genderSplit.map((g) => ({ label: g.label, value: g.value, color: g.color ?? 'auto' })) };
    case 'creator-fan-age':
      if (!cr.audience?.ageRange?.length) return null;
      return { bars: cr.audience.ageRange.map((a) => ({ label: a.label, value: a.value, color: a.color ?? 'auto' })) };
    case 'creator-works-list': {
      const cw = campaignCreatorWorks(campaignId).find((c) => c.creatorId === cr.id);
      if (!cw || cw.posts.length === 0) return null;
      const headers = ['Cover', 'Title', 'Impressions', 'Likes', 'Comments', 'Shares', 'Eng. Rate'];
      const rows = cw.posts.map((p) => [p.cover, p.title, p.impressions, p.likes, p.comments, p.shares, p.engagementRate]);
      return { headers, rows, title: `${cw.creatorName} Works` };
    }
    case 'work-screenshot': {
      const cw = campaignCreatorWorks(campaignId).find((c) => c.creatorId === cr.id);
      if (!cw || cw.posts.length === 0) return null;
      const images: WorkScreenshotItem[] = cw.posts.map((p) => ({ src: p.cover, caption: `${cw.creatorName} · ${p.title}` }));
      return { images };
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: DRY 重构——6 个「单达人」importer apply() 改调 `creatorPatch`**

`importers.tsx`，把以下 6 个**单达人** importer 的 `apply()` 内联 patch 计算替换为 `creatorPatch(...)` 调用（保留各自的 UI 状态：`updateComponentData` / `commit` / `setSelected('')`）。顶部加 `import { creatorPatch } from '../pageBinding';`。

> ⚠️ **不要动 `ReportWorkScreenshotImporter.importSelected`（:315-325）和 `ReportCreatorListImporter`（:598-685）**——它们是**多达人**选择 UI，语义与单达人的 `creatorPatch` 不同。`creatorPatch('work-screenshot', …)` 只服务「自动填充」单页达人路径，是一段新代码，不替换上述手 UI。creator-list 不在 `COMPONENT_BINDING_KIND` 内，本来也不自动填。

示例——`ReportCreatorAvatarImporter.apply()`（`:424-438`）改为：

```ts
function apply() {
  const cr = creators.find((c) => c.id === selected) ?? pageCreator;
  if (!cr) return;
  const patch = creatorPatch('creator-avatar-card', cr, '');
  if (!patch) return;
  updateComponentData(comp.id, patch);
  commit();
  setSelected('');
}
```

对其余 5 个单达人 importer 同理替换内联 patch（保留各自的 `cr` 解析与 UI 状态）：
- `meta-strip`（`ReportCreatorMetaStripImporter.apply` :488-500）→ `creatorPatch('meta-strip', cr, '')`
- `creator-stats-strip`（`ReportCreatorStatsImporter.apply` :549-555）→ `creatorPatch('creator-stats-strip', cr, '')`
- `creator-fan-gender`（`ReportCreatorFanGenderImporter.apply` :813-825）→ `creatorPatch('creator-fan-gender', cr, '')`
- `creator-fan-age`（`ReportCreatorFanAgeImporter.apply` :879-891）→ `creatorPatch('creator-fan-age', cr, '')`
- `creator-works-list`（`ReportCreatorWorksImporter.apply` :726-742）→ `creatorPatch('creator-works-list', cr, campaignId)`（`campaignId = reportData?.campaign?.id ?? ''`，该组件作用域已有）

每个 apply() 的 `cr` 取「下拉选中达人 ?? pageCreator」（与原逻辑一致）；campaign-works-list 用 `creators.find(c => c.id === selectedCreator) ?? pageCreator`。

- [ ] **Step 5: 跑全部相关测试 + typecheck**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts tests/creator-avatar-importer.test.tsx && npx tsc --noEmit`
Expected: PASS；typecheck 干净。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/pageBinding.ts apps/web/src/editor/property-panel/importers.tsx apps/web/tests/page-binding.test.ts
git commit -m "refactor(editor): extract creatorPatch, DRY creator importer apply() to use it"
```

---

## Task 4: `applyPageBinding` reducer（纯函数）+ 单测

**Files:**
- Modify: `apps/web/src/editor/pageBinding.ts`
- Test: `apps/web/tests/page-binding.test.ts`

- [ ] **Step 1: 写失败测试**

追加到 `tests/page-binding.test.ts`：

```ts
import { applyPageBinding } from '../src/editor/pageBinding';
import type { Page, EditorComponent } from '@mediakit/shared';

const mkComp = (type: string, dataSource?: string): EditorComponent =>
  ({ id: `c-${type}`, type, x: 0, y: 0, w: 10, h: 10, data: { ...(dataSource ? { _dataSource: dataSource } : {}) } }) as any;

describe('applyPageBinding reducer', () => {
  const rd2 = {
    campaign: { id: 'camp-1', name: 'G', metrics: [{ label: 'Spend', value: '$1', compare: '' }] } as any,
    campaignCreators: [{ id: 'cr-1', name: 'Ada', platform: 'TikTok', stats: [{ label: 'F', value: '1', compare: '' }] } as any],
  } as any;

  it('新增组件（无 _dataSource）在绑定页 → 被填充 + _dataSource=project', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set(['c-creator-stats-strip']));
    const c = out[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).stats).toBeDefined();
  });
  it('source=project 的组件在绑定变化时重填', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip', 'project')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set()); // 不传「新增」集合 → 只看 source=project
    expect((out[0].components[0].data as any).stats).toBeDefined();
    expect((out[0].components[0].data as any)._dataSource).toBe('project');
  });
  it('source=manual 的组件不被覆盖', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip', 'manual')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set());
    expect((out[0].components[0].data as any).stats).toBeUndefined();
  });
  it('未登记类型（text）不动', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('text', 'project')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set(['c-text']));
    expect(out[0].components[0].data).not.toHaveProperty('_dataSource');
  });
  it('无绑定的页面 → 原样返回', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', components: [mkComp('creator-stats-strip')] } as any];
    expect(applyPageBinding(pages, 'p1', rd2, new Set(['c-creator-stats-strip']))).toEqual(pages);
  });
  it('找不到 pageId → 原样返回', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [] } as any];
    expect(applyPageBinding(pages, 'nope', rd2, new Set())).toEqual(pages);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: FAIL（`applyPageBinding` 未导出）

- [ ] **Step 3: 实现 reducer**

在 `pageBinding.ts` 加：

```ts
import type { EditorComponent, Page, ReportDataContext } from '@mediakit/shared';

type DataSourceMode = 'manual' | 'url' | 'project';

/**
 * 纯 reducer：对 pageId 页面上的组件做绑定级联填充。
 * - 「新增组件」(newCompIds) → 无论源都填（首次落点）。
 * - 其余 → 仅当 _dataSource==='project'（跟随页面）才重填。
 * 填充 = 取 creatorPatch / campaignPatch 合并进 comp.data，并置 _dataSource='project'。
 * 无 patch（无数据 / 未登记）→ 不动该组件。
 */
export function applyPageBinding(
  pages: Page[],
  pageId: string,
  reportData: ReportDataContext,
  newCompIds: Set<string>,
): Page[] {
  const idx = pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return pages;
  const page = pages[idx];
  const creator = resolvePageCreator(page, reportData);
  const campaign = resolvePageCampaign(page, reportData);
  if (!creator && !campaign) return pages;

  const fill = (comp: EditorComponent): EditorComponent => {
    const kind = COMPONENT_BINDING_KIND[comp.type];
    if (!kind) return comp;
    const isNew = newCompIds.has(comp.id);
    const ds = (comp.data as { _dataSource?: DataSourceMode })._dataSource;
    const following = isNew || ds === 'project';
    if (!following) return comp;
    const patch = kind === 'creator' && creator
      ? creatorPatch(comp.type, creator, page.campaignId ?? '')
      : kind === 'campaign' && campaign
        ? campaignPatch(comp.type, campaign)
        : null;
    if (!patch) return comp;
    return { ...comp, data: { ...comp.data, ...patch, _dataSource: 'project' } };
  };

  const nextComps = page.components.map(fill);
  if (nextComps.every((c, i) => c === page.components[i])) return pages; // 无变化
  const nextPages = pages.slice();
  nextPages[idx] = { ...page, components: nextComps };
  return nextPages;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && npx vitest run tests/page-binding.test.ts`
Expected: PASS（全部 case）

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/pageBinding.ts apps/web/tests/page-binding.test.ts
git commit -m "feat(editor): add applyPageBinding pure reducer"
```

---

## Task 5: store action `applyPageBinding` + 接入「新增组件」

**Files:**
- Modify: `apps/web/src/editor/store-types.ts`（加签名）
- Modify: `apps/web/src/editor/store.ts`（实现 + 接入 addComponent / addComponentAt）
- Test: `apps/web/tests/editor.page-binding.test.tsx`

- [ ] **Step 1: 写失败集成测试**

```tsx
// apps/web/tests/editor.page-binding.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/editor/store';

beforeEach(() => {
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [] } as any],
    currentPageId: 'p1',
    reportData: {
      campaign: { id: 'camp-1', name: 'G', metrics: [] } as any,
      campaignCreators: [{ id: 'cr-1', name: 'Ada', platform: 'TikTok', stats: [{ label: 'F', value: '1M', compare: '' }] } as any],
    } as any,
    projectMeta: {},
  });
});

describe('addComponent on bound page', () => {
  it('新增 creator 型组件 → 自动填 + _dataSource=project', () => {
    useEditorStore.getState().addComponent('creator-stats-strip');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).stats).toBeDefined();
  });
  it('未绑定页面新增组件 → 不填（保持默认 manual）', () => {
    useEditorStore.setState({ pages: [{ id: 'p2', name: 'n', components: [] } as any], currentPageId: 'p2' });
    useEditorStore.getState().addComponent('creator-stats-strip');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBeUndefined();
  });
});

describe('applyPageBinding action', () => {
  it('手动改某组件 source=manual 后，applyPageBinding 不覆盖它', () => {
    useEditorStore.getState().addComponent('creator-stats-strip');
    const id = useEditorStore.getState().pages[0].components[0].id;
    useEditorStore.getState().setComponentData(id, { _dataSource: 'manual', stats: [{ label: 'X', value: '9', compare: '' }] });
    useEditorStore.getState().applyPageBinding('p1');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any).stats[0].value).toBe('9'); // 保留手动值
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/editor.page-binding.test.tsx`
Expected: FAIL（`applyPageBinding` action 不存在 / addComponent 未填）

- [ ] **Step 3: 加类型签名 `store-types.ts`**

在 `EditorState` 接口里（紧挨 `setPageType` 附近）加：

```ts
/** 把当前页（或指定页）的所有「跟随」组件按页面 campaign/creator 绑定重新填充。 */
applyPageBinding: (pageId?: string) => void;
```

- [ ] **Step 4: 实现 action 并接入 addComponent / addComponentAt**

`store.ts` 顶部 import：`import { applyPageBinding as applyPageBindingReducer } from './pageBinding';`

在 store 内（`setPageType` 之后，`:907` 附近）新增 action：

```ts
applyPageBinding: (pageId) => {
  const pid = pageId ?? get().currentPageId;
  if (!pid) return;
  mutateAndCommit((s) => ({
    pages: applyPageBindingReducer(s.pages, pid, s.reportData, new Set()),
  }));
},
```

改 `addComponent`（`:318-336`）——加完后对新组件 id 触发填充。把 return 前的 `mutateAndCommit` 体改为：先建 comp，返回 pages 时用 reducer 处理：

```ts
addComponent: (type) =>
  mutateAndCommit((s) => {
    const size = DEFAULT_SIZES[type] ?? { w: 300, h: 200 };
    const { x, y } = centered(size.w, size.h, s.canvasWidth, s.canvasHeight);
    const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
    const comp: EditorComponent = { id: newId(), type, x: cl.x, y: cl.y, w: cl.w, h: cl.h, data: getDefaultData(type) };
    const pages = withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]);
    return {
      pages: applyPageBindingReducer(pages, s.currentPageId!, s.reportData, new Set([comp.id])),
      selectedIds: [comp.id],
    };
  }),
```

对 `addComponentAt`（`:366-377`）做同样改动（建 comp → pages → 套 reducer 传 `new Set([comp.id])`）。

> `currentPageId` 此处非空（正在交互）。用 `!` 断言；若担心，加 `if (!s.currentPageId) return { pages, selectedIds: [comp.id] };` 守卫。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd apps/web && npx vitest run tests/editor.page-binding.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/src/editor/store-types.ts apps/web/tests/editor.page-binding.test.tsx
git commit -m "feat(editor): wire applyPageBinding into addComponent/addComponentAt"
```

---

## Task 6: 接入「创建页面」+「改页面类型自动绑定」

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`addPageWithComponents:687`、`addPagesBatch:710`、`setPageType` patchCampaign `:887-894`）
- Test: `apps/web/tests/editor.page-binding.test.tsx`

- [ ] **Step 1: 写失败测试**

追加到 `tests/editor.page-binding.test.tsx`：

```tsx
describe('page creation auto-fills', () => {
  it('addPageWithComponents 在已绑定 campaign 的页上 → campaign 组件被填', () => {
    // funnel-chart 的 campaignPatch 恒返回 { steps }（不依赖 metrics），适合断言「被填」
    useEditorStore.getState().addPageWithComponents('rep', [{ id: 't1', type: 'funnel-chart', x: 0, y: 0, w: 10, h: 10, data: { steps: [] } } as any], { pageType: 'report-monthly-overview' });
    // report-monthly-overview 属 campaign-report → 自动绑定全局 campaign；funnel-chart 应被填
    const page = useEditorStore.getState().pages.find((p) => p.name === 'rep')!;
    const c = page.components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).steps.length).toBeGreaterThan(0);
  });
});

describe('setPageType patchCampaign triggers fill', () => {
  it('切到 campaign-report 且自动绑 campaign → 页内 campaign 组件被填', () => {
    useEditorStore.setState({
      pages: [{ id: 'p1', name: 'n', components: [{ id: 'f1', type: 'funnel-chart', x: 0, y: 0, w: 10, h: 10, data: { steps: [] } } as any] } as any],
      currentPageId: 'p1',
    });
    useEditorStore.getState().setPageType('p1', 'report-channel');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).steps.length).toBeGreaterThan(0); // 确证被填，而非保留空数组
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && npx vitest run tests/editor.page-binding.test.tsx`
Expected: FAIL（创建页面 / setPageType 后组件未被填）

- [ ] **Step 3: 接入 addPageWithComponents**

`store.ts:705` 的 `return { pages: [...s.pages, page], ... }` 改为：

```ts
const pages = [...s.pages, page];
return {
  pages: applyPageBindingReducer(pages, page.id, s.reportData, new Set(page.components.map((c) => c.id))),
  currentPageId: page.id,
  selectedIds: [],
};
```

（`refreshReportTitle(pageId)` 在 `mutateAndCommit` 外的 `:707` 保持不变。）

- [ ] **Step 4: 接入 addPagesBatch**

`store.ts:731` 的 `return { pages: [...s.pages, ...built], ... }` 前，对每个新页面套 reducer：

```ts
let pages = [...s.pages, ...built];
for (const pg of built) {
  pages = applyPageBindingReducer(pages, pg.id, s.reportData, new Set(pg.components.map((c) => c.id)));
}
return { pages, currentPageId: built[0].id, selectedIds: [] };
```

- [ ] **Step 5: 接入 setPageType patchCampaign**

`setPageType`（`:882-905`）的 `return { pages: s.pages.map((p) => { ... }) }`，在 `const next: Page = { ...p, pageType }` 与 `patchCampaign` 赋值之后、return 之前，对该页套 reducer。最简做法：把 map 的结果先存变量，再 reducer：

```ts
const mapped = s.pages.map((p) => { /* 原有逻辑 */ return next; });
const patched = applyPageBindingReducer(mapped, pageId, s.reportData, new Set());
return { pages: patched };
```

（`setPageType` 的参数 `pageId` 已在作用域内。reducer 用 `new Set()`——不强制新增，仅重填 source=project 的；若切类型前组件是默认无 source 的，需把它们当新增处理：见下方说明。）

> **说明：** setPageType 场景下页面既有组件多为模板默认（无 `_dataSource`），按「跟随=source=project」规则不会被填。若希望切类型即填这些默认组件，把 `new Set()` 改为 `new Set(p.components.map((c) => c.id))`（当新增处理）。本步采用后者，使「切到 campaign-report → KPI 等立即有数据」成立。即：
> ```ts
> const patched = applyPageBindingReducer(mapped, pageId, s.reportData, new Set((mapped.find(p=>p.id===pageId)?.components ?? []).map(c => c.id)));
> ```

- [ ] **Step 6: 跑测试 + 全量 editor 测试**

Run: `cd apps/web && npx vitest run tests/editor.page-binding.test.tsx tests/editor.creator.test.tsx tests/editor.blocks.test.tsx`
Expected: PASS（新 + 既有不回归）

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.page-binding.test.tsx
git commit -m "feat(editor): auto-fill on page create and on setPageType campaign bind"
```

---

## Task 7: 接入「PageProperties 改 campaign/creator」

**Files:**
- Modify: `apps/web/src/editor/property-panel/PageProperties.tsx:407,428,453`

- [ ] **Step 1: 写失败测试**

追加到 `tests/editor.page-binding.test.tsx`：

```tsx
describe('changing page binding refills followers', () => {
  it('改 page.creatorId → 跟随组件更新', () => {
    useEditorStore.getState().addComponent('creator-stats-strip');
    // 切到另一个达人
    useEditorStore.setState({
      reportData: {
        campaignCreators: [
          { id: 'cr-1', name: 'Ada', stats: [{ label: 'F', value: '1M', compare: '' }] } as any,
          { id: 'cr-2', name: 'Bo', stats: [{ label: 'F', value: '2M', compare: '' }] } as any,
        ],
      } as any,
    });
    useEditorStore.getState().applyPageBinding('p1'); // 模拟 PageProperties 改 creatorId 后调用
    // 当前 page.creatorId 仍 cr-1 → stats=1M；改 creatorId 再 apply
    useEditorStore.setState({ pages: [{ id: 'p1', name: 'n', creatorId: 'cr-2', components: useEditorStore.getState().pages[0].components } as any] });
    useEditorStore.getState().applyPageBinding('p1');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any).stats[0].value).toBe('2M');
  });
});
```

> 说明：本测试直接驱动 `applyPageBinding` action（PageProperties 改完 creatorId 后即调它）。UI 层的「改完即调」在 Step 3 接入。

- [ ] **Step 2: 跑测试确认失败/通过**

Run: `cd apps/web && npx vitest run tests/editor.page-binding.test.tsx`
Expected: 该 case 应 PASS（action 在 Task 5 已实现）——此步主要锁定行为契约。

- [ ] **Step 3: PageProperties 改 campaign/creator 后调 applyPageBinding**

`PageProperties.tsx`：组件内取 action —— 在 `const setPageType = ...`（`:13`）旁加：

```ts
const applyPageBinding = useEditorStore((s) => s.applyPageBinding);
```

把 campaign/creator 的三个 `set(...)` 调用（`:407` 的 campaignId、`:428` 的 creatorId、`:453` 的 creatorId）改为改完即触发。例：

```ts
// :407 campaignId（campaign-report / creator-collab）
onChange={(e) => { set({ campaignId: e.target.value || undefined }); applyPageBinding(page.id); }}
```

对其余两处（`:428`、`:453`）同样追加 `applyPageBinding(page.id);`。

- [ ] **Step 4: typecheck + 跑组件测试**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run tests/editor.page-binding.test.tsx`
Expected: typecheck 干净；测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/property-panel/PageProperties.tsx apps/web/tests/editor.page-binding.test.tsx
git commit -m "feat(editor): refill followers when page campaign/creator binding changes"
```

---

## Task 8: 全量回归 + typecheck + 手动验证清单

**Files:** 无新增（验证 only）

- [ ] **Step 1: 全量 web 测试**

Run: `cd apps/web && npx vitest run`
Expected: 全绿（含既有 creator-avatar / report / editor 系列）。

- [ ] **Step 2: 全量 typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 干净。

- [ ] **Step 3: 手动验证清单（启动 dev server 后）**

- [ ] 建一个 creator-collab 页，绑定全局 campaign + 选一个达人 → 往页里拖 `creator-avatar-card` / `creator-stats-strip` / `creator-fan-age` → 立即显示该达人数据，属性面板源=项目。
- [ ] 改该页达人 → 上述组件自动换数据；把某组件源切「手动」再改达人 → 该组件不动。
- [ ] 建 campaign-report 页（如 report-monthly-overview）→ KPI / funnel 等落地即有全局 campaign 数据。
- [ ] 未绑定页面拖组件 → 保持默认占位（manual）。

- [ ] **Step 4: 最终提交（如有手动验证中发现的小修）**

```bash
git status
# 按 hunk 提交残余
```

---

## 已知权衡 / 后续

- **Undo 粒度**：PageProperties 改 campaign/creator 会产生两条 history（binding 一条 + refill 一条）。v1 接受。后续可合并为单一 `setPageBinding` action。
- **严格手动覆盖**：当前「简」模型——切源到 manual 才脱离。若要「在 project 源下编辑内容字段即自动脱离」，需在 `updateComponentData` 插桩 `_manualOverride` 标记（spec 已列为后续增强）。
- **creator-list / fan-city / fan-interest / work-metrics**：无单绑定 importer，未纳入自动填充（与 spec「以 importer 实际行为为准」一致）。
- **`creator-works-list` / `work-screenshot`** 需要 page 同时绑 campaign + creator 才有作品数据；只绑 creator（无 campaign）→ `campaignCreatorWorks('')` 可能返回空 → 跳过（保留占位）。
