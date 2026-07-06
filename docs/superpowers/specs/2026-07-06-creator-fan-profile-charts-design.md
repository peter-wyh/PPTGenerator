# 达人粉丝画像图表（设计 spec）

- 日期：2026-07-06
- 组件：`creator-fan-gender` / `creator-fan-city` / `creator-fan-age` / `creator-fan-interest`（4 个新增 ComponentType，归入「达人」领域）
- 范围：在达人领域下新增 4 个独立的粉丝画像图表块，复用 recharts + 现有 `{label,value,color}` 数据形状，属性面板手填。

## 背景

达人领域现有三组件（头像卡 / 数据条 / 作品列表），缺少「粉丝画像」维度的可视化。用户希望在达人组件中增加粉丝城市占比、性别占比、年龄段、兴趣标签等画像图表。

仓库已有图表基建（recharts ^2.12.7，`BarChartComponent` / `LineChartComponent` / `PieChartComponent`，数据形状 `BarChartDatum` / `PieChartSlice` 均为 `{label,value,color}`，与 `CreatorStatItem` 同构），配色有 `DEFAULT_CHART_PALETTE`。组件注册走 `REGISTRY` + `propertySchema`，属性面板 schema 驱动自动渲染。

## 目标

1. 新增 4 个独立可拖拽块（每块 = 一张图），与现有 `bar-chart` / `pie-chart` 同级，可自由拼版。
2. 数据由属性面板手填（复用 `kind:'list'` 字段编辑 label/value/color），不接数据源绑定。
3. 复用 recharts 与现有配色；兴趣标签用纯 div 占比条（不引 recharts）。
4. 每图带标题 + 副标题；副标题默认显示，清空即隐藏。

## 非目标（YAGNI）

- 复合「整页画像」块（已决定走独立小图）。
- 数据源 / Excel / CSV 绑定、达人链接自动拉取画像。
- 跨达人对比、多达人叠加。
- 新增 `PropertyFieldKind`、改动 store 动作。

## 设计

### 1. 数据模型（`packages/shared/src/index.ts`）

新增 4 个 ComponentType 字面量与 Data 类型，加入 `ComponentData` 联合。

```ts
/** 性别占比（环形图）。center 文案为中心显示的主项摘要。 */
export interface CreatorFanGenderData {
  title?: string;
  subtitle?: string;        // 空 → 不渲染
  center?: string;          // 例：'女性 62%'；空 → 不渲染中心文字
  slices: PieChartSlice[];  // 复用 {label,value,color}
}

/** 城市分布 Top N（横向条形）。条尾标百分比。 */
export interface CreatorFanCityData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];    // 复用 {label,value,color}，按 value 降序
}

/** 年龄段分布（竖向柱状）。 */
export interface CreatorFanAgeData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];
}

/** 兴趣标签（纯 div 横向占比条）。showPercent 控制是否标百分比。 */
export interface CreatorFanInterestData {
  title?: string;
  subtitle?: string;
  showPercent?: boolean;    // 缺省 true
  tags: { label: string; value: number; color: string }[];
}
```

ComponentType 联合追加：`'creator-fan-gender' | 'creator-fan-city' | 'creator-fan-age' | 'creator-fan-interest'`。

### 2. 渲染层（`apps/web/src/editor/components/CreatorComponents.tsx`）

新增共用外壳，消除四份重复卡片框 + 标题样式：

```tsx
function CreatorChartShell({
  title, subtitle, children,
}: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-3">
      {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
      {subtitle && <div className="mt-0.5 text-[11px] text-foreground-secondary">{subtitle}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
```

四个入口组件：

- `CreatorFanGender`：`CreatorChartShell` + recharts `Pie`（`innerRadius="55%"` `outerRadius="80%"`）+ `Cell` 染色 + `Tooltip`；中心用绝对定位 `<div>` 叠 `center` 文案。
- `CreatorFanCity`：`CreatorChartShell` + recharts `BarChart layout="vertical"`（`XAxis type="number"` 隐藏或显百分比、`YAxis type="category" dataKey="label"`、`Bar` 用 `Cell` 染色 + `<LabelList>` 标百分比）。数据按 `value` 降序。
- `CreatorFanAge`：`CreatorChartShell` + 复用 `BarChartComponent` 同款结构（`BarChart` + `CartesianGrid` + `XAxis/YAxis` + `Cell` 染色）。
- `CreatorFanInterest`：`CreatorChartShell` + 纯 div 占比条列表。每行：`label` + track(`bg-surface-hover`) + fill(`width: pct%`，`backgroundColor: color`)，`showPercent !== false` 时尾标 `${pct}%`。占比按 `value / sum(values)` 计算。

空数据（`slices/bars/tags` 为空数组）时图区不崩，渲染占位提示「暂无数据」。

### 3. 注册（`apps/web/src/editor/registry.tsx`）

4 条 REGISTRY 注册，沿用现有模式：

```ts
'creator-fan-gender': {
  Component: CreatorFanGender,
  defaultSize: DEFAULT_SIZES['creator-fan-gender'],
  defaultData: () => getDefaultData('creator-fan-gender'),
  propertySchema: [
    { kind: 'text', key: 'title', label: '标题' },
    { kind: 'text', key: 'subtitle', label: '副标题（清空隐藏）' },
    { kind: 'text', key: 'center', label: '中心文案' },
    { kind: 'list', key: 'slices', label: '性别项', itemLabel: (i) => i.label },
  ],
},
```

- city / age：`title` + `subtitle` + `list(bars)`。
- interest：`title` + `subtitle` + `list(tags)`。（`showPercent` 走默认 true，不暴露字段，保持面板简洁。）
- `variants`：均不设样式变体（单变体）。

### 4. 默认数据（`apps/web/src/editor/defaults.ts`）

`DEFAULT_SIZES` 加 4 项；`getDefaultData` 加 4 个 case，给合理 MOCK：

- gender：slices 女 62 / 男 36 / 其他 2，center `'女性 62%'`，title `'粉丝性别占比'`，subtitle `'女性主导'`。
- city：bars 上海 22 / 广州 16 / 北京 14 / 深圳 12 / 杭州 9 / 成都 7 / 武汉 5 / 西安 4（Top 8），title `'粉丝城市分布 Top 8'`，subtitle `'一线及新一线城市占 73%'`。
- age：bars 18-24 / 25-34 / 35-44 / 45+ 各占比，title `'粉丝年龄段'`。
- interest：tags 美妆 35 / 美食 28 / 穿搭 22 / 旅行 15，title `'兴趣标签'`。

颜色取自 `DEFAULT_CHART_PALETTE`。

### 5. 组件面板（`apps/web/src/editor/ComponentPanel.tsx`）

「达人」分组下追加 4 个入口：

```ts
{ type: 'creator-fan-gender', label: '性别占比', icon: '◑' },
{ type: 'creator-fan-city', label: '城市分布', icon: '≣' },
{ type: 'creator-fan-age', label: '年龄段', icon: '▤' },
{ type: 'creator-fan-interest', label: '兴趣标签', icon: '▦' },
```

### 6. 测试（`apps/web/tests/creator-fan-charts.test.tsx`，新增）

渲染 + 数据契约测试：

- 4 个组件用默认 MOCK 渲染不崩，断言标题/副标题/数据行出现。
- subtitle 为空字符串时不渲染副标题节点。
- 空数组数据时渲染「暂无数据」占位且不崩。
- interest 占比条宽度 = `value/sum`（用默认 MOCK 算期望值断言）。

## 落地骨架

shared 类型 → 渲染组件（含 `CreatorChartShell`）→ registry 注册 → defaults 默认数据 → ComponentPanel 入口 → 测试。复用 recharts + `{label,value,color}` + `DEFAULT_CHART_PALETTE`，不引新依赖、不改 store。
