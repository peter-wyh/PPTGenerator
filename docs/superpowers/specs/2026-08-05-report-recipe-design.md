# Report Recipe:内容↔组件契约 + 确定性渲染(DG Campaign Report 通用化)— 设计

- 日期: 2026-08-05
- 状态: 已批准,待实现

## 背景

仓库根目录 `DG Campaign Report.html` 是一份手工打磨、品牌化(DIGCHIC / GlowLab,主色 `#ff099e`,字体 Outfit/Poppins/Barlow Condensed)的联盟营销活动报告,结构清晰:Header、KPI 五卡、Performance Trend(Chart.js line+bar)、Publisher 表、Insight & Analysis(5 子卡)、Actionable Insights(5 卡)。

现有 AI HTML 生成走 `apps/server/src/modules/html-templates/ai-generate.service.ts`:`POST /api/v1/html-templates/generate`(`mode:'ai'`)把 campaign JSON + 自由 prompt + theme + 业务线 `design.md` 喂给 DeepSeek,**模型每次自由发挥结构**,返回整段 HTML。问题:

- **无法稳定复刻 DG 的质量与结构**——换一份数据,出来的版式、组件、图表类型都不一样。
- **数字会经过 AI**,存在编造/格式错乱风险(图表数据尤其致命)。
- **没有"组件"概念**,无法把"某段版式"与"它需要什么内容"显式绑定,也就无法换数据复用。

目标:把 DG 这一份报告固化成一份可复用的 **Recipe(配方)**——同一套风格 + 组件结构,换不同 campaign 数据即产出同样规格的报告。数字/图表/表格 100% 由数据驱动(确定性),只有"洞察叙事文案"交给 AI。

## 目标

1. 把 DG Campaign Report 拆成 **6 个组件**,每个组件定义明确的内容契约(Zod schema);组件只认契约,不认 campaign DB。
2. campaign DB → 内容契约由 **mapper** 适配(扩展现有 `buildCampaignContext`)。
3. 模板用 **Handlebars** 渲染,图表数据用 `{{{json}}}` 注入,数字不经过 AI。
4. AI **只**写组件 6(Actionable Insights)的叙事文案:输入数字、输出结构化 JSON、Zod 校验、失败降级(报告照常出)。
5. 渲染产物可沿用现有 `saveHtmlAsProject` 流程存成 `Project`。
6. v1 只做 DG 这一种报告类型;`Recipe` 接口预留为多类型扩展点。

## 核心设计

### Recipe = 四件套

| 部分 | 文件 | 作用 |
|------|------|------|
| 内容契约 | `schema.ts`(Zod) | 每个组件要什么内容;组件与数据的边界 |
| 模板 | `template.hbs`(Handlebars) | DG HTML 改写,`{{}}` 占位 |
| 风格 token | `tokens.ts` | DG 默认颜色/字体(v1 固定,预留 businessLine 覆盖) |
| 组件清单 | `manifest.ts` | 组件顺序 + 缺字段时的显隐规则 |

### 内容↔组件契约(组件 1–5 纯数据;组件 6 文案由 AI 写)

| # | 组件 | 内容契约 | 数据来源 | AI? |
|---|------|----------|----------|-----|
| 1 | Header | `{ brand:{name,logoText,logoImg?}, merchant:{name,logoText}, period:{start,end,display} }` | campaign + businessLine | 否 |
| 2 | KpiOverview | `Kpi[]{ label, value, highlight? }`(Revenues/Clicks/Orders/NewCust/AOV) | campaign.metrics | 否 |
| 3 | PerformanceTrend | `{ labels[], revenue[], clicks[], orders[] }` | campaign.analytics | 否 |
| 4 | PublisherTable | `Publisher[]{ name, handle?, type:{label,kind}, screenshotUrl, revenue, clicks, orders, linkUrl? }` | campaignCreators | 否 |
| 5 | InsightModules | topCategories`{segments[]{label,pct,color}}` / topProducts`{name,revenue}[]` / topMarket`{country,revenue,pct,color}[]` / topPromotion`{name,type,revenue,usage,tagKind}[]` / newCustomerRate`{rate,newCount,totalOrders,deltaPct?}` | metrics/analytics/creators | 否 |
| 6 | ActionableInsights | `Card[]{ icon, color, title, items[]{ text, sub? }, footer }` | **数字来自数据,文案 AI 写** | **是** |

### 数据流

```
campaignId
  → mapper: campaign DB → CampaignReportContent          # 数字填好,actionable 留空
  → narrative: AI 只填组件 6(DeepSeek,JSON,Zod 校验)     # 失败降级
  → render: Handlebars(template, content, tokens)         # 一次渲染
  → 独立 HTML(沿用 saveHtmlAsProject 存 Project)
```

## 改动范围

### A. Recipe 子系统(新增,位于 html-templates 模块内)

放在 `apps/server/src/modules/html-templates/recipe/`,与 `ai-generate.service.ts` 同模块(HTML 生成的代码集中在一起)。`campaign-report/` 是首个 recipe 实例。

```
apps/server/src/modules/html-templates/recipe/
  types.ts                          # Recipe 接口、RenderInput/Output
  campaign-report/
    schema.ts                       # Zod 内容契约(上表)
    template.hbs                    # DG HTML → Handlebars
    tokens.ts                       # DG 默认 token
    manifest.ts                     # 组件顺序 + 显隐规则
    mapper.ts                       # campaign DB → CampaignReportContent
    narrative.ts                    # AI 填组件 6(DeepSeek, JSON)
    render.ts                       # 编排 mapper→narrative→Handlebars,导出 render(input)
    index.ts                        # 对外出口
```

**A1. `schema.ts`** — Zod 契约(节选):

```ts
export const CampaignReportContent = z.object({
  header: z.object({
    brand: z.object({ name: z.string(), logoText: z.string(), logoImgUrl: z.string().optional() }),
    merchant: z.object({ name: z.string(), logoText: z.string() }),
    period: z.object({ start: z.string(), end: z.string(), display: z.string() }),
  }),
  kpis: z.array(z.object({ label: z.string(), value: z.string(), highlight: z.boolean().optional() })),
  trend: z.object({ labels: z.array(z.string()), revenue: z.array(z.number()),
                    clicks: z.array(z.number()), orders: z.array(z.number()) }),
  publishers: z.array(z.object({
    name: z.string(), handle: z.string().optional(),
    type: z.object({ label: z.string(), kind: z.enum(['creator','fb','tg','site','other']) }),
    screenshotUrl: z.string(), revenue: z.string(), clicks: z.string(), orders: z.string(),
    linkUrl: z.string().optional(),
  })),
  insights: z.object({
    topCategories: z.array(z.object({ label: z.string(), pct: z.number(), color: z.string() })).optional(),
    topProducts: z.array(z.object({ name: z.string(), revenue: z.string() })).optional(),
    topMarket: z.array(z.object({ country: z.string(), revenue: z.string(), pct: z.number(), color: z.string() })).optional(),
    topPromotion: z.array(z.object({ name: z.string(), type: z.string(), revenue: z.string(), usage: z.string(), tagKind: z.string() })).optional(),
    newCustomerRate: z.object({ rate: z.string(), newCount: z.number(), totalOrders: z.number(), deltaPct: z.string().optional() }).optional(),
  }),
  actionable: z.array(z.object({   // ← AI 填
    icon: z.string(), color: z.string(), title: z.string(),
    items: z.array(z.object({ text: z.string(), sub: z.string().optional() })),
    footer: z.string(),
  })),
});
export type CampaignReportContent = z.infer<typeof CampaignReportContent>;
```

> `insights.*` 与 `actionable` 用 `.optional()`/数组,配合 manifest 显隐;DG 原始 5 个 insight 子卡在数据缺失时整张隐藏,不报错。

**A2. `template.hbs`** — DG HTML 改写要点(节选):

- KPI 区:`{{#each kpis}}<div class="card ..."><p>{{label}}</p><h3 class="font-number ...">{{value}}</h3></div>{{/each}}`,`{{#if highlight}}text-brand-primary{{/if}}`。
- Publisher 表:`{{#each publishers}}<tr onclick="window.open('{{linkUrl}}','_blank')">…{{type.label}}…{{revenue}}…{{/each}}`。
- 图表:Chart.js 的 `data:` 数组改为 `data: {{{json trend.revenue}}}`,`labels: {{{json trend.labels}}}`。`{{{ }}}` 三花括号不转义,保证 JSON 原样注入。
- 颜色/字体:从 token 注入,`tailwind.config` 里 `brand.primary` 改为 `{{tokens.brandPrimary}}`(或在 `<style>` 顶部注入 CSS 变量)。

**A3. `mapper.ts`** — 复用 `aiGenerateService.buildCampaignContext(campaignId)` 拿到的同一份 campaign 对象(同样 include creators/performance/cps/businessLine/advertiser),映射成 `CampaignReportContent`:

- `metrics.totalRevenue` → `kpis[Revenues].value`(经 `formatMoney` → `$876,360`);`clicks/orders/newCustomer/aov` 同理。
- creators → publishers:`handle` = creator handle;`revenue` 取 cps.gmv 或 performance;`type.kind` 由 `collabType`/`contentType` 派生(creator→creator、FB 群→fb …)。
- `analytics` 时间序列 → `trend`。
- 新增格式化 util:`formatMoney / formatNum / formatPct`(放 `recipe/format.ts`)。
- **缺口兜底**:DG 里有但 campaign DB 没有的字段(`screenshotUrl`、TopCategories/TopMarket/TopPromotion 等)→ `screenshotUrl` 缺失用占位图(`https://placehold.co/…`);insight 子卡缺失则由 manifest 隐藏。映射阶段不抛错。

**A4. `narrative.ts`** — AI 填组件 6:

- 复用 `ai-generate.service` 里的 DeepSeek 配置(URL/KEY/MODEL 环境变量)。
- 输入:kpis + publishers(按 ROAS 排序)+ trend 走向 + newCustomerRate 等**数字摘要**。
- 要求模型**只**输出 JSON,匹配 `actionable[]` 五卡结构(Top Performers / High Traffic Low CVR / Best Performing Placement / Creative Insight / Action Required)。
- Zod 校验 → 失败重试 1 次 → 仍失败则**降级**:`actionable = []`,渲染时该区块显示一句"洞察暂不可用,请稍后重试"。**报告照常出**。

**A5. `render.ts`** — 编排:

```ts
export async function render(input: { campaignId: string; theme?: 'light'|'dark'; designMd?: string }): Promise<string> {
  const content = await mapCampaign(input.campaignId);          // mapper
  content.actionable = await fillActionable(content);            // narrative(AI)
  const tokens = dgTokens;                                       // v1 固定
  return compiledTemplate({ content, tokens });                  // Handlebars,模板编译后缓存
}
```

> `designMd` 在 v1 **保留未用**(token 固定为 DG);预留给「businessLine token 覆盖」扩展。

Handlebars 助手:`json`(安全 stringify,用于图表数据)、`eq`、`or`、`formatMoney`/`formatPct`(若模板里直接用)。模板编译一次缓存(module-level `compile`)。

### B. 集成到现有 generate 端点

- `html-templates.schema.ts` 的 `generateHtmlSchema.mode` 枚举加 `'recipe'`;新增可选字段 `recipeId`(z.string().optional(),默认 `'campaign-report'`)。
- `html-templates.controller.ts:generate` 增加分支:

```ts
} else if (mode === 'recipe') {
  html = await recipeRender({ campaignId, theme });
}
```

(`recipeRender` = `recipe/campaign-report` 的 `render`,通过 `recipe/index.ts` 按 `recipeId` 选择,为多 recipe 预留。)

- **端点不变**(`POST /api/v1/html-templates/generate`),前端只多一个 `mode:'recipe'`。返回仍是 `{ html }`,可继续走 `saveHtmlAsProject` 存 Project。
- `mode:'ai'`(自由生成)与 `mode:'template'` **保留不动**,向后兼容。

### C. 前端(可后置,非 v1 必需)

`GenerateHtmlReportOverlay.tsx` 增加第三种模式入口"配方生成(DG 风格)",提交时带 `mode:'recipe'`。可在 v1 后端跑通后再做;不在本 spec 的验收硬性范围内。

## 不改动

- `ai-generate.service.ts` 的 `mode:'ai'` 自由生成路径——保留。
- `htmlTemplateService.generateFromTemplate`(`mode:'template'`)——保留。
- DB schema(`schema.prisma`)——无新表、无迁移;recipe 落代码。
- 现有 Project 保存流程(`saveHtmlAsProject`)——recipe 产物复用它,不改。
- 编辑器 React 组件系统(`CampaignReport.tsx`、`ComponentType`)——本 spec 的"组件"指 HTML 报告内的版式段,与编辑器组件系统无关。

## 验证

- **mapper 单测**(`recipe/campaign-report/mapper.test.ts`):fixture campaign 对象 → 断言 `content.kpis`/`content.publishers`/`content.trend` 字段与格式化结果正确(creator 映射、单位/千分位)。
- **快照测试**(`render.test.ts`):用 fixture `content`(actionable 用固定桩)渲染 → 锁定 HTML 快照作为 DG 保真基线;模板改动时主动更新快照。断言关键数字字符串(如总收入 `$876,360`)出现在输出。
- **narrative 测试**(`narrative.test.ts`):mock fetch DeepSeek → 返回合法 JSON 断言解析+Zod 通过;返回脏 JSON 断言重试 1 次后降级为 `actionable=[]` 且不抛。
- **端点手测**:`POST /html-templates/generate { mode:'recipe', campaignId }` → 返回结构完整、含真实数字、Actionable 区块在 mock 下正常/降级两种情况均不 500。
- **回归**:`pnpm test`(server);前端若做 C 部分再从 `apps/web` 跑 vitest。
- **依赖**:`apps/server` 新增 `handlebars`(及 `@types/handlebars` dev)。

## 风险与边界

- **campaign DB 字段缺口**:DG 显示的 TopCategories/TopMarket/TopPromotion 在 campaign DB 中未必齐全 → manifest 规则:字段缺失则隐藏对应子卡,不报错、不留空壳。验收需列出"哪些字段当前缺、隐藏后视觉是否可接受"。
- **AI 文案失败**:DeepSeek 不可用/JSON 不合规 → 降级空 actionable + 提示文案,报告仍渲染。绝不因 AI 挂掉而整体 500。
- **图表数据准确性**:数字绕过 AI(模板直填)是本设计的核心保证;`{{{json}}}` 必须用三花括号避免转义破坏 JSON。
- **DG 像素级保真**:以快照为基线;后续微调模板需主动更新快照并在 PR 说明。
- **并发/性能**:单次渲染 = 1 次 DB 查询(复用 buildCampaignContext)+ 1 次 AI 调用 + 1 次模板编译(缓存);与现有 `mode:'ai'` 同量级。
- **v1 不做**:多 recipe、recipe 创作 UI、非 campaign 数据源、businessLine token 覆盖、组件级主题切换。

## 未来扩展点

- `Recipe` 接口(`recipe/types.ts`):`{ id, schema, render(input) }`;新增报告类型 = 新增一个 recipe 子目录 + 在 `recipe/index.ts` 注册。
- 数据源扩展:内容契约是数据源无关的,后续 CSV/手动录入/其它系统只要能产出 `CampaignReportContent` 即可直渲染(绕过 mapper)。
- businessLine token 覆盖:`tokens.ts` 支持读业务线 `design.md` 解析出的色值/字体覆盖 DG 默认值。
