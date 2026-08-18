import { beforeEach, describe, expect, it, vi } from 'vitest';

// extractPeriodData 直接查 prisma.campaign.findUnique({ include: { campaignCreators: { include: { creator, performance, cpsPerformances } } } })
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));

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
  prismaMock.campaign.findUnique.mockResolvedValue(campaignWithAvatarCreator());
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
    prismaMock.campaign.findUnique.mockResolvedValue(campaignWithMoney());
    const html = await renderTemplate(
      `<p class="kpi-value" data-field="revenue">$8.1K</p>`,
      'camp-1',
      PERIOD,
    );
    expect(html).toBe(`<p class="kpi-value" data-field="revenue">$17.9K</p>`);
  });

  it('aov 值含 $ 且位数多($3600)不塌标签', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignWithMoney());
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
