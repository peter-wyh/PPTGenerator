import { describe, it, expect } from 'vitest';
import type { CampaignAnalytics, CampaignInsight } from '@mediakit/shared';
import { getCreatorPerformances, getPlacementTypeSummaries } from '@/api/mock/creatorPerformance';
import { getCampaignAnalytics, getCampaignInsights, rollupWeekly } from '@/api/mock/campaignAnalytics';
import { reportCampaignFrom } from '@/api/campaigns';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';

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

const CID = 'camp-glowlab-q4';
function num(s: string): number {
  return Number.parseFloat(String(s).replace(/[$,%]/g, '')) || 0;
}

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
