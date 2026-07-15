# Campaign 分析数据（大盘趋势 + 新老客 + 洞察引擎）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Campaign 加 `CampaignAnalytics` 数据包（每日/每周 GMV+ROAS 趋势、新老客占比、5 类结构化洞察），接到 `ReportCampaign`（→ 进 ReportContext/导出）并写进 `campaignRecordDataSchema`（→ 进数据管理）。

**Architecture:** 新增确定性生成器 `getCampaignAnalytics(campaignId)` 组合已有 `getRevenueTimeline`/`getCampaignSummary` + 新推导引擎 `getCampaignInsights` + `rollupWeekly`；为避免 selectCampaign 异步化，给 mock 补 2 个 sync getter。`analytics?` 为加法可选字段，贯穿 shared 类型 / 服务端 schema / 编辑器接线。

**Tech Stack:** TypeScript + Zod + Vitest。包名 `@mediakit/web` / `@mediakit/server`。

**Spec:** `docs/superpowers/specs/2026-07-15-campaign-analytics-design.md`

---

## File Structure

| 文件 | 职责 | 改动 |
|---|---|---|
| `packages/shared/src/types/campaign.ts` | 类型 | 新增 `CampaignAnalytics` 等 4 接口 + 2 类型别名；`Campaign`/`ReportCampaign` 加 `analytics?` |
| `apps/web/src/api/mock/creatorPerformance.ts` | mock 取数 | 新增 sync `getCreatorPerformances` / `getPlacementTypeSummaries` |
| `apps/web/src/api/mock/campaignAnalytics.ts`（新） | 分析生成器 | `rollupWeekly` / `getCampaignInsights` / `getCampaignAnalytics` |
| `apps/server/src/modules/data/data.schema.ts` | 服务端校验 | `campaignRecordDataSchema` 加 `analytics?` |
| `apps/web/src/api/campaigns.ts` | Campaign→ReportCampaign | 新增 `reportCampaignFrom(c)` 含 analytics |
| `apps/web/src/editor/components/DataConfigOverlay.tsx` | 接线 | `selectCampaign` 改用 `reportCampaignFrom` |
| `apps/web/tests/campaign-analytics.test.ts`（新） | 生成器测试 | trend/weekly/insights/determinism |
| `apps/server/tests/data.schema.test.ts` | schema round-trip | analytics 保留 + 旧记录兼容 |

**测试命令**（根目录）：web 单测 `pnpm --filter @mediakit/web exec vitest run <file>`；web 类型 `pnpm --filter @mediakit/web typecheck`；server 单测 `pnpm --filter @mediakit/server exec vitest run <file>`。

---

## Task 1: shared 类型（CampaignAnalytics + analytics? 字段）

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`
- Test: `apps/web/tests/campaign-analytics.test.ts`（新建）

- [ ] **Step 1: 写失败测试（锁类型形状）**

新建 `apps/web/tests/campaign-analytics.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import type { CampaignAnalytics, CampaignInsight, CampaignTrendPoint } from '@mediakit/shared';

describe('CampaignAnalytics 类型契约', () => {
  it('可构造完整的 analytics 对象', () => {
    const sample: CampaignAnalytics = {
      trend: [{ date: '2026-10-12', revenue: 1000, spend: 130, commission: 120, orders: 5, roas: 7.69 }],
      weeklyTrend: [{ week: 'W1', start: '2026-10-12', revenue: 7000, spend: 910, orders: 35, roas: 7.69 }],
      customerSplit: { newCustomers: 100, returningCustomers: 60, newCustomerRate: '62.5%' },
      insights: [
        {
          kind: 'best-creator', severity: 'good', subjectType: 'creator',
          subjectId: 'cre-mia', subjectName: 'Mia Chen',
          metrics: [{ label: 'GMV', value: '$192,000' }],
          rationale: 'Mia Chen 带来 $192,000 GMV，为全场最高。',
          action: '加大该达人预算。',
        } satisfies CampaignInsight,
      ],
    };
    expect(sample.trend[0].roas).toBe(7.69);
    expect(sample.insights[0].kind).toBe('best-creator');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts`
Expected: FAIL — `CampaignAnalytics` 等类型不存在（TS 编译错误）。

- [ ] **Step 3: 实现 — 新增类型**

在 `packages/shared/src/types/campaign.ts` 末尾追加：
```ts
/* ------------------------------ Campaign 分析数据 ------------------------------ */

/** Campaign 大盘每日趋势（GMV + spend → ROAS）。 */
export interface CampaignTrendPoint {
  date: string;
  revenue: number;
  spend: number;
  commission: number;
  orders: number;
  roas: number;
}

/** 每周 rollup 趋势点。 */
export interface CampaignWeeklyTrendPoint {
  week: string;
  start: string;
  revenue: number;
  spend: number;
  orders: number;
  roas: number;
}

export type InsightKind =
  | 'high-traffic-low-cvr'
  | 'scale-opportunity'
  | 'best-placement'
  | 'best-creator'
  | 'roas-warning';
export type InsightSeverity = 'good' | 'warn' | 'opportunity';
export type InsightSubject = 'campaign' | 'creator' | 'placement';

export interface CampaignInsight {
  kind: InsightKind;
  severity: InsightSeverity;
  subjectType: InsightSubject;
  subjectId?: string;
  subjectName: string;
  metrics: { label: string; value: string }[];
  rationale: string;
  action: string;
}

/** Campaign 分析包（趋势 + 新老客 + 洞察）。 */
export interface CampaignAnalytics {
  trend: CampaignTrendPoint[];
  weeklyTrend: CampaignWeeklyTrendPoint[];
  customerSplit?: { newCustomers: number; returningCustomers: number; newCustomerRate: string };
  insights: CampaignInsight[];
}
```

给 `ReportCampaign`（`export interface ReportCampaign { ... }`，约 `campaign.ts:144`）和 `Campaign`（约 `campaign.ts:37`）接口各加一个可选字段（放在 `metrics?: CampaignMetric[];` 之后）：
```ts
  /** Campaign 分析数据包（大盘趋势 + 新老客 + 洞察），由生成器填充。 */
  analytics?: CampaignAnalytics;
```

- [ ] **Step 4: 跑测试 + 类型，确认通过**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → PASS
Run: `pnpm --filter @mediakit/web typecheck` → 无新错误

- [ ] **Step 5: 提交**
```bash
git add packages/shared/src/types/campaign.ts apps/web/tests/campaign-analytics.test.ts
git commit -m "feat(shared): CampaignAnalytics 类型（趋势/新老客/洞察）"
```

---

## Task 2: mock sync getter（旁路 250ms 异步）

**Files:**
- Modify: `apps/web/src/api/mock/creatorPerformance.ts`
- Test: `apps/web/tests/campaign-analytics.test.ts`

- [ ] **Step 1: 写失败测试**

在 `campaign-analytics.test.ts` 顶部加 import，并追加 describe：
```ts
import { getCreatorPerformances, getPlacementTypeSummaries } from '@/api/mock/creatorPerformance';

describe('mock sync getter', () => {
  it('getCreatorPerformances 同步返回该 campaign 的达人性能（非空、含 cps）', () => {
    const list = getCreatorPerformances('camp-glowlab-q4');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].cps).toBeDefined();
    expect(list[0].summary.totalImpressions).toBeTruthy();
  });
  it('getPlacementTypeSummaries 同步返回版位类型汇总（含 type/revenue/roas）', () => {
    const list = getPlacementTypeSummaries('camp-glowlab-q4');
    expect(list.length).toBeGreaterThan(0);
    expect(typeof list[0].type).toBe('string');
    expect(list[0].revenue).toBeTruthy();
    expect(list[0].roas).toBeTruthy();
  });
  it('未知 campaign 返回空数组（不抛错）', () => {
    expect(getCreatorPerformances('nope')).toEqual([]);
    expect(getPlacementTypeSummaries('nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → FAIL（两个 getter 未导出）。

- [ ] **Step 3: 实现**

在 `apps/web/src/api/mock/creatorPerformance.ts` 中，紧挨现有 `listCreatorPerformance`（约 `:692`）与 `listPlacementTypeSummary`（约 `:701`）之后，新增同步版本（复用文件内已有的 `clone`，定义在 `:689`）：
```ts
/** 同步获取 campaign 下达人性能（旁路 listCreatorPerformance 的 250ms 延迟，供分析生成器用）。 */
export function getCreatorPerformances(campaignId: string): CreatorCampaignPerformance[] {
  return clone(MOCK_PERFORMANCE[campaignId] ?? []);
}

/** 同步获取 campaign 版位类型汇总（旁路 listPlacementTypeSummary 的延迟）。 */
export function getPlacementTypeSummaries(campaignId: string): PlacementTypeSummary[] {
  return clone(MOCK_PLACEMENT_SUMMARY[campaignId] ?? []);
}
```
（`MOCK_PERFORMANCE` / `MOCK_PLACEMENT_SUMMARY` / `PlacementTypeSummary` / `CreatorCampaignPerformance` 均已在文件内可见。）

- [ ] **Step 4: 跑测试，确认通过**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → PASS

- [ ] **Step 5: 提交**
```bash
git add apps/web/src/api/mock/creatorPerformance.ts apps/web/tests/campaign-analytics.test.ts
git commit -m "feat(web): mock 同步 getter（getCreatorPerformances/getPlacementTypeSummaries）"
```

---

## Task 3: 分析生成器（rollupWeekly + getCampaignInsights + getCampaignAnalytics）

**Files:**
- Create: `apps/web/src/api/mock/campaignAnalytics.ts`
- Test: `apps/web/tests/campaign-analytics.test.ts`

- [ ] **Step 1: 写失败测试**

在 `campaign-analytics.test.ts` 加 import 并追加：
```ts
import { getCampaignAnalytics, getCampaignInsights, rollupWeekly } from '@/api/mock/campaignAnalytics';

const CID = 'camp-glowlab-q4';

describe('rollupWeekly', () => {
  it('14 天 → 2 个周点，桶内求和、roas=revenue/spend', () => {
    const trend = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(12 + i).padStart(2, '0')}`,
      revenue: 1000, spend: 130, commission: 120, orders: 5, roas: 7.69,
    }));
    const w = rollupWeekly(trend);
    expect(w.length).toBe(2);
    expect(w[0].revenue).toBe(7000);
    expect(w[0].orders).toBe(35);
    expect(w[0].roas).toBe(Math.round((7000 / 910) * 100) / 100);
    expect(w[0].week).toBe('W1');
    expect(w[0].start).toBe('2026-10-12');
  });
  it('空数组 → 空数组', () => {
    expect(rollupWeekly([])).toEqual([]);
  });
});

describe('getCampaignAnalytics', () => {
  it('返回完整结构：trend + weeklyTrend + customerSplit + insights', () => {
    const a = getCampaignAnalytics(CID);
    expect(a.trend.length).toBeGreaterThanOrEqual(28);
    expect(a.weeklyTrend.length).toBeGreaterThan(0);
    expect(a.customerSplit?.newCustomerRate).toMatch(/%/);
    expect(a.insights.length).toBeGreaterThan(0);
  });
  it('trend.roas = round2(revenue/spend)；spend=0 时 roas=0', () => {
    const a = getCampaignAnalytics(CID);
    for (const p of a.trend) {
      const want = p.spend > 0 ? Math.round((p.revenue / p.spend) * 100) / 100 : 0;
      expect(p.roas).toBe(want);
    }
  });
  it('内部一致：weeklyTrend 收入之和 = trend 收入之和', () => {
    const a = getCampaignAnalytics(CID);
    const sumT = a.trend.reduce((s, p) => s + p.revenue, 0);
    const sumW = a.weeklyTrend.reduce((s, p) => s + p.revenue, 0);
    expect(Math.round(sumW)).toBe(Math.round(sumT));
  });
  it('确定性：同 id 两次调用 deep-equal', () => {
    expect(getCampaignAnalytics(CID)).toEqual(getCampaignAnalytics(CID));
  });
});

describe('getCampaignInsights', () => {
  it('恒含 best-creator 与 best-placement（good）', () => {
    const kinds = getCampaignInsights(CID).map((i) => i.kind);
    expect(kinds).toContain('best-creator');
    expect(kinds).toContain('best-placement');
  });
  it('best-creator 的 subjectId 对应 GMV 最高达人', () => {
    const top = [...getCreatorPerformances(CID)].sort((a, b) => num(b.cps.gmv) - num(a.cps.gmv))[0];
    const best = getCampaignInsights(CID).find((i) => i.kind === 'best-creator')!;
    expect(best.subjectId).toBe(top.creatorId);
  });
  it('每个 kind 至多 1 条', () => {
    const list = getCampaignInsights(CID);
    const counts = list.reduce<Record<string, number>>((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {});
    expect(Object.values(counts).every((c) => c === 1)).toBe(true);
  });
});

function num(s: string): number {
  return Number.parseFloat(String(s).replace(/[$,%]/g, '')) || 0;
}
```
> 该测试块依赖文件顶部已 import 的 `getCreatorPerformances`（Task 2 Step 1 引入）与下面的 `num` 辅助函数；`getCampaignInsights(CID)` 内部自己取数，无需在测试里重复传 creator 列表。

- [ ] **Step 2: 跑测试，确认失败**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → FAIL（`campaignAnalytics` 模块不存在）。

- [ ] **Step 3: 实现 — 新建 `apps/web/src/api/mock/campaignAnalytics.ts`**

```ts
/**
 * Campaign 分析数据生成器（demo，确定性）。
 * 组合已有 getRevenueTimeline / getCampaignSummary + 洞察推导引擎。
 */
import type {
  CampaignAnalytics,
  CampaignInsight,
  CampaignTrendPoint,
  CampaignWeeklyTrendPoint,
} from '@mediakit/shared';
import { getRevenueTimeline, getCampaignSummary } from './affiliate';
import { getCreatorPerformances, getPlacementTypeSummaries } from './creatorPerformance';

/* 可调阈值 */
const LOW_CVR = 2; // % ：低于此且高曝光 → 高流量低转化
const LOW_ROAS = 2; // roasStatus bad 下界
const LOW_SHARE = 15; // % ：收入占比低于此且高 ROAS → 扩量机会
const TOP_PCT = 0.3; // 曝光前 30% 视为高流量

const num = (s: string): number => Number.parseFloat(String(s).replace(/[$,%]/g, '')) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 每日趋势按 7 天滚动分桶为周趋势。 */
export function rollupWeekly(trend: CampaignTrendPoint[]): CampaignWeeklyTrendPoint[] {
  const weeks: CampaignWeeklyTrendPoint[] = [];
  for (let i = 0; i < trend.length; i += 7) {
    const bucket = trend.slice(i, i + 7);
    const revenue = bucket.reduce((s, p) => s + p.revenue, 0);
    const spend = bucket.reduce((s, p) => s + p.spend, 0);
    const orders = bucket.reduce((s, p) => s + p.orders, 0);
    weeks.push({
      week: `W${weeks.length + 1}`,
      start: bucket[0].date,
      revenue: round2(revenue),
      spend: round2(spend),
      orders,
      roas: spend > 0 ? round2(revenue / spend) : 0,
    });
  }
  return weeks;
}

/** 洞察推导：从已有 CPS / 版位汇总算出结构化结论（每类至多 1 条）。 */
export function getCampaignInsights(campaignId: string): CampaignInsight[] {
  const out: CampaignInsight[] = [];
  const creators = getCreatorPerformances(campaignId);
  const placements = getPlacementTypeSummaries(campaignId);

  if (creators.length) {
    const best = [...creators].sort((a, b) => num(b.cps.gmv) - num(a.cps.gmv))[0];
    out.push({
      kind: 'best-creator', severity: 'good', subjectType: 'creator',
      subjectId: best.creatorId, subjectName: best.creatorName,
      metrics: [
        { label: 'GMV', value: best.cps.gmv },
        { label: 'ROAS', value: best.cps.roas },
        { label: 'Orders', value: best.cps.orders },
      ],
      rationale: `${best.creatorName} 带来 ${best.cps.gmv} GMV，为全场最高。`,
      action: '加大该达人预算、复用其内容模板。',
    });

    const byImp = [...creators].sort((a, b) => num(b.summary.totalImpressions) - num(a.summary.totalImpressions));
    const cutoff = Math.max(1, Math.ceil(byImp.length * TOP_PCT));
    const lowCvr = byImp.slice(0, cutoff).find((c) => num(c.cps.cvr) < LOW_CVR);
    if (lowCvr) {
      out.push({
        kind: 'high-traffic-low-cvr', severity: 'warn', subjectType: 'creator',
        subjectId: lowCvr.creatorId, subjectName: lowCvr.creatorName,
        metrics: [
          { label: 'Impressions', value: lowCvr.summary.totalImpressions },
          { label: 'CVR', value: lowCvr.cps.cvr },
          { label: 'GMV', value: lowCvr.cps.gmv },
        ],
        rationale: `${lowCvr.creatorName} 曝光 ${lowCvr.summary.totalImpressions} 居前 ${Math.round(TOP_PCT * 100)}%，但 CVR 仅 ${lowCvr.cps.cvr}（< ${LOW_CVR}%）。`,
        action: '优化落地页与素材承接，提升转化。',
      });
    }
  }

  if (placements.length) {
    const byRev = [...placements].sort((a, b) => num(b.revenue) - num(a.revenue));
    const best = byRev[0];
    out.push({
      kind: 'best-placement', severity: 'good', subjectType: 'placement',
      subjectName: best.type,
      metrics: [
        { label: 'Revenue', value: best.revenue },
        { label: 'Share', value: best.revenueShare },
        { label: 'ROAS', value: best.roas },
      ],
      rationale: `${best.type} 创收 ${best.revenue}（占 ${best.revenueShare}），为最佳版位。`,
      action: '向该版位倾斜投放。',
    });

    const bad = byRev.find((p) => num(p.roas) < LOW_ROAS);
    if (bad) {
      out.push({
        kind: 'roas-warning', severity: 'warn', subjectType: 'placement',
        subjectName: bad.type,
        metrics: [
          { label: 'ROAS', value: bad.roas },
          { label: 'Revenue', value: bad.revenue },
          { label: 'Share', value: bad.revenueShare },
        ],
        rationale: `${bad.type} ROAS 仅 ${bad.roas}（< ${LOW_ROAS}），效益偏低。`,
        action: '压降低效版位、调整出价。',
      });
    }

    const roasVals = placements.map((p) => num(p.roas)).sort((a, b) => a - b);
    const median = roasVals.length ? roasVals[Math.floor(roasVals.length / 2)] : 0;
    const scale = byRev.find((p) => num(p.roas) > median && num(p.revenueShare) < LOW_SHARE);
    if (scale) {
      out.push({
        kind: 'scale-opportunity', severity: 'opportunity', subjectType: 'placement',
        subjectName: scale.type,
        metrics: [
          { label: 'ROAS', value: scale.roas },
          { label: 'Share', value: scale.revenueShare },
          { label: 'Revenue', value: scale.revenue },
        ],
        rationale: `${scale.type} ROAS ${scale.roas} 高于中位（${round2(median)}），但收入占比仅 ${scale.revenueShare}，有扩量空间。`,
        action: '扩量该高效版位。',
      });
    }
  }

  return out;
}

/** 组合：每日趋势 + 周趋势 + 新老客 + 洞察。 */
export function getCampaignAnalytics(campaignId: string): CampaignAnalytics {
  const raw = getRevenueTimeline(campaignId);
  const trend: CampaignTrendPoint[] = raw.map((p) => ({
    date: p.date,
    revenue: p.revenue,
    spend: p.spend,
    commission: p.commission,
    orders: p.orders,
    roas: p.spend > 0 ? round2(p.revenue / p.spend) : 0,
  }));
  const summary = getCampaignSummary(campaignId);
  return {
    trend,
    weeklyTrend: rollupWeekly(trend),
    customerSplit: {
      newCustomers: summary.newCustomers,
      returningCustomers: summary.returningCustomers,
      newCustomerRate: summary.newCustomerRate,
    },
    insights: getCampaignInsights(campaignId),
  };
}
```

- [ ] **Step 4: 跑测试，确认通过**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → PASS（全部用例）
Run: `pnpm --filter @mediakit/web typecheck` → 无新错误

- [ ] **Step 5: 提交**
```bash
git add apps/web/src/api/mock/campaignAnalytics.ts apps/web/tests/campaign-analytics.test.ts
git commit -m "feat(web): Campaign 分析生成器（趋势/周聚合/洞察引擎）"
```

---

## Task 4: 服务端 schema（campaignRecordDataSchema.analytics）

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`
- Test: `apps/server/tests/data.schema.test.ts`（若不存在则新建）

- [ ] **Step 1: 写失败测试**

在 `apps/server/tests/data.schema.test.ts`（不存在则新建，import 自 `'../src/modules/data/data.schema'`）追加：
```ts
import { campaignRecordDataSchema } from '../src/modules/data/data.schema';

describe('campaignRecordDataSchema.analytics round-trip', () => {
  it('保留 analytics（趋势/周/新老客/洞察）', () => {
    const rec = {
      id: 'camp-glowlab-q4', name: 'GlowLab', advertiser: 'GlowLab', businessLine: 'FT',
      platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K',
      analytics: {
        trend: [{ date: '2026-10-12', revenue: 1000, spend: 130, commission: 120, orders: 5, roas: 7.69 }],
        weeklyTrend: [{ week: 'W1', start: '2026-10-12', revenue: 7000, spend: 910, orders: 35, roas: 7.69 }],
        customerSplit: { newCustomers: 100, returningCustomers: 60, newCustomerRate: '62.5%' },
        insights: [{
          kind: 'best-creator', severity: 'good', subjectType: 'creator',
          subjectId: 'cre-mia', subjectName: 'Mia Chen',
          metrics: [{ label: 'GMV', value: '$192,000' }],
          rationale: 'top gmv', action: 'scale',
        }],
      },
    };
    const out = campaignRecordDataSchema.parse(rec) as { analytics?: { insights: { kind: string }[] } };
    expect(out.analytics?.insights[0].kind).toBe('best-creator');
  });
  it('无 analytics 的旧记录仍通过校验', () => {
    const out = campaignRecordDataSchema.parse({
      id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT',
      platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$1',
    });
    expect(out).toBeDefined();
    expect((out as { analytics?: unknown }).analytics).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**
Run: `pnpm --filter @mediakit/server exec vitest run tests/data.schema.test.ts` → FAIL（analytics 被 Zod strip，或 `campaignRecordDataSchema` 未导出——若未导出则在 Task 4 内补 `export`）。

- [ ] **Step 3: 实现**

在 `apps/server/src/modules/data/data.schema.ts` 中，`campaignMetricSchema`/`campaignPlatformSchema` 之后、`campaignRecordDataSchema` 之前，新增子 schema：
```ts
const campaignTrendPointSchema = z.object({
  date: z.string(), revenue: z.number(), spend: z.number(),
  commission: z.number(), orders: z.number(), roas: z.number(),
});
const campaignWeeklyTrendPointSchema = z.object({
  week: z.string(), start: z.string(), revenue: z.number(),
  spend: z.number(), orders: z.number(), roas: z.number(),
});
const campaignInsightSchema = z.object({
  kind: z.string(),
  severity: z.string(),
  subjectType: z.string(),
  subjectId: z.string().optional(),
  subjectName: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })),
  rationale: z.string(),
  action: z.string(),
});
const campaignAnalyticsSchema = z.object({
  trend: z.array(campaignTrendPointSchema),
  weeklyTrend: z.array(campaignWeeklyTrendPointSchema),
  customerSplit: z.object({
    newCustomers: z.number(),
    returningCustomers: z.number(),
    newCustomerRate: z.string(),
  }).optional(),
  insights: z.array(campaignInsightSchema),
});
```

在 `campaignRecordDataSchema`（`z.object({ ... })`）末尾、闭合 `})` 之前加：
```ts
  analytics: campaignAnalyticsSchema.optional(),
```

并确保 `campaignRecordDataSchema` 是 `export`（已是 `export const`，`data.schema.ts:21`）。

- [ ] **Step 4: 跑测试，确认通过**
Run: `pnpm --filter @mediakit/server exec vitest run tests/data.schema.test.ts` → PASS
Run: `pnpm --filter @mediakit/server typecheck`（若无该 script 则 `pnpm --filter @mediakit/server exec tsc --noEmit`）→ 无新错误

- [ ] **Step 5: 提交**
```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/tests/data.schema.test.ts
git commit -m "feat(server): campaignRecordDataSchema 支持 analytics 字段"
```

---

## Task 5: 接线 — ReportCampaign 填 analytics（reportCampaignFrom + selectCampaign）

**Files:**
- Modify: `apps/web/src/api/campaigns.ts`
- Modify: `apps/web/src/editor/components/DataConfigOverlay.tsx`
- Test: `apps/web/tests/campaign-analytics.test.ts`

- [ ] **Step 1: 写失败测试**

在 `campaign-analytics.test.ts` 追加：
```ts
import { reportCampaignFrom } from '@/api/campaigns';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';

describe('reportCampaignFrom', () => {
  it('把 Campaign 映射为带 analytics 的 ReportCampaign', () => {
    const rc = reportCampaignFrom(MOCK_CAMPAIGNS[0]);
    expect(rc.id).toBe(MOCK_CAMPAIGNS[0].id);
    expect(rc.metrics).toEqual(MOCK_CAMPAIGNS[0].metrics);
    expect(rc.analytics).toBeDefined();
    expect(rc.analytics?.insights.length).toBeGreaterThan(0);
    expect(rc.analytics?.trend.length).toBeGreaterThanOrEqual(28);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → FAIL（`reportCampaignFrom` 未导出）。

- [ ] **Step 3: 实现 — `reportCampaignFrom`**

在 `apps/web/src/api/campaigns.ts` 加（文件已 import `Campaign` 类型；新增 `ReportCampaign` 类型与 generator 的 import）：
```ts
import type { Campaign, ReportCampaign } from '@mediakit/shared';
import { getCampaignAnalytics } from './mock/campaignAnalytics';

/** Campaign → ReportCampaign，并附带分析数据包（趋势/新老客/洞察）。 */
export function reportCampaignFrom(c: Campaign): ReportCampaign {
  return {
    id: c.id,
    name: c.name,
    advertiser: c.advertiser,
    platform: c.platform,
    platforms: c.platforms,
    startDate: c.startDate,
    endDate: c.endDate,
    budget: c.budget,
    status: c.status,
    metrics: c.metrics,
    analytics: getCampaignAnalytics(c.id),
  };
}
```
（若 `Campaign`/`ReportCampaign` 未在该文件 import，则补上 `import type`；保留文件现有其它 import 不动。）

- [ ] **Step 4: 实现 — `DataConfigOverlay.selectCampaign` 改用 helper**

在 `apps/web/src/editor/components/DataConfigOverlay.tsx`：
1. 顶部 import 加 `import { reportCampaignFrom } from '@/api/campaigns';`（若已有 `listCampaigns` 自同模块，并入同一 import）。
2. 把 `selectCampaign` 内手建的 `const rc: ReportCampaign = { ... };` 整块替换为：
```ts
  function selectCampaign(id: string) {
    const c = campaigns?.find((x) => x.id === id);
    if (!c) return;
    const rc = reportCampaignFrom(c);
    // 切换 Campaign 时清空旧的 campaign 达人选择
    setReportData({ ...reportData, campaign: rc, campaignCreators: [] });
  }
```
（`ReportCampaign` 类型 import 若不再被直接引用可保留或移除——以 typecheck 通过为准。）

- [ ] **Step 5: 跑测试，确认通过**
Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-analytics.test.ts` → PASS
Run: `pnpm --filter @mediakit/web typecheck` → 无新错误
Run: `pnpm --filter @mediakit/web test` → 全量绿（确保未破坏现有用例，尤其 DataConfigOverlay 相关）

- [ ] **Step 6: 提交**
```bash
git add apps/web/src/api/campaigns.ts apps/web/src/editor/components/DataConfigOverlay.tsx apps/web/tests/campaign-analytics.test.ts
git commit -m "feat(web): ReportCampaign 附带 analytics（reportCampaignFrom + selectCampaign 接线）"
```

---

## Self-Review（写计划后自查）

**1. Spec 覆盖：**
- Part A 类型 → Task 1。✓
- Part B 生成器（sync getter + rollupWeekly + getCampaignInsights + getCampaignAnalytics）→ Task 2 + Task 3。✓
- Part C 洞察推导（5 类 + 阈值 + 每 kind 至多 1 条）→ Task 3 的 `getCampaignInsights`。✓
- Part D schema（campaignRecordDataSchema.analytics）→ Task 4；接线（selectCampaign 填 analytics）→ Task 5（经 `reportCampaignFrom`）。✓

**2. 占位符扫描：** 无 TBD/TODO；所有代码块完整可粘贴。

**3. 类型一致：** `CampaignAnalytics`/`CampaignInsight`/`CampaignTrendPoint`/`CampaignWeeklyTrendPoint` 在 Task 1 定义、Task 3/4/5 及测试中一致；`reportCampaignFrom` 在 Task 5 定义并被 selectCampaign 与测试引用；`getCreatorPerformances`/`getPlacementTypeSummaries` 在 Task 2 定义、Task 3 使用。

**4. 依赖顺序：** Task 1（类型）→ Task 2（getter）→ Task 3（生成器，依赖 1+2）→ Task 4（schema，依赖 1）→ Task 5（接线，依赖 3）。建议顺序 1→2→3→4→5；Task 4 可与 Task 3 并行。

**风险提醒（实现时注意）：**
- `getRevenueTimeline` 默认 31 天，campaign 周期约 29 天 → `trend.length ≥ 28` 断言稳妥。
- mock 普遍高 ROAS 时 `roas-warning` 可能不触发——测试不断言其必出，只断言「恒有 best-*」「每 kind 至多 1 条」。
- `listCreatorPerformance` 等是 async（250ms）；本计划新增的是**同步** getter，不要混用。
