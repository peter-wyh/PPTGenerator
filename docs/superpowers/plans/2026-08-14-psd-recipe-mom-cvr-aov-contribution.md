# PSD 报告 A 类 gap 补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recipe 报告补齐 CVR/AOV 派生 KPI + MoM 月环比组件,AI 报告补齐 Creator Contribution 归因叙事 prompt。

**Architecture:** CVR/AOV 是 recipe kpis 派生(mapFromDaily + 汇总分支);MoM 是 recipe 新组件(mapFromDaily 算前等长期间对比,进 `insights.mom`,在 `_kpi.hbs` 底部显示);Creator Contribution 是 AI system prompt 加模板引导(buildCampaignContext 数据不变)。daily 全在内存,不需新 DB 查询。

**Tech Stack:** Prisma、Zod(recipe schema)、Vitest、Handlebars(recipe)、DeepSeek(SYSTEM_PROMPT)。

**Spec:** `docs/superpowers/specs/2026-08-14-psd-recipe-mom-cvr-aov-contribution-design.md`

**执行环境:** 起一个 worktree(`superpowers:using-git-worktrees`),`worktree.baseRef=head` 已配。每个 task 一个 commit。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | mapFromDaily + 汇总的 kpis(CVR)+ MoM(prePeriod) | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts` | `insights.mom` optional | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs` | MoM 显示块 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | CVR/MoM 测试 | Modify |
| `apps/server/src/modules/html-templates/ai-generate.service.ts` | SYSTEM_PROMPT Creator Contribution 模板 | Modify |

---

## Task 1: CVR 派生 KPI(recipe 两路径,TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(mapFromDaily kpis L62-69 + 汇总 kpis 约 L226-233)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

> AOV 两路径都已有(mapFromDaily L68、汇总)。CVR 两路径都没有。本 task 加 CVR。

- [ ] **Step 1: 写失败测试**

在 `mapper.test.ts` 的 `describe('mapCampaign', ...)` 内新增两个测试:

```ts
  it('汇总 KPI 含 CVR(= orders/clicks × 100,格式化)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    const cvr = c.kpis.find((k) => k.label === 'Conversion Rate');
    expect(cvr).toBeDefined();
    // campaignRow: orders 1016, clicks 124678 → 1016/124678*100 = 0.8%
    expect(cvr!.value).toBe('0.8%');
  });

  it('汇总 clicks=0 → CVR 兜底 0%(除零安全)', async () => {
    const row = { ...campaignRow, campaignCreators: [{ ...campaignRow.campaignCreators[0], cpsPerformances: [{ ...campaignRow.campaignCreators[0].cpsPerformances[0], clicks: 0 }] }] };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Conversion Rate')!.value).toBe('0%');
  });

  it('mapFromDaily(reportPeriod)KPI 含 CVR(期内 orders/clicks)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    // 期内: clicks 200+300=500, orders 20+30=50 → 50/500*100 = 10%
    expect(c.kpis.find((k) => k.label === 'Conversion Rate')!.value).toBe('10%');
  });
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: 3 个新测试 FAIL(`Conversion Rate` kpi 不存在,`cvr` undefined)。

- [ ] **Step 3: mapFromDaily kpis 加 CVR**

mapper.ts 的 `mapFromDaily`,在 `const aov = ...`(L60)之后、`const kpis =`(L63)之前加 CVR 计算,并在 kpis 数组插入 Conversion Rate(放 Orders 之后):

```ts
  const aov = total.orders ? total.gmv / total.orders : 0;
  const cvr = total.clicks ? (total.orders / total.clicks) * 100 : 0;

  // 3) KPI(结构同 mapCampaign 现有)
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(total.gmv) },
    { label: 'Clicks', value: formatNum(total.clicks) },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'Conversion Rate', value: formatPct(Math.round(cvr * 10) / 10) },
    { label: 'New Customer Acquisition', value: formatNum(total.newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
  ];
```

- [ ] **Step 4: 汇总分支 kpis 加 CVR**

mapper.ts 的 `mapCampaign` 汇总分支(约 L226-233 的 `const kpis = [...]`),在 aov 行附近加 cvr 计算,并在 kpis 数组 Orders 后插入 Conversion Rate:

```ts
  const cvr = clicks ? (orders / clicks) * 100 : 0;
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(totalRevenue) },
    { label: 'Clicks', value: formatNum(clicks) },
    { label: 'Orders', value: formatNum(orders) },
    { label: 'Conversion Rate', value: formatPct(Math.round(cvr * 10) / 10) },
    { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
    ...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend) }] : []),
  ];
```

(`formatPct` 已在 mapper.ts 顶部 import;`clicks`/`orders`/`totalSpend`/`totalRevenue` 都在汇总分支作用域已有。)

- [ ] **Step 5: 跑测试验证通过**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: 全部 PASS(含 3 新 CVR + 既有)。注意既有 KPI 测试断言 kpis 数量/顺序的可能要核对 —— 既有测试用 `byLabel` 取值(不依赖顺序),应不受影响。

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts
git commit -m "$(cat <<'EOF'
feat(recipe): KPI 加 Conversion Rate 派生(orders/clicks,除零安全)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: MoM 月环比组件(recipe,TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts`(`insights.mom` optional)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(mapFromDaily 加 prePeriod + mom)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs`(MoM 显示块)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

> MoM 只在 mapFromDaily(reportPeriod + daily 路径)。汇总分支无 reportPeriod,不产 MoM。

- [ ] **Step 1: 写失败测试**

在 `mapper.test.ts` 的 `describe('mapCampaign', ...)` 内新增:

```ts
  it('mapFromDaily + reportPeriod → insights.mom 算前等长期间环比', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    // reportPeriod 2026-10-15 ~ 2026-10-17(3 天):期内 orders=20+30=50, gmv=2000+3000=5000
    // 前等长(3 天): 2026-10-12 ~ 2026-10-14。fixture daily 里 10-12 期外、10-15/16 期内 → 前等长无 daily 数据
    // → previousOrders=0 → mom undefined(降级)
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    expect(c.insights?.mom).toBeUndefined();
  });

  it('mapFromDaily + 前等长有数据 → mom 正确(ordersMoM/salesMoM 带 + 号)', async () => {
    // 给 fixture daily 补前等长期间(2026-10-12~14)数据
    const row = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any),
          daily: [
            ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any).daily,
            { date: '2026-10-13', clicks: '50', orders: '10', gmv: '1000', spend: '50', newCustomers: '3' },
          ],
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    // reportPeriod 10-15~17: orders 50, gmv 5000。前等长 10-12~14: orders 10(daily 加的 10-13), gmv 1000
    // ordersMoM = (50-10)/10*100 = +400%, salesMoM = (5000-1000)/1000*100 = +400%
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    expect(c.insights?.mom).toMatchObject({
      ordersMoM: '+400%', salesMoM: '+400%',
      currentOrders: 50, previousOrders: 10,
      currentSales: 5000, previousSales: 1000,
    });
  });
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: 第 2 个测试 FAIL(`insights.mom` undefined)。第 1 个可能 pass(mom 本就 undefined)—— 确认第 2 个 fail 即可。

- [ ] **Step 3: schema.ts 加 mom optional**

`schema.ts` 的 `insights` 对象(L26-36)加 `mom`:

```ts
  insights: z.object({
    topCategories: z.array(z.object({ label: z.string(), pct: z.number(), color: z.string() })).optional(),
    topProducts: z.array(z.object({ name: z.string(), revenue: z.string() })).optional(),
    topMarket: z.array(z.object({ country: z.string(), revenue: z.string(), pct: z.number(), color: z.string() })).optional(),
    topPromotion: z.array(z.object({
      name: z.string(), type: z.string(), revenue: z.string(), usage: z.string(), tagKind: z.string(),
    })).optional(),
    newCustomerRate: z.object({
      rate: z.string(), newCount: z.number(), totalOrders: z.number(), deltaPct: z.string().optional(),
    }).optional(),
    mom: z.object({
      ordersMoM: z.string(), salesMoM: z.string(),
      currentOrders: z.number(), previousOrders: z.number(),
      currentSales: z.number(), previousSales: z.number(),
    }).optional(),
  }).optional(),
```

- [ ] **Step 4: mapFromDaily 加 prePeriod + mom**

mapper.ts 的 `mapFromDaily`,在「7) insights」段(Task 5/6 已有 dimLinks + aggregateDimensions)里,合并 mom 进 insights。在 `const insights = { ...aggregateDimensions(dimLinks), newCustomerRate: {...} };` 之前加 prePeriod 计算 + mom,并 spread 进 insights:

```ts
  // 7b) MoM:reportPeriod vs 前等长期间(紧邻 reportPeriod 之前,同天数)
  const startD = new Date(start);
  const endD = new Date(end);
  const lenDays = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1; // 含,天数
  const preEndD = new Date(startD); preEndD.setDate(preEndD.getDate() - 1);
  const preStartD = new Date(preEndD); preStartD.setDate(preStartD.getDate() - (lenDays - 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const preStart = iso(preStartD);
  const preEnd = iso(preEndD);
  const inPre = (d: string) => d >= preStart && d <= preEnd;
  let preOrders = 0, preGmv = 0;
  for (const cc of campaign.campaignCreators ?? []) {
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPre(date)) continue;
        preOrders += num(d.orders);
        preGmv += num(d.gmv);
      }
    }
  }
  const signedPct = (cur: number, prev: number) => {
    const v = Math.round(((cur - prev) / prev) * 1000) / 10;
    return `${v > 0 ? '+' : ''}${formatPct(v)}`;
  };
  const mom = preOrders > 0 ? {
    ordersMoM: signedPct(total.orders, preOrders),
    salesMoM: signedPct(total.gmv, preGmv),
    currentOrders: total.orders, previousOrders: preOrders,
    currentSales: total.gmv, previousSales: preGmv,
  } : undefined;

  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = {
    ...aggregateDimensions(dimLinks),
    ...(mom ? { mom } : {}),
    newCustomerRate: { rate: formatPct(Math.round(rate * 10) / 10), newCount: total.newCustomers, totalOrders: total.orders },
  };
```

(替换原「7) insights」末尾的 `const rate / const insights` 两行。`start`/`end` 是 reportPeriod(L29 解构),`total`/`num`/`formatPct`/`Any` 都在作用域。)

- [ ] **Step 5: _kpi.hbs 加 MoM 显示块**

`partials/_kpi.hbs` 在 `</div>`(L9,KPI grid 结束)之前/之后加 MoM 块。在 KPI grid 的 `</div>`(L9)之后追加:

```hbs
        {{!-- MoM 月环比 --}}
        {{#if insights.mom}}
        <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="card relative overflow-hidden">
                <p class="font-semibold text-[13px] text-grey-secondary mb-1">Orders MoM</p>
                <h3 class="font-number font-semibold text-[28px] leading-tight text-brand-primary">{{insights.mom.ordersMoM}}</h3>
                <p class="text-[12px] text-grey-secondary mt-1">{{insights.mom.currentOrders}} vs {{insights.mom.previousOrders}}</p>
            </div>
            <div class="card relative overflow-hidden">
                <p class="font-semibold text-[13px] text-grey-secondary mb-1">Sales MoM</p>
                <h3 class="font-number font-semibold text-[28px] leading-tight text-brand-primary">{{insights.mom.salesMoM}}</h3>
                <p class="text-[12px] text-grey-secondary mt-1">{{insights.mom.currentSales}} vs {{insights.mom.previousSales}}</p>
            </div>
        </div>
        {{/if}}
```

- [ ] **Step 6: 跑测试验证通过 + render 快照**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/`
Expected: mapper.test.ts 全 PASS(含 2 新 MoM)。render.test.ts 快照变化(_kpi.hbs 加了 MoM 块结构)→ 用 `pnpm -C apps/server exec vitest run -u` 更新 `__snapshots__/render.test.ts.snap`,确认快照 diff 只是新增 MoM 块的 `{{#if}}` 结构。

- [ ] **Step 7: Commit**(含更新的 .snap)

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(recipe): MoM 月环比组件(reportPeriod vs 前等长期间)

insights.mom(ordersMoM/salesMoM + 当前/前值),_kpi.hbs 底部显示。
前等长无数据 → undefined 降级。schema mom optional。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: AI Creator Contribution 归因叙事(SYSTEM_PROMPT)

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts`(SYSTEM_PROMPT 加 Creator Contribution 段)

> 纯 prompt 改动。buildCampaignContext 已传 creators(cps orders + Creator 定位 + deliverables)。验证:现有 AI 测试不破坏 + tsc。

- [ ] **Step 1: SYSTEM_PROMPT 加 Creator Contribution 段**

`ai-generate.service.ts` 的 SYSTEM_PROMPT 字符串里,在合适的结构段(例如 `Header → KPI → Charts → Tables → Insights → Footer` 那段 ordering 说明之后,或 Tables 段说明附近)插入一段。先用 grep 定位 SYSTEM_PROMRT 里 "Tables → Insights" 或 "publishers" 附近,在它之后加:

```
═══ CREATOR CONTRIBUTION NARRATIVE ═══
For each creator in the campaign, include a "Creator Contribution" analysis (in the creators table area or a dedicated section):
- **Allocated orders**: use `creators[].cps.orders` (or `creator.cps.orders`) verbatim — do NOT fabricate.
- **Content role**: 1 sentence on their positioning + content form, grounded in `creator.category`, `creator.metrics.followers`, and `collaboration.deliverables` (content type: Story / Post / Article / Video).
- **Why it converted**: 1-2 sentences connecting their positioning/content to the allocated orders. Base it on the data provided (e.g. "pain-point → product → CTA structure matches strong multi-pack performance"), not generic claims.
Every number MUST come from the campaign JSON. If a creator has no `cps.orders`, write "no attributed orders" — never invent a number.
```

- [ ] **Step 2: 跑 AI 相关测试确认不破坏**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/ai-generate.service.test.ts`
Expected: 全 PASS(prompt 改动不影响 mock 测试;buildCampaignContext 未变)。

- [ ] **Step 3: server typecheck**

Run: `pnpm -C apps/server typecheck`
Expected: 无输出(tsc clean)。

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts
git commit -m "$(cat <<'EOF'
feat(ai): SYSTEM_PROMPT 加 Creator Contribution 归因叙事模板

引导 AI 基于 cps.orders + creator 定位 + deliverables 写
content role / why converted,禁止编造数字。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 全量验证

- [ ] **Step 1: server 全测试**

Run: `pnpm -C apps/server exec vitest run src`
Expected: 全绿(含 CVR 3 + MoM 2 新测试 + 既有)。tests/ 集成(DB)失败是 pre-existing,不算。

- [ ] **Step 2: server typecheck**

Run: `pnpm -C apps/server typecheck`
Expected: exit 0。

- [ ] **Step 3: 端到端冒烟(可选,需 DB + dev server)**

给一个有 daily 的 campaign(如 camp-wander-summer),recipe 渲染确认 KPI 含 CVR + MoM 块;AI 报告确认含 Creator Contribution 叙事。

- [ ] **Step 4: 收尾 commit(若有)**

无则跳过。

---

## Self-Review

**Spec 覆盖:**
- CVR/AOV 派生 KPI → Task 1(CVR 加;AOV 已有,确认)✓
- MoM 月环比组件 → Task 2 ✓
- Creator Contribution AI prompt → Task 3 ✓
- 错误处理(除零 / 前等长降级)→ Task 1 除零测试 + Task 2 preOrders=0 降级测试 ✓
- 验收标准 4 条 → Task 4 ✓
- 不做项(B 类)→ 无对应 task ✓

**类型一致性:** `insights.mom` 在 schema(Task 2 Step 3)与 mapper 产出(Task 2 Step 4)字段名一致(ordersMoM/salesMoM/currentOrders/previousOrders/currentSales/previousSales);_kpi.hbs(Task 2 Step 5)引用 `insights.mom.ordersMoM` 等同名;CVR kpi label 两路径都是 'Conversion Rate'。

**无占位:** 所有 step 含完整代码;SYSTEM_PROMPT 段用 grep 定位(给出搜索锚点)+ 完整插入文本;无 TODO/类似 Task N。

**范围:** 单一 plan,4 task 顺序推进,每个独立可测可 commit。
