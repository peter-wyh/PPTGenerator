import { describe, it, expect } from 'vitest';
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
