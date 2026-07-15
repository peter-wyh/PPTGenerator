# 场景驱动的页面模版过滤 + media-kit 专属模版 — 设计

- 日期：2026-07-15
- 状态：已批准（待写实现计划）
- 范围：`apps/web/src/editor/templates.ts`、`apps/web/src/editor/components/TemplateOverlay.tsx`、`packages/shared/src/types/page.ts`、`apps/server/src/modules/projects/projects.schema.ts` 及相邻测试

## 1. 背景

项目有三种场景 `Scenario = 'campaign-report' | 'campaign-proposal' | 'media-kit'`（`packages/shared/src/types/campaign.ts:8`），存在 `ProjectMeta.scenario`，编辑器运行时可从 store 取到（`useEditorStore.getState().projectMeta?.scenario`）。

但「+ 页面」单页模版选择器（`apps/web/src/editor/components/TemplateOverlay.tsx`）遍历的是 `TEMPLATE_CATEGORIES`（`apps/web/src/editor/templates.ts:62-86`）——一个**与场景无关**的扁平 5 类别数组。无论项目是什么场景，都显示全部 27 个模版。`Template` 接口（`templates.ts:10-25`）也只有 `pageType` 和可选 `businessLine`，**没有任何场景维度**。

用户要求：**按项目场景过滤可选页面模版**。例如 media-kit 不需要 campaign 报告类模版。同时 media-kit 缺少自身专属模版（受众画像、账号数据、合作品牌），需要补齐。

> 注：DB 模版层（`TemplateMeta extends ProjectMeta`、服务端 `templatesService.list` 已按 `scenario` 过滤）已完整建模场景维度，可作为参照模式。本次补齐的是**编辑器内单页模版层**。

## 2. 目标

1. 单页模版选择器按当前项目场景过滤可见模版与类别。
2. 新增 3 个 media-kit 专属页面模版：受众画像页、账号数据概览页、合作品牌页。

## 3. 关键决策（评审已定）

| 决策点 | 结论 | 理由 |
|---|---|---|
| 过滤粒度 | 全量矩阵：每个模版按场景标注可见性 | 用户确认；与 DB 模版层一致 |
| 作用范围 | 仅「+ 页面」单页选择器（`TemplateOverlay`） | 用户确认；「+ 报告」多页骨架（`ScenarioOverlay`）不在本期 |
| 字段建模 | `Template.scenario?: Scenario[]`，缺省 = 全场景可见 | 向后兼容；只给需限制的模版打标，最简洁 |
| 新模版可见性 | 3 个新模版仅 `media-kit` 可见 | 与 report 的 `report-creator-collab`/overview 功能重叠，report 保留原 27 个 |
| 受众数据持久化 | 把 `CreatorAudience` 加进服务端 `reportDataContextSchema` | 否则自动绑定的粉丝画像保存后丢失；小的向后兼容改动 |
| 新模版分组 | 新增第 6 个类别「媒介包」 | media-kit 下集中展示；其他场景自动隐藏 |

### 3.1 矩阵（✓ 可见 / — 隐藏）

| 类别 / 模版 | report | proposal | media-kit | 标签 |
|---|:---:|:---:|:---:|---|
| **基础** blank · title · overview · table | ✓ | ✓ | ✓ | （不标） |
| **投放报告** weekly/monthly-overview · channel · product · creator-collab · placement · posts · wrapup-review | ✓ | — | — | `['campaign-report']` |
| **公司·品牌** cover · agenda · company · package · milestone · global · org · service | ✓ | ✓ | ✓ | （不标） |
| **达人·案例** creator-page · case-page | ✓ | ✓ | ✓ | （不标） |
| **策略·内容** challenge · process · calendar · campaign-plan · funnel | ✓ | ✓ | — | `['campaign-report','campaign-proposal']` |
| **策略·内容** content-analysis-page | ✓ | ✓ | ✓ | （不标） |
| **媒介包**（新增）audience-portrait · account-overview · brand-collab | — | — | ✓ | `['media-kit']` |

校验：report → 原 27 个全可见（媒介包隐藏）；proposal → 隐藏投放报告；media-kit → 隐藏投放报告 + 策划类、保留 content-analysis、显示媒介包。

## 4. 不在本次范围

- ❌ `ScenarioOverlay`（「+ 报告」多页报告骨架）的场景过滤——独立工作。
- ❌ 接入在开发的 `CollaborationData`（达人合作详情数据）——合作品牌页用**手动** `brand-wall`，不接 CollaborationData。
- ❌ 受众「兴趣」的上游数据源——`creator-fan-interest` 仅 demo（无 `creatorPatch` 分支、无 `CreatorAudience.interests`）。
- ❌ 业务线（BL）变体的新模版——3 个新模版不生成 `{pageType}-{BL}-bl` 变体。

## 5. 方案

### Part A · 过滤机制

**A.1 给 `Template` 加 scenario 字段**（`apps/web/src/editor/templates.ts:10`）：

```ts
export interface Template {
  id: string;
  name: string;
  description: string;
  components: () => EditorComponent[];
  pageTitleIndex?: number;
  pageType?: PageType;
  businessLine?: string;
  scenario?: Scenario[];   // 新增：缺省 = 全场景可见
}
```

**A.2 打标**（只给需限制的模版加 `scenario`，其余不动）：

- 投放报告 8 个 → `scenario: ['campaign-report']`
- 策略·内容 5 个（challenge-page、process-page、calendar-page、campaign-plan-page、funnel-page）→ `scenario: ['campaign-report', 'campaign-proposal']`
- 3 个新媒介包模版 → `scenario: ['media-kit']`
- 其余不标。

**A.3 `TemplateOverlay` 过滤**（`apps/web/src/editor/components/TemplateOverlay.tsx`）：

```ts
const scenario = useEditorStore((s) => s.projectMeta?.scenario);

const visibleCategories = !scenario
  ? TEMPLATE_CATEGORIES                                    // 无场景 → 全部（向后兼容）
  : TEMPLATE_CATEGORIES.map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => {
        const tpl = getTemplate(id);
        return !tpl?.scenario || tpl.scenario.includes(scenario);
      }),
    })).filter((cat) => cat.ids.length > 0);                // 丢弃空类别
```

渲染改用 `visibleCategories`。

### Part B · 三个新 media-kit 模版（新增「媒介包」类别）

在 `TEMPLATE_CATEGORIES`（`templates.ts:62-86`）追加第 6 类：

```ts
{ category: '媒介包', ids: ['audience-portrait', 'account-overview', 'brand-collab'] },
```

三个模版在 `TEMPLATES`（`templates.ts:191-624`）新增，沿用 demo 内容约定（`t()` + `getDefaultData()`，与 `creator-page`/`report-creator-collab` 同模式）。画布固定 1280 宽，内容左右边距 ~80，内容宽 ~1120。

**B.1 受众画像页 `audience-portrait`** — `pageType: 'audience-portrait'`，`pageCategory: 'creator-case'`（自动绑定 creator → 粉丝数据经 `creatorPatch` 自动填充），`scenario: ['media-kit']`：

```ts
{
  id: 'audience-portrait',
  name: '受众画像',
  description: '达人粉丝画像：性别 / 年龄 / 城市 / 兴趣',
  pageType: 'audience-portrait',
  scenario: ['media-kit'],
  components: () => {
    const title = titleAt('Audience Profile', 80, 40);
    const profile = t('creator-audience-profile', 80, 110, 1120, 360);  // 性别环+年龄柱+城市柱
    const interest = t('creator-fan-interest', 80, 490, 1120, 160);
    (interest.data as { title: string }).title = 'Audience Interests';
    const note = t('text', 80, 670, 1120, 70);
    (note.data as { content: string }).content = 'Audience insight...';
    return [title, profile, interest, note];
  },
}
```

**B.2 账号数据概览页 `account-overview`** — `pageType: 'account-overview'`，`pageCategory: 'creator-case'`，`scenario: ['media-kit']`：

```ts
{
  id: 'account-overview',
  name: '账号数据概览',
  description: '达人账号概览：数据条 + 核心指标 + 增长趋势',
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
}
```

**B.3 合作品牌页 `brand-collab`** — `pageType: 'brand-collab'`，`pageCategory: 'company-intro'`（手动 Logo，无需绑定），`scenario: ['media-kit']`：

```ts
{
  id: 'brand-collab',
  name: '合作品牌',
  description: '过往合作品牌展示（Logo 墙）',
  pageType: 'brand-collab',
  scenario: ['media-kit'],
  components: () => {
    const title = titleAt('Brand Collaborations', 80, 40);
    const wall = t('brand-wall', 80, 110, 1120, 420);
    const note = t('text', 80, 550, 1120, 70);
    (note.data as { content: string }).content = 'Selected past collaborations...';
    return [title, wall, note];
  },
}
```

### Part C · PageType 改动面（机械但必须）

每个新 PageType 同步更新（缺一不可）：

1. `PageType` 联合类型（`packages/shared/src/types/page.ts:23-56`）— 加 `'audience-portrait' | 'account-overview' | 'brand-collab'`。
2. `PAGE_CATEGORY_MAP`（`page.ts:78-112`，TS 强制穷举）— `audience-portrait → 'creator-case'`、`account-overview → 'creator-case'`、`brand-collab → 'company-intro'`。
3. **服务端 Zod enum**（`apps/server/src/modules/projects/projects.schema.ts:20-33`）— 不加则保存报 400。
4. `PAGE_TYPE_GROUPS`（`apps/web/src/editor/property-panel/PageProperties.tsx:288-342`）— 否则属性面板无法把页面改成该类型。
5. `PAGE_TYPE_ICONS`（`apps/web/src/editor/PageSidebar.tsx:10-44`）— 侧栏图标（缺省降级为空，非致命）。
6. `TEMPLATES` 条目 + `TEMPLATE_CATEGORIES`（见 Part B）。

无需新 `PageCategory`、无需 Prisma 迁移、无需 `pageBinding.ts` 改动（`creator-case`/`company-intro` 的绑定逻辑已存在；粉丝组件已在 `COMPONENT_BINDING_KIND` 注册为 `'creator'`）。

### Part D · 服务端 schema：受众数据持久化

`reportDataContextSchema`（`projects.schema.ts:193-246`）目前校验 `creators`/`campaignCreators` 但**省略 `audience`**，导致 `ReportCreator.audience` 经保存/刷新后可能丢失（回退 demo），受众画像页的自动绑定失效。

把 `CreatorAudience`（`packages/shared/src/types/campaign.ts:113-125`，`{ genderSplit?, ageRange?, topCities? }`，每项 `AudienceSlice = { label, value:number, color? }`）加进服务端 `reportCreatorSchema`：

```ts
audience: z.object({
  genderSplit: audienceSliceSchema.optional(),
  ageRange: audienceSliceSchema.optional(),
  topCities: audienceSliceSchema.optional(),
}).optional(),
```

（`audienceSliceSchema = z.object({ label: z.string(), value: z.number(), color: z.string().optional() })`。）

> 实现前需先验证 Zod 对未知键的处理（strip vs passthrough）以确认当前 audience 是否已被丢弃——若已被 strip 则此改动修复持久化；若 passthrough 则此改动仅是显式校验、无行为变化。

## 6. 涉及文件

- `apps/web/src/editor/templates.ts` — `Template.scenario` 字段、打标、3 个新模版、新增「媒介包」类别。
- `apps/web/src/editor/components/TemplateOverlay.tsx` — 按 `projectMeta.scenario` 过滤 + 丢弃空类别。
- `packages/shared/src/types/page.ts` — `PageType` 联合 + `PAGE_CATEGORY_MAP`。
- `apps/server/src/modules/projects/projects.schema.ts` — `pageTypeSchema` enum + `reportCreatorSchema.audience`。
- `apps/web/src/editor/property-panel/PageProperties.tsx` — `PAGE_TYPE_GROUPS`。
- `apps/web/src/editor/PageSidebar.tsx` — `PAGE_TYPE_ICONS`。
- 测试：`apps/web/tests/editor.scenario.test.ts`（更新类别完整性断言 + 新增场景过滤用例）。

## 7. 兼容性

- 存量项目无 `scenario` → 选择器显示全部模版，行为不变（A.3 的 `!scenario` 分支）。
- 新 PageType 为**加法**：旧项目不含新值，不受影响；`pageType` 是 JSON 字符串列、请求时校验，无需 DB 迁移。
- 服务端 `audience` 为可选加法字段，旧数据不受影响。
- 不标 `scenario` 的模版默认全场景可见，不破坏现有 report 行为。

## 8. 风险

- **Zod 未知键行为未确认**：若当前是 strip，受众数据已在丢失（Part D 修复之）；若 passthrough，Part D 无害。实现时先验证。
- **media-kit 是否绑定 creator**：受众画像/账号概览页依赖 `projectMeta.creator` 触发自动填充。若 media-kit 创建流程未设 creator，页面仍渲染 demo（不阻塞，但需确认 media-kit 流程是否设 creator）。
- **兴趣无上游**：`creator-fan-interest` 仅 demo，不会自动绑定——可接受，UI 上仍是完整图表。

## 9. 测试策略

遵循 `web-chart-test-convention`（recharts 在 jsdom 下被整体 mock，只断言 shell 文本、不测 chart 内部标签）。

- **场景过滤**（`editor.scenario.test.ts`）：构造 `projectMeta.scenario='media-kit'` → 可见类别不含「投放报告」「策略·内容(除 content-analysis)」、含「媒介包」；`scenario='campaign-proposal'` → 不含投放报告；`scenario=undefined` → 全部 5+1 类别可见。`TemplateOverlay` 渲染：media-kit 下不出现 `report-weekly-overview`、出现 `audience-portrait`。
- **类别完整性**（更新 `editor.scenario.test.ts:122-138`）：每个 `TEMPLATE_CATEGORIES` id 仍能解析到模版；分类 id 集合 == 非业务线模版集合（含 3 个新模版）。
- **打标正确性**：投放报告 8 个 `scenario==['campaign-report']`；媒介包 3 个 `scenario==['media-kit']`。
- **PageType 完整性**：`PAGE_CATEGORY_MAP` 覆盖 3 个新值；服务端 `pageTypeSchema` enum 含 3 个新值。
- **新模版可实例化**：3 个新模版的 `components()` 返回非空数组、各组件 `type` 合法（参照现有模版测试模式）。
