# 报告 ROAS KPI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recipe 报告两条路径(汇总 + 每日)加一张 ROAS KPI 卡(`GMV/Spend`,`formatRatio → "4.10x"`),`spend > 0` 才显示。

**Architecture:** 新增 `formatRatio` helper;`mapper.ts` 两路径各累加 `spend` 并在 KPI 数组末尾条件追加 ROAS 卡;`_kpi.hbs` 网格列数从硬编码 5 改为 `{{kpis.length}}`(动态,Tailwind play CDN 运行时生成)。纯加法,`spend=0` 时报告与现状完全一致(5 张卡)。

**Tech Stack:** Node + Prisma、Handlebars(recipe 模板)、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-12-report-roas-kpi-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/server/src/modules/html-templates/recipe/format.ts` | 格式化 helpers | 加 `formatRatio` |
| `apps/server/src/modules/html-templates/recipe/format.test.ts` | format 单测 | 加 `formatRatio` 用例 |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | mapCampaign(汇总)+ mapFromDaily(每日) | 两路径加 spend 累加 + 条件 ROAS KPI |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | mapper 单测 | 加 ROAS 用例(汇总 + 每日) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs` | KPI 网格 | 列数动态化 |

---

## Task 1: `formatRatio` helper + 单测(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/format.ts`
- Test: `apps/server/src/modules/html-templates/recipe/format.test.ts`

- [ ] **Step 1: 写失败测试** —— 在 `format.test.ts` 的现有 `describe(...)` 块内(与 formatMoney/formatNum/formatPct 用例并列)加:

```ts
  it('formatRatio → "4.10x"(2 位小数 + x)', () => {
    expect(formatRatio(4)).toBe('4.00x');
    expect(formatRatio(4.105)).toBe('4.11x');   // toFixed 四舍五入
    expect(formatRatio(0.5)).toBe('0.50x');
  });
```
并在 `format.test.ts` 顶部 import 加 `formatRatio`:
```ts
import { formatMoney, formatNum, formatPct, formatRatio } from './format';
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/format.test.ts
```
Expected: FAIL —— `formatRatio is not defined`(未导出)。

- [ ] **Step 3: 实现** —— 在 `format.ts` 末尾(`formatPct` 之后)加:

```ts
/** 比率/乘数 → "4.10x"(2 位小数 + x 后缀)。用于 ROAS 等。 */
export function formatRatio(v: number): string {
  return `${v.toFixed(2)}x`;
}
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/format.test.ts
```
Expected: PASS(新用例 + 现有 4 个全过)。

- [ ] **Step 5: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

- [ ] **Step 6: 提交(2 文件,atomic)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/format.ts apps/server/src/modules/html-templates/recipe/format.test.ts && git commit -m "$(cat <<'EOF'
feat(recipe): 加 formatRatio helper(乘数 → "4.10x")

为 ROAS KPI 准备;2 位小数 + x 后缀。配单测。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 汇总路径 ROAS + KPI 网格动态列数

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(`mapCampaign` 汇总路径)
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试** —— 在 `mapper.test.ts` 顶部 `campaignRow` 定义之后,加一个带 spend 的汇总 fixture:

```ts
// 汇总 fixture 带 spend(metrics.totalRevenue 对齐 cps.gmv,使 ROAS 直观)
const campaignRowWithSpend = {
  ...campaignRow,
  metrics: { ...campaignRow.metrics, totalRevenue: 192000 },
  campaignCreators: [{
    ...campaignRow.campaignCreators[0],
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 48000, commission: 0 }],
  }],
};
```

在 `describe('mapCampaign', ...)` 内加两个用例:

```ts
  it('汇总路径 spend>0 → KPI 含 ROAS(= totalRevenue/totalSpend)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithSpend);
    const c = await mapCampaign('c1');
    const roas = c.kpis.find((k) => k.label === 'ROAS');
    expect(roas).toBeDefined();
    expect(roas!.value).toBe('4.00x'); // 192000 / 48000 = 4
  });

  it('汇总路径 spend=0 → 无 ROAS 卡(仍 5 个 KPI)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); // campaignRow 的 cps spend=0
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'ROAS')).toBeUndefined();
    expect(c.kpis).toHaveLength(5);
  });
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: FAIL —— 第一个用例 `roas` 为 undefined(mapCampaign 未加 ROAS)。

- [ ] **Step 3a: mapper.ts 汇总路径加 totalSpend + 条件 ROAS**

在 `mapper.ts` 顶部 import 加 `formatRatio`:
```ts
import { formatMoney, formatNum, formatPct, formatRatio } from '../format';
```

在 `mapCampaign` 的汇总路径,找到 `return {` 之前(publishers reduce 之后、`newCustomerRate` 计算附近)。在 `return {` 之前插入 `totalSpend` + `kpis` 计算:
```ts
  const totalSpend = campaign.campaignCreators.reduce(
    (s, cc) => s + cc.cpsPerformances.reduce((a, p) => a + Number(p.spend), 0),
    0,
  );
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(totalRevenue) },
    { label: 'Clicks', value: formatNum(clicks) },
    { label: 'Orders', value: formatNum(orders) },
    { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
    ...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend) }] : []),
  ];
```
然后把 `return { ... }` 里的内联 `kpis: [ ... ],` 改成引用上面的 `kpis` 常量(删掉内联数组,改成 `kpis,`)。最终 return 形如:
```ts
  return {
    header: { /* 不变 */ },
    kpis,
    trend,
    publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], // 由 narrative 填
  };
```

- [ ] **Step 3b: `_kpi.hbs` 网格列数动态化** —— 把:
```hbs
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
```
改成:
```hbs
        <div class="grid grid-cols-2 md:grid-cols-{{kpis.length}} gap-4">
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: PASS —— 2 个新用例 + 现有全过。

- [ ] **Step 5: server tsc + render 快照回归**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: tsc exit 0;render 快照不变(render fixture `campaignRow` 无 spend → 5 KPI → `md:grid-cols-5`,与改前字节一致)。

- [ ] **Step 6: 提交(3 文件,atomic)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts && git commit -m "$(cat <<'EOF'
feat(recipe): 汇总路径加 ROAS KPI + 网格动态列数

mapCampaign 汇总路径:totalSpend 从 cpsPerformances.spend 求和,spend>0 时
KPI 末尾追加 ROAS(totalRevenue/totalSpend,formatRatio)。_kpi.hbs 网格列数
md:grid-cols-{{kpis.length}} 动态化(支持 5/6 张)。spend=0 与现状一致(5 张)。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 每日路径 ROAS

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(`mapFromDaily`)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试** —— 在 `mapper.test.ts` 的 `describe('mapCampaign', ...)` 内加(复用已有 `campaignRowWithDaily` fixture,其 daily 带 spend):

```ts
  it('每日路径 period + daily 带 spend → KPI 含 ROAS(= 期内 gmv/期内 spend)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const roas = c.kpis.find((k) => k.label === 'ROAS');
    expect(roas).toBeDefined();
    // 期内 gmv 2000+3000=5000,期内 spend 200+300=500 → 10.0
    expect(roas!.value).toBe('10.00x');
  });
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: FAIL —— 每日路径 `roas` 为 undefined(mapFromDaily 未加 spend/ROAS)。

- [ ] **Step 3: mapper.ts `mapFromDaily` 加 spend + 条件 ROAS**

3a. `DailySum` 类型加 `spend`(I2 清理时移除的,ROAS 要用):
```ts
  type DailySum = { clicks: number; orders: number; gmv: number; newCustomers: number; spend: number };
```
3b. `perCreator.map` 的 `sum` 初始化加 `spend: 0`:
```ts
    const sum: DailySum = { clicks: 0, orders: 0, gmv: 0, newCustomers: 0, spend: 0 };
```
3c. daily 循环里加一行(在 `sum.newCustomers += num(d.newCustomers);` 之后):
```ts
        sum.spend += num(d.spend);
```
3d. `total` reduce 的累加器 init + reducer body 都加 `spend`:
```ts
  const total = perCreator.reduce<DailySum>(
    (a, x) => ({
      clicks: a.clicks + x.sum.clicks,
      orders: a.orders + x.sum.orders, gmv: a.gmv + x.sum.gmv,
      newCustomers: a.newCustomers + x.sum.newCustomers,
      spend: a.spend + x.sum.spend,
    }),
    { clicks: 0, orders: 0, gmv: 0, newCustomers: 0, spend: 0 },
  );
```
3e. KPI 数组末尾条件追加 ROAS(在 AOV 之后):
```ts
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(total.gmv) },
    { label: 'Clicks', value: formatNum(total.clicks) },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'New Customer Acquisition', value: formatNum(total.newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
    ...(total.spend > 0 ? [{ label: 'ROAS', value: formatRatio(total.gmv / total.spend) }] : []),
  ];
```
(`formatRatio` import 已在 Task 2 加。)

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts
```
Expected: PASS —— 新用例 + 现有全过(含 Task 2 的汇总 ROAS 用例 + 现有 period 用例)。

- [ ] **Step 5: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

- [ ] **Step 6: 提交(2 文件,atomic)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts && git commit -m "$(cat <<'EOF'
feat(recipe): 每日路径加 ROAS KPI

mapFromDaily:DailySum 加回 spend(I2 清理时移除的),期内 daily 求和,
spend>0 时 KPI 末尾追加 ROAS(total.gmv/total.spend)。与汇总路径一致。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## 收尾验证

- [ ] **Step 1: recipe 模块全测**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/
```
Expected: 全过(format + mapper + render + narrative + schema)。render 快照不变(其 fixture 无 spend → 5 KPI)。

- [ ] **Step 2: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

> 注:仓库更广 server 套件有与本次无关的预存失败(用户 WIP:projects 模块等),不属本范围。

---

## Self-Review

**1. Spec coverage:**
- formatRatio helper → Task 1。✓
- 汇总路径 spend 累加 + 条件 ROAS → Task 2 Step 3a。✓
- 每日路径 DailySum spend + 条件 ROAS → Task 3 Step 3。✓
- `_kpi.hbs` 动态列数 → Task 2 Step 3b。✓
- 测试(formatRatio + 汇总 spend>0/=0 + 每日 period) → Task 1/2/3。✓
- 关键决策(4.10x / spend>0 才显示 / 只 KPI 卡) → 各 Task 体现。✓

**2. Placeholder scan:** 无 TBD;mapper 编辑给精确 before/after 块 + 锚点;测试断言用确切值(4.00x/10.00x/5 张);命令带 expected。✓

**3. Type consistency:** `formatRatio(v: number): string` 在 Task 1 定义、Task 2/3 使用一致;`DailySum` 加 `spend`(Task 3)与 total reduce/perCreator sum 一致;`totalSpend`/`total.spend` 命名一致;ROAS KPI 形状 `{label, value}`(无 highlight)与现有 KPI 一致。✓

无问题,无需返工。
