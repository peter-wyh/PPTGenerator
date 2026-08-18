import { beforeEach, describe, expect, it, vi } from 'vitest';

// ai-generate.service 顶层 import prisma，纯函数测试里 mock 掉避免实例化 PrismaClient。
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { aiGenerateService, rewriteExternalAssets, SYSTEM_PROMPT_DISPLAY } from './ai-generate.service';

describe('ai-generate.service · rewriteExternalAssets', () => {
  const base = 'https://campaignreport.sk8s.cn';

  it('改写 Tailwind Play CDN → 自托管', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>`;
    const out = rewriteExternalAssets(html, base);
    expect(out).toBe(`<script src="${base}/vendor/tailwind/play.min.js"></script>`);
    expect(out).not.toContain('cdn.tailwindcss.com');
  });

  it('改写 Chart.js UMD（jsdelivr）→ 自托管', () => {
    const html = `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`;
    const out = rewriteExternalAssets(html, base);
    expect(out).toContain(`${base}/vendor/chartjs/chart.umd.min.js`);
    expect(out).not.toContain('cdn.jsdelivr.net/npm/chart.js');
  });

  it('改写 FontAwesome（cdnjs 写法）→ 自托管', () => {
    const html = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">`;
    const out = rewriteExternalAssets(html, base);
    expect(out).toContain(`${base}/vendor/fontawesome/css/all.min.css`);
    expect(out).not.toContain('cdnjs.cloudflare.com');
  });

  it('改写 FontAwesome（jsdelivr @fortawesome 写法）→ 自托管', () => {
    const html = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css">`;
    const out = rewriteExternalAssets(html, base);
    expect(out).toContain(`${base}/vendor/fontawesome/css/all.min.css`);
    expect(out).not.toContain('@fortawesome/fontawesome-free');
  });

  it('baseUrl 为空时 no-op（不破坏无 PUBLIC_BASE_URL 的场景）', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>`;
    expect(rewriteExternalAssets(html, '')).toBe(html);
    expect(rewriteExternalAssets(html, '   ')).toBe(html);
  });

  it('去掉 baseUrl 尾部斜杠，避免双斜杠', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>`;
    expect(rewriteExternalAssets(html, `${base}/`)).toBe(
      `<script src="${base}/vendor/tailwind/play.min.js"></script>`,
    );
  });

  it('保留无关 URL（Google Fonts 等）不动', () => {
    const html = `<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">`;
    expect(rewriteExternalAssets(html, base)).toBe(html);
  });

  it('真实报告 head：三处 CDN 同时改写，不漏不改错', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
</head><body><i class="fas fa-chart-line"></i></body></html>`;
    const out = rewriteExternalAssets(html, base);
    expect(out).toContain(`${base}/vendor/tailwind/play.min.js`);
    expect(out).toContain(`${base}/vendor/chartjs/chart.umd.min.js`);
    expect(out).toContain(`${base}/vendor/fontawesome/css/all.min.css`);
    expect(out).toContain('https://fonts.googleapis.com/css2?family=Inter'); // 字体保留
    expect(out).not.toContain('cdn.tailwindcss.com');
    expect(out).not.toContain('cdnjs.cloudflare.com/ajax/libs/font-awesome');
    expect(out).not.toContain('cdn.jsdelivr.net/npm/chart.js');
    // 图标 class 不受影响
    expect(out).toContain('fas fa-chart-line');
  });
});

describe('ai-generate.service · buildCampaignContext 宁缺勿假', () => {
  const dailyCamp = {
    id: 'c1', name: 'T', platform: 'TikTok', startDate: '2026-10-01', endDate: '2026-10-31',
    budget: 1, status: 'x', businessLineCode: 'FT', metrics: { clicks: 1 },
    analytics: { trend: [{ date: '2026-10-01', revenue: 999 }], summary: { totalRevenue: 999 }, topProducts: [{ n: 1 }], weeklyTrend: [{ w: 1 }], topMarkets: [{ m: 1 }], insights: [{ i: 1 }], customerSplit: { newCustomers: 1, returningCustomers: 2 } },
    businessLine: { name: 'FT' }, advertiser: { name: 'A' },
    campaignCreators: [{
      creator: { name: 'M', platform: 'TikTok', partnerType: 'creator' },
      cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
        daily: [{ date: '2026-10-02', clicks: '10', orders: '1', gmv: '100', impressions: '0', spend: '0', commission: '0', newCustomers: '0' }] }],
      performance: { summary: {} },
    }],
  };

  beforeEach(() => vi.clearAllMocks());

  it('有 period 且 daily 有交集 → 上下文含 periodKpis + dataCoverage，不含 analytics 数字字段', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(json).toContain('periodKpis');
    expect(json).toContain('dataCoverage');
    expect(json).not.toContain('topProducts');
    expect(json).not.toContain('weeklyTrend'); // 顶层扁平字段也不出现
    expect(json).not.toContain('analytics');
  });

  it('有 period 零交集 → 无 periodKpis，附 dataCoverage(covered=null)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-11-01', endDate: '2026-11-05' });
    expect(json).not.toContain('periodKpis');
    expect(json).toContain('"covered": null');
  });

  it('无 period → dataGaps 列出缺失维度', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1');
    expect(json).toContain('dataGaps');
  });

  it('SYSTEM_PROMPT_DISPLAY 含 Data Unavailable 禁编造规则', () => {
    expect(SYSTEM_PROMPT_DISPLAY).toContain('Data Unavailable');
    expect(SYSTEM_PROMPT_DISPLAY).toContain('禁止编造');
  });

  it('SYSTEM_PROMPT_DISPLAY 含 periodKpis 优先级规则', () => {
    expect(SYSTEM_PROMPT_DISPLAY).toContain('periodKpis');
    expect(SYSTEM_PROMPT_DISPLAY).toContain('优先使用 periodKpis');
  });
});
