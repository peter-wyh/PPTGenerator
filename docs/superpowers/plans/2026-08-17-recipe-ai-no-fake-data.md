# recipe/AI 数据链路「宁缺勿假」改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recipe/AI 两条报告链路删掉 analytics blob 兜底与假零,单一真源 = CPS daily 切片;无数据/覆盖不完整时显式空态+提醒,永不硬拒、永不假数据。

**Architecture:** 新增纯函数 `coverage.ts`(mapper 与 ai-service 共用)计算 daily 覆盖;mapper 删 Branch B 改单路径,`CampaignReportContent` 增 `dataCoverage` 字段,空态以特殊 KPI 卡/空数组呈现并由模板渲染;AI `buildCampaignContext` 不再喂 analytics 数字,附 `dataCoverage`/`dataGaps`;SYSTEM_PROMPT 加禁编造规则;前端 DataPanel 按覆盖形状显示红/黄提示;删 seed 脚本。

**Tech Stack:** TypeScript + Zod(schema)、Handlebars(recipe 模板)、vitest(server 单测 + @testing-library/react)、React。

**Spec:** `docs/superpowers/specs/2026-08-17-recipe-ai-no-fake-data-design.md`

---

## File Structure

| 文件 | 职责 | 操作 |
|---|---|---|
| `apps/server/src/modules/html-templates/recipe/campaign-report/coverage.ts` | 纯函数:从 campaign 行计算请求区间 daily 覆盖 | Create |
| `apps/server/src/modules/html-templates/recipe/campaign-report/coverage.test.ts` | 覆盖计算单测 | Create |
| `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts` | `CampaignReportContent` 加 `dataCoverage` 可选字段 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | 删 Branch B;单路径+空态卡+dataCoverage | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | 新增/改写分支用例 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_header.hbs` | coverage 提示条 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs` | 空态卡样式类 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts` | coverage 条快照 | Modify |
| `apps/server/src/modules/html-templates/ai-generate.service.ts` | buildCampaignContext 改造 + SYSTEM_PROMPT 规则 + done chunk 附 coverage | Modify |
| `apps/server/src/modules/html-templates/ai-generate.service.test.ts` | context/prompt 规则用例 | Modify |
| `apps/web/src/editor/components/recipe-editor/DataPanel.tsx` | 重新生成后按覆盖显示红/黄提示条 | Modify |
| `apps/web/tests/recipe-editor.test.tsx` | DataPanel 提示条用例 | Modify |
| `apps/web/src/api/htmlTemplates.ts` | SSE done 事件类型 + recompute 返回类型加 dataCoverage | Modify |
| `apps/web/src/routes/HtmlStudio.tsx` | done chunk 带 coverage → toast | Modify |
| `apps/server/prisma/seed-cps-daily.ts` | 删除合成 seed 脚本 | Delete |

**命令约定**:server 测试 `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run <path>`;web 测试 `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run <path>`;类型检查各自 `./node_modules/.bin/tsc --noEmit`(server)/`tsc -b --force`(web)。原子提交:`git add <files> && git commit -m "..."` 一条命令。

---

## Task 1: coverage.ts 纯函数(TDD)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/coverage.ts`
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/coverage.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `coverage.test.ts`:

```ts
// coverage.test.ts
import { describe, expect, it } from 'vitest';
import { computeCoverage } from './coverage';

/** 造一个带 daily 的 campaign 行(形状对齐 mapper include 返回)。 */
function campWithDaily(dates: string[]) {
  return {
    startDate: '2026-10-01', endDate: '2026-10-31',
    campaignCreators: [{
      cpsPerformances: [{ daily: dates.map((date) => ({ date, clicks: '1', orders: '1', gmv: '1' })) }],
    }],
  };
}

describe('computeCoverage', () => {
  it('全覆盖:请求区间每天都有数据 → complete=true, missingDays=0', () => {
    const r = computeCoverage(campWithDaily(['2026-10-01', '2026-10-02', '2026-10-03']), { start: '2026-10-01', end: '2026-10-03' });
    expect(r.complete).toBe(true);
    expect(r.missingDays).toBe(0);
    expect(r.covered).toEqual({ start: '2026-10-01', end: '2026-10-03' });
  });

  it('部分覆盖:daily 在区间外还有 → complete=false,missingDays=区间天数-交集天数', () => {
    // 区间 10-01~10-05(5 天),daily 只有 10-02、10-03 → missing 3
    const r = computeCoverage(campWithDaily(['2026-10-02', '2026-10-03', '2026-11-01']), { start: '2026-10-01', end: '2026-10-05' });
    expect(r.complete).toBe(false);
    expect(r.missingDays).toBe(3);
    expect(r.covered).toEqual({ start: '2026-10-02', end: '2026-10-03' });
  });

  it('零交集:daily 存在但全在区间外 → covered=null,complete=false,missingDays=区间天数', () => {
    const r = computeCoverage(campWithDaily(['2026-09-15']), { start: '2026-10-01', end: '2026-10-03' });
    expect(r.covered).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missingDays).toBe(3);
  });

  it('无任何 daily → covered=null,missingDays=区间天数', () => {
    const r = computeCoverage({ campaignCreators: [{ cpsPerformances: [{ daily: null }] }] }, { start: '2026-10-01', end: '2026-10-02' });
    expect(r.covered).toBeNull();
    expect(r.missingDays).toBe(2);
    expect(r.complete).toBe(false);
  });

  it('半开区间(只 start)→ end 补 campaign.endDate(与 MoM guard 同口径)', () => {
    const r = computeCoverage(campWithDaily(['2026-10-01', '2026-10-02', '2026-10-05']), { start: '2026-10-01' }, '2026-10-05');
    expect(r.complete).toBe(true); // 01/02/05 都有;03/04 无 → 见下一断言口径
    expect(r.missingDays).toBe(2); // 10-03、10-04 缺
  });

  it('无请求区间 → covered=daily 全集范围,missingDays=0,complete=true(全集自身必全覆盖)', () => {
    const r = computeCoverage(campWithDaily(['2026-10-02', '2026-10-04']), undefined);
    expect(r.covered).toEqual({ start: '2026-10-02', end: '2026-10-04' });
    expect(r.complete).toBe(true);
    expect(r.missingDays).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/coverage.test.ts`
Expected: FAIL — `Cannot find module './coverage'`。

- [ ] **Step 3: 实现 coverage.ts**

创建 `coverage.ts`:

```ts
// coverage.ts
/**
 * 「宁缺勿假」覆盖计算:从 campaign 行(campaignCreators[].cpsPerformances[].daily)
 * 计算请求区间的 daily 覆盖。纯函数,mapper 与 ai-generate.service 共用。
 * 口径:区间内「每一天都有记录」才 complete;covered 是交集的 min/max 日期。
 */
type Any = Record<string, any>;

export interface DailyCoverage {
  /** daily 与请求区间交集的 min/max;无任何交集 → null */
  covered: { start: string; end: string } | null;
  /** 请求区间内无数据的天数(无 daily → 全区间天数) */
  missingDays: number;
  /** missingDays === 0 */
  complete: boolean;
}

/** 枚举 [start, end] 的每个 ISO 日期(含端点)。 */
function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let t = d.getTime(); !isNaN(t) && t <= e.getTime(); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function computeCoverage(
  campaign: Any,
  requested: { start?: string; end?: string } | undefined,
  /** 半开区间兜底用的 campaign.endDate(与 mapper MoM guard 同口径)。 */
  campaignEndFallback?: string,
): DailyCoverage {
  // 1) 收集全部 daily 日期集合
  const dailyDates = new Set<string>();
  for (const cc of campaign?.campaignCreators ?? []) {
    for (const p of cc?.cpsPerformances ?? []) {
      for (const d of (p?.daily as Any[] | null | undefined) ?? []) {
        const date = String(d?.date ?? '');
        if (date) dailyDates.add(date);
      }
    }
  }

  // 2) 请求区间(无 → daily 全集即"请求",全集必全覆盖)
  let start = requested?.start;
  let end = requested?.end;
  if (!start && !end) {
    if (dailyDates.size === 0) return { covered: null, missingDays: 0, complete: true };
    const sorted = [...dailyDates].sort();
    return { covered: { start: sorted[0], end: sorted[sorted.length - 1] }, missingDays: 0, complete: true };
  }
  start = start || [...dailyDates].sort()[0] || campaign?.startDate;
  end = end || campaignEndFallback || campaign?.endDate || start;

  // 3) 交集 + 缺失天数
  const days = eachDay(start, end);
  const inRange = days.filter((d) => dailyDates.has(d));
  if (inRange.length === 0) {
    return { covered: null, missingDays: days.length, complete: false };
  }
  inRange.sort();
  return {
    covered: { start: inRange[0], end: inRange[inRange.length - 1] },
    missingDays: days.length - inRange.length,
    complete: days.length === inRange.length,
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/coverage.test.ts`
Expected: PASS — 6/6。(若半开用例的 `campaignEndFallback` 传参与断言有出入,以实现口径修正测试——注意「complete=true 且 missingDays=2」语义是:请求区间(补全后)有缺天;两断言矛盾时改为 `complete=false`。)

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/coverage.ts apps/server/src/modules/html-templates/recipe/campaign-report/coverage.test.ts && git commit -m "feat(recipe): coverage 纯函数——daily 覆盖计算(mapper/AI 共用)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: schema 加 dataCoverage + mapper 单路径改造(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试(mapper.test.ts 新增/改写用例)**

在 `mapper.test.ts` 追加(文件顶部已 import `mapCampaign`;`campaignRowWithDaily` fixture 已存在,复用):

```ts
// ── 宁缺勿假:无 analytics 兜底 ──────────────────────────────

it('无 daily + period → 空态卡(No data for this period),不读 analytics', async () => {
  prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); // campaignRow 无 daily
  const r = await mapCampaign('c1', { startDate: '2026-10-13', endDate: '2026-10-19' });
  expect(r.kpis).toEqual([{ label: 'No data for this period', value: '—', highlight: false }]);
  expect(r.trend).toEqual({ labels: [], revenue: [], clicks: [], orders: [] });
  expect(r.publishers).toEqual([]);
  expect(r.dataCoverage?.covered).toBeNull();
  expect(r.dataCoverage?.complete).toBe(false);
});

it('部分覆盖 + period → 出真实数 + dataCoverage.missingDays>0', async () => {
  prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
  // 请求 10-12~10-20(9 天),daily 期内有 15/16/20 三个 → missing 6
  const r = await mapCampaign('c1', { startDate: '2026-10-12', endDate: '2026-10-20' });
  // KPI 是期内切片真实值:clicks=200+300+400=900? 注意 10-20 在 fixture 里标了「期外 after」但按区间 12~20 属期内
  expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('900');
  expect(r.dataCoverage).toMatchObject({ covered: { start: '2026-10-15', end: '2026-10-20' }, missingDays: 6, complete: false });
});

it('零交集 + period → 空态卡 + covered=null + dataCoverage 给出全量可用区间', async () => {
  prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
  const r = await mapCampaign('c1', { startDate: '2026-11-01', endDate: '2026-11-05' });
  expect(r.kpis).toEqual([{ label: 'No data for this period', value: '—', highlight: false }]);
  expect(r.dataCoverage?.covered).toBeNull();
});

it('无 period(汇总口径)→ metrics 缺字段渲染 Metric unavailable,不兜 0', async () => {
  const partial = { ...campaignRow, metrics: { totalRevenue: 876360 } }; // 只有 revenue,其余缺
  prismaMock.campaign.findUnique.mockResolvedValue(partial);
  const r = await mapCampaign('c1');
  expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('Metric unavailable');
  expect(r.kpis.find((k) => k.label === 'Total Revenues')?.value).toBe('$876,360');
});

it('无 period + 无 daily + analytics 有数据 → KPI/trend 不来自 analytics(宁缺勿假)', async () => {
  prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); // analytics.trend 有预透视数据
  const r = await mapCampaign('c1');
  // clicks/orders 缺 → Metric unavailable;trend 不再从 analytics.trend 取
  expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('Metric unavailable');
  expect(r.trend.labels).toEqual([]);
});
```

同时**改写**两个既有用例(它们锁定旧行为):
- `it('metrics 缺字段 → 兜底 0,不抛')` → 改名 `it('metrics 缺字段 → Metric unavailable(不兜 0)')`,断言 `value === 'Metric unavailable'`。
- `it('trend 从 analytics.trend 映射')` → 删除(该数据源废弃);如删后无覆盖可加 `it('trend 无 daily → 空数组')` 断言 `r.trend.labels` 为 `[]`。

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: FAIL — `dataCoverage` 不存在 / KPI 值是 0 或 `$0` 而非 'Metric unavailable'。

- [ ] **Step 3: schema.ts 加 dataCoverage**

在 `CampaignReportContent` 的 `insights` 之后、`actionable` 之前插入:

```ts
  /** 「宁缺勿假」覆盖元信息:无 daily→covered=null;missingDays>0→报告需明示区间。 */
  dataCoverage: z.object({
    requested: z.object({ start: z.string(), end: z.string() }),
    covered: z.object({ start: z.string(), end: z.string() }).nullable(),
    missingDays: z.number(),
    complete: z.boolean(),
  }).optional(),
```

- [ ] **Step 4: mapper.ts 单路径改造**

4a. 顶部 import:

```ts
import { computeCoverage, type DailyCoverage } from './coverage';
```

4b. **删除 Branch B**:现有 `mapper.ts:196-214` 的 `hasDaily` 判断分支与 `:212-214` 的 console.warn fallback 段,以及 `:216-251` 中对 `analytics`/`summary` 的读取(trend 双形状解析、KPI 从 summary/metrics 取数)整段删除;`:253-271` publishers 汇总保留但只用于无 period 路径。

4c. 重写 `mapCampaign` 主体为单路径(完整替换 `mapCampaign` 函数体):

```ts
export async function mapCampaign(campaignId: string, reportPeriod?: { startDate?: string; endDate?: string }): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');

  const header = {
    brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
    merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
  };

  // ★ 宁缺勿假:daily 是唯一数字真源。coverage 决定呈现形态。
  const cov = computeCoverage(campaign, reportPeriod && (reportPeriod.startDate || reportPeriod.endDate)
    ? { start: reportPeriod.startDate, end: reportPeriod.endDate }
    : undefined, campaign.endDate);
  const requested = {
    start: reportPeriod?.startDate ?? campaign.startDate,
    end: reportPeriod?.endDate ?? campaign.endDate,
  };
  const dataCoverage = { requested, ...cov };

  const emptyKpis = [{ label: 'No data for this period', value: '—', highlight: false }];
  const emptyTrend = { labels: [] as string[], revenue: [] as number[], clicks: [] as number[], orders: [] as number[] };

  // 分支 1/2:有 reportPeriod → 一律 daily 切片(有交集出真数,零交集空态)
  if (reportPeriod && (reportPeriod.startDate || reportPeriod.endDate)) {
    if (!cov.covered) {
      return {
        header: { ...header, period: { start: requested.start, end: requested.end, display: `${shortDate(requested.start)} - ${shortDate(requested.end)}, ${String(requested.start).slice(0, 4)}` } },
        kpis: emptyKpis, trend: emptyTrend, publishers: [], insights: undefined, actionable: [],
        dataCoverage,
      };
    }
    const { kpis, publishers, trend, period, insights } = mapFromDaily(campaign, reportPeriod);
    return {
      header: { ...header, period }, kpis, trend, publishers,
      insights, actionable: [], dataCoverage,
    };
  }

  // 分支 3:无 reportPeriod(汇总口径)→ metrics 有值才渲染;CPS 顶层真实汇总列保留。
  const m = (campaign.metrics ?? {}) as Any;
  const has = (v: unknown, num: number) => (v !== undefined && v !== null && v !== '' ? num : null);
  const totalRevenue = has(m.totalRevenue, Number(m.totalRevenue));
  const clicks = has(m.clicks, Number(m.clicks));
  const orders = has(m.orders, Number(m.orders));
  const newCustomers = has(m.newCustomers, Number(m.newCustomers));
  const aovRaw = m.aov !== undefined && m.aov !== null && m.aov !== '' ? Number(m.aov) : (orders ? totalRevenue! / orders : null);

  const kpi = (label: string, v: number | null) =>
    v === null ? { label, value: 'Metric unavailable', highlight: false } : { label, value: label === 'Total Revenues' || label === 'AOV' ? formatMoney(v) : label === 'Conversion Rate' ? formatPct(Math.round(v * 10) / 10) : formatNum(v) };

  const cvr = clicks && orders ? (orders / clicks) * 100 : null;
  const kpis = [
    kpi('Total Revenues', totalRevenue),
    kpi('Clicks', clicks),
    kpi('Orders', orders),
    kpi('Conversion Rate', cvr),
    kpi('New Customer Acquisition', newCustomers),
    kpi('AOV', aovRaw),
  ];

  // publishers:CPS 表顶层真实汇总(非 analytics)
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

  // 维度聚合(CPS 链接级真实标签)
  const dimLinks: DimLink[] = (campaign.campaignCreators ?? []).flatMap((cc: Any) =>
    (cc.cpsPerformances ?? []).map((p: Any) => ({
      productName: p.productName, category: p.category, market: p.market,
      promoName: p.promoName, promoType: p.promoType,
      gmv: Number(p.gmv) || 0, orders: Number(p.orders) || 0,
    })),
  );
  const insights = Object.keys(dimLinks).length ? aggregateDimensions(dimLinks) : undefined;

  return {
    header: { ...header, period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${String(campaign.startDate).slice(0, 4)}` } },
    kpis, trend: emptyTrend, publishers,
    insights, actionable: [], dataCoverage,
  };
}
```

> 注:旧汇总分支的 `analytics`/`summary`/`trendSrc` 代码与 `metric()` helper 删除;`insights` 里的 `newCustomerRate`(旧分支从 metrics 重算)如需保留,按「有值才渲染」同样处理(m.newCustomerRate 存在时才算)。`ROAS` 卡在汇总分支保留现有 `totalSpend > 0` 逻辑(cpsPerformances.spend 是真实列)。MoM/dimensions 聚合在 mapFromDaily 内部已有,不动。

- [ ] **Step 5: 运行确认通过 + 全 recipe 回归**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe`
Expected: PASS — coverage 6 + mapper 全部(含改写)+ schema/dimensions/render/narrative 既有用例。render.test 若因 `dataCoverage` 新字段快照失败 → `vitest run ... -u` 更新快照后人工确认差异仅新增 coverage 段。

- [ ] **Step 6: 类型检查 + 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/tsc --noEmit && cd ../.. && git add apps/server/src/modules/html-templates/recipe/campaign-report/{schema.ts,mapper.ts,mapper.test.ts} && git commit -m "feat(recipe): mapper 单路径——删 analytics 兜底,缺数显式空态/Metric unavailable + dataCoverage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 模板渲染 coverage 提示条 + 空态卡(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_header.hbs`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`

- [ ] **Step 1: 写失败测试(render.test.ts 追加)**

先看 render.test.ts 现有 fixture 构造方式(mock mapCampaign 或传 reportContent),追加两个用例:

```ts
describe('render · 宁缺勿假呈现', () => {
  it('dataCoverage 不完整 → header 下方渲染 coverage 提示条(含实际区间与缺失天数)', async () => {
    // 按现有 fixture 方式构造 content,加:
    // dataCoverage: { requested: { start: '2026-10-12', end: '2026-10-20' }, covered: { start: '2026-10-15', end: '2026-10-20' }, missingDays: 6, complete: false }
    const html = await render({ campaignId: 'c1', reportContent: contentWithCoverage });
    expect(html).toContain('Data coverage:');
    expect(html).toContain('Oct 15');
    expect(html).toContain('6 days missing');
  });

  it('complete=true → 无 coverage 提示条;空态 KPI 卡渲染占位文案', async () => {
    const html = await render({ campaignId: 'c1', reportContent: contentComplete });
    expect(html).not.toContain('Data coverage:');
    expect(html).toContain('No data for this period'); // 空态卡场景 content
  });
});
```

(具体 fixture 构造参考该文件现有用例的 `reportContent` 写法;`contentWithCoverage`/`contentComplete` 内联定义。)

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts`
Expected: FAIL — html 无 'Data coverage:'。

- [ ] **Step 3: _header.hbs 加提示条**

在 `_header.hbs` 的最外层 `<div class="card ...">` 结束后追加:

```hbs
        {{!-- ★ 宁缺勿假:数据覆盖提示条(数据层给什么渲染什么) --}}
        {{#if dataCoverage}}
          {{#unless dataCoverage.complete}}
            {{#if dataCoverage.covered}}
            <div class="card !py-3 border-l-4 border-amber-400 bg-amber-50">
                <p class="text-[13px] text-amber-700">
                    <i class="fas fa-triangle-exclamation mr-1"></i>
                    Data coverage: {{dataCoverage.covered.start}} – {{dataCoverage.covered.end}}
                    ({{dataCoverage.missingDays}} days missing in requested period)
                </p>
            </div>
            {{else}}
            <div class="card !py-3 border-l-4 border-red-400 bg-red-50">
                <p class="text-[13px] text-red-700">
                    <i class="fas fa-circle-exclamation mr-1"></i>
                    No data available for the requested period. Import real CPS daily data
                    (POST /api/v1/campaigns/import/cps-daily) before generating.
                </p>
            </div>
            {{/if}}
          {{/unless}}
        {{/if}}
```

- [ ] **Step 4: _kpi.hbs 空态卡样式**

KPI 卡 `{{#each kpis}}` 内,值元素改为:

```hbs
                <h3 class="font-number font-semibold text-[32px] leading-tight {{#if highlight}}text-brand-primary{{else}}text-grey-primary{{/if}} {{#if (isUnavailable value)}}text-[16px]!text-grey-tertiary{{/if}}">{{value}}</h3>
```

并在 `render.ts` 注册 helper(Task 3 一并改):

```ts
Handlebars.registerHelper('isUnavailable', (v: string) => v === 'Metric unavailable' || v === '—');
```

(空态文案字号降级、灰色弱化——真实数字仍是 32px 品牌色,占位视觉上明显"不是数"。)

- [ ] **Step 5: 运行确认通过 + 快照更新**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts`
Expected: PASS(快照变化 `-u` 更新后人工核对差异仅为提示条/占位样式)。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/partials/_header.hbs apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs apps/server/src/modules/html-templates/recipe/campaign-report/render.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/ && git commit -m "feat(recipe): 模板渲染数据覆盖提示条 + 空态卡降级样式

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: AI buildCampaignContext 只喂真数据 + prompt 规则(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `ai-generate.service.test.ts` 追加(参照现有 rewriteExternalAssets 用例的风格,mock prisma):

```ts
// 顶部(若已有 prisma mock 则复用):
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

describe('ai-generate.service · buildCampaignContext 宁缺勿假', () => {
  const dailyCamp = {
    id: 'c1', name: 'T', platform: 'TikTok', startDate: '2026-10-01', endDate: '2026-10-31',
    budget: 1, status: 'x', businessLineCode: 'FT', metrics: { clicks: 1 },
    analytics: { trend: [{ date: '2026-10-01', revenue: 999 }], summary: { totalRevenue: 999 }, topProducts: [{ n: 1 }] },
    businessLine: { name: 'FT' }, advertiser: { name: 'A' },
    campaignCreators: [{
      creator: { name: 'M', platform: 'TikTok', partnerType: 'creator' },
      cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
        daily: [{ date: '2026-10-02', clicks: '10', orders: '1', gmv: '100', impressions: '0', spend: '0', commission: '0', newCustomers: '0' }] }],
      performance: { summary: {} },
    }],
  };

  beforeEach(() => vi.clearAllMocks());

  it('有 period 且 daily 有交集 → 上下文含 periodKpis,不含 analytics 数字字段', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(json).toContain('periodKpis');
    expect(json).not.toContain('topProducts'); // analytics 数字字段不进 prompt
    expect(json).toContain('dataCoverage');
  });

  it('有 period 零交集 → 无数字维度,附 dataCoverage(covered=null)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-11-01', endDate: '2026-11-05' });
    expect(json).not.toContain('periodKpis');
    expect(json).toContain('"covered":null');
  });

  it('无 period → dataGaps 列出缺失维度', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1');
    expect(json).toContain('dataGaps');
  });

  it('SYSTEM_PROMPT 含禁编造规则', () => {
    // SYSTEM_PROMPT 未导出则经 SYSTEM_PROMPT_DISPLAY 断言中文版
    expect(SYSTEM_PROMPT_DISPLAY).toContain('Data Unavailable');
  });
});
```

(注:`SYSTEM_PROMPT` 若未导出,断言改用已导出的 `SYSTEM_PROMPT_DISPLAY`;import 路径按现有测试头部。)

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: FAIL — `Cannot find name 'aiGenerateService'` 或现有 context 仍含 topProducts。

- [ ] **Step 3: 改造 buildCampaignContext(ai-generate.service.ts:694-925 区域)**

3a. import 加 `import { computeCoverage } from './recipe/campaign-report/coverage';`

3b. 替换 `:712-720` 的 analytics 提取段与 `:737` 的 `if (reportPeriod && hasDaily)` 判断为:

```ts
    // ★ 宁缺勿假:daily 是唯一数字真源;analytics blob 不再进 prompt。
    const cov = computeCoverage(campaign, reportPeriod && (reportPeriod.startDate || reportPeriod.endDate)
      ? { start: reportPeriod.startDate, end: reportPeriod.endDate }
      : undefined, campaign.endDate);
    const dataCoverage = {
      requested: { start: reportPeriod?.startDate ?? campaign.startDate, end: reportPeriod?.endDate ?? campaign.endDate },
      ...cov,
    };
    const hasPeriod = !!(reportPeriod && (reportPeriod.startDate || reportPeriod.endDate));
    let dailyTrend: any[] = [];
    let weeklyTrend: any[] = [];
    let topProducts = null, topMarkets = null, insights = null, customerSplit = null;
    // @deprecated analytics 数字字段(trend/weeklyTrend/topProducts/topMarkets/insights/customerSplit)
    // 不再作为 AI 上下文——常过期、与周期不符。需要时序/分布,请导入真实 CPS daily。
```

3c. 现有「period 切片聚合」段(`:737-798`)保留逻辑但入口条件改 `if (hasPeriod && cov.covered)`,并在 `context` 对象(`:809-865`)中:
- 删除 `analytics` 字段与 `...(periodKpis ? ...)` 以外的 analytics 相关注入;
- `dailyTrend`/`weeklyTrend`/`topProducts`/`topMarkets`/`insights`/`customerSplit` 保持上述 null/空初值(不再从 analytics 赋值);
- 顶层追加 `dataCoverage`,及无 period 时的 `dataGaps`:

```ts
    // 无 period 汇总口径:metrics 有什么用什么,缺的维度显式列出
    const dataGaps = hasPeriod ? undefined : [
      'dailyTrend', 'weeklyTrend', 'topProducts', 'topMarkets', 'insights', 'customerSplit',
    ].filter((k) => k !== 'dailyTrend' || !cov.covered);
```

`context` 内:`...(dataCoverage ? { dataCoverage } : {})`、`...(dataGaps ? { dataGaps } : {})`;`campaign.metrics` 保留原样(真实录入字段)。

3d. SYSTEM_PROMPT(`:58` 起)在规则列表末尾(约 `:170` "1. DATA ANALYSIS" 段之前)插入:

```
5. DATA INTEGRITY (hard rule): If the context JSON provides `dataGaps` or a `dataCoverage` with
   `covered: null` or `complete: false`, you MUST render an explicit "Data Unavailable" placeholder
   block for the affected dimensions (grey card, dashed border, label "Data Unavailable"). NEVER
   invent, estimate, or extrapolate any number. If `dataCoverage.covered` is narrower than the
   requested period, display the actual covered date range prominently under the report header.
```

同步在 `EDIT_SYSTEM_PROMPT`(`:468`)与 `SYSTEM_PROMPT_DISPLAY`(`:281` 中文展示版)加对应中文/等价规则(编辑版:"上下文缺失的数字不得虚构,保留现有 Data Unavailable 区块")。

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: PASS(新增 4 例 + 既有 rewriteExternalAssets 8 例)。

- [ ] **Step 5: 类型检查 + 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/tsc --noEmit && cd ../.. && git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts && git commit -m "feat(ai): buildCampaignContext 宁缺勿假——删 analytics 数字喂数,附 dataCoverage/dataGaps + prompt 禁编造规则

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: DataPanel 覆盖提示 + HtmlStudio toast + API 类型(TDD)

**Files:**
- Modify: `apps/web/src/api/htmlTemplates.ts`
- Modify: `apps/web/src/editor/components/recipe-editor/DataPanel.tsx`
- Modify: `apps/web/src/routes/HtmlStudio.tsx`
- Modify: `apps/web/tests/recipe-editor.test.tsx`

- [ ] **Step 1: 写失败测试(recipe-editor.test.tsx 追加)**

```tsx
describe('DataPanel · 宁缺勿假提示', () => {
  it('recompute 返回零覆盖 → 红条(请先导入 CPS daily)', async () => {
    // mock htmlTemplatesApi.recomputeRecipe resolve { versionId: 'v1' } 后 onRecomputed 触发的父级
    // 重载路径中 reportContent 含 dataCoverage.covered=null → DataPanel 收 coverage prop
    render(<DataPanel campaignId="c1" versionId="v1" coverage={{ covered: null, missingDays: 9, complete: false }} onRecomputed={() => {}} />);
    await waitFor(() => expect(screen.getByText(/请先导入 CPS daily/)).toBeTruthy());
  });

  it('coverage 部分覆盖 → 黄条(实际数据区间 + 缺失天数)', async () => {
    render(<DataPanel campaignId="c1" versionId="v1" coverage={{ covered: { start: '2026-10-15', end: '2026-10-20' }, missingDays: 6, complete: false }} onRecomputed={() => {}} />);
    expect(screen.getByText(/实际数据区间 2026-10-15 ~ 2026-10-20,缺 6 天/)).toBeTruthy();
  });

  it('coverage.complete=true → 无提示条', () => {
    render(<DataPanel campaignId="c1" versionId="v1" coverage={{ covered: { start: 'a', end: 'b' }, missingDays: 0, complete: true }} onRecomputed={() => {}} />);
    expect(screen.queryByText(/实际数据区间/)).toBeNull();
    expect(screen.queryByText(/请先导入/)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run tests/recipe-editor.test.tsx`
Expected: FAIL — DataPanel 无 coverage prop。

- [ ] **Step 3: 实现**

3a. `htmlTemplates.ts`:`HtmlVersionDetail.reportContent` 旁加导出类型:

```ts
export interface RecipeDataCoverage {
  requested?: { start: string; end: string };
  covered: { start: string; end: string } | null;
  missingDays: number;
  complete: boolean;
}
```

SSE done chunk 类型(前端消费处,若 done 在 `consumeSSEStream` 事件联合中)加可选 `dataCoverage?: RecipeDataCoverage`。

3b. `DataPanel.tsx`:Props 加 `coverage?: RecipeDataCoverage | null`;在 error `<p>` 之后渲染:

```tsx
      {coverage && !coverage.complete && (
        <p className={`mt-1 rounded px-2 py-1 text-[10px] ${coverage.covered ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
          {coverage.covered
            ? `实际数据区间 ${coverage.covered.start} ~ ${coverage.covered.end},缺 ${coverage.missingDays} 天`
            : '所选周期无数据,请先导入 CPS daily(POST /campaigns/import/cps-daily)'}
        </p>
      )}
```

3c. `RecipeEditor.tsx`:从 `reportContent.dataCoverage` 提取传给 DataPanel(类型断言 `as RecipeDataCoverage | undefined`)。

3d. `HtmlStudio.tsx`:SSE done 处理(现有 consumeSSEStream 回调)加:

```ts
if (doneChunk.dataCoverage && !doneChunk.dataCoverage.complete) {
  toast.error(doneChunk.dataCoverage.covered
    ? `实际数据区间 ${doneChunk.dataCoverage.covered.start} ~ ${doneChunk.dataCoverage.covered.end},缺 ${doneChunk.dataCoverage.missingDays} 天`
    : '所选周期无数据,报告含 Data Unavailable 区块');
}
```

(HtmlStudio 已 import toast。)同时服务端 controller `generateStream`/`editHtmlStream` 的 done chunk 构造处把 `dataCoverage` 从 service 透传(在 Task 4 的 service 改造中让 `generateHtmlStream`/`editHtmlStream` 在 done chunk 附 `dataCoverage`,controller 已直接 `sseWrite(res, chunk)` 无需改)。

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run tests/recipe-editor.test.tsx src/routes/HtmlStudio.test.tsx`
Expected: PASS(新增 3 例 + 既有用例;HtmlStudio 3 例不回归)。

- [ ] **Step 5: 类型检查 + 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force && cd ../.. && git add apps/web/src/api/htmlTemplates.ts apps/web/src/editor/components/recipe-editor/DataPanel.tsx apps/web/src/editor/components/recipe-editor/RecipeEditor.tsx apps/web/src/routes/HtmlStudio.tsx apps/web/tests/recipe-editor.test.tsx && git commit -m "feat(web): DataPanel/HtmlStudio 数据覆盖红黄提示 + SSE done 附 dataCoverage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 删 seed 脚本 + done chunk 附 coverage(server 侧) + 全量验证

**Files:**
- Delete: `apps/server/prisma/seed-cps-daily.ts`
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(done chunk 类型 + 发射处)

- [ ] **Step 1: done chunk 类型与发射**

`ai-generate.service.ts:512` 的 done 类型加 `dataCoverage?: { requested: { start: string; end: string }; covered: { start: string; end: string } | null; missingDays: number; complete: boolean }`;`:1428` 与 `:1540` 两处 `yield { type: 'done', ... }` 时附 service 在本次生成中算得的 `dataCoverage`(generateHtmlStream/editHtmlStream 在开头 buildCampaignContext 处保存该值到局部变量,done 时带上)。

- [ ] **Step 2: 删除 seed 脚本**

```bash
git rm apps/server/prisma/seed-cps-daily.ts
```

检查无其他引用(`grep -rn "seed-cps-daily" apps/ --include='*.ts'` 应只剩 CHANGELOG/spec 的历史记录,不改动)。

- [ ] **Step 3: 全量验证**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/vitest run && ./node_modules/.bin/tsc --noEmit
cd ../web && ./node_modules/.bin/vitest run && ./node_modules/.bin/tsc -b --force
```
Expected: server 全绿(283+ 新增)、web 全绿(842+ 新增)、双 tsc 干净。

- [ ] **Step 4: 提交**

```bash
git add -A apps/server/prisma/seed-cps-daily.ts apps/server/src/modules/html-templates/ai-generate.service.ts && git commit -m "chore(recipe): 删 seed-cps-daily 合成脚本 + done chunk 附 dataCoverage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(`git add -A <file>` 对已 git rm 的删除生效;或直接 `git add apps/server/prisma/seed-cps-daily.ts`。)

- [ ] **Step 5: 手动核对(可选,浏览器)**

1. 有 daily 数据的 campaign → html-studio Recipe 生成 → 改周期重算:部分覆盖时报告头部出现 amber 提示条 + DataPanel 黄条;全覆盖无提示。
2. 无 daily 的 campaign → 生成:报告头部红色提示条,KPI 区"No data for this period"。
3. AI 模式生成一个零覆盖周期:done 后 toast 提示,报告含 Data Unavailable 区块。

---

## Self-Review

- **Spec 覆盖**:§2.1 mapper 单路径+空态+dataCoverage → Task 2;§2.2 AI context → Task 4;§2.3 coverage helper → Task 1;§2.4 prompt 规则 → Task 4;§3.1 DataPanel 提示 → Task 5;§3.2 报告内提示条 → Task 3;§3.3 HtmlStudio toast → Task 5/6;§4 API 契约(dataCoverage 字段/done 事件)→ Task 2(schema)/Task 5(类型)/Task 6(done 发射);§5 清理 seed → Task 6。
- **占位符**:无 TBD;Task 3 Step 1 的 fixture 构造标注「参考该文件现有用例写法」属现场适配,代码骨架完整。
- **类型一致性**:`DailyCoverage`(Task 1)与 schema `dataCoverage`(Task 2)、AI context(Task 4)、前端 `RecipeDataCoverage`(Task 5)字段名一致(covered/missingDays/complete;requested 在 DailyCoverage 外层)。Task 5 DataPanel 的 coverage prop 用 `RecipeDataCoverage`(含可选 requested),测试传参形状一致。
