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
} satisfies CampaignReportContent;

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
