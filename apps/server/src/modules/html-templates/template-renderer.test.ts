import { beforeEach, describe, expect, it, vi } from 'vitest';

// extractPeriodData 直接查 prisma.campaign.findUnique({ include: { campaignCreators: { include: { creator, performance, cpsPerformances } } } })
// ★ 真源切换(cps-daily 废弃)：loadCreatorCps 走 cc/LP/订单三查询——mock 同款注入
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  campaignCreator: { findMany: vi.fn() },
  linkPerformance: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

function mockCreatorCps(campaignRow: any) {
  const ccs = (campaignRow.campaignCreators ?? []).map((cc: any, i: any) => ({
    id: cc.id ?? `cc_${i}`, creatorId: cc.creatorId ?? `creator_${i}`, creator: { name: cc.creator?.name ?? 'X' },
  }));
  prismaMock.campaignCreator.findMany.mockResolvedValue(ccs);
  const lpRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) =>
    (cc.cpsPerformances ?? []).map((pp: any, j: any) => ({
      id: `lp_${i}_${j}`, campaignCreatorId: ccs[i].id, publisher: { creatorId: null },
      clicks: pp.clicks ?? 0, impressions: pp.impressions ?? 0, orders: pp.orders ?? 0,
      gmv: pp.gmv ?? 0, commission: pp.commission ?? 0, spend: pp.spend ?? 0,
      daily: pp.daily ?? [],
    })),
  );
  prismaMock.linkPerformance.findMany.mockResolvedValue(lpRows);
  campaignRow.linkPerformances = lpRows;
  const orderRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) => {
    const ccId = ccs[i].id;
    const rows = [];
    for (const perf of (cc.cpsPerformances ?? [])) {
      for (const dd of (perf.daily ?? [])) {
        const date = String(dd.date ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        rows.push({ ccId, d: date, cnt: BigInt(Number(dd.orders) || 0), sale: Number(dd.gmv) || 0, comm: Number(dd.commission) || 0, nc: BigInt(Number(dd.newCustomers) || 0) });
      }
    }
    return rows;
  });
  prismaMock.$queryRaw.mockResolvedValue(orderRows);
}

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { extractPeriodData, renderTemplate } from './template-renderer';

const AVATAR_URL = 'https://cdn.example.com/alice.jpg';
const PERIOD = { startDate: '2026-08-01', endDate: '2026-08-11' };

/** 一个 creator,带真实 avatar + 期内有 CPS daily(让该行被选中)。creator 头像是 Prisma 的 `avatar` 字段,非 `avatarUrl`。 */
function campaignWithAvatarCreator() {
  return {
    id: 'camp-1',
    platform: 'instagram',
    startDate: '2026-08-01',
    endDate: '2026-08-11',
    metrics: {},
    campaignCreators: [
      {
        id: 'cc_0', creatorId: 'creator_0',
        creator: {
          name: 'Alice',
          handle: '@alice',
          platform: 'instagram',
          partnerType: 'mega',
          avatar: AVATAR_URL, // Prisma schema 字段名是 avatar(schema.prisma:262)
        },
        performance: { posts: 5, engagement: 100, impressions: 1000, engagementRate: 10 },
        cpsPerformances: [
          {
            daily: [
              {
                date: '2026-08-05',
                clicks: 50,
                orders: 5,
                gmv: 500,
                newCustomers: 3,
                commission: 50,
              },
            ],
          },
        ],
      },
    ],
    businessLine: null,
    advertiser: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const row = campaignWithAvatarCreator();
  prismaMock.campaign.findUnique.mockResolvedValue(row);
  mockCreatorCps(row);
});

describe('template-renderer · 达人头像字段名映射', () => {
  it('extractPeriodData 把 Prisma creator.avatar 映射到 CreatorRow.avatarUrl', async () => {
    const data = await extractPeriodData('camp-1', PERIOD);
    expect(data.creators).toHaveLength(1);
    expect(data.creators[0].avatarUrl).toBe(AVATAR_URL);
  });

  it('renderTemplate 把达人头像 URL 渲染进 creators 表格行', async () => {
    const html = await renderTemplate(
      `<html><body>
        <tbody data-field="creators">
          <tr data-creator="template">
            <td data-field="creator.avatar">placeholder</td>
            <td data-field="creator.name">name</td>
          </tr>
        </tbody>
      </body></html>`,
      'camp-1',
      PERIOD,
    );
    expect(html).toContain(AVATAR_URL);
  });
});

describe('template-renderer · $ 值替换回归(反斜杠/捕获组注入)', () => {
  // fixture:gmv=17918 → revenue/AOV 均为 formatMoney 产物,以 $ 开头($17.9K/$100.00)
  function campaignWithMoney() {
    return {
      ...campaignWithAvatarCreator(),
      campaignCreators: [
        {
          id: 'cc_0', creatorId: 'creator_0',
          creator: { name: 'Alice', handle: '@alice', platform: 'instagram', partnerType: 'mega', avatar: AVATAR_URL },
          performance: { posts: 5, engagement: 100, impressions: 1000, engagementRate: 10 },
          cpsPerformances: [
            {
              daily: [
                // gmv=17918, orders=5 → revenue=$17.9K、aov=$3583.60($ 数字)
                { date: '2026-08-05', clicks: 50, orders: 5, gmv: 17918, newCustomers: 3, commission: 50 },
              ],
            },
          ],
        },
      ],
    };
  }

  it('revenue 值 "$17.9K" 不被当作 $1 反向引用(标签不复制、$ 保留)', async () => {
    const moneyRow = campaignWithMoney();
    prismaMock.campaign.findUnique.mockResolvedValue(moneyRow);
    mockCreatorCps(moneyRow);
    const html = await renderTemplate(
      `<p class="kpi-value" data-field="revenue">$8.1K</p>`,
      'camp-1',
      PERIOD,
    );
    expect(html).toBe(`<p class="kpi-value" data-field="revenue">$17.9K</p>`);
  });

  it('aov 值含 $ 且位数多($3600)不塌标签', async () => {
    const moneyRow2 = campaignWithMoney();
    prismaMock.campaign.findUnique.mockResolvedValue(moneyRow2);
    mockCreatorCps(moneyRow2);
    const html = await renderTemplate(
      `<p class="kpi-value" data-field="aov">$34</p>`,
      'camp-1',
      PERIOD,
    );
    // formatMoney(17918/5=3583.6) → 走 >=1000 分支 "$3600";关键断言:$ 保留、标签完整
    expect(html).toBe(`<p class="kpi-value" data-field="aov">$3600</p>`);
  });

  it('period.display 值若含 $ 也不注入(per 替换同修)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignWithMoney());
    const html = await renderTemplate(
      `<span data-field="period.display">$old 2026</span>`,
      'camp-1',
      PERIOD,
    );
    // period.display 来自 startDate~endDate(测试 fixture 8/1~8/11),不含 $;
    // 但断言旧 $ 文本被替换、span 完整闭合即可防回归
    expect(html).toMatch(/^<span data-field="period\.display">[^<]*<\/span>$/);
    expect(html).not.toContain('$old');
  });
});

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
      }],
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

  it('非整月窗口 → priorTrend 等长前窗；前窗无数据 → priorTrend 空数组 + trendPeak 仍可算', async () => {
    const camp = monthCamp();
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    // 8/20-8/21（等长前窗 8/18-8/19 无数据）
    const data = await extractPeriodData('camp-m', { startDate: '2026-08-20', endDate: '2026-08-21' });
    expect(data.trend).toEqual([]); // 期内无 daily
    expect(data.priorTrend).toEqual([]);
    expect(data.trendPeak).toBeNull();
  });
});
