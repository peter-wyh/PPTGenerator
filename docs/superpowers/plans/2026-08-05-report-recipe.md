# Report Recipe 实现计划(DG Campaign Report 通用化)

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现。步骤用 checkbox(`- [ ]`)跟踪。

**Goal:** 把 `DG Campaign Report.html` 固化成一份可复用 recipe,换 campaign 数据即产出同规格报告——数字/图表/表格确定性渲染,仅 Actionable Insights 文案由 AI 写。

**Architecture:** recipe = Zod 内容契约 + Handlebars 模板 + DG token + 组件 manifest。campaign DB → mapper → 内容契约 → (AI 填组件 6) → Handlebars 渲染 → 独立 HTML。挂在现有 `POST /html-templates/generate` 上,新增 `mode:'recipe'`。

**Tech Stack:** TypeScript(现有)、Zod(现有)、**Handlebars(新增)**、vitest(现有)、DeepSeek API(现有 `ai-generate.service` 同款)。

---

## 前置(重要)

- **测试 DB 容器必须在跑**:`apps/server/vitest.config.ts` 的 `globalSetup` 会连 `mysql://...@localhost:3317/mediakit_test`、`tests/setup.ts` 每个测试后用真实 prisma `TRUNCATE` + `redis.flushdb()`。即便本计划的测试全部 mock 了 prisma/global.fetch,vitest 启动仍会触发 globalSetup。先 `pnpm db:up`(起 mediakit 容器,端口 3317/6389),再跑测试。
- **跑测试命令**(从仓库根):`pnpm --filter @mediaket/server test <相对 apps/server 的路径>`(脚本 `vitest run`,会追加路径作为 filter)。例:`pnpm --filter @mediaket/server test src/modules/html-templates/recipe/format.test.ts`。
- **类型检查**:`pnpm --filter @mediaket/server build`(即 `tsc --noEmit`)。
- **提交约定**(用户工作区常有并发 WIP):每个任务结尾**只 `git add` 本任务新增/修改的具体文件**,与 `git commit` 写在同一条命令里(参考 [[ide-resets-git-index]]、[[isolate-feature-work-in-worktree]])。
- **源文件**:本计划中 Handlebars 模板以仓库根 `DG Campaign Report.html` 为蓝本,动态段替换为 Handlebars 语法,静态段原样保留。

## 文件结构

新增(均在 `apps/server/src/modules/html-templates/recipe/`):

| 文件 | 职责 |
|------|------|
| `format.ts` + `format.test.ts` | 纯格式化 util:`formatMoney / formatNum / formatPct` |
| `types.ts` | `Recipe` 接口、`RenderInput`、`RecipeId` |
| `campaign-report/schema.ts` + `schema.test.ts` | Zod 内容契约 `CampaignReportContent` |
| `campaign-report/tokens.ts` | DG 默认 token(颜色/字体) |
| `campaign-report/manifest.ts` | 组件顺序 + 缺字段显隐规则 |
| `campaign-report/template.hbs` | DG HTML → Handlebars |
| `campaign-report/mapper.ts` + `mapper.test.ts` | campaign DB → `CampaignReportContent` |
| `campaign-report/narrative.ts` + `narrative.test.ts` | AI 填组件 6(DeepSeek,JSON,Zod 校验,失败降级) |
| `campaign-report/render.ts` + `render.test.ts` | 编排 mapper→narrative→Handlebars;快照测试 |
| `campaign-report/index.ts` | 导出 `campaignReportRecipe: Recipe` |
| `index.ts` | recipe 注册表 `{ 'campaign-report': ... }`,按 id 选 recipe |

修改:
- `apps/server/src/modules/html-templates/html-templates.schema.ts` — `generateHtmlSchema.mode` 加 `'recipe'`,新增可选 `recipeId`
- `apps/server/src/modules/html-templates/html-templates.controller.ts` — `generate` 加 `mode==='recipe'` 分支
- `apps/server/package.json` — 加 `handlebars`(+`@types/handlebars` dev)

---

## Task 0:加 Handlebars 依赖

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: 安装**

```bash
pnpm --filter @mediaket/server add handlebars
pnpm --filter @mediaket/server add -D @types/handlebars
```

- [ ] **Step 2: 验证可导入**

```bash
node -e "console.log(require('handlebars').VERSION)" 2>/dev/null || pnpm --filter @mediaket/server exec node -e "import('handlebars').then(h=>console.log('hbs',h.default.VERSION))"
```

预期:打印 handlebars 版本号(如 `4.7.8`)。

- [ ] **Step 3: 提交**

```bash
git add apps/server/package.json apps/server/pnpm-lock.yaml && git commit -m "build(server): 加 handlebars 依赖(recipe 渲染用)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 1:格式化 util(`format.ts`)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/format.ts`
- Test: `apps/server/src/modules/html-templates/recipe/format.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// format.test.ts
import { describe, expect, it } from 'vitest';
import { formatMoney, formatNum, formatPct } from './format';

describe('format', () => {
  it('formatMoney:整数美元加千分位 + $ 前缀', () => {
    expect(formatMoney(876360)).toBe('$876,360');
    expect(formatMoney(0)).toBe('$0');
  });
  it('formatMoney:小数四舍五入到整数', () => {
    expect(formatMoney(192000.6)).toBe('$192,001');
  });
  it('formatNum:整数加千分位', () => {
    expect(formatNum(348619)).toBe('348,619');
    expect(formatNum(0)).toBe('0');
  });
  it('formatPct:数字 → 带 % 字符串(入参已是 34.6)', () => {
    expect(formatPct(34.6)).toBe('34.6%');
    expect(formatPct(0)).toBe('0%');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/format.test.ts`
Expected: FAIL(模块不存在 / 导出缺失)。

- [ ] **Step 3: 最小实现**

```ts
// format.ts
/** 美元金额 → "$876,360"(千分位,四舍五入到整数)。 */
export function formatMoney(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US');
}

/** 整数 → 千分位 "348,619"。 */
export function formatNum(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** 百分比(入参已是数值,如 34.6)→ "34.6%"。 */
export function formatPct(v: number): string {
  return `${v}%`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/format.test.ts`
Expected: PASS(4 个用例)。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/format.ts apps/server/src/modules/html-templates/recipe/format.test.ts && git commit -m "feat(recipe): format util(formatMoney/Num/Pct)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2:内容契约 schema(`schema.ts`)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/schema.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// schema.test.ts
import { describe, expect, it } from 'vitest';
import { CampaignReportContent, type CampaignReportContent as Content } from './schema';

const valid = {
  header: {
    brand: { name: 'DIGCHIC', logoText: 'digchic', logoImgUrl: 'digchic-logo.png' },
    merchant: { name: 'GlowLab', logoText: 'GL' },
    period: { start: '2026-10-12', end: '2026-11-10', display: 'Oct 12 - Nov 10, 2026' },
  },
  kpis: [{ label: 'Total Revenues', value: '$876,360' }],
  trend: { labels: ['Oct 12'], revenue: [50000], clicks: [15000], orders: [250] },
  publishers: [{
    name: 'Mia Chen', handle: '@miaglowup',
    type: { label: 'Creator', kind: 'creator' },
    screenshotUrl: 'https://placehold.co/120x68', revenue: '$192,000', clicks: '124,678', orders: '1,016',
    linkUrl: 'https://tiktok.com/@miaglowup',
  }],
  insights: {
    newCustomerRate: { rate: '34.6%', newCount: 1604, totalOrders: 4636, deltaPct: '6.2%' },
  },
  actionable: [{
    icon: 'trophy', color: 'green', title: 'Top Performers',
    items: [{ text: 'Instagram Influencer C', sub: '(ROAS 4.10)' }],
    footer: 'Focus on scaling these top publishers.',
  }],
};

describe('CampaignReportContent', () => {
  it('合法对象通过', () => {
    expect(CampaignReportContent.safeParse(valid).success).toBe(true);
  });
  it('缺 header 失败', () => {
    const { header, ...rest } = valid;
    expect(CampaignReportContent.safeParse(rest).success).toBe(false);
  });
  it('publisher.type.kind 枚举校验(非法值失败)', () => {
    const bad = { ...valid, publishers: [{ ...valid.publishers[0], type: { label: 'X', kind: 'banana' } }] };
    expect(CampaignReportContent.safeParse(bad).success).toBe(false);
  });
  it('insights / actionable 可选(全空也合法)', () => {
    const minimal = { ...valid, insights: undefined, actionable: [] };
    expect(CampaignReportContent.safeParse(minimal).success).toBe(true);
  });
  it('导出 TS 类型', () => {
    const c: Content = valid;
    expect(c.kpis[0].value).toBe('$876,360');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/schema.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

```ts
// schema.ts
import { z } from 'zod';

export const CampaignReportContent = z.object({
  header: z.object({
    brand: z.object({ name: z.string(), logoText: z.string(), logoImgUrl: z.string().optional() }),
    merchant: z.object({ name: z.string(), logoText: z.string() }),
    period: z.object({ start: z.string(), end: z.string(), display: z.string() }),
  }),
  kpis: z.array(z.object({ label: z.string(), value: z.string(), highlight: z.boolean().optional() })),
  trend: z.object({
    labels: z.array(z.string()),
    revenue: z.array(z.number()),
    clicks: z.array(z.number()),
    orders: z.array(z.number()),
  }),
  publishers: z.array(z.object({
    name: z.string(),
    handle: z.string().optional(),
    type: z.object({ label: z.string(), kind: z.enum(['creator', 'fb', 'tg', 'site', 'other']) }),
    screenshotUrl: z.string(),
    revenue: z.string(),
    clicks: z.string(),
    orders: z.string(),
    linkUrl: z.string().optional(),
  })),
  insights: z.object({
    topCategories: z.array(z.object({ label: z.string(), pct: z.number(), color: z.string() })).optional(),
    topProducts: z.array(z.object({ name: z.string(), revenue: z.string() })).optional(),
    topMarket: z.array(z.object({ country: z.string(), revenue: z.string(), pct: z.number(), color: z.string() })).optional(),
    topPromotion: z.array(z.object({
      name: z.string(), type: z.string(), revenue: z.string(), usage: z.string(), tagKind: z.string(),
    })).optional(),
    newCustomerRate: z.object({
      rate: z.string(), newCount: z.number(), totalOrders: z.number(), deltaPct: z.string().optional(),
    }).optional(),
  }).optional(),
  actionable: z.array(z.object({
    icon: z.string(),
    color: z.string(),
    title: z.string(),
    items: z.array(z.object({ text: z.string(), sub: z.string().optional() })),
    footer: z.string(),
  })),
});

export type CampaignReportContent = z.infer<typeof CampaignReportContent>;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/schema.test.ts`
Expected: PASS(5 用例)。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts apps/server/src/modules/html-templates/recipe/campaign-report/schema.test.ts && git commit -m "feat(recipe): CampaignReportContent Zod 契约

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3:DG token + manifest

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/tokens.ts`
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/manifest.ts`
- Create: `apps/server/src/modules/html-templates/recipe/types.ts`

- [ ] **Step 1: `tokens.ts`(DG 默认色/字体,值取自 DG.html 的 tailwind.config 与 <style>)**

```ts
// tokens.ts
/** DG Campaign Report 默认风格 token(v1 固定;预留给 businessLine 覆盖)。 */
export const dgTokens = {
  brandPrimary: '#ff099e',
  brand85: '#fff6f9',
  greyPrimary: '#1e1c24',
  greySecondary: '#626166',
  greyTertiary: '#999999',
  greyDisabled: '#dddddd',
  bgLayout: '#f5f7fa',
  bgCard: '#ffffff',
  strokeLine: 'rgba(0,0,0,0.08)',
  strokeCard: '#ebebeb',
  fontBody: "'Outfit', sans-serif",
  fontPoppins: "'Poppins', sans-serif",
  fontNumber: "'Barlow Condensed', sans-serif",
} as const;

export type DgTokens = typeof dgTokens;
```

- [ ] **Step 2: `manifest.ts`(组件顺序 + 缺字段隐藏规则)**

```ts
// manifest.ts
import type { CampaignReportContent } from './schema';

/** 按出现顺序列出组件;`visible` 依数据决定是否渲染该段。 */
export const campaignReportManifest = [
  { id: 'header', visible: (c: CampaignReportContent) => !!c.header },
  { id: 'kpis', visible: (c) => c.kpis.length > 0 },
  { id: 'trend', visible: (c) => c.trend.labels.length > 0 },
  { id: 'publishers', visible: (c) => c.publishers.length > 0 },
  { id: 'insights', visible: (c) => !!c.insights && Object.values(c.insights).some((v) => Array.isArray(v) ? v.length > 0 : !!v) },
  { id: 'actionable', visible: (c) => c.actionable.length > 0 },
] as const;

export type ComponentId = (typeof campaignReportManifest)[number]['id'];
```

- [ ] **Step 3: `recipe/types.ts`(Recipe 接口 + 注册类型)**

```ts
// recipe/types.ts
export type RecipeId = 'campaign-report';

export interface RenderInput {
  campaignId: string;
  theme?: 'light' | 'dark';
  designMd?: string; // v1 保留未用
}

export interface Recipe {
  id: RecipeId;
  render(input: RenderInput): Promise<string>;
}
```

- [ ] **Step 4: 类型检查**

Run: `pnpm --filter @mediaket/server build`
Expected: 通过(无 TS 错;`CampaignReportContent` 导入自 schema.ts)。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/tokens.ts apps/server/src/modules/html-templates/recipe/campaign-report/manifest.ts apps/server/src/modules/html-templates/recipe/types.ts && git commit -m "feat(recipe): DG tokens + 组件 manifest + Recipe 接口

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4:Handlebars 模板(`template.hbs`)

以 `DG Campaign Report.html` 为蓝本。**静态段(头部 logo、insight 五子卡的 HTML 骨架、Actionable 卡的图标/色块等)原样保留**,只把下列动态段替换为 Handlebars。token 注入:`tailwind.config` 与 `<style>` 里的 DG 颜色字面量改用 `{{tokens.xxx}}`(Handlebars 会渲染整文含 `<script>` 内的 JS)。

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs`

- [ ] **Step 1: 写完整模板**

```handlebars
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{header.brand.name}} - Campaign Report</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Noto+Sans:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: { primary: '{{tokens.brandPrimary}}', 85: '{{tokens.brand85}}', 95: 'rgba(255,9,158,0.05)' },
                        grey: { primary: '{{tokens.greyPrimary}}', secondary: '{{tokens.greySecondary}}', tertiary: '{{tokens.greyTertiary}}', disabled: '{{tokens.greyDisabled}}' },
                        bg: { layout: '{{tokens.bgLayout}}', card: '{{tokens.bgCard}}' },
                        stroke: { line: '{{tokens.strokeLine}}', card: '{{tokens.strokeCard}}' }
                    },
                    fontFamily: {
                        poppins: ['Poppins', 'sans-serif'],
                        outfit: ['Outfit', 'sans-serif'],
                        number: ['Barlow Condensed', 'sans-serif']
                    }
                }
            }
        }
    </script>

    <style>
        body { background-color: {{tokens.bgLayout}}; color: {{tokens.greyPrimary}}; font-family: {{tokens.fontBody}}; -webkit-font-smoothing: antialiased; }
        .card { background: {{tokens.bgCard}}; border-radius: 8px; border: 1px solid {{tokens.strokeCard}}; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .module-title { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 600; color: {{tokens.greyPrimary}}; margin-bottom: 16px; display: flex; align-items: center; }
        .module-title::before { content: ''; display: inline-block; width: 4px; height: 16px; background-color: {{tokens.brandPrimary}}; border-radius: 2px; margin-right: 8px; }
        .digchic-table { width: 100%; text-align: left; border-collapse: collapse; }
        .digchic-table th { border-bottom: 1px solid rgba(0,0,0,0.08); font-weight: 600; color: {{tokens.greySecondary}}; font-size: 13px; padding: 12px 16px; }
        .digchic-table td { border-bottom: 1px solid rgba(0,0,0,0.08); font-weight: 400; color: {{tokens.greyPrimary}}; font-size: 14px; padding: 12px 16px; vertical-align: middle; }
        .digchic-table tbody tr:hover td { background-color: {{tokens.brand85}}; transition: background-color 0.2s; cursor: pointer; }
        .tag { border-radius: 4px; padding: 4px 8px; font-weight: 600; font-size: 12px; }
        .tag-creator { background: rgba(255,9,158,0.1); color: {{tokens.brandPrimary}}; }
        .tag-fb { background: #eef2ff; color: #4f46e5; }
        .tag-tg { background: #f0fdf4; color: #16a34a; }
        .tag-site { background: #fffbeb; color: #d97706; }
        .insight-ol { padding-left: 16px; margin-bottom: 16px; }
        .insight-ol li { margin-bottom: 8px; font-size: 13px; color: {{tokens.greyPrimary}}; padding-left: 4px; }
        .insight-ol li span.highlight { color: {{tokens.brandPrimary}}; font-weight: 500; }
        .insight-ol li span.sub { display: block; color: {{tokens.greySecondary}}; font-size: 12px; margin-top: 2px; }
    </style>
</head>
<body class="py-6">
    <div class="max-w-[1280px] mx-auto px-4 md:px-[72px] space-y-6">

        {{!-- 1. HEADER --}}
        <div class="card flex justify-between items-center !py-4">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-grey-primary text-white rounded-full flex items-center justify-center font-bold font-poppins">{{header.merchant.logoText}}</div>
                    <span class="font-bold text-[18px] tracking-tight">{{header.merchant.name}}</span>
                </div>
                <div class="h-6 w-px bg-stroke-line"></div>
                <span class="font-bold font-poppins text-[20px] tracking-wide text-black lowercase">{{header.brand.logoText}}</span>
            </div>
            <div class="text-sm font-medium text-grey-secondary bg-bg-layout px-4 py-2 rounded-md">
                {{header.period.display}}
            </div>
        </div>

        {{!-- 2. KPI OVERVIEW --}}
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            {{#each kpis}}
            <div class="card relative overflow-hidden">
                <p class="font-semibold text-[13px] text-grey-secondary mb-1">{{label}}</p>
                <h3 class="font-number font-semibold text-[32px] leading-tight {{#if highlight}}text-brand-primary{{else}}text-grey-primary{{/if}}">{{value}}</h3>
            </div>
            {{/each}}
        </div>

        {{!-- 3. PERFORMANCE TREND --}}
        <div class="card">
            <h2 class="module-title">Performance Trend</h2>
            <div class="h-[300px] w-full">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        {{!-- 4. PUBLISHER PERFORMANCE OVERVIEW --}}
        <div class="card !px-0">
            <div class="px-5"><h2 class="module-title">Publisher Performance Overview</h2></div>
            <div class="overflow-x-auto">
                <table class="digchic-table">
                    <thead class="bg-bg-layout">
                        <tr>
                            <th>Publisher</th><th>Type</th><th>Screenshot</th>
                            <th class="text-right">Sales (Revenue)</th>
                            <th class="text-right">Clicks</th>
                            <th class="text-right">Conversion</th>
                            <th class="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{#each publishers}}
                        <tr onclick="window.open('{{#if linkUrl}}{{linkUrl}}{{else}}#{{/if}}', '_blank')" title="Click to view Publisher">
                            <td>
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-[4px] bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{{initials name}}</div>
                                    <div>
                                        <div class="font-semibold text-grey-primary">{{name}}</div>
                                        {{#if handle}}<div class="text-[12px] text-grey-tertiary">{{handle}}</div>{{/if}}
                                    </div>
                                </div>
                            </td>
                            <td><span class="tag tag-{{type.kind}}">{{type.label}}</span></td>
                            <td><img src="{{screenshotUrl}}" class="h-[34px] rounded border border-stroke-card"></td>
                            <td class="text-right font-number font-semibold text-[18px]">{{revenue}}</td>
                            <td class="text-right">{{clicks}}</td>
                            <td class="text-right">{{orders}}</td>
                            <td class="text-center"><i class="fas fa-external-link-alt text-grey-tertiary hover:text-brand-primary"></i></td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>
            </div>
        </div>

        {{!-- 5. INSIGHT & ANALYSIS(静态五子卡;数据驱动段用 #if 守卫) --}}
        {{#if insights}}
        <h2 class="module-title !mb-0 mt-8">Insight & Analysis</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {{#if insights.topCategories}}
            <div class="card">
                <h3 class="font-semibold text-[14px] text-grey-secondary mb-4 uppercase">1. Top-Selling Categories</h3>
                <div class="flex items-center justify-center h-[180px]">
                    <div class="w-[150px] relative"><canvas id="categoryChart"></canvas></div>
                    <div class="ml-6 space-y-3">
                        {{#each insights.topCategories}}
                        <div class="flex items-center gap-2 text-sm"><div class="w-3 h-3 rounded-full" style="background:{{color}}"></div>{{label}} ({{pct}}%)</div>
                        {{/each}}
                    </div>
                </div>
            </div>
            {{/if}}

            {{#if insights.topProducts}}
            <div class="card !px-0 flex flex-col">
                <h3 class="font-semibold text-[14px] text-grey-secondary mb-2 px-5 uppercase">2. Top-Selling Products</h3>
                <div class="flex-1 overflow-y-auto">
                    <table class="digchic-table text-[13px]"><tbody>
                        {{#each insights.topProducts}}
                        <tr><td>{{name}}</td><td class="text-right font-number font-semibold text-[16px]">{{revenue}}</td></tr>
                        {{/each}}
                    </tbody></table>
                </div>
            </div>
            {{/if}}

            {{#if insights.topMarket}}
            <div class="card">
                <h3 class="font-semibold text-[14px] text-grey-secondary mb-4 uppercase">3. Top Market (By Sales)</h3>
                <div class="space-y-4 mt-4">
                    {{#each insights.topMarket}}
                    <div>
                        <div class="flex justify-between text-sm mb-1"><span class="font-semibold">{{country}}</span><span class="font-number text-[16px]">{{revenue}}</span></div>
                        <div class="w-full bg-bg-layout rounded-full h-2"><div class="h-2 rounded-full" style="width:{{pct}}%;background:{{color}}"></div></div>
                    </div>
                    {{/each}}
                </div>
            </div>
            {{/if}}

            {{#if insights.topPromotion}}
            <div class="card lg:col-span-2 !px-0">
                <h3 class="font-semibold text-[14px] text-grey-secondary mb-2 px-5 uppercase">4. Top Promotion Offer</h3>
                <table class="digchic-table">
                    <thead class="bg-bg-layout"><tr><th>Offer Name</th><th>Type</th><th class="text-right">Revenue Driven</th><th class="text-right">Usage Count</th></tr></thead>
                    <tbody>
                        {{#each insights.topPromotion}}
                        <tr>
                            <td><span class="tag tag-{{tagKind}} text-[13px]">{{name}}</span></td>
                            <td>{{type}}</td>
                            <td class="text-right font-number font-semibold text-[16px]">{{revenue}}</td>
                            <td class="text-right">{{usage}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>
            </div>
            {{/if}}

            {{#if insights.newCustomerRate}}
            <div class="card flex flex-col justify-center items-center text-center">
                <h3 class="font-semibold text-[14px] text-grey-secondary mb-4 uppercase w-full text-left">5. New Customer Rate</h3>
                <div class="relative w-[120px] h-[120px] mb-2">
                    <canvas id="newCustChart"></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="font-number font-semibold text-[32px] text-brand-primary leading-none">{{insights.newCustomerRate.rate}}</span>
                    </div>
                </div>
                <p class="text-[13px] text-grey-secondary mt-2">{{insights.newCustomerRate.newCount}} New / {{insights.newCustomerRate.totalOrders}} Total Orders</p>
                {{#if insights.newCustomerRate.deltaPct}}
                <div class="mt-2 text-[12px] bg-green-50 text-green-600 px-3 py-1 rounded"><i class="fas fa-arrow-up mr-1"></i> {{insights.newCustomerRate.deltaPct}} vs last period</div>
                {{/if}}
            </div>
            {{/if}}
        </div>
        {{/if}}

        {{!-- 6. ACTIONABLE INSIGHTS(AI 文案) --}}
        {{#if actionable.length}}
        <h2 class="module-title !mb-0 mt-8">Actionable Insights</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {{#each actionable}}
            <div class="card flex flex-col !p-4 h-full border-t-[3px] border-t-{{color}}-500">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-6 h-6 rounded-full bg-{{color}}-50 text-{{color}}-500 flex items-center justify-center text-xs"><i class="fas fa-{{icon}}"></i></div>
                    <h3 class="font-bold text-[13px] text-{{color}}-600 uppercase tracking-wide">{{title}}</h3>
                </div>
                <div class="flex-1">
                    <ol class="list-decimal insight-ol">
                        {{#each items}}
                        <li><span class="highlight">{{text}}</span>{{#if sub}}<span class="sub">{{sub}}</span>{{/if}}</li>
                        {{/each}}
                    </ol>
                </div>
                <p class="text-[12px] text-grey-secondary leading-relaxed pt-2 border-t border-stroke-card mt-auto">{{footer}}</p>
            </div>
            {{/each}}
        </div>
        {{else}}
        <div class="card text-center text-grey-secondary text-sm mt-8">洞察暂不可用,请稍后重试。</div>
        {{/if}}

    </div>

    <script>
        // Performance Trend(line + bar)—— 数据由 mapper 注入,不经 AI
        const ctxTrend = document.getElementById('trendChart').getContext('2d');
        new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: {{{json trend.labels}}},
                datasets: [
                    { type: 'line', label: 'Revenue ($)', data: {{{json trend.revenue}}}, borderColor: '{{tokens.brandPrimary}}', backgroundColor: '{{tokens.brandPrimary}}', borderWidth: 3, tension: 0.4, yAxisID: 'yRevenue', order: 1 },
                    { type: 'line', label: 'Clicks', data: {{{json trend.clicks}}}, borderColor: '{{tokens.greyPrimary}}', borderWidth: 2, borderDash: [5,5], tension: 0.4, yAxisID: 'yCount', pointRadius: 0, order: 2 },
                    { type: 'bar', label: 'Orders', data: {{{json trend.orders}}}, backgroundColor: 'rgba(255,9,158,0.15)', borderRadius: 4, yAxisID: 'yCount', order: 3 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { family: 'Outfit', size: 12 } } } },
                scales: {
                    x: { grid: { display: false } },
                    yRevenue: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Revenue (USD)' }, ticks: { callback: v => '$' + v/1000 + 'k' } },
                    yCount: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Clicks / Orders' } }
                }
            }
        });

        {{#if insights.topCategories}}
        new Chart(document.getElementById('categoryChart').getContext('2d'), {
            type: 'doughnut',
            data: { labels: {{{json (map insights.topCategories "label")}}}, datasets: [{ data: {{{json (map insights.topCategories "pct")}}}, backgroundColor: {{{json (map insights.topCategories "color")}}}, borderWidth: 0, cutout: '65%' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
        {{/if}}

        {{#if insights.newCustomerRate}}
        new Chart(document.getElementById('newCustChart').getContext('2d'), {
            type: 'doughnut',
            data: { datasets: [{ data: [{{insights.newCustomerRate.newCount}}, {{minus insights.newCustomerRate.totalOrders insights.newCustomerRate.newCount}}], backgroundColor: ['{{tokens.brandPrimary}}', '{{tokens.bgLayout}}'], borderWidth: 0, cutout: '80%' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
        {{/if}}
    </script>
</body>
</html>
```

> 模板用到 4 个自定义 helper:`json`(安全 stringify)、`map`(取对象数组某字段)、`minus`、`initials`(取姓名首字母)。这些在 Task 7 render.ts 注册。

- [ ] **Step 2: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs && git commit -m "feat(recipe): DG Campaign Report Handlebars 模板

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5:mapper(`mapper.ts`)— campaign DB → 内容契约

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

**先核对 metrics 键名**:`campaign.metrics` 是 freeform Json,由前端写入。仓库代码高频键:`totalRevenue / clicks / orders / newCustomers / aov / newCustomerRate`(见 `apps/web/src` 用法)。mapper 以这些为契约,缺失按 0/"—"兜底。**实现前用一条查询确认真实数据键名**:

```bash
pnpm --filter @mediaket/server exec node -e "import('./src/prisma').then(async ({prisma})=>{const c=await prisma.campaign.findFirst({select:{name:true,metrics:true,analytics:true}});console.log(JSON.stringify(c,null,2));process.exit(0)})"
```

> 若真实键名与下面 `M.kpis` 不同,改 `metric()` 读取键即可(mapper 只在这一处读 metrics)。

- [ ] **Step 1: 写失败测试(mock prisma)**

```ts
// mapper.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));

import { mapCampaign } from './mapper';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12','Nov 10'], revenue: [50000,166360], clicks: [15000,83619], orders: [250,876] } },
  campaignCreators: [{
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

beforeEach(() => vi.clearAllMocks());

describe('mapCampaign', () => {
  it('campaign 不存在 → 抛 notFound', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    await expect(mapCampaign('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('KPI 从 metrics 映射 + 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$876,360');
    expect(byLabel['Clicks']).toBe('348,619');
    expect(byLabel['Orders']).toBe('4,636');
    expect(byLabel['New Customer Acquisition']).toBe('1,604');
    expect(byLabel['AOV']).toBe('$189');
    // New Customer 卡高亮
    expect(c.kpis.find((k) => k.label === 'New Customer Acquisition')?.highlight).toBe(true);
  });

  it('header.period.display 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.header.period.display).toBe('Oct 12 - Nov 10, 2026');
  });

  it('publisher 从 campaignCreators + cps 映射', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.publishers).toHaveLength(1);
    const p = c.publishers[0];
    expect(p.name).toBe('Mia Chen');
    expect(p.handle).toBe('@miaglowup');
    expect(p.type.kind).toBe('creator');
    expect(p.revenue).toBe('$192,000');
    expect(p.clicks).toBe('124,678');
    expect(p.orders).toBe('1,016');
    expect(p.linkUrl).toBe('https://tiktok.com/@miaglowup');
  });

  it('trend 从 analytics.trend 映射', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.trend.labels).toEqual(['Oct 12','Nov 10']);
    expect(c.trend.revenue).toEqual([50000,166360]);
  });

  it('metrics 缺字段 → 兜底 0,不抛', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ ...campaignRow, metrics: {} });
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Total Revenues')?.value).toBe('$0');
  });

  it('actionable 留空(由 narrative 填)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.actionable).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

```ts
// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum } from '../format';
import type { CampaignReportContent } from './schema';

type Any = Record<string, any>;

function metric(m: Any | null, key: string): number {
  return Number((m as Any)?.[key] ?? 0);
}

/** "2026-10-12" → "Oct 12"。 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export async function mapCampaign(campaignId: string): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');

  const m = (campaign.metrics ?? {}) as Any;
  const analytics = (campaign.analytics ?? {}) as Any;
  const trendSrc = analytics.trend ?? {};

  const totalRevenue = metric(m, 'totalRevenue');
  const clicks = metric(m, 'clicks');
  const orders = metric(m, 'orders');
  const newCustomers = metric(m, 'newCustomers');
  const aov = metric(m, 'aov') || (orders ? totalRevenue / orders : 0);

  const publishers = campaign.campaignCreators.map((cc) => {
    const cps = cc.cpsPerformances.reduce(
      (a, p) => ({ clicks: a.clicks + p.clicks, orders: a.orders + p.orders, gmv: a.gmv + Number(p.gmv) }),
      { clicks: 0, orders: 0, gmv: 0 },
    );
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(cps.gmv),
      clicks: formatNum(cps.clicks),
      orders: formatNum(cps.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  const newCustomerRate = metric(m, 'newCustomerRate');
  const insights = newCustomerRate
    ? {
        newCustomerRate: {
          rate: `${newCustomerRate}%`,
          newCount: newCustomers,
          totalOrders: orders,
          deltaPct: m.newCustomerDelta ? `${m.newCustomerDelta}%` : undefined,
        },
      }
    : {};

  return {
    header: {
      brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
      merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
      period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${campaign.startDate.slice(0, 4)}` },
    },
    kpis: [
      { label: 'Total Revenues', value: formatMoney(totalRevenue) },
      { label: 'Clicks', value: formatNum(clicks) },
      { label: 'Orders', value: formatNum(orders) },
      { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
      { label: 'AOV', value: formatMoney(aov) },
    ],
    trend: {
      labels: trendSrc.labels ?? [],
      revenue: trendSrc.revenue ?? [],
      clicks: trendSrc.clicks ?? [],
      orders: trendSrc.orders ?? [],
    },
    publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], // 由 narrative 填
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: PASS(7 用例)。

> 若 Step 0 的真实 metrics 键名与 `metric(m,'totalRevenue')` 等不一致:改 `metric()` 调用的键名,重跑测试;fixture 的 metrics 也改成真实形状。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts && git commit -m "feat(recipe): campaign DB → CampaignReportContent mapper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6:AI 文案(`narrative.ts`)— 只填组件 6

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/narrative.test.ts`

- [ ] **Step 1: 写失败测试(mock global.fetch)**

```ts
// narrative.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillActionable } from './narrative';
import type { CampaignReportContent } from './schema';

const content = {
  header: { brand: { name: 'B', logoText: 'b' }, merchant: { name: 'M', logoText: 'M' }, period: { start: 's', end: 'e', display: 'd' } },
  kpis: [{ label: 'Total Revenues', value: '$876,360' }],
  trend: { labels: ['a'], revenue: [1], clicks: [1], orders: [1] },
  publishers: [{ name: 'Mia', type: { label: 'Creator', kind: 'creator' }, screenshotUrl: 'x', revenue: '$192,000', clicks: '1', orders: '1' }],
  actionable: [],
} as unknown as CampaignReportContent;

function okJson(obj: unknown) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }) } as any;
}

beforeEach(() => { delete process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = 'test-key'; vi.clearAllMocks(); });

describe('fillActionable', () => {
  it('合法 JSON → 解析 + Zod 通过,返回 5 卡', async () => {
    const cards = [{ icon: 'trophy', color: 'green', title: 'Top Performers', items: [{ text: 'Mia', sub: '(ROAS 4.10)' }], footer: 'Scale.' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(cards)));
    const out = await fillActionable(content);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Top Performers');
  });

  it('模型返回带 ```json 代码块 → 剥离后解析', async () => {
    const cards = [{ icon: 'star', color: 'blue', title: 'Best Placement', items: [{ text: 'Story' }], footer: 'x' }];
    const wrapped = '```json\n' + JSON.stringify(cards) + '\n```';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: wrapped } }] }) } as any));
    const out = await fillActionable(content);
    expect(out[0].title).toBe('Best Placement');
  });

  it('非法 JSON → 重试 1 次仍失败 → 降级返回 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) } as any));
    const out = await fillActionable(content);
    expect(out).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2); // 初试 + 重试 1 次
  });

  it('HTTP 非 200 → 降级 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' } as any));
    const out = await fillActionable(content);
    expect(out).toEqual([]);
  });

  it('prompt 不含完整 HTML,只含数字摘要 + JSON 输出指令', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([])));
    await fillActionable(content);
    const body = (fetch as any).mock.calls[0][1].body;
    expect(body).toContain('Total Revenues');
    expect(body).toMatch(/JSON|json/);
    expect(body).not.toContain('<html');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/narrative.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

```ts
// narrative.ts
import { z } from 'zod';
import type { CampaignReportContent } from './schema';

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const ActionableCard = z.object({
  icon: z.string(),
  color: z.string(),
  title: z.string(),
  items: z.array(z.object({ text: z.string(), sub: z.string().optional() })),
  footer: z.string(),
});

const SYSTEM = `You write ONLY the narrative text for an affiliate marketing report's "Actionable Insights" section. You receive numbers; you return insight cards as JSON. Do not write HTML. Do not invent metrics not implied by the data.`;

function buildPrompt(c: CampaignReportContent): string {
  const topPublishers = [...c.publishers].slice(0, 5).map((p) => `${p.name} (${p.type.label}, revenue ${p.revenue}, clicks ${p.clicks}, orders ${p.orders})`);
  const kpis = c.kpis.map((k) => `${k.label}: ${k.value}`).join('; ');
  return `Campaign KPIs: ${kpis}.
Top publishers: ${topPublishers.join(' | ') || 'n/a'}.
Trend points: ${c.trend.labels.length}.

Return a JSON array (5 cards, in this order): "Top Performers", "High Traffic / Low CVR", "Best Performing Placement", "Creative Insight", "Action Required".
Each card: { icon (font-awesome name, e.g. trophy), color (one of: green, orange, blue, purple, red), title, items: [{text, sub?}], footer }.
Output ONLY the JSON array, no markdown fences, no prose.`;
}

function stripFences(s: string): string {
  return s.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/i, '').trim();
}

async function callDeepSeek(c: CampaignReportContent): Promise<any[]> {
  const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(c) }],
      temperature: 0.5,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json() as any;
  const raw = stripFences(data.choices?.[0]?.message?.content ?? '');
  const parsed = JSON.parse(raw); // 抛 SyntaxError 由调用方触发重试/降级
  const arr = z.array(ActionableCard).parse(parsed);
  return arr;
}

/** 填组件 6。失败(网络/非200/非法JSON/Zod)→ 重试 1 次 → 仍失败返回 [](报告照常渲染)。 */
export async function fillActionable(c: CampaignReportContent): Promise<CampaignReportContent['actionable']> {
  if (!DEEPSEEK_API_KEY) return [];
  try {
    return await callDeepSeek(c);
  } catch {
    try {
      return await callDeepSeek(c); // 重试 1 次
    } catch {
      return []; // 降级
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/narrative.test.ts`
Expected: PASS(5 用例)。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/narrative.ts apps/server/src/modules/html-templates/recipe/campaign-report/narrative.test.ts && git commit -m "feat(recipe): AI 填 Actionable Insights 文案(失败降级)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7:渲染编排 + 快照(`render.ts`)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`
- Create(首次跑测试生成): `apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap`

- [ ] **Step 1: 写快照测试(mock mapper/narrative,真实 Handlebars 渲染)**

```ts
// render.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ campaign: { findUnique: vi.fn() } }));
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));
vi.mock('./narrative', () => ({ fillActionable: vi.fn().mockResolvedValue([{ icon: 'trophy', color: 'green', title: 'Top Performers', items: [{ text: 'Mia', sub: '(ROAS 4.10)' }], footer: 'Scale.' }]) }));

import { render } from './render';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12', 'Nov 10'], revenue: [50000, 166360], clicks: [15000, 83619], orders: [250, 876] } },
  campaignCreators: [{
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

beforeEach(() => { vi.clearAllMocks(); prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); });

describe('render', () => {
  it('产出以 <!DOCTYPE html> 开头、</html> 结尾的独立 HTML', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trim().endsWith('</html>')).toBe(true);
  });

  it('真实数字注入(不经 AI)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('$876,360');      // KPI
    expect(html).toContain('124,678');        // publisher clicks
    expect(html).toContain('"revenue":[50000,166360]'); // Chart.js data 注入
  });

  it('DG token 注入', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('#ff099e');
  });

  it('AI 文案出现(Actionable 区块)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('Top Performers');
  });

  it('HTML 快照(DG 保真基线)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/render.test.ts`
Expected: FAIL(`render` 不存在)。

- [ ] **Step 3: 实现**

```ts
// render.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';
import { mapCampaign } from './mapper';
import { fillActionable } from './narrative';
import { dgTokens } from './tokens';
import type { RenderInput } from '../types';

// 注册 helpers
Handlebars.registerHelper('json', (v) => new Handlebars.SafeString(JSON.stringify(v)));
Handlebars.registerHelper('map', (arr: any[], key: string) => (arr ?? []).map((x) => x[key]));
Handlebars.registerHelper('minus', (a: number, b: number) => a - b);
Handlebars.registerHelper('initials', (full: string) =>
  (full ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
);

const here = dirname(fileURLToPath(import.meta.url));
const templateSrc = readFileSync(join(here, 'template.hbs'), 'utf8');
const compiled = Handlebars.compile(templateSrc, { noEscape: false });

export async function render(input: RenderInput): Promise<string> {
  const content = await mapCampaign(input.campaignId);
  content.actionable = await fillActionable(content);
  return compiled({ content, tokens: dgTokens });
}
```

> Handlebars 默认对 `{{var}}` 做 HTML 转义;模板里 chart 数据用 `{{{json}}}`(三花括号)避免 JSON 被转义破坏。`{ noEscape: false }` 是默认,显式标注。

- [ ] **Step 4: 跑测试,生成快照**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/recipe/campaign-report/render.test.ts`
Expected: PASS;首次运行在 `__snapshots__/render.test.ts.snap` 生成快照。

- [ ] **Step 5: 人工核对快照**

打开快照文件,核对:DG 五子卡骨架在、KPI 五卡在、Chart.js `data:` 数组是真实数字、AI 文案卡在。若与 DG 视觉有出入,改 `template.hbs` 后 `pnpm --filter @mediaket/server test ... -- -u` 更新快照(并说明原因)。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/render.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/ && git commit -m "feat(recipe): Handlebars 渲染编排 + DG 保真快照基线

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8:recipe 注册表 + 子模块出口

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/index.ts`
- Create: `apps/server/src/modules/html-templates/recipe/index.ts`

- [ ] **Step 1: `campaign-report/index.ts`**

```ts
// campaign-report/index.ts
import { render } from './render';
import type { Recipe } from '../types';

export const campaignReportRecipe: Recipe = { id: 'campaign-report', render };
```

- [ ] **Step 2: `recipe/index.ts`(注册表,按 id 选)**

```ts
// recipe/index.ts
import type { Recipe, RecipeId } from './types';
import { campaignReportRecipe } from './campaign-report';

const RECIPES: Record<RecipeId, Recipe> = {
  'campaign-report': campaignReportRecipe,
};

export function getRecipe(id?: string): Recipe {
  const recipe = RECIPES[(id ?? 'campaign-report') as RecipeId];
  if (!recipe) throw new Error(`未知 recipe: ${id}`);
  return recipe;
}

export type { Recipe, RecipeId, RenderInput } from './types';
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @mediaket/server build`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/index.ts apps/server/src/modules/html-templates/recipe/index.ts && git commit -m "feat(recipe): recipe 注册表(campaign-report)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9:集成到 generate 端点(`mode:'recipe'`)

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Test: `apps/server/src/modules/html-templates/html-templates.controller.recipe.test.ts`

- [ ] **Step 1: 改 schema(加 `'recipe'` + `recipeId`)**

把 `generateHtmlSchema` 的 `mode` 行与新增字段改成:

```ts
export const generateHtmlSchema = z.object({
  mode: z.enum(['template', 'ai', 'recipe']),
  templateId: z.string().optional(),
  prompt: z.string().optional(),
  campaignId: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  designMd: z.string().optional(),
  recipeId: z.string().optional(),
});
```

- [ ] **Step 2: 写失败测试(端点级,mock recipe.render)**

```ts
// html-templates.controller.recipe.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./recipe', () => ({ getRecipe: vi.fn(() => ({ id: 'campaign-report', render: vi.fn().mockResolvedValue('<!DOCTYPE html><html>RECIPE</html>') })) }));
vi.mock('./ai-generate.service', () => ({ aiGenerateService: { buildCampaignContext: vi.fn(), generateHtml: vi.fn() } }));
vi.mock('./html-templates.service', () => ({ htmlTemplateService: { generateFromTemplate: vi.fn() } }));

import { htmlTemplateController } from './html-templates.controller';
import { getRecipe } from './recipe';

beforeEach(() => vi.clearAllMocks());

describe('generate · mode=recipe', () => {
  it('调 recipe.render 并返回 { html }', async () => {
    const req = { body: { mode: 'recipe', campaignId: 'c1' } } as any;
    const res = { json: vi.fn() } as any;
    await htmlTemplateController.generate(req as any, res as any);
    const recipe = (getRecipe as any).mock.results[0].value;
    expect(recipe.render).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'c1' }));
    expect(res.json).toHaveBeenCalledWith({ html: expect.stringContaining('RECIPE') });
  });

  it('未给 recipeId → 默认 campaign-report', async () => {
    const req = { body: { mode: 'recipe', campaignId: 'c1' } } as any;
    await htmlTemplateController.generate(req as any, { json: vi.fn() } as any);
    expect(getRecipe).toHaveBeenCalledWith('campaign-report');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/html-templates.controller.recipe.test.ts`
Expected: FAIL(`mode==='recipe'` 分支不存在 → 落入 else 走 AI 分支 → mock 不符)。

- [ ] **Step 4: 改 controller(加分支)**

在 `html-templates.controller.ts:generate` 现有 `if (mode === 'template') {...} else {...}` 中间插入 recipe 分支。改后形如:

```ts
generate: asyncHandler(async (req: Request, res: Response) => {
  const { mode, templateId, prompt, campaignId, theme, recipeId } = req.body;

  let html: string;

  if (mode === 'template') {
    if (!templateId) throw new Error('templateId is required for template mode');
    let campaignData: Record<string, any> = {};
    if (campaignId) {
      const json = await aiGenerateService.buildCampaignContext(campaignId);
      campaignData = JSON.parse(json);
    }
    html = await htmlTemplateService.generateFromTemplate(templateId, campaignData);
  } else if (mode === 'recipe') {
    html = await getRecipe(recipeId).render({ campaignId, theme });
  } else {
    html = await aiGenerateService.generateHtml({
      campaignId,
      prompt: prompt || 'Generate a comprehensive campaign performance report',
      theme,
      designMd: req.body.designMd,
    });
  }

  res.json({ html });
}),
```

并在文件顶部 import:`import { getRecipe } from './recipe';`

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates/html-templates.controller.recipe.test.ts`
Expected: PASS(2 用例)。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.schema.ts apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/html-templates.controller.recipe.test.ts && git commit -m "feat(html-templates): generate 端点新增 mode:recipe

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10:整体验证

- [ ] **Step 1: 跑本特性全部测试**

Run: `pnpm --filter @mediaket/server test src/modules/html-templates`
Expected: 全 PASS(含 recipe 子目录 + 现有 html-templates 测试 + 新 controller.recipe 测试)。

- [ ] **Step 2: 类型检查整仓 server**

Run: `pnpm --filter @mediaket/server build`
Expected: 0 error。

- [ ] **Step 3: 手测端点(需 dev server + DB)**

```bash
# 拿一个真实 campaign id(从 DB)
CID=$(pnpm --filter @mediaket/server exec node -e "import('./src/prisma').then(({prisma})=>prisma.campaign.findFirst().then(c=>{console.log(c?.id);process.exit(0)}))")
# 起 dev server 后(另一终端 pnpm --filter @mediaket/server dev),带登录态 cookie 调:
curl -s localhost:4000/api/v1/html-templates/generate -H 'Content-Type: application/json' -H "Cookie: $AUTH_COOKIE" -d "{\"mode\":\"recipe\",\"campaignId\":\"$CID\"}" | head -c 400
```

Expected:返回 `{"html":"<!DOCTYPE html>...`,含真实数字。

- [ ] **Step 4: 验收对照**

打开生成的 HTML(写到 `/tmp/out.html` 用浏览器开),对照 `DG Campaign Report.html`:KPI 五卡、Publisher 表、Performance Trend 图、Actionable Insights 卡均在;数字来自该 campaign;AI 文案区块在 mock/真实 key 下都有(失败则显示"洞察暂不可用")。

---

## 自检(写计划后)

**Spec 覆盖**:
- 组件↔内容契约 → Task 2(schema,6 组件字段全覆盖)+ Task 4(模板对应渲染)
- mapper(campaign→契约)→ Task 5
- Handlebars 渲染 + 图表 `{{{json}}}` 注入 → Task 4 + Task 7
- AI 只填组件 6 + 失败降级 → Task 6
- manifest 显隐 → Task 3 + Task 4(`{{#if insights.topX}}` 守卫)
- token(DG 默认)→ Task 3 + Task 4(注入)
- `mode:'recipe'` 集成 → Task 9
- 沿用 saveHtmlAsProject → 不需改动(产物 `{html}` 直接可走现有保存流程),Task 10 手测验证
- 测试策略(mapper/快照/narrative mock)→ Task 5/6/7/9

**无占位符**:每步含真实代码/命令/预期;Task 5 含真实数据键名核对步骤;Task 4 含完整 .hbs。

**类型一致**:`CampaignReportContent`、`RenderInput`、`Recipe`、`getRecipe` 在各任务间签名一致;`mapCampaign`/`fillActionable`/`render` 调用链匹配。

**已知风险/待核**:Task 5 Step 0 需用真实 campaign 核对 metrics 键名(已写成显式步骤);若 campaign DB 无 cps 数据,publisher 收入显示 `$0`(可接受,manifest 不隐藏非空表)。
