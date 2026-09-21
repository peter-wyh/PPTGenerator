# 月报迭代（AI 模式）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 模式月报新增三块能力：趋势图上月虚线叠加 + Revenue 峰值高亮与洞察卡；exposure 卡片纯 CSS hover 大图；首屏 Executive Summary 模块（确定性候选 + AI 叙述）。

**Architecture:** 服务端在 `buildCampaignContext` 预计算三块确定性素材（`priorPeriod.dailyTrend` / `trendPeak` / `execSummary`），SYSTEM_PROMPT 增加模块渲染规则与 `priorTrend`/`trendPeak` 命名常量锚定，`template-renderer` 快路径同步改写三常量。数字全部服务端算好，AI 只做挑选与叙述（宁缺勿假契约）。

**Tech Stack:** TypeScript (NestJS-style service modules)、vitest、Chart.js（生成产物）、Handlebars 无关（recipe 模式本次不动）。

**Spec:** `docs/superpowers/specs/2026-09-21-monthly-report-iteration-design.md`

---

## 工程师上下文（执行前必读）

- **仓库**：pnpm monorepo，`apps/server`（`@mediaket/server`）+ `apps/web`。本次全部改动在 `apps/server/src/modules/html-templates/`。
- **命令**（从仓库根 `/Users/ap/Desktop/PPTGenerator` 执行）：
  - 单文件测试：`pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/<file>.test.ts`
  - 全量：`pnpm --filter @mediaket/server test`
  - 类型检查：`pnpm --filter @mediakit/server typecheck`
- **核心哲学「宁缺勿假」**：数字只能来自真源；缺失 → 不注入字段 / 渲染 N/A，绝不编造。所有新派生数字（倍数、份额、环比）在服务端算好。
- **git 约定**：本仓库用户常并行开特性，**建议在 worktree 中执行本计划**（superpowers:using-git-worktrees）；commit 时 `git add <具体文件>` + `git commit` 一条原子命令（IDE 会重置 index）。
- **测试 mock 形态**：`ai-generate.service.test.ts` 顶部 `prismaMock` + `mockCreatorCps(campaignRow)` 把 fixture 的 `cpsPerformances[].daily` 注入 LP/订单 mock；`mockOrderStats(totalRows, creatorRows)` 用 `mockResolvedValueOnce` 两次喂一次 `getRange` 调用。**注意：`getRange` 每次调用消费 2 个 findMany mock**（聚合行 + creator 行）。

## File Structure

- **Create** `apps/server/src/modules/html-templates/report-insights.ts` — 纯函数：前窗解析 / 峰值 / ExecSummary 候选。不查 DB，可独立单测。
- **Create** `apps/server/src/modules/html-templates/report-insights.test.ts`
- **Modify** `apps/server/src/modules/html-templates/ai-generate.service.ts` — context 注入三块 + SYSTEM_PROMPT(EN) + SYSTEM_PROMPT_DISPLAY(CN 镜像) + `getModuleCoverage` 新条目
- **Modify** `apps/server/src/modules/html-templates/ai-generate.service.test.ts` — context 集成测试 + prompt 不变量
- **Modify** `apps/server/src/modules/html-templates/template-renderer.ts` — `extractPeriodData` 产出 `priorTrend`/`trendPeak`；`replaceTrendData` 改写三常量
- **Modify** `apps/server/src/modules/html-templates/template-renderer.test.ts`

---

### Task 1: `report-insights.ts` — resolvePriorWindow + buildTrendPeak + peakDayTopCreator

**Files:**
- Create: `apps/server/src/modules/html-templates/report-insights.test.ts`
- Create: `apps/server/src/modules/html-templates/report-insights.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/html-templates/report-insights.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { buildTrendPeak, peakDayTopCreator, resolvePriorWindow } from './report-insights';

describe('report-insights · resolvePriorWindow', () => {
  it('整自然月（31 天月）→ 上一自然月全月', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-01', endDate: '2026-08-31' }))
      .toEqual({ pStart: '2026-07-01', pEnd: '2026-07-31' });
  });

  it('★30 天月：等长窗口会截断上月（09-01~09-30 等长=08-02 起）→ 修正为 8 月全月', () => {
    expect(resolvePriorWindow({ startDate: '2026-09-01', endDate: '2026-09-30' }))
      .toEqual({ pStart: '2026-08-01', pEnd: '2026-08-31' });
  });

  it('★2 月边 case：3 月整月 → 2 月全月（1-28/29），不截断 1 月', () => {
    expect(resolvePriorWindow({ startDate: '2026-03-01', endDate: '2026-03-31' }))
      .toEqual({ pStart: '2026-02-01', pEnd: '2026-02-28' });
    expect(resolvePriorWindow({ startDate: '2028-03-01', endDate: '2028-03-31' }))
      .toEqual({ pStart: '2028-02-01', pEnd: '2028-02-29' }); // 闰年
  });

  it('★1 月整月 → 上一年 12 月', () => {
    expect(resolvePriorWindow({ startDate: '2026-01-01', endDate: '2026-01-31' }))
      .toEqual({ pStart: '2025-12-01', pEnd: '2025-12-31' });
  });

  it('非整月自定义区间 → 等长前窗口（与现行 MoM 口径一致）', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-05', endDate: '2026-08-10' }))
      .toEqual({ pStart: '2026-07-30', pEnd: '2026-08-04' });
  });

  it('单日区间 → 前一天', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-01', endDate: '2026-08-01' }))
      .toEqual({ pStart: '2026-07-31', pEnd: '2026-07-31' });
  });
});

describe('report-insights · buildTrendPeak', () => {
  const series = [
    { date: '2026-08-01', revenue: 100, orders: 2, clicks: 10 },
    { date: '2026-08-02', revenue: 500, orders: 1, clicks: 5 },
    { date: '2026-08-03', revenue: 300, orders: 3 }, // 无 clicks 字段（clicks 缺源场景）
  ];

  it('峰值日 = revenue 最大日；vsAvgMultiple = 峰值/日均（1 位小数）；clicks 缺省不带', () => {
    expect(buildTrendPeak(series)).toEqual({
      date: '2026-08-02', revenue: 500, orders: 1, vsAvgMultiple: 1.7,
    });
  });

  it('topCreator 传入且 sharePct ≥ 20 → 附带；< 20 → 不附带', () => {
    expect(buildTrendPeak(series, { topCreator: { name: 'Mia', sharePct: 55 } }))
      .toMatchObject({ topCreator: { name: 'Mia', sharePct: 55 } });
    expect(buildTrendPeak(series, { topCreator: { name: 'Mia', sharePct: 10 } }))
      .not.toHaveProperty('topCreator');
  });

  it('空序列 / revenue 全 0 → null（宁缺勿假）', () => {
    expect(buildTrendPeak([])).toBeNull();
    expect(buildTrendPeak([{ date: '2026-08-01', revenue: 0, orders: 0 }])).toBeNull();
  });
});

describe('report-insights · peakDayTopCreator', () => {
  const byCreatorDaily = [
    { name: 'Mia', daily: new Map([['2026-08-02', 300], ['2026-08-01', 100]]) },
    { name: 'Leo', daily: new Map([['2026-08-02', 200]]) },
  ];

  it('峰日 gmv 最大达人 + 份额（1 位小数）', () => {
    expect(peakDayTopCreator(byCreatorDaily, '2026-08-02')).toEqual({ name: 'Mia', sharePct: 60 });
  });

  it('峰日无数据 / 全 0 → null', () => {
    expect(peakDayTopCreator(byCreatorDaily, '2026-08-05')).toBeNull();
    expect(peakDayTopCreator([{ name: 'X', daily: new Map([['2026-08-02', 0]]) }], '2026-08-02')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/html-templates/report-insights.test.ts`
Expected: FAIL（模块不存在，import 报错）

- [ ] **Step 3: 实现模块**

创建 `apps/server/src/modules/html-templates/report-insights.ts`：

```ts
// report-insights.ts
// ★ 0921 月报迭代（spec docs/superpowers/specs/2026-09-21-monthly-report-iteration-design.md）：
//   趋势对比前窗 / 峰值 / Executive Summary 候选的确定性派生——纯函数，不查 DB。
//   契约：数字全部在此算好注入 AI 上下文，AI 只做挑选与叙述（narrative.ts 同哲学，宁缺勿假）。

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  clicks?: number;
}

export interface TrendPeak {
  date: string;
  revenue: number;
  orders: number;
  clicks?: number;
  /** 峰日 revenue ÷ 期内日均（数据日口径），1 位小数 */
  vsAvgMultiple: number;
  /** 峰日贡献最大达人（gmv 口径）；仅非中间层路径可导出（口径门控见 spec §1.2） */
  topCreator?: { name: string; sharePct: number };
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoUtc = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/**
 * 前期窗口解析（spec §1.1）：
 * - 报告期 = 整自然月（start=当月1日 且 end=当月最后一天）→ 上一自然月全月。
 *   （等长前窗口在 30/28 天月会截断上月——如 9 月报等长窗口从 8/2 起，故整月改自然月口径。）
 * - 否则 → 等长前窗口（与 buildCampaignContext 现行 MoM 口径保持兼容）。
 * UTC 算术，与现行 `new Date('YYYY-MM-DD')` + `toISOString()` 约定一致。
 */
export function resolvePriorWindow(period: { startDate: string; endDate: string }): { pStart: string; pEnd: string } {
  const dayMs = 86_400_000;
  const s = new Date(period.startDate);
  const e = new Date(period.endDate);
  const sY = s.getUTCFullYear(), sM = s.getUTCMonth(), sD = s.getUTCDate();
  const lastDay = new Date(Date.UTC(sY, sM + 1, 0)).getUTCDate();
  if (sD === 1 && e.getUTCFullYear() === sY && e.getUTCMonth() === sM && e.getUTCDate() === lastDay) {
    const py = sM === 0 ? sY - 1 : sY;
    const pm = sM === 0 ? 11 : sM - 1;
    const pLast = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
    return { pStart: isoUtc(py, pm, 1), pEnd: isoUtc(py, pm, pLast) };
  }
  const len = Math.max(e.getTime() - s.getTime() + dayMs, dayMs);
  return {
    pStart: new Date(s.getTime() - len).toISOString().slice(0, 10),
    pEnd: new Date(s.getTime() - dayMs).toISOString().slice(0, 10),
  };
}

/** 峰值事实（spec §1.2）：series 的 revenue 最大日。空序列 / revenue 全 0 → null。 */
export function buildTrendPeak(
  series: DailyPoint[],
  opts?: { topCreator?: { name: string; sharePct: number } | null },
): TrendPeak | null {
  if (!series.length) return null;
  let peakIdx = -1;
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].revenue;
    if (peakIdx < 0 || series[i].revenue > series[peakIdx].revenue) peakIdx = i;
  }
  const peak = series[peakIdx];
  if (peak.revenue <= 0) return null;
  const avg = sum / series.length;
  const out: TrendPeak = {
    date: peak.date,
    revenue: Math.round(peak.revenue * 100) / 100,
    orders: peak.orders,
    ...(peak.clicks !== undefined ? { clicks: peak.clicks } : {}),
    vsAvgMultiple: Math.round((peak.revenue / avg) * 10) / 10,
  };
  // 份额 < 20% 的"峰日最大达人"无叙事价值 → 不注入（与 execSummary topCreator 同阈值）
  if (opts?.topCreator && opts.topCreator.sharePct >= 20) out.topCreator = opts.topCreator;
  return out;
}

/**
 * 峰日贡献最大达人（spec §1.2 口径门控）：share = 该达人峰日 gmv ÷ 全 campaign 峰日 gmv。
 * 仅非中间层路径调用（OrderDailyStat 无「达人×日」维度，commission 与 gmv 口径不符——宁缺勿假）。
 */
export function peakDayTopCreator(
  byCreatorDaily: { name: string; daily: Map<string, number> }[],
  peakDate: string,
): { name: string; sharePct: number } | null {
  const campaignGmv = byCreatorDaily.reduce((s, c) => s + (c.daily.get(peakDate) ?? 0), 0);
  if (campaignGmv <= 0) return null;
  let top: { name: string; gmv: number } | null = null;
  for (const c of byCreatorDaily) {
    const g = c.daily.get(peakDate) ?? 0;
    if (!top || g > top.gmv) top = { name: c.name, gmv };
  }
  if (!top || top.gmv <= 0) return null;
  return { name: top.name, sharePct: Math.round((top.gmv / campaignGmv) * 1000) / 10 };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/report-insights.test.ts`
Expected: PASS（17 个用例）

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/report-insights.ts apps/server/src/modules/html-templates/report-insights.test.ts && git commit -m "feat(server): report-insights 纯函数——前窗解析(自然月修正)/峰值事实/峰日达人归因"
```

---

### Task 2: `report-insights.ts` — buildExecSummary（候选事实块）

**Files:**
- Modify: `apps/server/src/modules/html-templates/report-insights.test.ts`
- Modify: `apps/server/src/modules/html-templates/report-insights.ts`

- [ ] **Step 1: 追加失败测试**

在 `report-insights.test.ts` 末尾追加：

```ts
import { buildExecSummary } from './report-insights';

describe('report-insights · buildExecSummary', () => {
  const creators = [
    { name: 'Mia', platform: 'Instagram', clicks: 4000, orders: 179, gmv: 1600 },
    { name: 'Leo', platform: 'TikTok', clicks: 2000, orders: 50, gmv: 600 },
    { name: 'Ash', platform: 'Instagram', clicks: 1000, orders: 30, gmv: 400 },
  ];
  const trendPeak = { date: '2026-08-14', revenue: 820, orders: 9, clicks: 120, vsAvgMultiple: 3.2 };

  it('MoM 正增长(≥+5%)入 highlights；负增长(≤-5%)入 concerns；|pct|<5 不立候选', () => {
    const out = buildExecSummary({
      creators,
      current: { revenue: 5800, orders: 1100, clicks: 34600 },
      prior: { revenue: 4770, orders: 904, clicks: 10400 },
      trendPeak,
      newCustomers: { count: 380, orders: 1100 },
      pendingOrders: 809,
    })!;
    const revMoM = out.highlights.find((h) => h.key === 'revenueMoM')!;
    expect(revMoM.value).toBe('+21.6%');
    expect(out.highlights.some((h) => h.key === 'ordersMoM')).toBe(true);
    expect(out.concerns.some((c) => c.key === 'decliningClicks')).toBe(true); // clicks 环比大跌
  });

  it('topCreator 份额≥20% / topPlatform 份额≥30% / peakDay / newCustomerRate 候选', () => {
    const out = buildExecSummary({ creators, current: undefined, prior: undefined, trendPeak, newCustomers: { count: 380, orders: 1100 } })!;
    expect(out.highlights.find((h) => h.key === 'topCreator')).toMatchObject({ value: '62% of GMV' });
    expect(out.highlights.find((h) => h.key === 'topPlatform')).toMatchObject({ value: '71% of clicks' });
    expect(out.highlights.find((h) => h.key === 'peakDay')).toMatchObject({ value: '$820 on Aug 14' });
    expect(out.highlights.find((h) => h.key === 'newCustomerRate')).toMatchObject({ value: '34.5%' });
  });

  it('集中度：≥3 活跃达人且 top 份额≥50% → concern', () => {
    const out = buildExecSummary({ creators, trendPeak })!;
    expect(out.concerns.some((c) => c.key === 'concentration')).toBe(true); // 62% ≥ 50%
  });

  it('pendingOrders>0 / dataGaps / caliberCoverage<80 → concerns；clicks 缺源(null) 不产生 MoM 候选', () => {
    const out = buildExecSummary({
      creators, trendPeak,
      current: { revenue: 5800, orders: 1100, clicks: null },
      prior: { revenue: 4770, orders: 904, clicks: null },
      pendingOrders: 809, dataGaps: ['clicks', 'newCustomers'], caliberCoveragePct: 1.8,
    })!;
    expect(out.concerns.find((c) => c.key === 'pendingOrders')).toMatchObject({ value: '809' });
    expect(out.concerns.find((c) => c.key === 'dataGaps')).toMatchObject({ value: 'clicks, newCustomers' });
    expect(out.concerns.find((c) => c.key === 'caliberCoverage')).toMatchObject({ value: '1.8% of tracked orders' });
    expect(out.concerns.some((c) => c.key === 'decliningClicks')).toBe(false);
  });

  it('全空输入 → null（AI 渲染空态卡）', () => {
    expect(buildExecSummary({ creators: [], trendPeak: null })).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/report-insights.test.ts`
Expected: FAIL（buildExecSummary 未导出）

- [ ] **Step 3: 实现 buildExecSummary**

在 `report-insights.ts` 末尾追加：

```ts
export interface ExecCandidate {
  key: string;
  label: string;
  /** 格式化好的锚定值（如 "+21.6%" / "28% of GMV"）——AI 只能复制，不能重算 */
  value: string;
  detail: string;
}

export interface ExecSummaryInput {
  /** 期内 per-creator 聚合（gmv 口径与 periodKpis 一致——中间层路径由调用方换 commission） */
  creators: Array<{ name: string; platform: string | null; clicks: number; orders: number; gmv: number }>;
  current?: { revenue: number; orders: number; clicks: number | null };
  prior?: { revenue: number; orders: number; clicks: number | null };
  trendPeak: TrendPeak | null;
  pendingOrders?: number;
  /** 新客率分子分母（hasNewCustomerTag=false 时不传） */
  newCustomers?: { count: number; orders: number };
  dataGaps?: string[];
  /** 订单表覆盖度 %（<80 且有口径提示时传） */
  caliberCoveragePct?: number | null;
}

const fmtNumL = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const fmtMoneyL = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)}`;
const pctNum = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 1000) / 10;
const pctStr = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

/**
 * Executive Summary 候选块（spec §1.3）：确定性预计算，AI 只挑选 2-3 highlights + 1 concern。
 * 候选有数据才出现；highlights 与 concerns 双空 → 返回 null（AI 渲染空态卡）。
 */
export function buildExecSummary(input: ExecSummaryInput): { highlights: ExecCandidate[]; concerns: ExecCandidate[] } | null {
  const highlights: ExecCandidate[] = [];
  const concerns: ExecCandidate[] = [];

  // ── MoM（|pct| ≥ 5 才立候选；正→highlight，负→concern）──
  if (input.current && input.prior) {
    if (input.prior.revenue > 0 && input.current.revenue > 0) {
      const p = pctNum(input.current.revenue, input.prior.revenue);
      const detail = `${fmtMoneyL(input.current.revenue)} this month vs ${fmtMoneyL(input.prior.revenue)} last month`;
      if (p >= 5) highlights.push({ key: 'revenueMoM', label: 'Revenue MoM', value: pctStr(p), detail });
      if (p <= -5) concerns.push({ key: 'decliningRevenue', label: 'Revenue MoM', value: pctStr(p), detail });
    }
    if (input.prior.orders > 0 && input.current.orders > 0) {
      const p = pctNum(input.current.orders, input.prior.orders);
      const detail = `${fmtNumL(input.current.orders)} orders this month vs ${fmtNumL(input.prior.orders)} last month`;
      if (p >= 5) highlights.push({ key: 'ordersMoM', label: 'Orders MoM', value: pctStr(p), detail });
      if (p <= -5) concerns.push({ key: 'decliningOrders', label: 'Orders MoM', value: pctStr(p), detail });
    }
    if (
      input.current.clicks !== null && input.prior.clicks !== null &&
      input.prior.clicks > 0 && input.current.clicks > 0
    ) {
      const p = pctNum(input.current.clicks, input.prior.clicks);
      if (p <= -5) {
        concerns.push({
          key: 'decliningClicks', label: 'Clicks MoM', value: pctStr(p),
          detail: `${fmtNumL(input.current.clicks)} this month vs ${fmtNumL(input.prior.clicks)} last month`,
        });
      }
    }
  }

  // ── 期内达人 / 渠道份额 ──
  const totalGmv = input.creators.reduce((s, c) => s + c.gmv, 0);
  const totalClicks = input.creators.reduce((s, c) => s + c.clicks, 0);
  const active = input.creators.filter((c) => c.gmv > 0 || c.orders > 0 || c.clicks > 0);
  let topCreator: { name: string; share: number } | null = null;
  if (totalGmv > 0) {
    for (const c of input.creators) {
      const share = c.gmv / totalGmv;
      if (!topCreator || share > topCreator.share) topCreator = { name: c.name, share };
    }
    if (topCreator && topCreator.share >= 0.2) {
      const c = input.creators.find((x) => x.name === topCreator!.name)!;
      highlights.push({
        key: 'topCreator', label: 'Top Creator',
        value: `${Math.round(topCreator.share * 100)}% of GMV`,
        detail: `${c.name} — ${fmtMoneyL(c.gmv)} GMV, ${fmtNumL(c.orders)} orders`,
      });
    }
    // 集中度（≥3 活跃达人且 top 份额 ≥ 50%）
    if (active.length >= 3 && topCreator && topCreator.share >= 0.5) {
      concerns.push({
        key: 'concentration', label: 'Creator Concentration',
        value: `${Math.round(topCreator.share * 100)}% of GMV`,
        detail: `top creator of ${active.length} active creators`,
      });
    }
  }
  // topPlatform：clicks 口径优先；无 clicks（全 0）降级 gmv 口径
  if (totalClicks > 0 || totalGmv > 0) {
    const useClicks = totalClicks > 0;
    const byPlat = new Map<string, number>();
    for (const c of input.creators) {
      if (!c.platform) continue;
      byPlat.set(c.platform, (byPlat.get(c.platform) ?? 0) + (useClicks ? c.clicks : c.gmv));
    }
    const denom = useClicks ? totalClicks : totalGmv;
    const unit = useClicks ? 'clicks' : 'GMV';
    let topPlat: { name: string; v: number } | null = null;
    for (const [name, v] of byPlat) if (!topPlat || v > topPlat.v) topPlat = { name, v };
    if (topPlat && topPlat.v / denom >= 0.3) {
      highlights.push({
        key: 'topPlatform', label: 'Top Channel',
        value: `${Math.round((topPlat.v / denom) * 100)}% of ${unit}`,
        detail: `${topPlat.name} — ${fmtNumL(topPlat.v)} of ${fmtNumL(denom)} ${unit}`,
      });
    }
  }

  // ── 峰值日 ──
  if (input.trendPeak) {
    const label = new Date(input.trendPeak.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    highlights.push({
      key: 'peakDay', label: 'Peak Day',
      value: `${fmtMoneyL(input.trendPeak.revenue)} on ${label}`,
      detail: `${input.trendPeak.vsAvgMultiple}× the daily average`,
    });
  }

  // ── 新客率 ──
  if (input.newCustomers && input.newCustomers.orders > 0 && input.newCustomers.count > 0) {
    highlights.push({
      key: 'newCustomerRate', label: 'New-Customer Rate',
      value: `${Math.round((input.newCustomers.count / input.newCustomers.orders) * 1000) / 10}%`,
      detail: `${fmtNumL(input.newCustomers.count)} new customers across ${fmtNumL(input.newCustomers.orders)} orders`,
    });
  }

  // ── pending orders ──
  if (input.pendingOrders && input.pendingOrders > 0) {
    concerns.push({ key: 'pendingOrders', label: 'Pending Orders', value: fmtNumL(input.pendingOrders), detail: 'awaiting approval in the order table' });
  }

  // ── 数据缺口 ──
  if (input.dataGaps && input.dataGaps.length) {
    concerns.push({ key: 'dataGaps', label: 'Data Gaps', value: input.dataGaps.join(', '), detail: 'no source data — shown as N/A in this report' });
  }

  // ── 订单表口径覆盖度 ──
  if (input.caliberCoveragePct !== null && input.caliberCoveragePct !== undefined && input.caliberCoveragePct < 80) {
    concerns.push({
      key: 'caliberCoverage', label: 'Order-Table Coverage',
      value: `${input.caliberCoveragePct.toFixed(1)}% of tracked orders`,
      detail: 'order table covers only part of tracked orders — KPI caliber noted in report',
    });
  }

  if (!highlights.length && !concerns.length) return null;
  return { highlights, concerns };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/report-insights.test.ts`
Expected: PASS

手工核对一个数值（测试已内置）：`current.revenue=5800, prior.revenue=4770` → `(5800-4770)/4770 = +21.59%` → 四舍五入 `+21.6%` ✓；`Mia gmv=1600/2600=61.5%` → `62% of GMV` ✓；Instagram clicks `(4000+1000)/7000=71.4%` → `71% of clicks` ✓；`380/1100=34.54%` → `34.5%` ✓。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/report-insights.ts apps/server/src/modules/html-templates/report-insights.test.ts && git commit -m "feat(server): buildExecSummary 确定性候选块——MoM/达人/渠道/峰值/新客 highlight + pending/下滑/集中度/缺口/口径 concern"
```

---

### Task 3: `ai-generate.service.ts` — 自然月前窗 + `priorPeriod.dailyTrend` + `trendPeak` 注入

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`（`buildCampaignContext`，~L1386-1451 前期窗口块；~L1372-1384 dailyTrend 块后；~L1202 声明区）
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `ai-generate.service.test.ts` 的 `describe('ai-generate.service · buildCampaignContext 订单中间层口径')` 之后新增 describe：

```ts
describe('ai-generate.service · buildCampaignContext 0921 月报迭代（前窗/上月序列/峰值）', () => {
  beforeEach(() => vi.clearAllMocks());

  /** LP 路径 fixture：8 月两天 + 7 月一天，Mia 单达人。$queryRaw 清空 → 强制非中间层路径。 */
  function monthCampLp() {
    return {
      id: 'c9', name: 'MR', platform: 'Instagram', startDate: '2026-07-01', endDate: '2026-08-31',
      budget: 1, status: 'x', businessLineCode: 'FT', metrics: { clicks: 1 },
      analytics: null, businessLine: { title: 'FT' }, advertiser: { name: 'A' },
      campaignCreators: [{
        creator: { name: 'Mia', platform: 'Instagram', partnerType: 'creator' },
        cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
          daily: [
            { date: '2026-08-01', clicks: '10', orders: '2', gmv: '100', impressions: '0', spend: '0', commission: '100', newCustomers: '1' },
            { date: '2026-08-02', clicks: '5', orders: '1', gmv: '500', impressions: '0', spend: '0', commission: '500', newCustomers: '0' },
            { date: '2026-07-05', clicks: '4', orders: '1', gmv: '50', impressions: '0', spend: '0', commission: '50', newCustomers: '0' },
          ] }],
        performance: { summary: {} },
      }],
    };
  }

  it('★整自然月 → 前窗=上一自然月全月（period 字符串证明）+ 上月日级序列注入', async () => {
    const camp = monthCampLp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.$queryRaw.mockResolvedValue([]); // 无订单行 → LP 路径
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    // 8 月整月 → 7 月全月（等长窗口也是 7/1-7/31，但此断言锁定口径不被回归破坏）
    expect(json).toContain('"period": "2026-07-01 ~ 2026-07-31"');
    // 上月序列：7/5 一天，LP 口径 gmv=50 orders=1 clicks=4
    expect(json).toContain('"priorPeriod"');
    expect(json).toMatch(/"dailyTrend": \[\{[^]*?"date": "2026-07-05"[^]*?"revenue": 50[^]*?"clicks": 4/s);
  });

  it('★30 天月不再截断上月：9 月整月 → 前窗 8 月全月（8/1 起）', async () => {
    const camp = { ...monthCampLp() } as any;
    camp.campaignCreators = [{
      creator: { name: 'Mia', platform: 'Instagram', partnerType: 'creator' },
      cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
        daily: [
          { date: '2026-09-01', clicks: '10', orders: '2', gmv: '100', impressions: '0', spend: '0', commission: '100', newCustomers: '0' },
          { date: '2026-08-01', clicks: '4', orders: '1', gmv: '50', impressions: '0', spend: '0', commission: '50', newCustomers: '0' },
        ] }],
      performance: { summary: {} },
    }];
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.$queryRaw.mockResolvedValue([]);
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-09-01', endDate: '2026-09-30' });
    // 旧等长口径会是 "2026-08-02 ~ 2026-08-31"（截断 8/1）——修正后为 8 月全月
    expect(json).toContain('"period": "2026-08-01 ~ 2026-08-31"');
  });

  it('★LP 路径 trendPeak：峰值日 + vsAvgMultiple + 峰日达人归因', async () => {
    const camp = monthCampLp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.$queryRaw.mockResolvedValue([]);
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(json).toContain('"trendPeak"');
    expect(json).toContain('"date": "2026-08-02"');
    expect(json).toContain('"vsAvgMultiple": 1.7'); // 500 / ((100+500)/2)
    expect(json).toContain('"topCreator"');          // LP 路径可归因（Mia 100% ≥ 20%）
    expect(json).toContain('"name": "Mia"');
  });

  it('★中间层路径 trendPeak 无 topCreator（口径门控）+ 上月序列走订单表', async () => {
    const camp = monthCampLp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    // getRange 调两次（主周期 + 前期窗口），每次消费 2 个 findMany（聚合行 → creator 行）
    prismaMock.orderDailyStat.findMany
      .mockResolvedValueOnce([
        { statDate: '2026-08-01', campaignCreatorId: '', totalOrders: 2, approvedOrders: 2, pendingOrders: 0, otherOrders: 0, totalCommission: dec('100.00'), approvedCommission: dec('100.00'), pendingCommission: dec('0.00'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [], topDevices: [] },
        { statDate: '2026-08-02', campaignCreatorId: '', totalOrders: 1, approvedOrders: 1, pendingOrders: 0, otherOrders: 0, totalCommission: dec('500.00'), approvedCommission: dec('500.00'), pendingCommission: dec('0.00'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [], topDevices: [] },
      ])
      .mockResolvedValueOnce([
        { statDate: '2026-08-02', campaignCreatorId: 'cc_0', totalOrders: 1, approvedOrders: 1, pendingOrders: 0, otherOrders: 0, totalCommission: dec('500.00'), approvedCommission: dec('500.00'), pendingCommission: dec('0.00'), newCustomerOrders: 0, hasNewCustomerTag: false },
      ])
      .mockResolvedValueOnce([
        { statDate: '2026-07-05', campaignCreatorId: '', totalOrders: 1, approvedOrders: 1, pendingOrders: 0, otherOrders: 0, totalCommission: dec('50.00'), approvedCommission: dec('50.00'), pendingCommission: dec('0.00'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [], topDevices: [] },
      ])
      .mockResolvedValueOnce([]);
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    // trendPeak 存在但无 topCreator（OrderDailyStat 无达人×日维度）
    expect(json).toContain('"trendPeak"');
    expect(json).not.toContain('"topCreator"');
    // 上月序列 revenue/orders 走订单表口径（7/5 commission=50）
    expect(json).toMatch(/"priorPeriod"[\s\S]*?"dailyTrend": \[\{[^]*?"date": "2026-07-05"[^]*?"revenue": 50/s);
  });

  it('前窗无数据 → priorPeriod 不注入（现状回归保障）', async () => {
    const camp = monthCampLp();
    camp.campaignCreators[0].cpsPerformances[0].daily = camp.campaignCreators[0].cpsPerformances[0].daily.filter((d: any) => d.date >= '2026-08-01');
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.$queryRaw.mockResolvedValue([]);
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(json).not.toContain('"priorPeriod"');
    expect(json).toContain('"trendPeak"'); // 当期峰值与上月无关
  });
});
```

注意：`dec` helper 已存在于订单中间层 describe（L322）；若作用域不可见，把 `const dec = (v: string) => ({ toString: () => v, toNumber: () => Number(v) });` 复制进新 describe。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: FAIL（无 `"priorPeriod"` 的 `dailyTrend` 字段、无 `"trendPeak"`、9 月 period 是 `"2026-08-02 ~ 2026-08-31"`）

- [ ] **Step 3: 实现服务端改动**

**3a. 顶部 import**（与现有 `cps-source` 等 import 并列）：

```ts
import { buildExecSummary, buildTrendPeak, peakDayTopCreator, resolvePriorWindow, type TrendPeak } from './report-insights';
```

**3b. 声明区**（`let priorPeriod:` 声明块之后，~L1207）追加：

```ts
    // ★ 0921 月报迭代：峰值事实（趋势最高日）——AI 只叙述不计算
    let trendPeak: TrendPeak | null = null;
```

**3c. `caliberAdvisory` 声明（~L1191）后追加**：

```ts
    let caliberCoveragePct: number | null = null; // ★ 0921：订单表覆盖度 %（ExecSummary concern 候选）
```

并在 `caliberAdvisory = lpAgg ? coverageAdvisory(...)` 赋值行（~L1298）后追加：

```ts
        if (lpAgg) caliberCoveragePct = (orderStats.totals.orders / lpAgg.orders) * 100;
```

**3d. dailyTrend 构建完（`if (orderStats) {...} else {...}` 的 else 分支闭合后、`// ── 缺口① MoM 环比` 注释前，~L1385）插入**：

```ts
      // ★ 0921 峰值事实（spec §1.2）：与 dailyTrend 同序列同口径（中间层=commission，非中间层=gmv）。
      //   中间层路径无「达人×日」维度 → 不归因 topCreator（宁缺勿假，prompt 约束 AI 不提达人）。
      if (dailyTrend && dailyTrend.length) {
        let topCreator: { name: string; sharePct: number } | null = null;
        if (!orderStats && cpsSource) {
          const peakDate = (dailyTrend as any[]).reduce((a, b) => (b.revenue > a.revenue ? b : a)).date;
          const byCreatorDaily = campaign.campaignCreators.map((cc: any) => {
            const daily = cpsSource.byCc.get(cc.id)?.daily;
            return {
              name: cc.creator?.name ?? 'Unknown',
              daily: new Map([...(daily ?? [])].map(([d, c]: [string, any]) => [d, c.gmv])),
            };
          });
          topCreator = peakDayTopCreator(byCreatorDaily, peakDate);
        }
        trendPeak = buildTrendPeak(dailyTrend as any[], topCreator ? { topCreator } : undefined);
      }
```

**3e. 前期窗口块改造**。将（~L1386-1394）：

```ts
      // ── 缺口① MoM 环比：前一期 = 报告周期往前推同样长度（宁缺勿假：前一期无数据不注入）──
      if (reportPeriod?.startDate && reportPeriod.endDate) {
        const dayMs = 86_400_000;
        const s = new Date(reportPeriod.startDate).getTime();
        const e = new Date(reportPeriod.endDate).getTime();
        const len = Math.max(e - s + dayMs, dayMs);
        const pStart = new Date(s - len).toISOString().slice(0, 10);
        const pEnd = new Date(s - dayMs).toISOString().slice(0, 10);
        const inPrior = (d: string) => d >= pStart && d <= pEnd;
```

替换为：

```ts
      // ── 缺口① MoM 环比：前一期窗口（宁缺勿假：前一期无数据不注入）──
      //   ★ 0921 月报迭代：整自然月报告 → 上一自然月全月（等长窗口在 30/28 天月会截断上月）；
      //   非整月区间保持等长前窗口（历史口径兼容）。
      if (reportPeriod?.startDate && reportPeriod.endDate) {
        const { pStart, pEnd } = resolvePriorWindow({ startDate: reportPeriod.startDate, endDate: reportPeriod.endDate });
        const inPrior = (d: string) => d >= pStart && d <= pEnd;
```

**3f. 前期扫描循环加按日聚合**。将（~L1399-1405）：

```ts
        for (const [, e] of cpsSource.byCc) {
          for (const [date, cell] of e.daily) {
            if (!inPrior(date)) continue;
            pt.clicks += cell.clicks; pt.orders += cell.orders; pt.gmv += cell.gmv;
            pt.newCustomers += cell.newCustomers; priorDays++;
          }
        }
```

替换为：

```ts
        // ★ 0921：前窗按日聚合（上月序列 + 中间层路径 clicks 并集日期）
        const priorByDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
        for (const [, e] of cpsSource.byCc) {
          for (const [date, cell] of e.daily) {
            if (!inPrior(date)) continue;
            pt.clicks += cell.clicks; pt.orders += cell.orders; pt.gmv += cell.gmv;
            pt.newCustomers += cell.newCustomers; priorDays++;
            const entry = priorByDate.get(date) ?? { revenue: 0, clicks: 0, orders: 0 };
            entry.revenue += cell.gmv; entry.clicks += cell.clicks; entry.orders += cell.orders;
            priorByDate.set(date, entry);
          }
        }
```

**3g. `priorPeriod` 赋值块**。在 `if (hasPrior) {` 内、`priorPeriod = {` 之前插入：

```ts
          // ★ 0921 上月日级序列（spec §1.1）：中间层 → revenue/orders=订单表日值 ∪ clicks=daily 前窗；
          //   非中间层 → cpsSource 前窗切片（gmv 口径）。宁缺勿假：clicks 无日级源不带字段。
          const priorDailyTrend: { date: string; revenue: number; orders: number; clicks?: number }[] = priorOrderStats
            ? [...new Set([
                ...priorOrderStats.days.map((d) => d.date),
                ...(clicksKeySeen ? [...priorByDate.keys()] : []),
              ])].sort().map((d) => {
                const od = priorOrderStats!.days.find((x) => x.date === d);
                return {
                  date: d,
                  revenue: od?.commission ?? 0,
                  orders: od?.orders ?? 0,
                  ...(clicksKeySeen ? { clicks: priorByDate.get(d)?.clicks ?? 0 } : {}),
                };
              })
            : [...priorByDate.keys()].sort().map((d) => {
                const e2 = priorByDate.get(d)!;
                return { date: d, revenue: e2.revenue, orders: e2.orders, ...(clicksKeySeen ? { clicks: e2.clicks } : {}) };
              });
```

并把对象字面量末尾（`mom: { ... },` 之后、闭合 `};` 之前）追加：

```ts
            ...(priorDailyTrend.length ? { dailyTrend: priorDailyTrend } : {}),
```

**3h. context 注入**（`...(priorPeriod ? { priorPeriod } : {}),` 行 ~L1799 之后）：

```ts
      // ★ 0921 峰值事实：趋势最高日 + vs 日均倍数（口径可导出时含峰日达人）。AI 只叙述。
      ...(trendPeak ? { trendPeak } : {}),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: PASS（含既有全部用例——`periodKpis`/中间层等不回归）

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts && git commit -m "feat(server): 上月趋势对比数据层——自然月前窗+priorPeriod.dailyTrend+trendPeak 注入 AI 上下文"
```

---

### Task 4: `ai-generate.service.ts` — `execSummary` 注入 + 覆盖清单条目

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`（`const context = {` 前 ~L1676；context 注入区；`getModuleCoverage` ~L1069）
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 Task 3 的 describe 内追加用例：

```ts
  it('★execSummary 注入：topCreator/topPlatform/peakDay 候选 + dataGaps concern', async () => {
    const camp = monthCampLp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.$queryRaw.mockResolvedValue([]);
    const json = await aiGenerateService.buildCampaignContext('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(json).toContain('"execSummary"');
    expect(json).toContain('"highlights"');
    expect(json).toContain('"key": "topCreator"');   // Mia 期内 gmv 600 全部 → 100% ≥ 20%
    expect(json).toContain('"key": "topPlatform"');  // Instagram 100% ≥ 30%
    expect(json).toContain('"key": "peakDay"');
    expect(json).toContain('"concerns"');
  });

  it('★getModuleCoverage 含 execSummary 条目', async () => {
    const camp = monthCampLp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.orderDailyStat.findMany.mockResolvedValue([]);
    const res = await aiGenerateService.getModuleCoverage('c9', { startDate: '2026-08-01', endDate: '2026-08-31' });
    const entry = res?.modules.find((m) => m.key === 'execSummary');
    expect(entry?.status).toBe('ok');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: FAIL（无 `"execSummary"`、覆盖清单无该 key）

- [ ] **Step 3: 实现**

**4a. `execSummary` 计算**——`buildCampaignContext` 内、`const context = {`（~L1676）之前插入：

```ts
    // ★ 0921 Executive Summary 候选（spec §1.3）：全部确定性预计算，AI 只挑选与叙述。
    //   creators 口径与 periodKpis 一致：中间层路径 gmv 换 commission（与下方 creators 上下文同款覆盖）。
    const execCreators = (hasPeriod && cov.covered
      ? campaign.campaignCreators.map((cc: any) => {
          const s = perCreatorSums.get(cc.id) ?? { clicks: 0, gmv: 0, orders: 0 };
          const oc = orderStats?.byCreator.get(cc.id);
          return {
            name: cc.creator?.name ?? 'Unknown',
            platform: cc.creator?.platform ?? null,
            clicks: s.clicks,
            orders: oc ? oc.orders : s.orders,
            gmv: oc ? oc.commission : s.gmv,
          };
        })
      : // 汇总口径（无 period / 未覆盖）→ 聚合列候选（无 MoM/峰值/pending）
        campaign.campaignCreators.map((cc: any) => {
          const e = syncSource?.byCc.get(cc.id);
          return {
            name: cc.creator?.name ?? 'Unknown',
            platform: cc.creator?.platform ?? null,
            clicks: e?.clicks ?? 0,
            orders: e?.orders ?? 0,
            gmv: e?.gmv ?? 0,
          };
        })
    );
    const execCurrent = priorPeriod
      ? {
          revenue: orderStats ? orderStats.totals.commission : total.gmv,
          orders: orderStats ? orderStats.totals.orders : total.orders,
          clicks: (clicksKeySeen || clicksFallback) ? total.clicks : null,
        }
      : undefined;
    const execPrior = priorPeriod
      ? {
          revenue: priorPeriod.priorKpis.revenues,
          orders: priorPeriod.priorKpis.orders,
          clicks: priorPeriod.priorKpis.clicks >= 0 ? priorPeriod.priorKpis.clicks : null, // -1 = 概念不适用
        }
      : undefined;
    const execSummary = buildExecSummary({
      creators: execCreators,
      ...(execCurrent ? { current: execCurrent } : {}),
      ...(execPrior ? { prior: execPrior } : {}),
      trendPeak,
      ...(orderStats?.totals.pendingOrders ? { pendingOrders: orderStats.totals.pendingOrders } : {}),
      ...(orderStats?.totals.hasNewCustomerTag
        ? { newCustomers: { count: orderStats.totals.newCustomers, orders: orderStats.totals.orders } }
        : (!orderStats && total.orders > 0 && total.newCustomers > 0
            ? { newCustomers: { count: total.newCustomers, orders: total.orders } }
            : {})),
      ...(periodDataGaps.length ? { dataGaps: [...periodDataGaps] } : {}),
      ...(caliberCoveragePct !== null ? { caliberCoveragePct } : {}),
    });
```

（`syncSource` 变量已存在于该作用域——`const allMediaCps = syncSource;` 在 ~L1610。）

**4b. context 注入**——`...(trendPeak ? { trendPeak } : {}),` 之后追加：

```ts
      // ★ 0921 Executive Summary 候选块：highlights/concerns 确定性候选，AI 挑 2-3 + 1（空 → 空态卡）。
      ...(execSummary ? { execSummary } : {}),
```

**4c. `getModuleCoverage` 覆盖清单**——找到 `key: 'priorPeriod'` 条目（~L1069-1073），在其闭合 `},` 后插入：

```ts
      {
        // ★ 0921 月报迭代：Executive Summary 确定性候选（MoM / 达人 / 渠道 / 峰值 / pending / 缺口）
        key: 'execSummary',
        label: 'Executive Summary',
        status: (hasPeriod ? cov.covered !== null || orderStatDays > 0 : activeCreators > 0) ? 'ok' : 'missing',
        detail: hasPeriod ? '期内确定性候选（MoM / 达人 / 渠道 / 峰值）' : `${activeCreators} 位达人汇总口径候选`,
      },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts && git commit -m "feat(server): execSummary 候选块注入 AI 上下文 + 覆盖清单 execSummary 条目"
```

---

### Task 5: SYSTEM_PROMPT（EN）模块规则 + SYSTEM_PROMPT_DISPLAY（CN 镜像）+ 不变量测试

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`（`SYSTEM_PROMPT_TEMPLATE_RAW` L134-356；`SYSTEM_PROMPT_DISPLAY` L363-517）
- Test: `apps/server/src/modules/html-templates/ai-generate.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `ai-generate.service.test.ts` 追加：

```ts
describe('SYSTEM_PROMPT · 0921 月报迭代模块规则', () => {
  it('Executive Summary：ALWAYS 首屏 + execSummary 锚定铁律', () => {
    expect(SYSTEM_PROMPT).toContain('EXECUTIVE SUMMARY RULES');
    expect(SYSTEM_PROMPT).toContain('Executive Summary (ALWAYS');
    expect(SYSTEM_PROMPT).toContain('EXACTLY 1');
    expect(SYSTEM_PROMPT).toContain('Automated summary unavailable');
  });
  it('趋势：上月虚线叠加 + 峰值高亮 + priorTrend/trendPeak 命名常量', () => {
    expect(SYSTEM_PROMPT).toContain('borderDash');
    expect(SYSTEM_PROMPT).toContain('This Month');
    expect(SYSTEM_PROMPT).toContain('Peak Insight');
    expect(SYSTEM_PROMPT).toContain('const priorTrend');
    expect(SYSTEM_PROMPT).toContain('const trendPeak');
  });
  it('exposure：纯 CSS hover 大图（无 JS）', () => {
    expect(SYSTEM_PROMPT).toContain('object-fit:contain');
    expect(SYSTEM_PROMPT).toContain(':hover');
    expect(SYSTEM_PROMPT).toContain('no JavaScript');
  });
  it('CN 镜像同步', () => {
    expect(SYSTEM_PROMPT_DISPLAY).toContain('Executive Summary');
    expect(SYSTEM_PROMPT_DISPLAY).toContain('上月');
    expect(SYSTEM_PROMPT_DISPLAY).toContain('峰值');
    expect(SYSTEM_PROMPT_DISPLAY).toContain('大图');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: FAIL（四处规则均缺失）

- [ ] **Step 3: 编辑 SYSTEM_PROMPT_TEMPLATE_RAW（EN 生效版）**

**5a. REPORT STRUCTURE 模块清单**——在 `- Header (ALWAYS): business line logo + advertiser logo + campaign name + date range` 之后插入一行 bullet：

```
   - Executive Summary (ALWAYS, FIRST section after the header): the month's key conclusions — 2-3
     performance highlight cards + 1 concern card, built STRICTLY from the "execSummary" context block
     (see EXECUTIVE SUMMARY RULES below). When "execSummary" is absent from the context, render a single
     full-width muted card: "Automated summary unavailable — pending data import".
```

**5b. Time series bullet 扩展**——在 `- Time series (dailyTrend/weeklyTrend) → line chart / area chart / bar chart (Chart.js)` 之后追加两个子条目：

```
     * Prior-month overlay: when priorPeriod.dailyTrend is present, overlay the prior-period series in
       the SAME chart as dashed lines (Chart.js borderDash: [6,6], lighter tint of the same color
       family), aligned by day-of-month (day 1 of this month pairs with day 1 of last month). Add a
       legend distinguishing "This Month" vs "Last Month", and next to or below the chart show last
       month's Revenue/Orders totals with the mom % delta badges from priorPeriod.mom.
     * Peak highlight: when trendPeak is present, emphasize the peak revenue day on the chart (larger
       pointRadius + a callout label with date and value) and render a "Peak Insight" card below the
       chart: 1-3 sentences of analysis where every fact is copied from the trendPeak object (date,
       revenue, vsAvgMultiple, that day's orders/clicks, topCreator when present — never mention a
       creator when topCreator is absent). When priorPeriod.dailyTrend or trendPeak is absent, omit
       that enhancement silently (no placeholder).
```

**5c. Placements bullet 追加 hover 大图**——在 `Entries without screenshots are EXCLUDED server-side.` 之后追加：

```
     Hover large-image preview (pure CSS, no JavaScript): each card contains a hidden lightbox layer
     that becomes visible on card :hover — a centered fixed overlay (semi-transparent dark backdrop)
     showing the SAME screenshot URL at natural aspect ratio (object-fit:contain, max-width: 85vw,
     max-height: 85vh) with the item title and platform chip. CSS only (:hover + position/opacity
     transitions); no JavaScript, no navigation behavior. This overlay is exempt from the
     no-fixed-position layout rule — it is a transient hover preview, not navigation chrome. The
     card's normal hover-lift and postUrl click behavior remain unchanged.
```

**5d. EXECUTIVE SUMMARY RULES 独立段**——在 `4. If the user's instruction includes specific section requirements (§1, §2, ...), follow those INSTEAD of the default structure above.` 之后、`{{ASSET:table-alignment}}` 之前插入：

```
═══ EXECUTIVE SUMMARY RULES (本月核心结论) ═══
The Executive Summary is the FIRST content section after the report header (before KPI Overview);
subsequent section numbering continues after it.
- Section head: numbered badge + serif large title "Executive Summary" + one-line muted subtitle.
- Card grid: 4 columns (responsive: 2 on medium, 1 on narrow screens). Card structure top-to-bottom:
  circular icon on a tinted background → short conclusive title (bold, one line) → 1-2 sentence body
  with key numbers in <strong> → pill badge at the bottom (small arrow/trend glyph + short data anchor).
- Semantic colors: highlights use soft tinted card backgrounds in green / pink / purple families (icon
  circle, card tint, and pill share the same family at different saturations); the concern card uses
  amber with a "!" icon and a "→" pill. Flat style, no or minimal shadow, rounded-xl — consistent with
  the design guide's serif headings + numbered badges.
- Content rules (CRITICAL): pick 2-3 items from execSummary.highlights and EXACTLY 1 from
  execSummary.concerns. Every number in card bodies and pills MUST be copied verbatim from the chosen
  candidate's value/detail — do NOT compute, convert, or invent any number. If concerns is empty, omit
  the concern card (render 2-3 highlight cards only). Never fabricate a concern.
```

**5e. 数据锚定常量约定**——将：

```
   The system will replace the entire \`dailyTrend\` array. Use this exact variable name.
```

替换为：

```
   The system will replace the entire \`dailyTrend\` array. Use this exact variable name.
   When the context contains priorPeriod.dailyTrend, ALSO define (same replacement contract):
   const priorTrend = [ { date: "2024-09-01", revenue: ..., orders: ..., clicks: ... }, ... ];
   When the context contains trendPeak, ALSO define:
   const trendPeak = { date: "...", revenue: ..., orders: ..., clicks: ..., vsAvgMultiple: ..., topCreator: { name: "...", sharePct: ... } };
   Render the prior-series overlay only when priorTrend.length > 0; guard peak rendering with if (trendPeak).
```

**5f. CN 镜像 `SYSTEM_PROMPT_DISPLAY`**——三处追加：

（1）`## 📋 报告结构 (REPORT STRUCTURE)` 小节末尾（`**固定结构模式**……` 行后）追加：

```
### 0921 新增：Executive Summary（本月核心结论 · 首屏常驻）

- **位置**：Header 之后、KPI 之前的首个内容模块，后续章节编号顺延；`execSummary` 缺失时渲染单张全宽空态卡
- **卡片**：4 列网格（响应式 2/1 列）——圆底图标 + 结论式标题 + 粗体数字正文 + 胶囊徽标
- **配色**：highlight 绿/粉/紫浅底同色系；concern 琥珀底 + "!" 图标
- **铁律**：从 `execSummary.highlights` 选 2-3 个 + `execSummary.concerns` 恰好 1 个；数字只能从候选 value/detail 复制，禁止自行计算；concerns 为空则省略 concern 卡
```

（2）`## 📊 Chart.js 规则` 列表末尾追加：

```
8. **上月叠加（0921）**：`priorPeriod.dailyTrend` 存在时，同图叠加上月序列虚线（`borderDash: [6,6]`、同色系浅色），按月内日对齐，图例区分 This Month / Last Month，图旁配上月 Revenue/Orders 汇总 + MoM 徽标
9. **峰值高亮（0921）**：`trendPeak` 存在时，峰值日放大圆点 + 标注气泡，图下渲染 Peak Insight 卡（事实只能来自 trendPeak 字段）
```

（3）`## 🚧 布局禁令` 小节末尾追加：

```
> **0921 豁免**：资源位卡片 hover 大图预览（纯 CSS :hover overlay，`object-fit:contain` 展示同一截图原图）不算导航 chrome——零 JS、零导航行为，允许 position:fixed；卡片点击跳转 postUrl 行为不变
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts apps/server/src/modules/html-templates/ai-generate.service.test.ts && git commit -m "feat(server): SYSTEM_PROMPT 月报迭代规则——ExecSummary 四卡铁律/上月虚线叠加/峰值洞察卡/CSS hover 大图 + CN 镜像"
```

---

### Task 6: `template-renderer.ts` — 快路径 `priorTrend`/`trendPeak` 提取与三常量改写

**Files:**
- Modify: `apps/server/src/modules/html-templates/template-renderer.ts`（`PeriodData` 类型 ~L56；trend 构建 ~L225-233；`replaceTrendData` ~L354-362；调用点 ~L429）
- Test: `apps/server/src/modules/html-templates/template-renderer.test.ts`

- [ ] **Step 1: 写失败测试**

在 `template-renderer.test.ts` 追加：

```ts
import { resolvePriorWindow } from './report-insights'; // 若文件已 import 则省略

describe('template-renderer · 0921 priorTrend/trendPeak 快路径', () => {
  beforeEach(() => vi.clearAllMocks());

  /** LP fixture：8 月两天 + 7 月一天（7/5 gmv 50 clicks 4 orders 1）。 */
  function monthCamp() {
    return {
      id: 'camp-m', platform: 'instagram', startDate: '2026-07-01', endDate: '2026-08-31',
      metrics: {},
      campaignCreators: [{
        creator: { name: 'Mia', platform: 'Instagram' },
        cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
          daily: [
            { date: '2026-08-01', clicks: '10', orders: '2', gmv: '100', impressions: '0', spend: '0', commission: '100', newCustomers: '1' },
            { date: '2026-08-02', clicks: '5', orders: '1', gmv: '500', impressions: '0', spend: '0', commission: '500', newCustomers: '0' },
            { date: '2026-07-05', clicks: '4', orders: '1', gmv: '50', impressions: '0', spend: '0', commission: '50', newCustomers: '0' },
          ] }],
      performance: { summary: {} },
      linkPerformances: [],
    } as any;
  }

  it('extractPeriodData：整月窗口 → priorTrend 含 7/5；trendPeak 峰值 8/2', async () => {
    const camp = monthCamp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    const data = await extractPeriodData('camp-m', { startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(data.trend).toHaveLength(2);
    expect(data.priorTrend).toEqual([{ date: '2026-07-05', revenue: 50, clicks: 4, orders: 1 }]);
    expect(data.trendPeak).toMatchObject({ date: '2026-08-02', revenue: 500, vsAvgMultiple: 1.7 });
  });

  it('renderTemplate：三个命名常量都被改写', async () => {
    const camp = monthCamp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    const html = `<!DOCTYPE html><html><body>
<span data-field="period.start">x</span>
<script>
const dailyTrend = [{ date: "2026-08-01", revenue: 1, clicks: 1, orders: 1 }];
const priorTrend = [{ date: "2026-07-01", revenue: 9, clicks: 9, orders: 9 }];
const trendPeak = { date: "2026-08-01", revenue: 1, orders: 1, clicks: 1, vsAvgMultiple: 1 };
</script></body></html>`;
    const out = await renderTemplate(html, 'camp-m', { startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(out).toContain(`const dailyTrend = [{"date":"2026-08-01","revenue":100,"clicks":10,"orders":2},{"date":"2026-08-02","revenue":500,"clicks":5,"orders":1}];`);
    expect(out).toContain(`const priorTrend = [{"date":"2026-07-05","revenue":50,"clicks":4,"orders":1}];`);
    expect(out).toMatch(/const trendPeak = \{"date":"2026-08-02"[^}]*"vsAvgMultiple":1\.7\};/);
  });
});
```

（若文件顶部未 import `extractPeriodData`，沿用现有 import 行——该文件已同时导出 `extractPeriodData, renderTemplate`。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediaket/server exec vitest run src/modules/html-templates/template-renderer.test.ts`
Expected: FAIL（`data.priorTrend` undefined / HTML 中 priorTrend 未改写）

- [ ] **Step 3: 实现**

**6a. import**（文件头部）：

```ts
import { buildTrendPeak, resolvePriorWindow } from './report-insights';
```

**6b. `PeriodData` 类型**（`trend: ...;` 字段后追加）：

```ts
  /** ★ 0921：上月日级序列（自然月/等长前窗，cps 口径）；无前窗数据为空数组 */
  priorTrend: { date: string; revenue: number; clicks: number; orders: number }[];
  /** ★ 0921：峰值事实（与 trend 同序列）；revenue 全 0 → null */
  trendPeak: ReturnType<typeof buildTrendPeak>;
```

**6c. `extractPeriodData`**——trend 构建（`const trend = dates.map(...)`）之后、period 之前插入：

```ts
  // ★ 0921 月报迭代：上月序列（自然月/等长前窗）+ 峰值（与 trend 同序列；cps 口径无达人归因）
  let priorTrend: PeriodData['priorTrend'] = [];
  if (reportPeriod?.startDate && reportPeriod.endDate) {
    const { pStart, pEnd } = resolvePriorWindow({ startDate: reportPeriod.startDate, endDate: reportPeriod.endDate });
    const pByDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
    for (const [date, cell] of cps.campaignDaily) {
      if (date < pStart || date > pEnd) continue;
      pByDate.set(date, { revenue: cell.gmv, clicks: cell.clicks, orders: cell.orders });
    }
    priorTrend = [...pByDate.keys()].sort().map((d) => ({ date: d, ...pByDate.get(d)! }));
  }
  const trendPeak = buildTrendPeak(trend);
```

并把 return 改为 `return { kpis, kpisRaw, creators, trend, priorTrend, trendPeak, period };`

**6d. `replaceTrendData` 三常量改写**——将整个函数替换为：

```ts
/**
 * 替换 script 中 dailyTrend / priorTrend / trendPeak 数据。
 * ★ 0921：priorTrend/trendPeak 命名常量同款改写（AI 按 prompt 约定使用精确变量名）。
 *   存在才动；priorTrend 改为空数组 / trendPeak 改为 null 时，AI 侧按 length/空值降级渲染。
 */
function replaceTrendData(html: string, data: Pick<PeriodData, 'trend' | 'priorTrend' | 'trendPeak'>): string {
  if (data.trend.length === 0) return html;
  let out = html.replace(
    /(const\s+dailyTrend\s*=\s*)\[([\s\S]*?)\]\s*;/,
    `$1${JSON.stringify(data.trend)};`,
  );
  if (data.priorTrend) {
    out = out.replace(
      /(const\s+priorTrend\s*=\s*)\[([\s\S]*?)\]\s*;/,
      `$1${JSON.stringify(data.priorTrend)};`,
    );
  }
  if (data.trendPeak !== undefined) {
    out = out.replace(
      /(const\s+trendPeak\s*=\s*)\{([\s\S]*?)\}\s*;/,
      `$1${JSON.stringify(data.trendPeak)};`,
    );
  }
  return out;
}
```

调用点（~L429）改为：`result = replaceTrendData(result, data);`

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/html-templates/template-renderer.test.ts`
Expected: PASS（含既有用例）

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/template-renderer.ts apps/server/src/modules/html-templates/template-renderer.test.ts && git commit -m "feat(server): 换周期快路径改写三命名常量——dailyTrend/priorTrend/trendPeak 不脱锚"
```

---

### Task 7: 全量回归 + 类型检查

**Files:** 无新改动（验证任务）

- [ ] **Step 1: 全量测试**

Run: `pnpm --filter @mediaket/server test`
Expected: PASS（588+ 用例全绿；若出现非本计划文件的失败，先确认是否 main 上已有——对照 `git stash` 前状态，不修无关失败，如实上报）

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @mediaket/server typecheck`
Expected: 无错误（`tsc --noEmit` 退出码 0）

- [ ] **Step 3: 收尾提交（如有零散修正）**

```bash
git status --short && git log --oneline -6
```

Expected: 工作区干净；本计划共 6 个功能 commit + 此前 1 个 spec commit。

---

## Self-Review 记录

- **Spec 覆盖**：§1.1（Task 1/3）、§1.2（Task 1/3）、§1.3（Task 2/4）、§2.1①②③（Task 5）、§2.2（Task 5e/6）、§2.3（各任务测试 + Task 7）、§2.4（Task 3 前窗无数据用例 / Task 5 空态卡规则）——无缺口。
- **占位符**：无 TBD/TODO；所有代码步骤含完整代码。
- **类型一致性**：`TrendPeak`/`DailyPoint`/`ExecCandidate`/`ExecSummaryInput` 由 Task 1/2 定义，Task 3/4/6 引用一致；`resolvePriorWindow` 返回 `{pStart, pEnd}` 三处使用一致；`replaceTrendData` 签名与调用点匹配。
- **已知取舍**（spec §2.2 已声明）：Exec Summary 散文不做快路径重写；中间层路径无峰日达人归因。
