# 业务线 / 广告主 / 商家 结构化 MOCK 数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把扁平的 `BUSINESS_LINES` / `ADVERTISERS` 字符串补全为结构化 mock（业务线简称/全称/Logo、广告主关联商家/Logo、商家独立列表），仅新增共享类型与查找表，不改任何 UI 行为。

**Architecture:** Approach B（附加式查找表）：保留现有字符串数组不变，在 `packages/shared` 新增 `BusinessLine` / `Merchant` / `Advertiser` 三个 interface，在 `apps/web/src/projectsMeta.ts` 新增 `BUSINESS_LINE_META` / `MERCHANTS` / `ADVERTISER_META` 三个 export。Logo 使用 `placehold.co` 占位 URL，无二进制资源。

**Tech Stack:** TypeScript、pnpm monorepo（`@mediakit/shared` + `@mediakit/web`）。

**Spec:** `docs/superpowers/specs/2026-07-06-business-line-advertiser-mock-design.md`

---

## File Structure

| 文件 | 责任 | 改动 |
|---|---|---|
| `packages/shared/src/index.ts` | 前后端共享类型 | 在 `Campaign` interface（行 88）后新增 3 个 interface |
| `apps/web/src/projectsMeta.ts` | web 端 mock 选项 / 查找表 | 顶部 import 新类型；新增 `BUSINESS_LINE_META` / `MERCHANTS` / `ADVERTISER_META` |

无其他文件改动。

---

## Task 1: 共享类型 — `BusinessLine` / `Merchant` / `Advertiser`

**Files:**
- Modify: `packages/shared/src/index.ts`（在 `Campaign` interface 之后，约第 88 行后插入）

- [ ] **Step 1: 在 `Campaign` interface 之后插入 3 个 interface**

在 `packages/shared/src/index.ts` 中，定位到 `Campaign` interface 的闭合 `}`（约第 88 行），紧接其后（第 89 行空行位置）插入：

```ts
/** 业务线（mock 查找表 BUSINESS_LINE_META 的条目）。 */
export interface BusinessLine {
  /** 简称，与 BUSINESS_LINES 中的条目一致，例如 'FT'。 */
  code: string;
  /** 全称，例如 'FineTech 芯科'。 */
  name: string;
  /** Logo URL。 */
  logo?: string;
}

/** 商家（独立列表 MERCHANTS 的条目；广告主通过 merchantId 引用）。 */
export interface Merchant {
  /** 例如 'm1'。 */
  id: string;
  /** 商家名称。 */
  name: string;
  /** Logo URL。 */
  logo?: string;
}

/** 广告主（mock 查找表 ADVERTISER_META 的条目）。 */
export interface Advertiser {
  /** 广告主名称，与 ADVERTISERS 中的条目一致，例如 'GlowLab'。 */
  name: string;
  /** 关联的商家 id（指向 MERCHANTS）。 */
  merchantId?: string;
  /** Logo URL。 */
  logo?: string;
}
```

- [ ] **Step 2: 类型检查 shared 包**

Run: `pnpm --filter @mediakit/shared run typecheck`
Expected: PASS（无输出或 "Done"）。若该 filter 无 typecheck 脚本，改用根级 `pnpm -w typecheck` 并确认 shared 包部分无报错。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): 业务线/广告主/商家 结构化类型"
```

---

## Task 2: Mock 查找表 — `BUSINESS_LINE_META` / `MERCHANTS` / `ADVERTISER_META`

**Files:**
- Modify: `apps/web/src/projectsMeta.ts`（修改第 1 行 import；在第 10 行 `ADVERTISERS` 之后插入 3 个 export）

- [ ] **Step 1: 扩展第 1 行 import，加入新类型**

把 `apps/web/src/projectsMeta.ts` 第 1 行：

```ts
import type { CampaignInfo, Scenario, ScenarioSub } from '@mediakit/shared';
```

改为：

```ts
import type { Advertiser, BusinessLine, CampaignInfo, Merchant, Scenario, ScenarioSub } from '@mediakit/shared';
```

- [ ] **Step 2: 在 `ADVERTISERS` 之后插入 3 个 export**

在第 10 行 `export const ADVERTISERS = [...];` 之后、第 11 行空行之前插入：

```ts
/** 业务线结构化数据（key 与 BUSINESS_LINES 一一对应）。 */
export const BUSINESS_LINE_META: Record<string, BusinessLine> = {
  FT: { code: 'FT', name: 'FineTech 芯科',   logo: 'https://placehold.co/120x120/2563eb/ffffff?text=FT' },
  SM: { code: 'SM', name: 'SocialMove 社动', logo: 'https://placehold.co/120x120/16a34a/ffffff?text=SM' },
  CX: { code: 'CX', name: 'CosmeX 珂研',     logo: 'https://placehold.co/120x120/db2777/ffffff?text=CX' },
  DG: { code: 'DG', name: 'DigitalGo 数行',  logo: 'https://placehold.co/120x120/ea580c/ffffff?text=DG' },
  KN: { code: 'KN', name: 'KitchenNest 巢厨', logo: 'https://placehold.co/120x120/9333ea/ffffff?text=KN' },
  DM: { code: 'DM', name: 'DreamMart 梦集',  logo: 'https://placehold.co/120x120/0891b2/ffffff?text=DM' },
};

/** 商家列表（广告主通过 merchantId 引用）。 */
export const MERCHANTS: Merchant[] = [
  { id: 'm1', name: 'GlowLab 官方旗舰店',   logo: 'https://placehold.co/120x120/2563eb/ffffff?text=M1' },
  { id: 'm2', name: 'LUMIÈRE 海外旗舰店',   logo: 'https://placehold.co/120x120/1e293b/ffffff?text=M2' },
  { id: 'm3', name: 'NOVA Home 居家旗舰店', logo: 'https://placehold.co/120x120/475569/ffffff?text=M3' },
  { id: 'm4', name: 'MOTION 运动专营店',     logo: 'https://placehold.co/120x120/dc2626/ffffff?text=M4' },
  { id: 'm5', name: 'EVERYDAY 日用品旗舰店', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=M5' },
  { id: 'm6', name: 'WANDER 户外旗舰店',     logo: 'https://placehold.co/120x120/0d9488/ffffff?text=M6' },
];

/** 广告主结构化数据（key 与 ADVERTISERS 一一对应）。 */
export const ADVERTISER_META: Record<string, Advertiser> = {
  GlowLab:    { name: 'GlowLab',    merchantId: 'm1', logo: 'https://placehold.co/120x120/2563eb/ffffff?text=GL' },
  'LUMIÈRE':  { name: 'LUMIÈRE',    merchantId: 'm2', logo: 'https://placehold.co/120x120/1e293b/ffffff?text=LU' },
  'NOVA Home':{ name: 'NOVA Home',  merchantId: 'm3', logo: 'https://placehold.co/120x120/475569/ffffff?text=NV' },
  MOTION:     { name: 'MOTION',     merchantId: 'm4', logo: 'https://placehold.co/120x120/dc2626/ffffff?text=MO' },
  EVERYDAY:   { name: 'EVERYDAY',   merchantId: 'm5', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=EV' },
  WANDER:     { name: 'WANDER',     merchantId: 'm6', logo: 'https://placehold.co/120x120/0d9488/ffffff?text=WA' },
};
```

- [ ] **Step 3: 全仓类型检查**

Run: `pnpm -w typecheck`
Expected: PASS（所有包 typecheck 通过，无报错）。

- [ ] **Step 4: 一致性自检（人工 / grep）**

确认三个约束（不强制写运行时断言，人工核对即可）：

1. `BUSINESS_LINES`（6 条）的每个值都是 `BUSINESS_LINE_META` 的 key。
2. `ADVERTISERS`（6 条）的每个值都是 `ADVERTISER_META` 的 key。
3. 每个 `ADVERTISER_META[name].merchantId` 都能在 `MERCHANTS` 中找到对应 `id`（m1–m6 已全部覆盖）。

可执行下面命令辅助核对（应无输出表示一致）：

```bash
node -e "const m=require('./apps/web/src/projectsMeta.ts'); " 2>/dev/null || echo "（TS 不能直接 require，跳过；改为人工核对或在 Step 3 的 typecheck 通过后相信 key 一一对应）"
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/projectsMeta.ts
git commit -m "feat(web): 业务线/广告主/商家 结构化 MOCK 查找表"
```

---

## Self-Review

**Spec coverage:**
- 共享类型 `BusinessLine` / `Merchant` / `Advertiser` → Task 1 ✓
- `BUSINESS_LINE_META` / `MERCHANTS` / `ADVERTISER_META` → Task 2 ✓
- 业务线 6 条一一对应 → Task 2 Step 4 ✓
- 广告主 6 条一一对应 → Task 2 Step 4 ✓
- 商家独立列表、广告主 merchantId 引用 → Task 2 ✓
- Logo 用 placehold.co 占位、无二进制资源 → Task 2 Step 2 ✓
- 不改 `BUSINESS_LINES` / `ADVERTISERS` / 顶栏 / 新建项目弹窗 → 本计划不触及这些文件 ✓

**Placeholder scan:** 无 TBD/TODO；所有 mock 值（全称、Logo URL、商家名、merchantId）均已给出具体值。✓

**Type consistency:** Task 1 定义的 `BusinessLine.code/name/logo`、`Merchant.id/name/logo`、`Advertiser.name/merchantId/logo` 与 Task 2 使用的字段完全一致。import 名（`Advertiser, BusinessLine, Merchant`）与 Task 1 export 名一致。✓
