# 场景驱动的页面模版过滤 + media-kit 专属模版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「+ 页面」单页模版选择器按当前项目场景（`campaign-report` / `campaign-proposal` / `media-kit`）过滤可选模版，并为 media-kit 新增三个专属模版（受众画像 / 账号数据概览 / 合作品牌）。

**Architecture:** 给 `Template` 加可选 `scenario?: Scenario[]`（缺省=全场景可见），新增纯函数 `filterCategoriesByScenario(scenario)` 作为过滤唯一入口，`TemplateOverlay` 读 store 的 `projectMeta.scenario` 调用它、丢弃空类别。三个新模版各引入一个新 `PageType`（同步 union / `PAGE_CATEGORY_MAP` / 服务端 Zod enum / `PAGE_TYPE_ICONS` / `PAGE_TYPE_GROUPS`），归入新增的「媒介包」类别、标 `['media-kit']`。服务端 `reportDataContextSchema` 补 `creators[].audience` 让受众画像自动绑定数据可持久化。

**Tech Stack:** React + TypeScript + Zustand（前端）、Zod（服务端校验）、Vitest（测试）。包名 `@mediakit/web` / `@mediakit/server`。

**Spec:** `docs/superpowers/specs/2026-07-15-scenario-page-template-filter-design.md`

---

## File Structure

| 文件 | 职责 | 改动 |
|---|---|---|
| `apps/web/src/editor/templates.ts` | `Template` 接口、`TEMPLATE_CATEGORIES`、`TEMPLATES` 目录、过滤入口 | 加 `scenario` 字段 + `filterCategoriesByScenario` + 打标 13 个模版 + 3 个新模版 + 「媒介包」类别 |
| `apps/web/src/editor/components/TemplateOverlay.tsx` | 「+ 页面」浮层 | 改用 `filterCategoriesByScenario(scenario)` |
| `packages/shared/src/types/page.ts` | `PageType` 联合 + `PAGE_CATEGORY_MAP` | 加 3 个新 PageType + 映射 |
| `apps/server/src/modules/projects/projects.schema.ts` | 服务端 Zod 校验 | `pageTypeSchema` enum +3；`reportDataContextSchema` 两个 creator 数组加 `audience` |
| `apps/web/src/editor/PageSidebar.tsx` | 侧栏图标 `PAGE_TYPE_ICONS` | +3 图标 |
| `apps/web/src/editor/property-panel/PageProperties.tsx` | 属性面板类型选择器 `PAGE_TYPE_GROUPS` | +「媒介包」组 |
| `apps/web/tests/editor.scenario.test.ts` | 场景过滤 + 新模版测试 | 新增 describe 块 |
| `apps/web/tests/editor.page-type.test.ts` | PageType→大类映射测试 | +3 断言 |
| `apps/server/tests/projects.schema.test.ts` | 服务端 schema round-trip 测试 | +新 pageType + audience 持久化 |

**测试命令**（根目录运行，包名过滤）：
- web 单测：`pnpm --filter @mediakit/web exec vitest run <file>`
- web 全量：`pnpm --filter @mediakit/web test`
- web 类型：`pnpm --filter @mediakit/web typecheck`
- server 单测：`pnpm --filter @mediakit/server exec vitest run <file>`

---

## Task 1: 场景过滤机制（scenario 字段 + 过滤入口 + 打标）

**Files:**
- Modify: `apps/web/src/editor/templates.ts`
- Modify: `apps/web/src/editor/components/TemplateOverlay.tsx`
- Test: `apps/web/tests/editor.scenario.test.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/web/tests/editor.scenario.test.ts` 顶部 import 行（第 2 行）后追加导入 `filterCategoriesByScenario`：

```ts
import { SCENARIO_TEMPLATES, getTemplate, TEMPLATE_CATEGORIES, TEMPLATES, filterCategoriesByScenario } from '@/editor/templates';
```

在文件末尾（第 138 行 `});` 之后、`describe('页面维度编辑…` 之前）插入新 describe 块：

```ts
describe('filterCategoriesByScenario（按场景过滤模版）', () => {
  it('media-kit：隐藏投放报告整类；策略·内容仅剩 content-analysis', () => {
    const cats = filterCategoriesByScenario('media-kit');
    expect(cats.map((c) => c.category)).not.toContain('投放报告');
    const strategy = cats.find((c) => c.category === '策略 · 内容');
    expect(strategy?.ids).toEqual(['content-analysis-page']);
  });

  it('campaign-proposal：隐藏投放报告', () => {
    expect(filterCategoriesByScenario('campaign-proposal').map((c) => c.category)).not.toContain('投放报告');
  });

  it('campaign-report：含投放报告', () => {
    expect(filterCategoriesByScenario('campaign-report').map((c) => c.category)).toContain('投放报告');
  });

  it('无场景（undefined）→ 返回全部分类，不过滤（向后兼容）', () => {
    expect(filterCategoriesByScenario(undefined).length).toBe(TEMPLATE_CATEGORIES.length);
  });

  it('打标正确', () => {
    expect(getTemplate('report-monthly-overview')?.scenario).toEqual(['campaign-report']);
    expect(getTemplate('report-creator-collab')?.scenario).toEqual(['campaign-report']);
    expect(getTemplate('challenge-page')?.scenario).toEqual(['campaign-report', 'campaign-proposal']);
    expect(getTemplate('content-analysis-page')?.scenario).toBeUndefined();
    expect(getTemplate('creator-page')?.scenario).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.scenario.test.ts`
Expected: FAIL — `filterCategoriesByScenario is not exported`（导入失败），且 `scenario` 字段为 `undefined`。

- [ ] **Step 3: 实现 — 接口字段 + 过滤入口**

3a. 合并 import 并引入 `Scenario` 类型。把 `apps/web/src/editor/templates.ts` 第 1–2 行：

```ts
import type { ComponentType, EditorComponent } from '@mediakit/shared';
import type { PageType } from '@mediakit/shared';
```

替换为：

```ts
import type { ComponentType, EditorComponent, PageType, Scenario } from '@mediakit/shared';
```

3b. 给 `Template` 接口加字段。在 `apps/web/src/editor/templates.ts` 的 `Template` 接口（第 10–25 行）中，`businessLine?: string;`（第 24 行）之后、闭合 `}`（第 25 行）之前加：

```ts
  /**
   * 标记该模版适用的项目场景。
   * 缺省 = 所有场景可见（向后兼容）；仅当数组包含当前项目场景时，模版在选择器中可见。
   */
  scenario?: Scenario[];
```

3c. 加过滤纯函数。在 `TEMPLATE_CATEGORIES` 数组闭合（第 86 行 `];`）之后插入：

```ts
/**
 * 按项目场景过滤模版分类（「+ 页面」浮层用）：
 * - tpl.scenario 缺省 → 全场景可见；
 * - 否则仅当 scenario 包含当前场景时保留该模版；
 * - 过滤后为空的分类被丢弃；
 * - scenario 为 undefined（旧项目 / 未设场景）→ 返回全部（向后兼容）。
 */
export function filterCategoriesByScenario(
  scenario?: Scenario,
): { category: string; ids: string[] }[] {
  if (!scenario) return TEMPLATE_CATEGORIES;
  return TEMPLATE_CATEGORIES.map((cat) => ({
    category: cat.category,
    ids: cat.ids.filter((id) => {
      const tpl = getTemplate(id);
      return !tpl?.scenario || tpl.scenario.includes(scenario);
    }),
  })).filter((cat) => cat.ids.length > 0);
}
```

- [ ] **Step 4: 实现 — 给 13 个模版打 scenario 标**

对下列 8 个「投放报告」模版，在各自 `pageType: '...',` 行之后加一行 `scenario: ['campaign-report'],`：
`report-weekly-overview`（pageType 在第 343 行）、`report-monthly-overview`（357）、`report-channel`（373）、`report-wrapup-review`（389）、`report-product`（404）、`report-creator-collab`（415）、`report-placement`（438）、`report-posts`（450）。

示例（`report-monthly-overview`，第 353–368 行改动）：

```ts
  {
    id: 'report-monthly-overview',
    name: '月报 · 业绩概览',
    description: 'KPI + 趋势图 + 周期对比 + 洞察',
    pageType: 'report-monthly-overview',
    scenario: ['campaign-report'],
    components: () => {
```

对下列 5 个「策略 · 内容」模版，在各自 `pageType: '...',` 行之后加 `scenario: ['campaign-report', 'campaign-proposal'],`：
`challenge-page`（pageType `challenge`，第 521 行）、`process-page`（`process`，540）、`calendar-page`（`calendar`，553）、`campaign-plan-page`（`campaign-plan`，566）、`funnel-page`（`funnel`，616）。

示例（`challenge-page`）：

```ts
  {
    id: 'challenge-page',
    name: '机会与挑战',
    description: 'SWOT 四象限矩阵',
    pageType: 'challenge',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () => {
```

`content-analysis-page`（第 596 行）**不打标**（全场景可见）。

- [ ] **Step 5: 实现 — TemplateOverlay 接入过滤**

改 `apps/web/src/editor/components/TemplateOverlay.tsx`。

第 1 行：

```ts
import { TEMPLATE_CATEGORIES, getTemplate, type Template } from '../templates';
```

替换为：

```ts
import { filterCategoriesByScenario, getTemplate, type Template } from '../templates';
import { useEditorStore } from '../store';
```

在组件函数体开头（第 9 行 `export function TemplateOverlay({ onApply, onClose }: Props) {` 之后）加一行读场景：

```ts
  const scenario = useEditorStore((s) => s.projectMeta?.scenario);
```

把第 28 行 `{TEMPLATE_CATEGORIES.map((cat) => {` 改为：

```ts
          {filterCategoriesByScenario(scenario).map((cat) => {
```

（第 29–30 行已有的「过滤 falsy + 空则返回 null」逻辑保留不动，作为兜底。）

- [ ] **Step 6: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.scenario.test.ts`
Expected: PASS（全部用例，含原有 `TEMPLATE_CATEGORIES` 完整性用例 122–138 行——3 个新模版尚未加入，但该用例此刻仍只校验已有集合，不受影响）。

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/templates.ts apps/web/src/editor/components/TemplateOverlay.tsx apps/web/tests/editor.scenario.test.ts
git commit -m "feat(web): 页面模版按项目场景过滤（scenario 字段 + 过滤入口）"
```

---

## Task 2: 三个新 PageType 的类型贯通

> 新模版（Task 3）会引用这三个 PageType，必须先让类型系统 + 服务端校验认识它们。

**Files:**
- Modify: `packages/shared/src/types/page.ts`
- Modify: `apps/server/src/modules/projects/projects.schema.ts`
- Modify: `apps/web/src/editor/PageSidebar.tsx`
- Modify: `apps/web/src/editor/property-panel/PageProperties.tsx`
- Test: `apps/web/tests/editor.page-type.test.ts`
- Test: `apps/server/tests/projects.schema.test.ts`

- [ ] **Step 1: 写失败测试**

1a. web 端——在 `apps/web/tests/editor.page-type.test.ts` 顶部确保已 import `pageCategory`（若未 import 则加 `import { pageCategory } from '@mediakit/shared';`），在文件末尾追加：

```ts
describe('新 media-kit 页面类型 → 大类映射', () => {
  it('audience-portrait / account-overview → creator-case；brand-collab → company-intro', () => {
    expect(pageCategory('audience-portrait')).toBe('creator-case');
    expect(pageCategory('account-overview')).toBe('creator-case');
    expect(pageCategory('brand-collab')).toBe('company-intro');
  });
});
```

1b. server 端——在 `apps/server/tests/projects.schema.test.ts` 文件末尾追加：

```ts
describe('pageSchema 接受新 media-kit 页面类型', () => {
  it('audience-portrait / account-overview / brand-collab 均通过校验', () => {
    for (const pt of ['audience-portrait', 'account-overview', 'brand-collab'] as const) {
      const out = pageSchema.parse({ id: 'p', name: 'P', components: [], pageType: pt });
      expect((out as { pageType?: string }).pageType).toBe(pt);
    }
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.page-type.test.ts`
Expected: FAIL（TS 编译错误：`'audience-portrait'` 不能赋给 `PageType`；或 `pageCategory` 返回 `undefined`）。

Run: `pnpm --filter @mediakit/server exec vitest run tests/projects.schema.test.ts`
Expected: FAIL（Zod `Invalid enum value`）。

- [ ] **Step 3: 实现 — PageType 联合 + 大类映射**

3a. `packages/shared/src/types/page.ts` 的 `PageType` 联合（第 23–56 行），在末尾 `'campaign-plan';`（第 56 行）之前追加一段（注意把原第 56 行的 `| 'campaign-plan';` 保留，在其后加新段并仍以 `;` 结尾）：

```ts
  | 'campaign-plan'
  // ── 媒介包（media-kit 专属） ──
  | 'audience-portrait'
  | 'account-overview'
  | 'brand-collab';
```

（即把原 `  | 'campaign-plan';` 改为 `  | 'campaign-plan'`，再续上注释和三个新值，最后一行带 `;`。）

3b. 同文件 `PAGE_CATEGORY_MAP`（第 78–112 行），在 `'campaign-plan': 'strategy',`（第 111 行）之后、闭合 `};`（第 112 行）之前加：

```ts
  // 媒介包
  'audience-portrait': 'creator-case',
  'account-overview': 'creator-case',
  'brand-collab': 'company-intro',
```

> `Record<PageType, PageCategory>` 是穷举映射，TS 会强制要求补齐，遗漏会编译报错。

- [ ] **Step 4: 实现 — 服务端 Zod enum**

`apps/server/src/modules/projects/projects.schema.ts` 的 `pageTypeSchema` enum（第 20–33 行），把：

```ts
      // 策略 · 内容
      'challenge', 'process', 'calendar', 'campaign-plan',
    ])
```

改为：

```ts
      // 策略 · 内容
      'challenge', 'process', 'calendar', 'campaign-plan',
      // 媒介包（media-kit 专属）
      'audience-portrait', 'account-overview', 'brand-collab',
    ])
```

- [ ] **Step 5: 实现 — 侧栏图标**

`apps/web/src/editor/PageSidebar.tsx` 的 `PAGE_TYPE_ICONS`（第 10–44 行），在 `'campaign-plan': '🗺️',`（第 43 行）之后、闭合 `};`（第 44 行）之前加：

```ts
  // 媒介包
  'audience-portrait': '👥',
  'account-overview': '📊',
  'brand-collab': '🏷️',
```

- [ ] **Step 6: 实现 — 属性面板类型选择器**

`apps/web/src/editor/property-panel/PageProperties.tsx` 的 `PAGE_TYPE_GROUPS`（第 288–342 行），在最后一个组「策略 · 内容」（第 333–341 行）之后、闭合 `];`（第 342 行）之前追加一组：

```ts
  {
    label: '媒介包',
    options: [
      { value: 'audience-portrait', label: '受众画像', icon: '👥', desc: '粉丝画像：性别 / 年龄 / 城市 / 兴趣' },
      { value: 'account-overview', label: '账号数据概览', icon: '📊', desc: '数据条 + 核心指标 + 增长趋势' },
      { value: 'brand-collab', label: '合作品牌', icon: '🏷️', desc: '过往合作品牌 Logo 墙' },
    ],
  },
```

- [ ] **Step 7: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.page-type.test.ts`
Expected: PASS

Run: `pnpm --filter @mediakit/server exec vitest run tests/projects.schema.test.ts`
Expected: PASS

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 8: 提交**

```bash
git add packages/shared/src/types/page.ts apps/server/src/modules/projects/projects.schema.ts apps/web/src/editor/PageSidebar.tsx apps/web/src/editor/property-panel/PageProperties.tsx apps/web/tests/editor.page-type.test.ts apps/server/tests/projects.schema.test.ts
git commit -m "feat(shared,web,server): 新增 media-kit 三个 PageType（类型贯通）"
```

---

## Task 3: 三个 media-kit 专属模版 + 「媒介包」类别

**Files:**
- Modify: `apps/web/src/editor/templates.ts`
- Test: `apps/web/tests/editor.scenario.test.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/web/tests/editor.scenario.test.ts` 末尾追加：

```ts
describe('media-kit 专属模版（媒介包类别）', () => {
  it('三个新模版存在、标 media-kit、components() 非空', () => {
    for (const id of ['audience-portrait', 'account-overview', 'brand-collab']) {
      const tpl = getTemplate(id);
      expect(tpl, `${id} missing`).toBeDefined();
      expect(tpl!.scenario).toEqual(['media-kit']);
      expect(tpl!.components().length).toBeGreaterThan(0);
      expect(tpl!.pageType).toBe(id);
    }
  });

  it('「媒介包」类别存在且仅含三个新模版', () => {
    const mk = TEMPLATE_CATEGORIES.find((c) => c.category === '媒介包');
    expect(mk?.ids).toEqual(['audience-portrait', 'account-overview', 'brand-collab']);
  });

  it('media-kit 过滤结果含「媒介包」', () => {
    expect(filterCategoriesByScenario('media-kit').map((c) => c.category)).toContain('媒介包');
  });

  it('campaign-report 过滤结果不含「媒介包」（media-kit 专属）', () => {
    expect(filterCategoriesByScenario('campaign-report').map((c) => c.category)).not.toContain('媒介包');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.scenario.test.ts`
Expected: FAIL（三个模版未定义；「媒介包」类别不存在）。

- [ ] **Step 3: 实现 — 三个新模版**

在 `apps/web/src/editor/templates.ts` 的 `TEMPLATES` 数组中，`funnel-page` 模版闭合（第 623 行 `},`）之后、数组闭合 `];`（第 624 行）之前，插入三个模版：

```ts
  {
    id: 'audience-portrait',
    name: '受众画像',
    description: '粉丝画像：性别 / 年龄 / 城市 / 兴趣',
    pageType: 'audience-portrait',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('Audience Profile', 80, 40);
      const profile = t('creator-audience-profile', 80, 110, 1120, 360);
      const interest = t('creator-fan-interest', 80, 490, 1120, 160);
      (interest.data as { title: string }).title = 'Audience Interests';
      const note = t('text', 80, 670, 1120, 70);
      (note.data as { content: string }).content = 'Audience insight...';
      return [title, profile, interest, note];
    },
  },
  {
    id: 'account-overview',
    name: '账号数据概览',
    description: '数据条 + 核心指标 + 增长趋势',
    pageType: 'account-overview',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('Account Overview', 80, 40);
      const stats = t('creator-stats-strip', 80, 110, 1120, 120);
      const c1 = t('indicator-card', 80, 250, 265, 130);
      const c2 = t('indicator-card', 365, 250, 265, 130);
      const c3 = t('indicator-card', 650, 250, 265, 130);
      const c4 = t('indicator-card', 935, 250, 265, 130);
      const growth = t('line-chart', 80, 400, 1120, 240);
      (growth.data as { title: string }).title = 'Growth Trend';
      return [title, stats, c1, c2, c3, c4, growth];
    },
  },
  {
    id: 'brand-collab',
    name: '合作品牌',
    description: '过往合作品牌 Logo 墙',
    pageType: 'brand-collab',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('Brand Collaborations', 80, 40);
      const wall = t('brand-wall', 80, 110, 1120, 420);
      const note = t('text', 80, 550, 1120, 70);
      (note.data as { content: string }).content = 'Selected past collaborations...';
      return [title, wall, note];
    },
  },
```

> 复用的组件类型（`creator-audience-profile` / `creator-fan-interest` / `creator-stats-strip` / `indicator-card` / `line-chart` / `brand-wall`）均已存在，`getDefaultData()` 会注入 demo 数据，渲染即完整图表，无需额外接线。

- [ ] **Step 4: 实现 — 「媒介包」类别**

在 `apps/web/src/editor/templates.ts` 的 `TEMPLATE_CATEGORIES`（第 62–86 行）末尾，「策略 · 内容」组闭合（第 85 行 `},`）之后、数组闭合 `];`（第 86 行）之前加：

```ts
  { category: '媒介包', ids: ['audience-portrait', 'account-overview', 'brand-collab'] },
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.scenario.test.ts`
Expected: PASS（含原有 `TEMPLATE_CATEGORIES` 完整性用例——三个新模版均为非业务线模版且都已归类，集合等式仍成立）。

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/templates.ts apps/web/tests/editor.scenario.test.ts
git commit -m "feat(web): 新增 media-kit 三个专属模版（媒介包类别）"
```

---

## Task 4: 服务端持久化受众数据（audience）

> 受众画像页（Task 3）的粉丝组件会经 `creatorPatch` 从 `reportData.creators[].audience` 自动填充。当前服务端 `reportDataContextSchema` 校验 creator 时**省略 `audience`**，Zod 默认 strip 未知键 → 保存后受众数据丢失。补上 schema 让其 round-trip。

**Files:**
- Modify: `apps/server/src/modules/projects/projects.schema.ts`
- Test: `apps/server/tests/projects.schema.test.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/server/tests/projects.schema.test.ts` 顶部 import 块加入 `projectMetaSchema`（第 3–7 行的 import 列表）：

```ts
import {
  createProjectSchema,
  updateProjectSchema,
  pageSchema,
  projectMetaSchema,
} from '../src/modules/projects/projects.schema';
```

在文件末尾追加：

```ts
describe('reportData.creators[].audience 经 schema 保留（round-trip）', () => {
  it('creators 与 campaignCreators 的 audience 字段不被剥离', () => {
    const meta = {
      reportData: {
        creators: [
          {
            id: 'c1',
            name: 'C1',
            audience: {
              genderSplit: [{ label: 'F', value: 62 }],
              ageRange: [{ label: '18-24', value: 30 }],
              topCities: [{ label: '上海', value: 28, color: '#FF5C00' }],
            },
          },
        ],
        campaignCreators: [{ id: 'c2', name: 'C2', audience: { genderSplit: [{ label: 'M', value: 40 }] } }],
      },
    };
    const out = projectMetaSchema.parse(meta) as {
      reportData?: {
        creators?: { audience?: { genderSplit?: { value: number }[]; topCities?: { color?: string }[] } }[];
        campaignCreators?: { audience?: { genderSplit?: { value: number }[] } }[];
      };
    };
    expect(out.reportData?.creators?.[0]?.audience?.genderSplit?.[0]?.value).toBe(62);
    expect(out.reportData?.creators?.[0]?.audience?.topCities?.[0]?.color).toBe('#FF5C00');
    expect(out.reportData?.campaignCreators?.[0]?.audience?.genderSplit?.[0]?.value).toBe(40);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run tests/projects.schema.test.ts`
Expected: FAIL — `audience` 被 Zod strip，断言读到 `undefined`。

- [ ] **Step 3: 实现 — 加 audience schema**

在 `apps/server/src/modules/projects/projects.schema.ts` 的 `reportDataContextSchema` 定义（第 169 行 `const reportDataContextSchema = z.object({`）之前插入两个复用 helper：

```ts
/** 受众画像单项（性别 / 年龄 / 城市占比）。 */
const audienceSliceSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().max(20).optional(),
});

/** 达人受众画像（与 shared CreatorAudience 对齐）。 */
const creatorAudienceSchema = z.object({
  genderSplit: z.array(audienceSliceSchema).optional(),
  ageRange: z.array(audienceSliceSchema).optional(),
  topCities: z.array(audienceSliceSchema).optional(),
});
```

在 `campaignCreators` 数组的对象 schema 中（第 195–217 行），`stats` 数组闭合 `).optional(),`（第 216 行）之后、对象闭合 `},`（第 217 行）之前加：

```ts
          audience: creatorAudienceSchema.optional(),
```

在 `creators` 数组的对象 schema 中（第 221–244 行），`stats` 数组闭合 `).optional(),`（第 243 行）之后、对象闭合 `},`（第 244 行）之前加同一行：

```ts
          audience: creatorAudienceSchema.optional(),
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run tests/projects.schema.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/projects/projects.schema.ts apps/server/tests/projects.schema.test.ts
git commit -m "fix(server): reportDataContextSchema 保留 creators[].audience（受众画像持久化）"
```

---

## Self-Review（写计划后自查）

**1. Spec 覆盖：**
- Part A 过滤机制 → Task 1（scenario 字段、`filterCategoriesByScenario`、TemplateOverlay、打标 13 个）。✓
- Part B 三个新模版 + 媒介包类别 → Task 3。✓
- Part C PageType 改动面（union / map / 服务端 enum / PAGE_TYPE_ICONS / PAGE_TYPE_GROUPS）→ Task 2 全部 5 处。✓
- Part D 受众持久化 → Task 4。✓
- 矩阵三种场景的可见性 → Task 1 测试覆盖 report/proposal/media-kit + undefined。✓

**2. 占位符扫描：** 无 TBD/TODO/「类似上文」。所有代码块均为完整可粘贴内容。

**3. 类型一致性：** `filterCategoriesByScenario` 在 Task 1 定义、Task 1/3 测试与 TemplateOverlay 中名称一致；三个 PageType 字面量（`audience-portrait` / `account-overview` / `brand-collab`）在 Task 2/3 及测试中一致；`creatorAudienceSchema` / `audienceSliceSchema` 在 Task 4 定义与使用一致；`projectMetaSchema` 已是 exported（projects.schema.ts:289）。

**依赖顺序：** Task 1（过滤）独立可先行；Task 2（PageType 贯通）须先于 Task 3（新模版引用新 PageType）；Task 4（服务端 audience）与 1–3 解耦，独立可并行/最后做。建议顺序 1 → 2 → 3 → 4。
