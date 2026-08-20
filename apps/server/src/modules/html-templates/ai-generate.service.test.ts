import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEEPSEEK_API_KEY 在模块顶层读取,须在 import 之前(hoisted)设置
vi.hoisted(() => { process.env.DEEPSEEK_API_KEY = 'test-key'; });

// ai-generate.service 顶层 import prisma，纯函数测试里 mock 掉避免实例化 PrismaClient。
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  guide: { findMany: vi.fn() },
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

const aiClientMock = vi.hoisted(() => ({ fetchChatCompletionWithRetry: vi.fn() }));
vi.mock('./ai-client', () => aiClientMock);

import { aiGenerateService, buildSystemPrompt, rewriteExternalAssets, SYSTEM_PROMPT, SYSTEM_PROMPT_DISPLAY } from './ai-generate.service';

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

describe('generateHtml · 指南接入与 guideUsed 回传', () => {
  /** buildCampaignContext + resolveForCampaign 共用 campaign.findUnique mock 的最小形状 */
  const camp = {
    name: 'T', platform: 'x', startDate: '2026-07-01', endDate: '2026-07-31',
    budget: 0, status: 'x', businessLineCode: 'DG', metrics: null, analytics: null,
    businessLineId: 'bl1', businessLine: { name: 'DG 好物', code: 'DG' },
    advertiser: null, campaignCreators: [],
  };
  const okResp = {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '<!DOCTYPE html><html><body>ok</body></html>' } }] }),
  } as any;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    aiClientMock.fetchChatCompletionWithRetry.mockReset().mockResolvedValue({ response: okResp, attempts: 1 });
  });

  it('campaign 带 businessLineId → system 含指南,pick 用 scenario;返回 guideUsed', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    prismaMock.guide.findMany.mockResolvedValue([
      { id: 'g-mo', scenario: '月报', name: 'DG 月报指南', content: '## 语调与术语\n用「创作者」', isDefault: false, isActive: true, updatedAt: new Date() },
    ]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p', scenario: '月报' });
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.guideUsed).toEqual({ id: 'g-mo', name: 'DG 月报指南' });
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toContain('BUSINESS LINE GUIDE');
    expect(sys).toContain('用「创作者」');
    expect(sys).toContain('Prepared by DG 好物');
    expect(sys).not.toContain('{{GUIDE}}'); // 占位符已替换
  });

  it('无匹配指南 → system 等于 CORE,guideUsed=null,user prompt 不再拼设计指南', async () => {
    // 无业务线名(businessLine 缺失 → businessLineName='') → system 严格等于 CORE
    prismaMock.campaign.findUnique.mockResolvedValue({ ...camp, businessLine: null });
    prismaMock.guide.findMany.mockResolvedValue([]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toBeNull();
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toBe(SYSTEM_PROMPT);
    const user = body.messages.find((m: any) => m.role === 'user').content as string;
    expect(user).not.toContain('BRAND DESIGN GUIDE'); // 旧注入路径已废除
  });

  it('Guide 查询抛错 → 静默降级无指南,不阻断生成', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    prismaMock.guide.findMany.mockRejectedValue(new Error('db down'));
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toBeNull();
    expect(out.html).toContain('<!DOCTYPE html>');
  });
});

describe('buildSystemPrompt · 三层拼装', () => {
  const guide = '# DG 报告指南\n## 品牌视觉\n主色 #ff099e\n## 语调与术语\n用「创作者」';

  it('无指南无业务线名 → 等于 CORE 原文', () => {
    expect(buildSystemPrompt({})).toBe(SYSTEM_PROMPT);
  });
  it('有指南 → 追加 BUSINESS LINE GUIDE 段,含指南原文与覆盖规则', () => {
    const s = buildSystemPrompt({ guideContent: guide });
    expect(s).toContain(SYSTEM_PROMPT);
    expect(s).toContain('BUSINESS LINE GUIDE');
    expect(s).toContain('#ff099e');
    expect(s.indexOf('BUSINESS LINE GUIDE')).toBeGreaterThan(SYSTEM_PROMPT.length); // 拼在 CORE 之后
  });
  it('指南空串 → 视同无指南', () => {
    expect(buildSystemPrompt({ guideContent: '   ' })).toBe(SYSTEM_PROMPT);
  });
  it('businessLineName → 业务事实段含 Prepared by <名称>', () => {
    const s = buildSystemPrompt({ businessLineName: 'DG 好物' });
    expect(s).toContain('Prepared by DG 好物');
  });
  it('CORE 无业务词残留:不含 "Prepared by" 字面量(署名示例已移入业务事实段)', () => {
    expect(SYSTEM_PROMPT).not.toContain('Prepared by');
  });
  it('EDIT 基座:EDIT_SYSTEM_PROMPT + 指南', () => {
    const s = buildSystemPrompt({ base: 'EDIT_BASE', guideContent: guide });
    expect(s.startsWith('EDIT_BASE')).toBe(true);
    expect(s).toContain('BUSINESS LINE GUIDE');
  });
});
