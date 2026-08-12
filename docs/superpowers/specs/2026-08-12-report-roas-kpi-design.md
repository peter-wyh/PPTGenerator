# 报告 ROAS KPI — 设计

- **日期**: 2026-08-12
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: recipe 报告(renderer)加 ROAS KPI 卡

## 背景

recipe 报告(`mapCampaign` / `mapFromDaily`)目前 5 个 KPI:Revenue / Clicks / Orders / NewCustomers / AOV,**无 ROAS**。而 `SYSTEM_PROMPT` 已要求 AI 报告含 "Total Spend, Total ROAS"(`ai-generate.service.ts:83`),并定义 `ROAS = GMV / Spend`(`:86`)—— recipe 落后于 AI。花费数据已齐:`CpsPerformance.spend`(汇总)+ `CpsDaily.spend`(每日,子项目 2 加)。补上 ROAS 让 recipe 与 AI 对齐,并兑现前两个子项目采集的 spend 数据。

## 目标 / 非目标

**目标**: recipe 报告两条路径(汇总 + 每日)都加一张 **ROAS** KPI 卡(`ROAS = GMV / Spend`),`spend > 0` 时显示。

**非目标**:
- 不加创作者表的 ROAS 列(另外的增强)。
- 不加 "Total Spend" 独立 KPI 卡(只加 ROAS;Spend 作为 ROAS 的输入,不单独展示)。
- 不改 AI 模式、不改 SYSTEM_PROMPT。

## 改动

### 1. `apps/server/src/modules/html-templates/recipe/format.ts`
新增 helper(与 formatMoney/formatNum/formatPct 同风格):
```ts
/** 比率/乘数 → "4.10x"(2 位小数 + x 后缀)。用于 ROAS 等。 */
export function formatRatio(v: number): string {
  return `${v.toFixed(2)}x`;
}
```

### 2. `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`
两条路径都累加 `spend`、算 ROAS、条件追加 KPI 卡:

**汇总路径(`mapCampaign`)** —— 新增独立的 `totalSpend` reduce(`publishers` 的 reduce 不动,只做展示用):
```ts
const totalSpend = campaign.campaignCreators.reduce(
  (s, cc) => s + cc.cpsPerformances.reduce((a, p) => a + Number(p.spend), 0),
  0,
);
```
KPI 数组末尾,`totalSpend > 0` 时追加:
```ts
const kpis = [
  { label: 'Total Revenues', value: formatMoney(totalRevenue) },
  { label: 'Clicks', value: formatNum(clicks) },
  { label: 'Orders', value: formatNum(orders) },
  { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
  { label: 'AOV', value: formatMoney(aov) },
  ...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend) }] : []),
];
```

**每日路径(`mapFromDaily`)** —— `DailySum` 加回 `spend`(I2 清理时移除的):
```ts
type DailySum = { clicks: number; orders: number; gmv: number; newCustomers: number; spend: number };
// 初始化 sum/spend 累加 `sum.spend += num(d.spend)`;total reduce 含 spend。
const totalSpend = total.spend;
```
KPI 数组末尾,`totalSpend > 0` 时追加(同汇总:`...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(total.gmv / totalSpend) }] : [])`)。

import 加 `formatRatio`。

### 3. `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs`
网格列数从硬编码 5 改为动态(支持 5 或 6 张卡):
```hbs
<div class="grid grid-cols-2 md:grid-cols-{{kpis.length}} gap-4">
```
（Tailwind play CDN 运行时扫描 DOM 生成 `md:grid-cols-5`/`md:grid-cols-6`,支持动态类名。）

## 关键决策(已确认)
1. **格式 `4.10x`**（乘数,2 位小数 + x）—— 匹配 SYSTEM_PROMPT/narrative 的 "ROAS 4.10" 约定;`x` 后缀比裸 "4.10" 清晰。
2. **`spend > 0` 才显示** —— 避免除零/Infinity;无花费数据的 campaign 保持 5 张卡,有花费的 6 张;动态列数兜住两种布局。两条路径一致。
3. **只加 KPI 卡** —— 不加创作者表 ROAS 列、不加独立 Spend 卡。

## 测试（扩 `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`）
- **汇总路径,有 spend** → KPI 含 ROAS,值 = `formatRatio(totalRevenue/totalSpend)`(用 fixture 算确值断言);`spend=0` 的 fixture → 无 ROAS(5 张)。
- **每日路径,有 spend + period** → ROAS = 期内 gmv / 期内 spend(期外 spend 不计入);用 `campaignRowWithDaily`(daily 带 spend)断言。
- `formatRatio` 单测(`4.105 → "4.11x"`?注意 toFixed 四舍五入;`4 → "4.00x"`)。
- 回归:现有 KPI 用例(无 spend)仍 5 张、值不变。

## 文件改动
| 文件 | 动作 |
|---|---|
| `apps/server/src/modules/html-templates/recipe/format.ts` | 加 `formatRatio` |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | 两路径加 spend 累加 + 条件 ROAS KPI |
| `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_kpi.hbs` | 网格列数动态化 |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | 扩 ROAS 用例 |
| `apps/server/src/modules/html-templates/recipe/format.test.ts` | 加 `formatRatio` 用例（该文件已存在,现 4 个用例） |

（纯 server;无 web 改动。）

## 风险
- ⚠️ **网格列数动态化**:依赖 Tailwind play CDN 运行时生成 `md:grid-cols-6`。recipe 报告用 play CDN(self-hosted `play.min.js`),运行时扫描 DOM 生成类名,支持。若改用预编译 Tailwind 则需 safelist(不在本范围)。
- ⚠️ **汇总路径 spend 来源**:`CpsPerformance.spend` 是 Decimal(默认 0)。`Number(p.spend)` 转换;缺失/0 → 0,ROAS 不显示。与每日路径(CpsDaily.spend,字符串)一致处理。
