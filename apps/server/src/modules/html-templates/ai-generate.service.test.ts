import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEEPSEEK_API_KEY 在模块顶层读取,须在 import 之前(hoisted)设置
vi.hoisted(() => { process.env.DEEPSEEK_API_KEY = 'test-key'; });

// ai-generate.service 顶层 import prisma，纯函数测试里 mock 掉避免实例化 PrismaClient。
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  guide: { findMany: vi.fn() },
  orderDailyStat: { findMany: vi.fn() },
  // ★ 真源切换(cps-daily 废弃)：loadCreatorCps 三查询
  campaignCreator: { findMany: vi.fn() },
  linkPerformance: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

/** mockCreatorCps(其他 test 同款)：fixture cpsPerformances → cc/LP/订单三查询 mock。 */
function mockCreatorCps(campaignRow: any) {
  const ccs = (campaignRow.campaignCreators ?? []).map((cc: any, i: any) => ({
    id: cc.id ?? 'cc_' + i, creatorId: cc.creatorId ?? 'creator_' + i, creator: { name: cc.creator?.name ?? 'X' },
  }));
  prismaMock.campaignCreator.findMany.mockResolvedValue(ccs);
  const lpRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) =>
    (cc.cpsPerformances ?? []).map((pp: any, j: any) => ({
      id: 'lp_' + i + '_' + j, campaignCreatorId: ccs[i].id, publisher: { creatorId: null },
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
    businessLine: { title: 'FT' }, advertiser: { name: 'A' },
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
    mockCreatorCps(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(json).toContain('periodKpis');
    expect(json).toContain('dataCoverage');
    expect(json).not.toContain('topProducts');
    expect(json).not.toContain('weeklyTrend'); // 顶层扁平字段也不出现
    expect(json).not.toContain('analytics');
  });

  it('有 period 零交集 → 无 periodKpis，附 dataCoverage(covered=null)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-11-01', endDate: '2026-11-05' });
    expect(json).not.toContain('periodKpis');
    expect(json).toContain('"covered": null');
  });

  it('无 period → dataGaps 列出缺失维度', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
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
  const camp = {
    name: 'T', platform: 'x', startDate: '2026-07-01', endDate: '2026-07-31',
    budget: 0, status: 'x', businessLineCode: 'DG', metrics: null, analytics: null,
    businessLineId: 'bl1', businessLine: { title: 'DG 好物', code: 'DG' },
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
    mockCreatorCps(camp);
    prismaMock.guide.findMany.mockResolvedValue([
      { id: 'g-mo', scenario: '月报', name: 'DG 月报指南', content: '## 语调与术语\n用「创作者」', isDefault: false, isActive: true, updatedAt: new Date() },
    ]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p', guideId: 'g-mo' });
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.guideUsed).toEqual([{ id: 'g-mo', name: 'DG 月报指南' }]); // 双层:数组承载(视觉+结构)
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toContain('BUSINESS LINE GUIDE');
    expect(sys).toContain('用「创作者」');
    expect(sys).toContain('Prepared by DG 好物');
    expect(sys).not.toContain('{{GUIDE}}'); // 占位符已替换
  });

  it('无匹配指南 → system 等于 CORE,guideUsed 空数组,user prompt 不再拼设计指南', async () => {
    // 无业务线名(businessLine 缺失 → businessLineName='') → system 严格等于 CORE
    prismaMock.campaign.findUnique.mockResolvedValue({ ...camp, businessLine: null });
    mockCreatorCps({ ...camp, businessLine: null });
    prismaMock.guide.findMany.mockResolvedValue([]);
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toEqual([]); // 双层:无匹配=空数组
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toBe(SYSTEM_PROMPT);
    const user = body.messages.find((m: any) => m.role === 'user').content as string;
    expect(user).not.toContain('BRAND DESIGN GUIDE'); // 旧注入路径已废除
  });

  it('Guide 查询抛错 → 静默降级无指南,不阻断生成', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(camp);
    mockCreatorCps(camp);
    prismaMock.guide.findMany.mockRejectedValue(new Error('db down'));
    const out = await aiGenerateService.generateHtml({ campaignId: 'c1', prompt: 'p' });
    expect(out.guideUsed).toEqual([]); // 双层:无指南=空数组
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
    // ★ CORE 导航豁免段也含 "BUSINESS LINE GUIDE" 字样,须用注入段独有标记断言位置
    expect(s.indexOf('★★★ BUSINESS LINE GUIDE (MANDATORY')).toBeGreaterThan(SYSTEM_PROMPT.length); // 拼在 CORE 之后
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

describe('editHtml · 编辑续写带指南(风格一致)', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    aiClientMock.fetchChatCompletionWithRetry.mockReset().mockResolvedValue({
      response: {
        ok: true, status: 200,
        json: async () => ({ choices: [{ message: { content: '<!DOCTYPE html><html><body>edited</body></html>' } }] }),
      } as any,
      attempts: 1,
    });
  });

  it('传 guideContent+businessLineName → system = EDIT 基座 + 指南 + 业务事实', async () => {
    const html = await aiGenerateService.editHtml({
      currentHtml: '<!DOCTYPE html><html><body>x</body></html>',
      instruction: '改标题',
      guideContent: '## 语调与术语\n克制',
      businessLineName: 'DG 好物',
    });
    expect(html).toContain('edited');
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).toContain('You are an HTML editor agent'); // EDIT 基座
    expect(sys).toContain('BUSINESS LINE GUIDE');
    expect(sys).toContain('克制');
    expect(sys).toContain('Prepared by DG 好物');
  });

  it('不传指南 → system 等于 EDIT_SYSTEM_PROMPT 原文', async () => {
    await aiGenerateService.editHtml({ currentHtml: '<!DOCTYPE html><html></html>', instruction: 'i' });
    const body = aiClientMock.fetchChatCompletionWithRetry.mock.calls[0][0];
    const sys = body.messages.find((m: any) => m.role === 'system').content as string;
    expect(sys).not.toContain('BUSINESS LINE GUIDE');
  });
});

describe('ai-generate.service · buildCampaignContext 订单中间层口径', () => {
  beforeEach(() => vi.clearAllMocks());

  /** mock getRange 的两次 findMany(聚合行 → creator 行)。 */
  function mockOrderStats(totalRows: unknown[], creatorRows: unknown[]) {
    prismaMock.orderDailyStat.findMany
      .mockResolvedValueOnce(totalRows)
      .mockResolvedValueOnce(creatorRows);
  }
  const dec = (v: string) => ({ toString: () => v, toNumber: () => Number(v) });
  const dailyCamp = {
    id: 'c1', name: 'T', platform: 'TikTok', startDate: '2026-10-01', endDate: '2026-10-31',
    budget: 1, status: 'x', businessLineCode: 'FT', metrics: { clicks: 1 },
    analytics: {},
    businessLine: { title: 'FT' }, advertiser: { name: 'A' },
    campaignCreators: [{
      id: 'cc1',
      creator: { name: 'M', platform: 'TikTok', partnerType: 'creator' },
      cpsPerformances: [{ clicks: 0, orders: 0, gmv: 0, spend: 0, commission: 0, impressions: 0,
        daily: [{ date: '2026-10-02', clicks: '10', orders: '1', gmv: '100', impressions: '0', spend: '0', commission: '0', newCustomers: '0' }] }],
      performance: { summary: {} },
    }],
  };

  /** periodKpis 的 {label,value} 在 JSON 里是多行对象——按相邻对断言。 */
  function kpiJson(json: string, label: string, value: string): boolean {
    return json.includes(`"label": "${label}"`) &&
      json.includes(`"label": "${label}"`) &&
      new RegExp(`"label": "${label}",\\s*"value": "${value.replace(/\$/g, '\\$')}"`).test(json);
  }

  it('中间层有数据 → periodKpis 换订单源;新客标签缺失 → N/A + dataGaps 声明;注入 orderStatusSplit', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
    mockOrderStats(
      [{ statDate: '2026-10-02', campaignCreatorId: '', totalOrders: 25, approvedOrders: 20, pendingOrders: 5, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('250.00'), pendingCommission: dec('50.00'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [{ country: 'Netherlands', orders: 25, commission: '300.00' }] }],
      [{ statDate: '2026-10-02', campaignCreatorId: 'cc1', totalOrders: 25, approvedOrders: 20, pendingOrders: 5, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('250.00'), pendingCommission: dec('50.00'), newCustomerOrders: 0, hasNewCustomerTag: false }],
    );
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    // periodKpis 来自订单表:orders 25(revenue 佣金口径 300)
    expect(kpiJson(json, 'Orders', '25')).toBe(true);
    expect(kpiJson(json, 'Total Revenues', '$300')).toBe(true);
    // 新客标签缺失 → N/A(不编造 0)
    expect(kpiJson(json, 'New Customer Acquisition', 'N/A')).toBe(true);
    // dataGaps 声明 newCustomers 缺失
    expect(json).toContain('newCustomers');
    // 状态拆分 + 国家注入
    expect(json).toContain('"orderStatusSplit"');
    expect(json).toContain('"approved": 20');
    expect(json).toContain('"topCountries"');
    // clicks 保持 daily(10)
    expect(kpiJson(json, 'Clicks', '10')).toBe(true);
  });

  it('daily 无 clicks key(数据源缺失) → Clicks=N/A + dataGaps 声明 + trend 不带 clicks', async () => {
    // daily 记录只含 orders/gmv(无 clicks key)——模拟 Awin 导入通道(从不写 clicks)
    const noClicksCamp = {
      ...dailyCamp,
      campaignCreators: [{
        ...dailyCamp.campaignCreators[0],
        cpsPerformances: [{
          ...dailyCamp.campaignCreators[0].cpsPerformances[0],
          daily: [{ date: '2026-10-02', orders: '1', gmv: '100' }],
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(noClicksCamp);
    mockCreatorCps(noClicksCamp);
    mockOrderStats(
      [{ statDate: '2026-10-02', campaignCreatorId: '', totalOrders: 25, approvedOrders: 20, pendingOrders: 5, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('250.00'), pendingCommission: dec('50.00'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: null, topDevices: [] }],
      [],
    );
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    // Clicks 渲染 N/A,不编造 0
    expect(kpiJson(json, 'Clicks', 'N/A')).toBe(true);
    // dataGaps 声明 clicks 缺失
    expect(json).toContain('"clicks"');
    // trend 不带 clicks 字段
    const trendMatch = json.match(/"dailyTrend":\s*\[[\s\S]*?\]/);
    expect(trendMatch?.[0]).not.toContain('clicks');
  });

  it('设备维度注入 deviceSplit(区间合并)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
    mockOrderStats(
      [{ statDate: '2026-10-02', campaignCreatorId: '', totalOrders: 25, approvedOrders: 25, pendingOrders: 0, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('300.00'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: null, topDevices: [{ device: 'iPhone', orders: 15 }, { device: 'Android Mobile', orders: 10 }] }],
      [],
    );
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(json).toContain('"deviceSplit"');
    expect(json).toContain('"device": "iPhone"');
  });

  it('中间层有数据 + 标签可用 → 新客输真值', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
    mockOrderStats(
      [{ statDate: '2026-10-02', campaignCreatorId: '', totalOrders: 10, approvedOrders: 10, pendingOrders: 0, otherOrders: 0, totalCommission: dec('100.00'), approvedCommission: dec('100.00'), pendingCommission: dec('0'), newCustomerOrders: 4, hasNewCustomerTag: true, topCountries: null }],
      [],
    );
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(kpiJson(json, 'New Customer Acquisition', '4')).toBe(true);
  });

  it('中间层无数据(空行) → 走 daily 老路(不注入 orderStatusSplit)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(dailyCamp);
    mockCreatorCps(dailyCamp);
    prismaMock.orderDailyStat.findMany.mockResolvedValue([]);
    const json = await aiGenerateService.buildCampaignContext('c1', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(json).not.toContain('orderStatusSplit');
    // daily 口径:orders 1 / gmv 100
    expect(kpiJson(json, 'Orders', '1')).toBe(true);
  });
});
