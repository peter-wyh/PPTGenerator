# 达人数据条 — 指标筛选与文案编辑（设计 spec）

- 日期：2026-07-03
- 组件：`creator-stats-strip`（达人数据条）
- 范围：在现有组件上新增「指标库勾选启用」+「文案修改」，不新建组件。

## 背景

`creator-stats-strip` 现有数据形状：

```ts
interface CreatorStatsStripData {
  variant: 'cards' | 'plain' | 'metric';
  stats: { label: string; value: string; color: string }[];
}
```

属性面板用通用 `kind: 'list'` 字段编辑（自由增删 + 改 label/value/color）。本次需求：提供一份「常用达人指标库」，用户勾选要展示的指标，并对已选指标做文案修改。

## 目标

1. **筛选指标**：勾选式启用指标库中的指标，取消则隐藏（保留数据以便反复切换不丢文案）。
2. **文案修改**：每个已选指标的 label / value / color 可编辑。
3. **向后兼容**：旧数据（无 `selected` 字段）继续全部渲染，行为不变。

## 非目标（YAGNI）

- 单指标单位格式化、前缀/后缀。
- 指标拖拽排序（按勾选顺序展示即可）。
- 数据源（datasource）绑定。
- 新增 `PropertyFieldKind`、改动 store 动作。

## 设计

### 1. 数据模型（`packages/shared/src/index.ts`）

- 给 stat 项新增可选 `selected?: boolean`：

```ts
export interface CreatorStatItem {
  label: string;
  value: string;
  color: string;
  selected?: boolean; // 缺省视为 true（向后兼容）
}
export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: CreatorStatItem[];
}
```

- 导出指标库常量（UI 与测试共用）：

```ts
export const CREATOR_METRIC_CATALOG: {
  key: string;
  label: string;
  color: string;
  placeholder: string;
}[] = [
  { key: 'followers', label: '粉丝数', color: '#FF5C00', placeholder: '1.28M' },
  { key: 'engagement', label: '互动率', color: '#3B82F6', placeholder: '8.7%' },
  { key: 'reach', label: '平均触达', color: '#22C55E', placeholder: '640K' },
  { key: 'impressions', label: '曝光量', color: '#8B5CF6', placeholder: '12.6M' },
  { key: 'cpm', label: 'CPM', color: '#EC4899', placeholder: '¥120' },
  { key: 'cpe', label: 'CPE', color: '#14B8A6', placeholder: '¥3.2' },
  { key: 'completion', label: '完播率', color: '#F59E0B', placeholder: '42%' },
  { key: 'growth', label: '粉丝增量', color: '#6366F1', placeholder: '+38K' },
];
```

> 指标项以 `key` 标识，与 `stats` 的对应关系靠 `key`（见下）。旧数据无 `key`，按「指标库未匹配的自由项」处理，仍可编辑。

给 stat 项补可选 `key?: string`，用于与指标库对齐：

```ts
export interface CreatorStatItem {
  key?: string;            // 命中 CREATOR_METRIC_CATALOG 的 key
  label: string;
  value: string;
  color: string;
  selected?: boolean;
}
```

### 2. 渲染层（`apps/web/src/editor/components/CreatorComponents.tsx`）

`CreatorStatsStrip` 入口先过滤可见项，再分发给三个样式变体：

```ts
const visible = (stats ?? []).filter((s) => s.selected !== false);
```

`StatsCards / StatsPlain / StatsMetric` 接收 `visible`，其余不变。

### 3. 属性面板（`apps/web/src/editor/PropertyPanel.tsx`）

- 新增自定义区块 `CreatorStatsFields`，在第 59 行附近注入：
  `{comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}`
- 移除该组件 registry 中 `propertySchema` 的 `kind: 'list'` 字段（避免与自定义区块重复），改由自定义区块全权负责 stats 编辑。
- `CreatorStatsFields` 两部分：
  1. **筛选指标**：渲染 `CREATOR_METRIC_CATALOG` 勾选清单。命中规则：`stats` 中存在同 `key` 且 `selected !== false` 视为启用。
     - 勾选：若 `stats` 无该 key，push `{ key, label, color, value: '', selected: true }`；若有，置 `selected: true`。
     - 取消：置对应项 `selected: false`（保留 value/文案）。
  2. **文案修改**：对 `visible` 项（含指标库项 + 旧自由项），渲染可编辑行：label（text）、value（text）、color（color），复用 `useDataUpdate`。
- 写入统一走 `updateComponentData` + `commit()`（与 `ListField` 一致，进历史）。

### 4. 默认数据（`apps/web/src/editor/defaults.ts`）

保持现有 4 项默认（粉丝 / 互动率 / 平均触达 / 曝光），为它们补 `key`（followers / engagement / reach / impressions）与 `selected: true`，确保新面板默认勾选态正确。其余自由项兼容。

### 5. 测试（`apps/web/tests/editor.scenario.test.ts`）

新增 `describe('达人数据条 — 指标筛选与文案')`：

- 渲染过滤：构造含 `selected: false` 的数据，断言渲染可见集不含该项。
- 向后兼容：无 `selected` 字段时全部可见。
- 勾选启停：模拟面板逻辑（toggle `selected`）经 `updateComponentData` 后，`currentPage()` 内数据正确变化。
- 文案修改：改 label/value 经 `updateComponentData` 持久化。

## 落地骨架（沿用 commit 75d67e4）

shared 类型 → 渲染过滤 → 属性面板自定义区块 → 默认数据补字段 → 就近测试。最小可选字段 + 复用现有 history 动作 + 不改 store。
