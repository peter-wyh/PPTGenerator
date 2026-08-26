// render.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() }, guide: { findMany: vi.fn() },
  // ★ 真源切换(cps-daily 废弃)：loadCreatorCps 三查询
  campaignCreator: { findMany: vi.fn() },
  linkPerformance: { findMany: vi.fn() },
  orderDailyStat: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

/** mockCreatorCps(mapper.test 同款)：fixture cpsPerformances → cc/LP/订单三查询 mock。 */
function mockCreatorCps(campaignRow: any) {
  const ccs = (campaignRow.campaignCreators ?? []).map((cc: any, i: any) => ({
    id: cc.id ?? `cc_${i}`, creatorId: cc.creatorId ?? `creator_${i}`, creator: { name: cc.creator?.name ?? 'X' },
  }));
  prismaMock.campaignCreator.findMany.mockResolvedValue(ccs);
  const lpRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) =>
    (cc.cpsPerformances ?? []).map((p: any, j: any) => ({
      id: `lp_${i}_${j}`, campaignCreatorId: ccs[i].id, publisher: { creatorId: null },
      clicks: p.clicks ?? 0, impressions: p.impressions ?? 0, orders: p.orders ?? 0,
      gmv: p.gmv ?? 0, commission: p.commission ?? 0, spend: p.spend ?? 0,
      daily: p.daily ?? [],
    })),
  );
  prismaMock.linkPerformance.findMany.mockResolvedValue(lpRows);
  campaignRow.linkPerformances = lpRows;
  // 成交侧:顶层 orders/gmv 差值放末日 + daily 逐日行(mapper.test 同款)
  const orderRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) => {
    const ccId = ccs[i].id;
    const rows = [];
    for (const perf of (cc.cpsPerformances ?? [])) {
      const daily = perf.daily ?? [];
      const sum = (k: any) => daily.reduce((acc: any, d: any) => acc + (Number(d[k]) || 0), 0);
      const ordersTot = (perf.orders ?? 0) - sum('orders');
      const gmvTot = (perf.gmv ?? 0) - sum('gmv');
      const ncTot = (perf.newCustomers ?? 0) - sum('newCustomers');
      if (ordersTot > 0 || gmvTot > 0 || ncTot > 0) {
        const dates = daily.map((d: any) => String(d.date)).filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
        rows.push({ ccId, d: dates.length ? dates[dates.length - 1] : '2026-01-01', cnt: BigInt(Math.max(0, Math.round(ordersTot))), sale: gmvTot, comm: 0, nc: BigInt(Math.max(0, Math.round(ncTot))) });
      }
      for (const dd of daily) {
        const date = String(dd.date ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        rows.push({ ccId, d: date, cnt: BigInt(Number(dd.orders) || 0), sale: Number(dd.gmv) || 0, comm: Number(dd.commission) || 0, nc: BigInt(Number(dd.newCustomers) || 0) });
      }
    }
    return rows;
  });
  prismaMock.$queryRaw.mockResolvedValue(orderRows);
}
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));
vi.mock('./narrative', () => ({ fillActionable: vi.fn().mockResolvedValue([{ icon: 'trophy', color: 'green', title: 'Top Performers', items: [{ text: 'Mia', sub: '(ROAS 4.10)' }], footer: 'Scale.' }]) }));

import { render } from './render';
import { mapCampaign } from './mapper';
import { fillActionable } from './narrative';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12', 'Nov 10'], revenue: [50000, 166360], clicks: [15000, 83619], orders: [250, 876] } },
  campaignCreators: [{
    id: 'cc_0', creatorId: 'creator_0',
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

const campaignRowWithDaily = {
  ...campaignRow,
  campaignCreators: [{
    ...campaignRow.campaignCreators[0],
    id: 'cc_0', creatorId: 'creator_0',
    cpsPerformances: [{
      clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0,
      daily: [
        { date: '2026-10-12', clicks: '100', orders: '10', gmv: '1000', spend: '100', newCustomers: '5' },
        { date: '2026-10-15', clicks: '200', orders: '20', gmv: '2000', spend: '200', newCustomers: '8' },
        { date: '2026-10-16', clicks: '300', orders: '30', gmv: '3000', spend: '300', newCustomers: '12' },
        { date: '2026-10-20', clicks: '400', orders: '40', gmv: '4000', spend: '400', newCustomers: '15' },
      ],
    }],
  }],
};

beforeEach(() => { vi.clearAllMocks(); prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); prismaMock.guide.findMany.mockResolvedValue([]); mockCreatorCps(campaignRow); prismaMock.orderDailyStat.findMany.mockResolvedValue([]); });

describe('render · 宁缺勿假呈现', () => {
  // 基线 content 走真实 mapCampaign(fixture 数据),仅覆盖 dataCoverage / kpis
  const buildBase = async () => await mapCampaign('c1');

  it('dataCoverage 不完整 → header 下方渲染 coverage 提示条(含实际区间与缺失天数)', async () => {
    const base = await buildBase();
    const html = await render({ campaignId: 'c1', reportContent: {
      ...base,
      dataCoverage: { requested: { start: '2026-10-12', end: '2026-10-20' }, covered: { start: '2026-10-15', end: '2026-10-20' }, missingDays: 6, complete: false },
    } } as any);
    expect(html).toContain('Data coverage:');
    expect(html).toContain('2026-10-15');
    expect(html).toContain('6 days missing');
  });

  it('covered=null → 渲染红色无数据提示条(引导导入真实数据)', async () => {
    const base = await buildBase();
    const html = await render({ campaignId: 'c1', reportContent: {
      ...base,
      dataCoverage: { requested: { start: '2026-10-12', end: '2026-10-20' }, covered: null, missingDays: 9, complete: false },
    } } as any);
    expect(html).toContain('No data available for the requested period');
    expect(html).toContain('import/cps-daily');
  });

  it('complete=true → 无 coverage 提示条;空态 KPI 渲染占位文案降级样式', async () => {
    const base = await buildBase();
    const html = await render({ campaignId: 'c1', reportContent: {
      ...base,
      kpis: [{ label: 'No data for this period', value: '—', highlight: false }],
      dataCoverage: { requested: { start: '2026-10-12', end: '2026-10-20' }, covered: { start: '2026-10-12', end: '2026-10-20' }, missingDays: 0, complete: true },
    } } as any);
    expect(html).not.toContain('Data coverage:');
    expect(html).toContain('No data for this period');
    expect(html).toContain('kpi-unavailable');
  });
});

describe('render · 指南语调节传给洞察文案', () => {
  it('campaign 有指南 → fillActionable 收到语调节字符串', async () => {
    prismaMock.campaign.findUnique.mockImplementation(async () => ({
      ...campaignRow, businessLineId: 'bl1',
      businessLine: { name: 'DG', code: 'DG' },
    }));
    prismaMock.guide.findMany.mockResolvedValue([
      { id: 'g1', scenario: null, name: '默认', content: '## 语调与术语\n用「创作者」', isDefault: true, isActive: true, businessLineId: 'bl1' },
    ]);
    await render({ campaignId: 'c1' });
    const call = (fillActionable as any).mock.calls.at(-1);
    expect(call?.[1]).toContain('用「创作者」');
  });

  it('无指南 → fillActionable 第二参为空串', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ ...campaignRow, businessLineId: 'bl1', businessLine: { name: 'DG', code: 'DG' } });
    prismaMock.guide.findMany.mockResolvedValue([]);
    await render({ campaignId: 'c1' });
    const call = (fillActionable as any).mock.calls.at(-1);
    expect(call?.[1]).toBe('');
  });
});

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
    // 宁缺勿假:汇总口径 trend 不再读 analytics.trend → 空序列注入
    expect(html).toContain('data: []');
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

  it('缺 campaignId → 400(不查 DB)', async () => {
    await expect(render({ campaignId: '' } as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled();
  });

  it('manifestOverrides.hidden 隐藏组件', async () => {
    const html = await render({ campaignId: 'c1', manifestOverrides: { hidden: ['insights'] } });
    expect(html).not.toContain('Insight & Analysis');
    // KPI 区无可见标题,用注入的真实数字锚定(KPI cards 仍在)
    expect(html).toContain('$876,360');
  });

  it('manifestOverrides.order 调整组件顺序', async () => {
    const html = await render({
      campaignId: 'c1',
      manifestOverrides: { order: ['header', 'publishers', 'kpi', 'trend', 'actionable'] },
    });
    const publishersIdx = html.indexOf('Publisher Performance Overview');
    const kpiIdx = html.indexOf('$876,360');
    expect(publishersIdx).toBeGreaterThan(0);
    expect(publishersIdx).toBeLessThan(kpiIdx);
  });

  it('tokenOverrides 覆盖主色', async () => {
    const html = await render({ campaignId: 'c1', tokenOverrides: { brandPrimary: '#3b82f6' } } as any);
    expect(html).toContain('#3b82f6');
    // 默认主色 #ff099e 不应再出现(tokens.brandPrimary 已被全覆盖,所有引用点都换成覆盖值)
    expect(html).not.toContain('#ff099e');
  });

  it('reportContent 快照优先于 mapCampaign', async () => {
    const base = await mapCampaign('c1');
    base.kpis[0].label = '总收入(手改)';
    const html = await render({ campaignId: 'c1', reportContent: base } as any);
    expect(html).toContain('总收入(手改)');
  });

  it('reportPeriod 透传到 mapCampaign → HTML 含期内数字、不含期外', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const html = await render({ campaignId: 'c1', reportPeriod: { startDate: '2026-10-15', endDate: '2026-10-17' } });
    // 期内 gmv 合计 5000 → 注入 HTML
    expect(html).toContain('$5,000');
    // 期外日(10-12 的 gmv 1000、10-20 的 4000)不应作为 KPI 出现
    expect(html).not.toContain('$1,000');
    expect(html).not.toContain('$4,000');
  });

  it('资源走自托管 /vendor/ + Google Fonts 国内镜像(无海外 CDN)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('/vendor/tailwind/play.min.js');
    expect(html).toContain('/vendor/chartjs/chart.umd.min.js');
    expect(html).toContain('/vendor/fontawesome/css/all.min.css');
    expect(html).toContain('fonts.loli.net');
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).not.toContain('cdn.jsdelivr.net/npm/chart.js');
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('fonts.googleapis.com');
  });
});
