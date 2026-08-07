# 报告按 reportPeriod 重算(recipe 路径)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recipe 路径串通 `reportPeriod`,有 period 且 campaign 有 CPS daily 数据时,`mapCampaign` 从 `CpsPerformance.daily` 按日期切片重算 KPI/创作者/趋势/`header.period`;无 period 或无 daily 时行为与现状完全一致。

**Architecture:** `mapCampaign(campaignId, reportPeriod?)` 顶部加分支:`reportPeriod && hasDaily` → 调纯函数 `mapFromDaily(campaign, reportPeriod)` 派生 `{kpis, publishers, trend, period, insights}` 并返回;否则走现有逻辑(降级时 console.warn)。透传链 `RenderInput.reportPeriod → render → mapCampaign`,controller recipe 分支补一个透传字段。

**Tech Stack:** Node + Express + Prisma、Vitest(prisma mock)、Handlebars(recipe 模板)。

**Spec:** `docs/superpowers/specs/2026-08-07-report-period-recompute-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | `mapCampaign` + 新 `mapFromDaily` 纯函数 | 改(加 reportPeriod 参数 + 顶部分支 + helper) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | mapCampaign 单测 | 改(加带 daily 的 fixture + 4 个 period 用例) |
| `apps/server/src/modules/html-templates/recipe/types.ts` | `RenderInput` 类型 | 改(+= `reportPeriod?`) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` | render 入口 | 改(把 reportPeriod 传给 mapCampaign) |
| `apps/server/src/modules/html-templates/html-templates.controller.ts` | `generate` 的 recipe 分支 | 改(透传 reportPeriod) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts` | render 单测 | 改(加 daily fixture + 1 个 period 转发用例) |

---

## Task 1: `mapFromDaily` + `mapCampaign` 分支(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试** —— 在 `mapper.test.ts` 顶部 `campaignRow` 定义之后,加一个带 daily 的 fixture;在 `describe('mapCampaign', ...)` 内加 4 个用例。

在 `campaignRow` 定义之后(约 line 24 后)加入:

```ts
// 带 CPS daily 的 fixture(daily 值为字符串,与 importCpsDaily 落库一致)
const campaignRowWithDaily = {
  id: 'c1', name: 'Test', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-10-20',
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  metrics: { totalRevenue: 999999, clicks: 999999, orders: 999999, newCustomers: 999999, aov: 999, newCustomerRate: 50 },
  analytics: { trend: { labels: ['x'], revenue: [999999], clicks: [999999], orders: [999999] } },
  campaignCreators: [{
    creator: { name: 'Mia Chen', handle: '@mia', platform: 'TikTok', partnerType: 'creator', profileUrl: 'u1' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{
      clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0,
      daily: [
        { date: '2026-10-12', clicks: '100', orders: '10', gmv: '1000', spend: '100', newCustomers: '5' },  // 期外 before
        { date: '2026-10-15', clicks: '200', orders: '20', gmv: '2000', spend: '200', newCustomers: '8' },  // 期内
        { date: '2026-10-16', clicks: '300', orders: '30', gmv: '3000', spend: '300', newCustomers: '12' }, // 期内
        { date: '2026-10-20', clicks: '400', orders: '40', gmv: '4000', spend: '400', newCustomers: '15' }, // 期外 after
      ],
    }],
    performance: { summary: {} },
  }],
};
```

在 `describe('mapCampaign', () => { ... })` 内(末尾 `});` 前)加 4 个用例:

```ts
  it('有 period → KPI/publishers/trend 只含期内 daily,header.period=reportPeriod', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$5,000');      // 2000+3000
    expect(byLabel['Clicks']).toBe('500');                 // 200+300
    expect(byLabel['Orders']).toBe('50');                  // 20+30
    expect(byLabel['New Customer Acquisition']).toBe('20');// 8+12
    expect(byLabel['AOV']).toBe('$100');                   // 5000/50
    expect(c.publishers).toHaveLength(1);
    expect(c.publishers[0].revenue).toBe('$5,000');
    expect(c.publishers[0].clicks).toBe('500');
    expect(c.publishers[0].orders).toBe('50');
    expect(c.trend.labels).toEqual(['2026-10-15', '2026-10-16']);
    expect(c.trend.revenue).toEqual([2000, 3000]);
    expect(c.trend.orders).toEqual([20, 30]);
    expect(c.header.period.start).toBe('2026-10-15');
    expect(c.header.period.end).toBe('2026-10-17');
  });

  it('无 daily 数据 + period → 降级为汇总(不报错,KPI 来自 metrics)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); // campaignRow 无 daily
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$876,360'); // 来自 metrics,非 daily
  });

  it('period 半开(只 startDate)→ 单边过滤', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-16' }); // 只 start,无 end
    // >= 2026-10-16:10-16、10-20 入;10-12、10-15 出
    expect(c.trend.labels).toEqual(['2026-10-16', '2026-10-20']);
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$7,000'); // 3000+4000
  });

  it('旧 daily(无 spend/newCustomers)+ period → 当 0,不 NaN', async () => {
    const oldRow = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0,
          daily: [{ date: '2026-10-15', clicks: '200', orders: '20', gmv: '2000' }], // 无 spend/newCustomers
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(oldRow);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['New Customer Acquisition']).toBe('0');
    expect(byLabel['Total Revenues']).toBe('$2,000');
  });
```

- [ ] **Step 2: 跑测试,确认失败**

Run(从 `apps/server`):
```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: **FAIL** —— 4 个新用例挂(`mapCampaign` 现签名只收 1 个参,period 被忽略 → 数字是全量/汇总);现有 6 个用例仍过。

- [ ] **Step 3: 实现** —— 在 `mapper.ts` 加 `mapFromDaily` 纯函数 + `mapCampaign` 顶部分支。

3a. 在 `shortDate` 函数之后(约 line 18 后)、`mapCampaign` 之前,加 `mapFromDaily`:

```ts
/**
 * reportPeriod 给定且有 CPS daily 数据时,从 CpsPerformance.daily 按日期切片
 * 派生 KPI / publishers / trend / period / insights。纯函数,不查 DB。
 * 与 mapCampaign 的「汇总派生」分支隔离,可独立测试。
 */
function mapFromDaily(
  campaign: Any,
  reportPeriod: { startDate?: string; endDate?: string },
): { kpis: CampaignReportContent['kpis']; publishers: CampaignReportContent['publishers']; trend: CampaignReportContent['trend']; period: CampaignReportContent['header']['period']; insights: CampaignReportContent['insights'] } {
  const { startDate, endDate } = reportPeriod;
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const num = (v: unknown) => Number(v) || 0;

  // 1) 每个创作者的期内 daily 求和
  const perCreator = (campaign.campaignCreators ?? []).map((cc: Any) => {
    const sum = { clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, newCustomers: 0 };
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        sum.clicks += num(d.clicks);
        sum.impressions += num(d.impressions);
        sum.orders += num(d.orders);
        sum.gmv += num(d.gmv);
        sum.spend += num(d.spend);
        sum.newCustomers += num(d.newCustomers);
      }
    }
    return { cc, sum };
  });

  // 2) 总量
  const total = perCreator.reduce(
    (a, x) => ({
      clicks: a.clicks + x.sum.clicks, impressions: a.impressions + x.sum.impressions,
      orders: a.orders + x.sum.orders, gmv: a.gmv + x.sum.gmv,
      spend: a.spend + x.sum.spend, newCustomers: a.newCustomers + x.sum.newCustomers,
    }),
    { clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, newCustomers: 0 },
  );
  const aov = total.orders ? total.gmv / total.orders : 0;

  // 3) KPI(结构同 mapCampaign 现有)
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(total.gmv) },
    { label: 'Clicks', value: formatNum(total.clicks) },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'New Customer Acquisition', value: formatNum(total.newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
  ];

  // 4) publishers(同 mapCampaign 现有结构)
  const publishers = perCreator.map(({ cc, sum }) => {
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(sum.gmv),
      clicks: formatNum(sum.clicks),
      orders: formatNum(sum.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  // 5) trend:跨创作者按 date 分组(日粒度)
  const byDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
  for (const cc of campaign.campaignCreators ?? []) {
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        const entry = byDate.get(date) ?? { revenue: 0, clicks: 0, orders: 0 };
        entry.revenue += num(d.gmv);
        entry.clicks += num(d.clicks);
        entry.orders += num(d.orders);
        byDate.set(date, entry);
      }
    }
  }
  const dates = [...byDate.keys()].sort();
  const trend = {
    labels: dates,
    revenue: dates.map((d) => byDate.get(d)!.revenue),
    clicks: dates.map((d) => byDate.get(d)!.clicks),
    orders: dates.map((d) => byDate.get(d)!.orders),
  };

  // 6) period
  const start = reportPeriod.startDate ?? campaign.startDate;
  const end = reportPeriod.endDate ?? campaign.endDate;
  const period = { start, end, display: `${shortDate(start)} - ${shortDate(end)}, ${String(start).slice(0, 4)}` };

  // 7) insights(newCustomerRate 从 daily 重算)
  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = { newCustomerRate: { rate: formatPct(Math.round(rate * 10) / 10), newCount: total.newCustomers, totalOrders: total.orders } };

  return { kpis, publishers, trend, period, insights };
}
```

3b. 改 `mapCampaign` 签名 + 顶部加分支。把现有第一行:
```ts
export async function mapCampaign(campaignId: string): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');
```
改成(签名加 `reportPeriod?`,在 `if (!campaign) throw` 之后插分支):
```ts
export async function mapCampaign(campaignId: string, reportPeriod?: { startDate?: string; endDate?: string }): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');

  // ★ reportPeriod + 有 CPS daily → 从 daily 派生;否则走下方现有汇总逻辑
  const hasDaily = (campaign.campaignCreators ?? []).some((cc: Any) =>
    (cc.cpsPerformances ?? []).some((p: Any) => Array.isArray(p.daily) && p.daily.length > 0));
  if (reportPeriod && hasDaily) {
    const { kpis, publishers, trend, period, insights } = mapFromDaily(campaign, reportPeriod);
    return {
      header: {
        brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
        merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
        period,
      },
      kpis, trend, publishers,
      insights,
      actionable: [], // 由 narrative 填(与现有路径一致)
    };
  }
  if (reportPeriod && !hasDaily) {
    console.warn('[mapCampaign] reportPeriod given but no CPS daily data; falling back to aggregate');
  }
```
(下方现有汇总逻辑完全不动。)

- [ ] **Step 4: 跑测试,确认通过**

Run(从 `apps/server`):
```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: **PASS** —— 4 个新用例 + 现有 6 个全过(共 10)。

- [ ] **Step 5: server tsc(CI gate)**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0,无输出。

- [ ] **Step 6: 提交(只 add 这两个文件)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts && git commit -m "$(cat <<'EOF'
feat(recipe): mapCampaign 按 reportPeriod 从 CPS daily 重算

mapCampaign(campaignId, reportPeriod?):有 period 且有 CPS daily 时,调纯函数
mapFromDaily 按 [start,end] 切片 daily 重算 KPI/publishers/trend/insights/period;
无 period 或无 daily 走原汇总逻辑(降级时 console.warn)。配 4 个 period 单测。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 串通 reportPeriod(controller → render → mapCampaign)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/types.ts`(`RenderInput`)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`(`generate` recipe 分支)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`(转发用例)

- [ ] **Step 1: `RenderInput` 加 `reportPeriod?`**(`types.ts`)

把现有:
```ts
export interface RenderInput {
  campaignId: string;
```
(后面有 `tokenOverrides?` / `manifestOverrides?` / `reportContent?` 三行)
在 `campaignId: string;` 之后加一行:
```ts
  reportPeriod?: { startDate?: string; endDate?: string };
```
(即 `RenderInput` 变为:`campaignId` + `reportPeriod?` + `tokenOverrides?` + `manifestOverrides?` + `reportContent?`。)

- [ ] **Step 2: `render` 透传 reportPeriod**(`render.ts`)

把 `render` 内(约 line 33):
```ts
  const content = input.reportContent ?? await mapCampaign(input.campaignId!);
```
改成:
```ts
  const content = input.reportContent ?? await mapCampaign(input.campaignId!, input.reportPeriod);
```

- [ ] **Step 3: controller recipe 分支透传**(`html-templates.controller.ts`)

在 `generate` handler 的 recipe 分支(约 line 65-68),把:
```ts
      html = await getRecipe(recipeId ?? 'campaign-report').render({ campaignId, theme, designMd: req.body.designMd });
```
改成:
```ts
      html = await getRecipe(recipeId ?? 'campaign-report').render({ campaignId, theme, designMd: req.body.designMd, reportPeriod });
```
(`reportPeriod` 已在 handler 顶部从 `req.body` 解构,`generateHtmlSchema` 已允许它——AI 分支在用。无需改 schema/路由。)

- [ ] **Step 4: 加 render 转发用例**(`render.test.ts`)

在 `campaignRow` 定义之后加带 daily 的 fixture:
```ts
const campaignRowWithDaily = {
  ...campaignRow,
  campaignCreators: [{
    ...campaignRow.campaignCreators[0],
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
```
在 `describe('render', () => { ... })` 内末尾加转发用例:
```ts
  it('reportPeriod 透传到 mapCampaign → HTML 含期内数字、不含期外', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    const html = await render({ campaignId: 'c1', reportPeriod: { startDate: '2026-10-15', endDate: '2026-10-17' } });
    // 期内 gmv 合计 5000 → 注入 HTML
    expect(html).toContain('$5,000');
    // 期外日(10-12 的 gmv 1000、10-20 的 4000)不应作为 KPI 出现
    expect(html).not.toContain('$1,000');
    expect(html).not.toContain('$4,000');
  });
```
(注:`beforeEach` 把 `findUnique` 默认 mock 成 `campaignRow`;本用例覆盖成 `campaignRowWithDaily`。快照用例用的是默认 `campaignRow`(无 daily、无 period),不受影响。)

- [ ] **Step 5: 跑 render + mapper 测试 + 双端 tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/ && pnpm exec tsc -b --force
```
Expected: recipe 目录全测过(含 mapper 10 个 + render 全部含新转发用例 + 快照不变);tsc exit 0。

- [ ] **Step 6: 提交(4 个文件)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/types.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.ts apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts apps/server/src/modules/html-templates/html-templates.controller.ts && git commit -m "$(cat <<'EOF'
feat(recipe): 串通 reportPeriod controller→render→mapCampaign

RenderInput+=reportPeriod?;render 透传给 mapCampaign;controller recipe 分支
补 reportPeriod 字段(修现在 recipe 模式丢 reportPeriod 的 bug)。配 render 转发用例。
DataPanel 调 generate({mode:'recipe',reportPeriod}) 现在真正按时段重算。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## 收尾验证

- [ ] **Step 1: html-templates 模块全测无新回归**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/
```
Expected: 全过(含 mapper 10、render 全部、recipe 其它、ai-generate 8)。`render` 的快照用例必须仍过(证明「无 period 不变」)。

- [ ] **Step 2: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

> 注:仓库更广的 server/web 套件存在与本次无关的预存失败(未合 WIP),不属本计划范围。本计划只对 recipe 模块负责。

---

## Self-Review

**1. Spec coverage:**
- §架构 1 透传(types/controller/render)→ Task 2 Step 1-3。✓
- §架构 2 mapCampaign 分支 + mapFromDaily → Task 1 Step 3。✓
- §mapFromDaily 算法(KPI/publishers/trend/period/insights、inPeriod、num 防 NaN)→ Task 1 Step 3a。✓
- §关键决策(无 period 不动 / trend 从 daily / 无 daily 降级)→ Task 1 分支 + 测试覆盖。✓
- §边界(period 半开、旧 daily 缺字段、期外排除)→ Task 1 用例 3/4 + 用例 1。✓
- §测试(mapper.test.ts 扩 period 用例)→ Task 1 Step 1。✓
- §文件改动 5 个文件 → Task 1(mapper.ts+test)+ Task 2(types/render/controller+render.test)。✓

**2. Placeholder scan:** 无 TBD/TODO;mapFromDaily 完整;测试断言用确切数字(5000/500/50/20/100 等);命令带 expected。✓

**3. Type consistency:** `mapCampaign(campaignId, reportPeriod?)` 签名在 Task 1 定义、Task 2 render 调用一致;`RenderInput.reportPeriod` 形状 `{startDate?, endDate?}` 与 mapCampaign 参数、controller `reportPeriod`(从 `generateHtmlSchema`)一致;`mapFromDaily` 返回字段名 `kpis/publishers/trend/period/insights` 与 mapCampaign 解构一致。✓

无问题,无需返工。
