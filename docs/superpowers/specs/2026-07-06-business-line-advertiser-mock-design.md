# 业务线 / 广告主 / 商家 — 结构化 MOCK 数据

**日期:** 2026-07-06
**范围:** 仅 mock 数据 + 共享类型。无 UI 行为改动。

## 背景

当前 mock 数据中业务线与广告主只是扁平字符串：

- `apps/web/src/projectsMeta.ts`
  - `BUSINESS_LINES = ['FT','SM','CX','DG','KN','DM']`（仅简称）
  - `ADVERTISERS = ['GlowLab','LUMIÈRE','NOVA Home','MOTION','EVERYDAY','WANDER']`（仅名称）
- `apps/web/src/api/campaigns.ts` `MOCK_CAMPAIGNS` 中 `advertiser` / `businessLine` 为字符串。
- 编辑器顶栏（`EditorTopbar.tsx`）把这些字符串渲染成标签 chip；`CreateProjectDialog` 用它们做下拉选项。
- 代码库中无任何 商家 / 全称 / Logo 字段（仅 `brand-wall` 组件表第二列为 Logo URL）。

需要把这些扁平字符串补全为结构化记录，便于后续组件直接消费业务线全称、Logo、以及广告主关联的商家。

## 目标 / 非目标

**目标**

1. 在共享类型层定义 `BusinessLine` / `Merchant` / `Advertiser`。
2. 在 mock 层为每条业务线、每个广告主补充结构化数据（简称 / 全称 / Logo / 关联商家）。
3. 商家作为独立列表存在；广告主通过 `merchantId` 引用。

**非目标（本次迭代）**

- 不改动 `EditorTopbar`、`CreateProjectDialog`、任何组件的渲染逻辑或行为。
- 不替换 `BUSINESS_LINES` / `ADVERTISERS` 扁平字符串数组。
- 不引入二进制图片资源。

## 方案：附加式查找表（Approach B）

保留现有扁平字符串数组不变（消费方零改动），并行新增结构化查找表。所有结构化数据通过查找即可获得。

### 共享类型 — `packages/shared/src/index.ts`

```ts
/** 业务线 */
export interface BusinessLine {
  code: string;        // 简称，与 BUSINESS_LINES 中的条目一致，例如 'FT'
  name: string;        // 全称，例如 'FineTech 芯科'
  logo?: string;       // URL
}

/** 商家（独立列表） */
export interface Merchant {
  id: string;          // 例如 'm1'
  name: string;        // 商家名称
  logo?: string;
}

/** 广告主 */
export interface Advertiser {
  name: string;        // 广告主名称，与 ADVERTISERS 中的条目一致，例如 'GlowLab'
  merchantId?: string; // 关联的商家 id（指向 MERCHANTS）
  logo?: string;
}
```

### Mock 数据 — `apps/web/src/projectsMeta.ts`

新增导出（与现有 `BUSINESS_LINES` / `ADVERTISERS` 并列，不替换）：

```ts
export const BUSINESS_LINE_META: Record<string, BusinessLine> = {
  FT: { code: 'FT', name: 'FineTech 芯科',  logo: 'https://placehold.co/120x120/2563eb/ffffff?text=FT' },
  SM: { code: 'SM', name: 'SocialMove 社动', logo: '...' },
  CX: { code: 'CX', name: 'CosmeX 珂研',    logo: '...' },
  DG: { code: 'DG', name: 'DigitalGo 数行', logo: '...' },
  KN: { code: 'KN', name: 'KitchenNest 巢厨', logo: '...' },
  DM: { code: 'DM', name: 'DreamMart 梦集', logo: '...' },
};

export const MERCHANTS: Merchant[] = [
  { id: 'm1', name: 'GlowLab 官方旗舰店', logo: '...' },
  { id: 'm2', name: 'LUMIÈRE 海外旗舰店', logo: '...' },
  // ... 共约 6 条
];

export const ADVERTISER_META: Record<string, Advertiser> = {
  GlowLab:    { name: 'GlowLab',    merchantId: 'm1', logo: '...' },
  'LUMIÈRE':  { name: 'LUMIÈRE',    merchantId: 'm2', logo: '...' },
  'NOVA Home':{ name: 'NOVA Home',  merchantId: 'm3', logo: '...' },
  MOTION:     { name: 'MOTION',     merchantId: 'm4', logo: '...' },
  EVERYDAY:   { name: 'EVERYDAY',   merchantId: 'm5', logo: '...' },
  WANDER:     { name: 'WANDER',     merchantId: 'm6', logo: '...' },
};
```

约束：

- `BUSINESS_LINE_META` 的 key 必须与 `BUSINESS_LINES` 6 个条目一一对应（`FT/SM/CX/DG/KN/DM`）。
- `ADVERTISER_META` 的 key 必须与 `ADVERTISERS` 6 个条目一一对应。
- `ADVERTISER_META[name].merchantId` 必须指向 `MERCHANTS` 中存在的 `id`。
- Logo 统一使用 `https://placehold.co/120x120/<bg>/<fg>?text=<CODE>` 占位 URL，颜色按业务线区分；不引入二进制资源。

### 一致性

`api/campaigns.ts` 中 `MOCK_CAMPAIGNS` 的 `advertiser` / `businessLine` 字符串保持不变，作为查找键：

- `BUSINESS_LINE_META[campaign.businessLine]` → 业务线全称 + Logo
- `ADVERTISER_META[campaign.advertiser]` → 广告主 Logo + 关联商家 id
- `MERCHANTS.find(m => m.id === advertiser.merchantId)` → 商家名称 + Logo

## 受影响文件

| 文件 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | 新增 3 个 interface |
| `apps/web/src/projectsMeta.ts` | 新增 3 个 export（`BUSINESS_LINE_META` / `MERCHANTS` / `ADVERTISER_META`），import 新类型 |

无其他文件改动；现有 `BUSINESS_LINES` / `ADVERTISERS` / `mockCampaignInfo` / `CreateProjectDialog` / `EditorTopbar` 全部保持原样。

## 测试 / 验证

- 类型检查：`pnpm -w typecheck`（或对应脚本）通过。
- 一致性自检（可在 spec 落地后人工核对，不强制写运行时断言）：6 业务线 key 一一对应、6 广告主 key 一一对应、每个广告主 `merchantId` 命中 `MERCHANTS`。
- 构建无破坏：现有顶栏 chip、新建项目下拉项渲染不变。
