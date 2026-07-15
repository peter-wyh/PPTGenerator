import { describe, it, expect } from 'vitest';
import type { CampaignAnalytics, CampaignInsight } from '@mediakit/shared';

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
