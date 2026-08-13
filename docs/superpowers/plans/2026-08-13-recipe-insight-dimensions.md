# recipe Insight & Analysis 四维度数据补齐 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 recipe 报告的 Insight & Analysis 4 张维度卡(品类/产品/市场/促销)显示来自 CpsPerformance 维度标签的真实聚合数据,随 reportPeriod 重算。

**Architecture:** CpsPerformance 加 5 个链接级维度列 → importCpsPerformance 录入 → 新增纯函数 `aggregateDimensions` 把链接按维度 group + 算 pct/color/tagKind → mapper 的两条路径(mapFromDaily / 汇总)调用它 → _insights.hbs 既有的 `{{#if}}` 守卫自动点亮/降级。

**Tech Stack:** Prisma(MySQL,手写 migration)、Zod(仅现有,本特性 import 路径不经 zod)、Vitest、Handlebars(recipe 模板)。

**Spec:** `docs/superpowers/specs/2026-08-13-recipe-insight-dimensions-design.md`

**执行环境:** 起一个 worktree(`superpowers:using-git-worktrees`),在隔离工作树里按 task 推进。每个 task 一个 commit。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `apps/server/prisma/schema.prisma` | CpsPerformance 模型 | Modify(+5 维度列) |
| `apps/server/prisma/migrations/<ts>_cps_dimensions/migration.sql` | DDL | Create |
| `apps/server/src/modules/campaigns/campaigns.service.ts` | `importCpsPerformance` 录入 | Modify |
| `apps/server/src/modules/campaigns/campaigns.service.test.ts` | 录入测试 | Modify |
| `apps/web/src/editor/dataImport.ts` | 前端 CPS 字段清单/预览列 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.ts` | 维度聚合纯函数 | Create |
| `apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.test.ts` | 聚合单测 | Create |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | mapFromDaily + 汇总接入 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | 集成测试 | Modify |
| `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs` | 促销 tag CSS | Modify |

**为什么 `dimensions.ts` 独立成文件:** 聚合是纯函数、逻辑自成一域,独立后可单测、mapper 保持聚焦(符合 spec「新增纯函数 aggregateDimensions」)。

---

## Task 1: CpsPerformance 加 5 维度列 + migration

**Files:**
- Modify: `apps/server/prisma/schema.prisma`(CpsPerformance 模型,L403-429)
- Create: `apps/server/prisma/migrations/<ts>_cps_dimensions/migration.sql`

- [ ] **Step 1: schema.prisma CpsPerformance 加 5 列**

在 `CpsPerformance` 模型的 `spend` 行(L419)之后、`daily` 注释(L421)之前插入:

```prisma
  /// 维度标签(链接级,一条 CPS 链接一组维度;recipe Insight & Analysis 聚合用)。
  productName String?
  category    String?
  market      String?
  promoName   String?
  promoType   String?
```

- [ ] **Step 2: 生成 Prisma client**

Run: `pnpm -C apps/server exec prisma generate`
Expected: `✔ Generated Prisma Client`。TS 类型 `CpsPerformance` 现在含 5 个可选字段。

- [ ] **Step 3: 写 migration SQL**

创建目录与文件(时间戳由命令生成,避免手敲):

```bash
MIG="apps/server/prisma/migrations/$(date +%Y%m%d%H%M%S)_cps_dimensions"
mkdir -p "$MIG"
```

写入 `$MIG/migration.sql`:

```sql
ALTER TABLE `cps_performance`
  ADD COLUMN `productName` VARCHAR(191) NULL,
  ADD COLUMN `category`    VARCHAR(191) NULL,
  ADD COLUMN `market`      VARCHAR(191) NULL,
  ADD COLUMN `promoName`   VARCHAR(191) NULL,
  ADD COLUMN `promoType`   VARCHAR(191) NULL;
```

- [ ] **Step 4: 应用 migration 到 dev DB**

> dev DB 跑不了 `migrate dev`(缺 shadow DB 权限),用 `migrate deploy`。

Run: `pnpm -C apps/server exec prisma migrate deploy`
Expected: `Applied 1 migration named ... cps_dimensions`。

- [ ] **Step 5: 验证 DB schema 已变更**

Run: `pnpm -C apps/server exec prisma db pull --print | grep -A2 productName`
Expected: 输出含 `productName String?`(确认列已落库且与 schema 一致)。

- [ ] **Step 6: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations
git commit -m "feat(cps): CpsPerformance 加 5 维度列(product/category/market/promo)+ migration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: importCpsPerformance 录入维度字段(TDD)

**Files:**
- Modify: `apps/server/src/modules/campaigns/campaigns.service.ts`(`importCpsPerformance`,L479-522)
- Test: `apps/server/src/modules/campaigns/campaigns.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `campaigns.service.test.ts` 末尾(`describe('importService.importCpsDaily ...')` 之后)新增:

```ts
describe('importService.importCpsPerformance — 维度字段落库', () => {
  it('带 5 个维度字段 → 写入 CpsPerformance 维度列', async () => {
    prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'cc1' });
    prismaMock.cpsPerformance.findUnique.mockResolvedValue(null); // 走 create
    prismaMock.cpsPerformance.create.mockResolvedValue({});

    await importService.importCpsPerformance('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post',
        clicks: 100, orders: 10, gmv: 1000, commission: 100, spend: 200,
        productName: 'Vitamin C Serum', category: 'Skincare',
        market: 'US', promoName: 'Summer Sale', promoType: 'discount',
      },
    ]);

    const data = prismaMock.cpsPerformance.create.mock.calls[0][0].data;
    expect(data.productName).toBe('Vitamin C Serum');
    expect(data.category).toBe('Skincare');
    expect(data.market).toBe('US');
    expect(data.promoName).toBe('Summer Sale');
    expect(data.promoType).toBe('discount');
  });

  it('未传维度字段 → 落库为 null(不阻塞导入)', async () => {
    prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'cc1' });
    prismaMock.cpsPerformance.findUnique.mockResolvedValue(null);
    prismaMock.cpsPerformance.create.mockResolvedValue({});

    await importService.importCpsPerformance('u', [
      { campaignId: 'c1', creatorId: 'cr1', contentType: 'post', clicks: 1, orders: 1, gmv: 1 },
    ]);

    const data = prismaMock.cpsPerformance.create.mock.calls[0][0].data;
    expect(data.productName).toBeNull();
    expect(data.category).toBeNull();
    expect(data.market).toBeNull();
    expect(data.promoName).toBeNull();
    expect(data.promoType).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/campaigns/campaigns.service.test.ts`
Expected: FAIL —— `expected 'Vitamin C Serum', received undefined`(importCpsPerformance 还没读维度字段,create.data 不含它们)。

- [ ] **Step 3: 改 importCpsPerformance 读维度字段**

在 `campaigns.service.ts` 的 `importCpsPerformance` 内,`spend` 行(L499)之后加维度解析;并在 upsert 的 `create` / `update`(L503-514)补 5 字段:

```ts
        const spend = new Prisma.Decimal(parseFloat(String(item.spend ?? '0').replace(/[$,]/g, '')) || 0);

        // 维度标签(链接级,空 → null)
        const productName = String(item.productName ?? '').trim() || null;
        const category = String(item.category ?? '').trim() || null;
        const market = String(item.market ?? '').trim() || null;
        const promoName = String(item.promoName ?? '').trim() || null;
        const promoType = String(item.promoType ?? '').trim() || null;

        await prisma.cpsPerformance.upsert({
          where: { campaignCreatorId_contentType: { campaignCreatorId: link.id, contentType } },
          create: {
            campaignCreatorId: link.id,
            contentType,
            linkUrl: String(item.linkUrl ?? '') || null,
            clicks, impressions, orders,
            gmv, commission, spend,
            productName, category, market, promoName, promoType,
          },
          update: {
            linkUrl: String(item.linkUrl ?? '') || null,
            clicks, impressions, orders,
            gmv, commission, spend,
            productName, category, market, promoName, promoType,
          },
        });
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm -C apps/server exec vitest run src/modules/campaigns/campaigns.service.test.ts`
Expected: 全部 PASS(含新增 2 个)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/campaigns/campaigns.service.ts apps/server/src/modules/campaigns/campaigns.service.test.ts
git commit -m "feat(cps): importCpsPerformance 录入 5 维度标签(product/category/market/promo)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 前端导入模板加维度列

**Files:**
- Modify: `apps/web/src/editor/dataImport.ts`(`CPS_FIELDS` L76-80、`PREVIEW_COLUMNS.cps` L133)

- [ ] **Step 1: CPS_FIELDS 加 5 列**

改 `CPS_FIELDS`(L76-80)为:

```ts
export const CPS_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType',
  'linkUrl', 'clicks', 'impressions', 'orders',
  'gmv', 'commission', 'spend',
  'productName', 'category', 'market', 'promoName', 'promoType',
] as const;
```

- [ ] **Step 2: PREVIEW_COLUMNS.cps 加维度列(便于用户核对)**

改 `PREVIEW_COLUMNS.cps`(L133)为:

```ts
  cps: ['campaignId', 'creatorId', 'collabId', 'contentType', 'linkUrl', 'clicks', 'orders', 'gmv', 'commission', 'productName', 'category', 'market', 'promoName', 'promoType'],
```

- [ ] **Step 3: 核对导入 UI 无硬编码列**

Run: `grep -n "cps" apps/web/src/editor/components/ImportPreviewModal.tsx apps/web/src/editor/property-panel/importers.tsx | grep -iE "product|category|market|promo|clicks|gmv"`
Expected: 无命中,或仅命中通用字段遍历(说明 UI 跟随 `PREVIEW_COLUMNS`/`CPS_FIELDS`,无需改)。若发现硬编码 CPS 列清单,把 5 维度列加进去。

- [ ] **Step 4: 跑前端类型检查**

Run: `pnpm -C apps/web exec tsc -b --force`
Expected: 无错误(`CPS_FIELDS` 是 `as const` 元组,加项不破坏类型)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/dataImport.ts
git commit -m "feat(web): CPS 导入模板加 5 维度列(product/category/market/promo)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: dimensions.ts 聚合纯函数(TDD)

**Files:**
- Create: `apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `dimensions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aggregateDimensions } from './dimensions';

describe('aggregateDimensions', () => {
  it('topCategories:按 category group + pct + color,降序', () => {
    const r = aggregateDimensions([
      { category: 'Skincare', gmv: 3000, orders: 30 },
      { category: 'Makeup', gmv: 1000, orders: 10 },
      { category: 'Skincare', gmv: 1000, orders: 10 }, // 同类合并 → 4000
    ]);
    expect(r.topCategories).toEqual([
      { label: 'Skincare', pct: 80, color: '#ff099e' }, // 4000/5000
      { label: 'Makeup', pct: 20, color: '#4f46e5' },   // 1000/5000
    ]);
  });

  it('topProducts:按 productName group,前 5,revenue 格式化', () => {
    const r = aggregateDimensions([
      { productName: 'Serum A', gmv: 5000, orders: 5 },
      { productName: 'Serum B', gmv: 3000, orders: 3 },
    ]);
    expect(r.topProducts).toEqual([
      { name: 'Serum A', revenue: '$5,000' },
      { name: 'Serum B', revenue: '$3,000' },
    ]);
  });

  it('topMarket:按 market group + revenue + pct + color', () => {
    const r = aggregateDimensions([{ market: 'US', gmv: 8000, orders: 8 }, { market: 'EU', gmv: 2000, orders: 2 }]);
    expect(r.topMarket).toEqual([
      { country: 'US', revenue: '$8,000', pct: 80, color: '#ff099e' },
      { country: 'EU', revenue: '$2,000', pct: 20, color: '#4f46e5' },
    ]);
  });

  it('topPromotion:按 promoName group,type/promoType/usage(=orders)/tagKind', () => {
    const r = aggregateDimensions([
      { promoName: 'Summer Sale', promoType: 'discount', gmv: 4000, orders: 40 },
      { promoName: 'Bundle A', promoType: 'bundle', gmv: 1000, orders: 5 },
    ]);
    expect(r.topPromotion).toEqual([
      { name: 'Summer Sale', type: 'discount', revenue: '$4,000', usage: '40', tagKind: 'discount' },
      { name: 'Bundle A', type: 'bundle', revenue: '$1,000', usage: '5', tagKind: 'bundle' },
    ]);
  });

  it('某维度全空 → 该维度 undefined(降级)', () => {
    const r = aggregateDimensions([{ category: 'Skincare', gmv: 1000, orders: 1 }]);
    expect(r.topCategories).toBeDefined();
    expect(r.topProducts).toBeUndefined();
    expect(r.topMarket).toBeUndefined();
    expect(r.topPromotion).toBeUndefined();
  });

  it('总 gmv=0 → pct=0(除零保护),不 NaN', () => {
    const r = aggregateDimensions([{ category: 'X', gmv: 0, orders: 0 }]);
    expect(r.topCategories).toEqual([{ label: 'X', pct: 0, color: '#ff099e' }]);
  });

  it('调色板不足 → 循环复用', () => {
    const links = Array.from({ length: 8 }, (_, i) => ({ category: `C${i}`, gmv: 8 - i, orders: 1 }));
    const r = aggregateDimensions(links)!;
    expect(r.topCategories!.length).toBe(8);
    expect(r.topCategories![0].color).toBe(r.topCategories![6].color); // 0 和 6 同色(6 色循环)
  });

  it('tagKind 未知 promoType → gift 兜底', () => {
    const r = aggregateDimensions([{ promoName: 'Mystery', promoType: 'unknown', gmv: 1, orders: 1 }]);
    expect(r.topPromotion![0].tagKind).toBe('gift');
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/dimensions.test.ts`
Expected: FAIL —— `Cannot find module './dimensions'`。

- [ ] **Step 3: 实现 dimensions.ts**

创建 `dimensions.ts`:

```ts
// dimensions.ts
// recipe Insight & Analysis 四维度聚合:把 CpsPerformance 链接级维度标签
// 聚合成 schema 定义的 insights.topCategories/topProducts/topMarket/topPromotion。
// 纯函数,不查 DB,不依赖 tokens(颜色用固定调色板)。
import { formatMoney, formatNum } from '../format';

export type DimLink = {
  productName?: string | null;
  category?: string | null;
  market?: string | null;
  promoName?: string | null;
  promoType?: string | null;
  gmv: number;
  orders: number;
};

export type DimInsights = {
  topCategories?: { label: string; pct: number; color: string }[];
  topProducts?: { name: string; revenue: string }[];
  topMarket?: { country: string; revenue: string; pct: number; color: string }[];
  topPromotion?: { name: string; type: string; revenue: string; usage: string; tagKind: string }[];
};

/** 固定调色板(第一色对齐默认 brandPrimary #ff099e;不足循环)。 */
const PALETTE = ['#ff099e', '#4f46e5', '#16a34a', '#d97706', '#0ea5e9', '#8b5cf6'];

/** promoType → 模板 tag CSS 后缀(对应 template.hbs 的 .tag-xxx)。 */
function mapTagKind(promoType?: string | null): string {
  const t = String(promoType ?? '').toLowerCase();
  if (t.includes('coupon')) return 'coupon';
  if (t.includes('bundle')) return 'bundle';
  if (t.includes('flash') || t.includes('deal')) return 'flash';
  if (t.includes('discount') || t.includes('sale')) return 'discount';
  return 'gift';
}

/** 按某维度键 group,累加 gmv/orders,保留组内第一个非空 promoType;按 gmv 降序。 */
function groupBy(links: DimLink[], key: keyof DimLink) {
  const m = new Map<string, { gmv: number; orders: number; promoType?: string }>();
  for (const l of links) {
    const v = String((l as Record<string, unknown>)[key as string] ?? '').trim();
    if (!v) continue;
    const cur = m.get(v) ?? { gmv: 0, orders: 0 };
    cur.gmv += l.gmv;
    cur.orders += l.orders;
    if (!cur.promoType && l.promoType) cur.promoType = String(l.promoType).trim();
    m.set(v, cur);
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.gmv - a.gmv);
}

export function aggregateDimensions(links: DimLink[]): DimInsights {
  // topCategories
  const cats = groupBy(links, 'category');
  const catTotal = cats.reduce((s, x) => s + x.gmv, 0);
  const topCategories = cats.length
    ? cats.map((x, i) => ({ label: x.key, pct: catTotal ? Math.round((x.gmv / catTotal) * 1000) / 10 : 0, color: PALETTE[i % PALETTE.length] }))
    : undefined;

  // topProducts(前 5)
  const prods = groupBy(links, 'productName');
  const topProducts = prods.length
    ? prods.slice(0, 5).map((x) => ({ name: x.key, revenue: formatMoney(x.gmv) }))
    : undefined;

  // topMarket
  const markets = groupBy(links, 'market');
  const mktTotal = markets.reduce((s, x) => s + x.gmv, 0);
  const topMarket = markets.length
    ? markets.map((x, i) => ({ country: x.key, revenue: formatMoney(x.gmv), pct: mktTotal ? Math.round((x.gmv / mktTotal) * 1000) / 10 : 0, color: PALETTE[i % PALETTE.length] }))
    : undefined;

  // topPromotion
  const promos = groupBy(links, 'promoName');
  const topPromotion = promos.length
    ? promos.map((x) => ({ name: x.key, type: x.promoType || '—', revenue: formatMoney(x.gmv), usage: formatNum(x.orders), tagKind: mapTagKind(x.promoType) }))
    : undefined;

  return { topCategories, topProducts, topMarket, topPromotion };
}
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/dimensions.test.ts`
Expected: 全部 PASS(8 个)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.ts apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.test.ts
git commit -m "feat(recipe): dimensions 聚合纯函数(品类/产品/市场/促销 → insights)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: mapFromDaily 接入 aggregateDimensions(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(import + mapFromDaily 内收集 dimLinks + 合并 insights)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试**

在 `mapper.test.ts` 新增一个带维度+daily 的 fixture 和测试(放在 `campaignRowWithDaily` 定义之后):

```ts
// 带 CPS daily + 维度标签的 fixture(验证 mapFromDaily 聚合 4 维度)
const campaignRowWithDailyAndDims = {
  ...campaignRowWithDaily,
  campaignCreators: [{
    ...campaignRowWithDaily.campaignCreators[0],
    cpsPerformances: [{
      ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any),
      productName: 'Vitamin C Serum', category: 'Skincare',
      market: 'US', promoName: 'Summer Sale', promoType: 'discount',
    }],
  }],
};
```

在 `describe('mapCampaign', ...)` 内新增测试:

```ts
  it('有 daily + 维度标签 + period → insights 聚合 4 维度(期内切片)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDailyAndDims);
    // period 2026-10-15 ~ 2026-10-17:期内 daily = 2000(10-15) + 3000(10-16),orders = 20 + 30 = 50
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    expect(c.insights?.topCategories).toEqual([{ label: 'Skincare', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topProducts).toEqual([{ name: 'Vitamin C Serum', revenue: '$5,000' }]);
    expect(c.insights?.topMarket).toEqual([{ country: 'US', revenue: '$5,000', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topPromotion).toEqual([{ name: 'Summer Sale', type: 'discount', revenue: '$5,000', usage: '50', tagKind: 'discount' }]);
    // newCustomerRate 仍保留
    expect(c.insights?.newCustomerRate).toBeDefined();
  });
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: FAIL —— `expected [ {...Skincare...} ], received undefined`(mapFromDaily 的 insights 还没含维度)。

- [ ] **Step 3: mapFromDaily 接入 aggregateDimensions**

在 `mapper.ts` 顶部 import(L4 之后):

```ts
import { aggregateDimensions, type DimLink } from './dimensions';
```

在 `mapFromDaily` 内,「7) insights」段(L115-119)替换为(先收集期内链接级 gmv/orders + 维度,再聚合,再合并 newCustomerRate):

```ts
  // 7) insights(4 维度从 cpsPerformances 链接级标签聚合 + newCustomerRate 从 daily 重算)
  const dimLinks: DimLink[] = [];
  for (const cc of campaign.campaignCreators ?? []) {
    for (const p of cc.cpsPerformances ?? []) {
      let gmv = 0, orders = 0;
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        gmv += num(d.gmv);
        orders += num(d.orders);
      }
      if (gmv > 0 || orders > 0) {
        dimLinks.push({
          productName: p.productName, category: p.category, market: p.market,
          promoName: p.promoName, promoType: p.promoType, gmv, orders,
        });
      }
    }
  }
  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = {
    ...aggregateDimensions(dimLinks),
    newCustomerRate: { rate: formatPct(Math.round(rate * 10) / 10), newCount: total.newCustomers, totalOrders: total.orders },
  };
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: 全部 PASS(含新增维度测试;既有 daily 切片测试不受影响——它们 fixture 无维度,4 维度返回 undefined,`{{#if}}` 降级,insights 仍含 newCustomerRate)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts
git commit -m "feat(recipe): mapFromDaily 接入维度聚合(期内切片)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 汇总分支接入 aggregateDimensions(TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(`mapCampaign` 汇总分支,L189-244)
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`

- [ ] **Step 1: 写失败测试**

在 `mapper.test.ts` `describe('mapCampaign')` 内新增(用汇总 fixture `campaignRow` 的 cps 加维度):

```ts
  it('汇总路径(无 daily)+ 维度标签 → insights 聚合 4 维度(用链接 gmv)', async () => {
    const row = {
      ...campaignRow,
      campaignCreators: [{
        ...campaignRow.campaignCreators[0],
        cpsPerformances: [{
          ...campaignRow.campaignCreators[0].cpsPerformances[0],
          productName: 'Serum', category: 'Skincare', market: 'US',
          promoName: 'Sale', promoType: 'discount',
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    const c = await mapCampaign('c1'); // 无 reportPeriod → 汇总分支
    // campaignRow cps.gmv = 192000, orders = 1016
    expect(c.insights?.topCategories).toEqual([{ label: 'Skincare', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topProducts?.[0]).toEqual({ name: 'Serum', revenue: '$192,000' });
    expect(c.insights?.topPromotion?.[0]).toMatchObject({ name: 'Sale', usage: '1,016', tagKind: 'discount' });
  });
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: FAIL —— `received undefined`(汇总分支 insights 还没含维度)。

- [ ] **Step 3: 汇总分支接入**

在 `mapper.ts` `mapCampaign` 汇总分支,把现有 insights 构造(L211-220)替换为:先从 `campaign.campaignCreators[].cpsPerformances` 收集 dimLinks(用链接顶层 gmv/orders),再聚合,再合并 newCustomerRate:

```ts
  // 维度聚合(汇总路径:用 cpsPerformance 链接顶层 gmv/orders,不切日期)
  const dimLinks: DimLink[] = (campaign.campaignCreators ?? []).flatMap((cc: Any) =>
    (cc.cpsPerformances ?? []).map((p: Any) => ({
      productName: p.productName, category: p.category, market: p.market,
      promoName: p.promoName, promoType: p.promoType,
      gmv: num(p.gmv), orders: num(p.orders),
    })),
  );
  const dimInsights = aggregateDimensions(dimLinks);

  // newCustomerRate:metrics 优先(数值),否则从 newCustomers/orders 重算。
  const newCustomerRate = metric(m, 'newCustomerRate') || (newCustomers && orders ? (newCustomers / orders) * 100 : 0);
  const insights = {
    ...dimInsights,
    ...(newCustomerRate
      ? {
          newCustomerRate: {
            rate: formatPct(Math.round(newCustomerRate * 10) / 10),
            newCount: newCustomers,
            totalOrders: orders,
            deltaPct: m.newCustomerDelta ? formatPct(Math.round(Number(m.newCustomerDelta) * 10) / 10) : undefined,
          },
        }
      : {}),
  };
```

(`DimLink` 类型已由 Task 5 的 import 引入。`return` 里 L244 的 `insights: Object.keys(insights).length ? insights : undefined` 保持不变 —— dimInsights 为空对象时 newCustomerRate 也无 → undefined,`{{#if insights}}` 整块隐藏。)

- [ ] **Step 4: 跑测试验证通过**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts
git commit -m "feat(recipe): 汇总分支接入维度聚合(链接 gmv)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: template.hbs 加促销 tag CSS

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs`(L49 `.tag-site` 之后)

> topPromotion 卡用 `tag-{{tagKind}}`,tagKind 取值 discount/coupon/bundle/flash/gift(见 dimensions.ts mapTagKind)。现有 CSS 只有 creator/fb/tg/site,需补促销类,否则标签无配色(只剩 `.tag` 基类的 padding/圆角)。

- [ ] **Step 1: 加促销 tag CSS**

在 `template.hbs` 的 `.tag-site { ... }`(L49)之后插入:

```hbs
        .tag-discount { background: rgba(255,9,158,0.1); color: {{tokens.brandPrimary}}; }
        .tag-coupon { background: #f0fdf4; color: #16a34a; }
        .tag-bundle { background: #eef2ff; color: #4f46e5; }
        .tag-flash { background: #fffbeb; color: #d97706; }
        .tag-gift { background: #f5f3ff; color: #7c3aed; }
```

- [ ] **Step 2: 跑 recipe 渲染测试(确认模板仍编译)**

Run: `pnpm -C apps/server exec vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts`
Expected: 全部 PASS(Handlebars 编译 + 既有渲染断言不受影响)。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs
git commit -m "feat(recipe): 加促销 tag CSS(discount/coupon/bundle/flash/gift)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 全量验证 + typecheck

- [ ] **Step 1: server 全测试**

Run: `pnpm -C apps/server exec vitest run`
Expected: 全绿(含 dimensions 8 + mapper 新增 2 + importCpsPerformance 新增 2 + 既有全量)。

- [ ] **Step 2: server typecheck**

Run: `pnpm -C apps/server typecheck`
Expected: 无输出(tsc --noEmit 通过)。

- [ ] **Step 3: web typecheck**

Run: `pnpm -C apps/web exec tsc -b --force`
Expected: 无错误。

- [ ] **Step 4: 端到端冒烟(可选,需 dev DB)**

1. `pnpm db:up && pnpm -C apps/server db:migrate`(确认 migration 已应用)
2. 用 `POST /api/campaigns/import/cps` 导入一条带维度的 CPS 链接
3. 触发 recipe 报告渲染(Projects 列表「预览 HTML」或 HtmlStudio recipe 分支),确认 Insight & Analysis 4 张卡显示
4. 无打标维度的旧 campaign → 仅显示 New Customer Rate(降级正常)

- [ ] **Step 5: 收尾 commit(若有未提交的修复)**

若 Step 4 发现并修复了小问题,提交。否则跳过。

---

## Self-Review

**Spec 覆盖:**
- 数据模型 5 列 → Task 1 ✓
- 录入(importCpsPerformance + dataImport)→ Task 2 + 3 ✓
- 聚合(mapFromDaily + 汇总 + aggregateDimensions)→ Task 4 + 5 + 6 ✓
- 渐进降级 → Task 4(空→undefined 测试)+ Task 5/6(`{{#if}}` 既有)✓
- 错误处理(除零/调色板循环/空不阻塞)→ Task 4 测试 ✓
- tagKind CSS → Task 7 ✓
- 验收标准 5 条 → Task 8 ✓
- 不做项(AI/主数据/订单级)→ 均无对应 task ✓

**类型一致性:** `aggregateDimensions(links: DimLink[]): DimInsights` 签名在 Task 4 定义,Task 5/6 调用一致;`DimLink` 字段名(productName/category/market/promoName/promoType)与 schema.prisma(Task 1)、importCpsPerformance(Task 2)完全对齐;`mapTagKind` 返回值(discount/coupon/bundle/flash/gift)与 template.hbs CSS 类(Task 7)一一对应。

**无占位:** migration 目录用 `$(date +%Y%m%d%H%M%S)` 命令生成;所有代码块完整;无 "TODO/类似 Task N"。

**范围:** 单一实现计划,8 个 task 顺序推进,每个独立可测、可 commit。
