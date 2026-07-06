# SVG 图标库 + 组件变体级图标接入 设计

| 项目 | 内容 |
|---|---|
| 文档 | 底层补充多套 SVG 图标库，支持组件（如指标卡）在样式变体中渲染 SVG 图标 |
| 日期 | 2026-07-06 |
| 状态 | 设计（待评审） |
| 关联 | `docs/component-system.md` §5 添加新组件配方、§6 工程约定；`packages/shared/src/index.ts` 数据模型；`apps/web/src/editor/registry.tsx` REGISTRY/变体机制 |

---

## 1. 背景 / 目标

当前通用组件层（`BasicComponents.tsx`）的图标表达极弱：指标卡只用 `▲▼` 文本字符表达趋势，没有真正的 SVG 图标能力；其它数值类组件（KPI 看板、达人数据条等）同理。

目标分两层：

1. **底层图标库**：补充一套多维度 SVG 图标能力——「风格 + 用途」二维分类。风格维度由图标库的 weight 机制提供（多套风格），用途维度由我们包一层分类。
2. **组件接入**：以「指标卡」为首批落地组件，提供带图标的样式变体；同时把图标能力做成**通用机制**——任何组件声明变体时，可以让某个变体启用图标。

**关键约束（用户明确）**：图标是通用能力（任何组件都能声明 icon 字段），但**必须与组件某个变体的定义绑定**——即「变体决定是否启用图标」。不存在脱离变体的全局图标字段。

---

## 2. 方案选型

### 2.1 图标库选型

选 **`@phosphor-icons/react`**。理由：它是主流 React 图标集中唯一为**同一图标**提供 6 种视觉 weight 的库——`thin / light / regular / bold / fill / duotone`。这 6 个 weight 天然对应需求中的「多套风格」，无需拼接多个库。约 9000 图标，tree-shakeable，MIT。

weight → 风格映射：

| weight | 风格定位 |
|---|---|
| `thin` | 细线、轻盈 |
| `light` | 细线 |
| `regular` | 标准线（默认） |
| `bold` | 粗线 |
| `fill` | 实心 |
| `duotone` | 双色 |

否决项：`lucide-react`（仅 outline 一套，不满足「多套」）；多库组合（两套 API，过度）。

### 2.2 二维分类

- **风格维度** = Phosphor weight（见上表）。属性面板的 weight tabs 即「多套风格」选择器。
- **用途维度** = 我们自定的 category（`metric` / `creator` / `report` / `generic`）。我们维护一份**精选目录**（~40–60 个图标，按用途分组，带中文 label），不直接暴露全部 9000 个。

**为什么用精选目录而非全量**：9000 图标的 picker 不可用；精选 + 分组 + 搜索才好用。同时我们用稳定的字符串 `key` 解耦于 Phosphor 组件名——未来换库不必迁移已存数据。

### 2.3 分层归属

- 图标**渲染层**（Phosphor 依赖、React 组件）放 `apps/web/src/editor/icons/`。
- 图标**数据契约**（`IconWeight` 类型、组件 data 里的 `icon` 字符串 key）放 `packages/shared/src/index.ts`（type-only）。
- shared 不引入 Phosphor（它是严格 type-only 包，无运行时依赖）。

---

## 3. 数据模型（shared）

`packages/shared/src/index.ts` 新增（type-only，最小侵入）：

```ts
/** 图标风格 = Phosphor weight。 */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/** 指标卡样式变体。plain 复刻旧外观（无图标），其余三个启用图标。 */
export type IndicatorCardVariant = 'plain' | 'icon-left' | 'icon-top' | 'icon-bg';

export interface IndicatorCardData {
  variant?: IndicatorCardVariant;        // 缺省 'plain'（向后兼容老数据）
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  colorTheme: 'orange' | 'green' | 'blue' | 'purple' | 'red';
  icon?: string;                         // catalog key，可选；仅当变体启用图标时有意义
  iconWeight?: IconWeight;               // 缺省走 variant.icon.defaultWeight
}
```

- `icon` / `iconWeight` 是纯字符串 → 组件数据保持可序列化、可移植；Phosphor 永不触碰 shared。
- `variant` 可选且缺省 `plain` → 老数据无 `variant` 字段时按旧外观渲染，零破坏。

---

## 4. 变体绑定机制（registry）

`apps/web/src/editor/registry.tsx` 的 `VariantOption` 扩展一个可选图标槽：

```ts
export interface VariantOption {
  id: string;
  label: string;
  /**
   * 变体声明图标支持。存在即启用：
   *  - 渲染层在该变体的图标位渲染 <IconKit>
   *  - 属性面板对该组件显示 icon 字段
   * 缺省（undefined）= 该变体不涉及图标。
   */
  icon?: {
    position?: 'left' | 'top' | 'bg';     // 图标在组件中的位置
    defaultKey?: string;                  // 首次切到该变体时的默认图标 catalog key
    defaultWeight?: IconWeight;           // 默认 weight
  };
}
```

「变体决定是否启用图标」由 `variant.icon` 的存在性单一判定：
- 存在 → 渲染图标位 + 面板出现 icon 字段
- 不存在 → 无图标、无字段（plain 变体）

**为什么不是全局 icon 字段**：字段之所以存在，是「因为某个变体的定义说要它」。切到非图标变体时，字段干净隐藏、停止渲染，`icon` 值只是闲置，不产生孤儿数据困惑。

---

## 5. 指标卡变体（首批落地）

`IndicatorCardComponent` 从单体改为 1→4 分发器（仿 `CreatorAvatarCard`）：

| variant | icon | 布局 |
|---|---|---|
| `plain` | — | 旧外观：title + value + trend，左 padding，无图标（完全向后兼容） |
| `icon-left` | `position: left` | 小色块圆角框内的图标位于 title/value/trend 左侧 |
| `icon-top` | `position: top` | 图标位于文本栈上方 |
| `icon-bg` | `position: bg` | value 后方大尺寸淡化 fill 图标作水印 |

**默认值**：每个启用图标的变体声明合理默认（如 `icon-top` → `defaultKey: 'trend-up'`, `defaultWeight: 'fill'`），首次切换即见图标，不留空位。

**着色**：`colorTheme` 继续驱动图标色调——图标取主题 `fg`；`icon-bg` 用 ~12% 透明度的主题色。一个旋钮（colorTheme）同时管卡片底色与图标色，无需为每图标单独配色字段。

REGISTRY 中 `indicator-card` 加 `variants`（4 项，3 项带 `icon` 声明）+ 动态注入的 `icon` field。

---

## 6. 属性面板 + 图标选择器 UI

新增 `PropertyFieldKind: 'icon'`。该字段读写 `data.icon`（+ 同行小下拉读写 `data.iconWeight`）。**仅当当前激活变体声明了 icon 才渲染**——这是「变体决定是否启用图标」在 UI 上的唯一闸门。

```
PropertyPanel
  └─ 对 propertySchema 每个字段 + 动态注入的 icon 字段:
       若 field.kind === 'icon':
         查 active variant → variant.icon 存在: 渲染 <IconPickerField>
                            否则:              跳过（不渲染、不报错）
```

`IconPickerField` = 预览 chip（当前图标 + weight）+「选择」按钮 +「清除」按钮；点击「选择」打开 `IconPickerOverlay`。

`IconPickerOverlay`（复用现有 overlay 模式，形如 `TemplateOverlay` / `ScenarioOverlay`）：

- **weight tabs**：6 个 weight = 「多套风格」选择器，实时切预览
- **分类分组**（metric / creator / report / generic）+ **搜索框**
- 图标网格，点击即选中 → 关闭 overlay → 写入 `data.icon`
- 面板内 weight 小下拉写 `data.iconWeight`；省略时回退 `variant.icon.defaultWeight`

**通用能力验证**：任何组件声明带 `icon: {...}` 的 `variants`，并在其 schema 加一条 `icon` 字段，即免费获得此 picker——无需为每组件写自定义代码。面板对变体敏感，同一套逻辑覆盖 indicator-card 及未来任何带图标组件。

---

## 7. 底层图标库（apps/web/src/editor/icons/）

三个新文件：

### 7.1 `catalog.ts`
精选目录。导出：

```ts
export interface IconDef { key: string; label: string; category: IconCategory; phosphor: string; }
export type IconCategory = 'metric' | 'creator' | 'report' | 'generic';
export const ICONS: IconDef[];            // ~40-60 项，按用途分组
export const ICON_CATEGORIES: { id: IconCategory; label: string }[];
export const ICON_WEIGHTS: IconWeight[];  // ['thin','light','regular','bold','fill','duotone']
export function findIcon(key: string): IconDef | undefined;
```

`key` 是稳定字符串标识（如 `'trend-up'` / 'eye' / 'cart'），解耦于 Phosphor 组件名。

### 7.2 `IconKit.tsx`
唯一渲染入口：

```tsx
export function IconKit({ name, weight = 'regular', size = 24, color }: {
  name: string; weight?: IconWeight; size?: number; color?: string;
}): JSX.Element | null;
```

- `name` → `findIcon` → 取 Phosphor 组件 → 渲染。
- 未命中 key → 返回 `null`（不抛），渲染层对此无感。

所有组件的图标**只通过 `<IconKit>` 渲染**，不直接 import Phosphor。

### 7.3 `IconPickerOverlay.tsx`
选择器模态：weight tabs + 分类分组 + 搜索 + 选中回调。被 `IconPickerField`（PropertyPanel 内）使用。

---

## 8. 变更清单

| 文件 | 变更 |
|---|---|
| `apps/web/package.json` | 加 `@phosphor-icons/react` |
| `packages/shared/src/index.ts` | `IconWeight`；`IndicatorCardVariant`；`IndicatorCardData` 加 `variant?/icon?/iconWeight?` |
| `apps/web/src/editor/icons/catalog.ts` ✱new | `ICONS` + `ICON_CATEGORIES` + helpers |
| `apps/web/src/editor/icons/IconKit.tsx` ✱new | `<IconKit>` 渲染原语 |
| `apps/web/src/editor/icons/IconPickerOverlay.tsx` ✱new | picker 模态 |
| `apps/web/src/editor/registry.tsx` | `VariantOption.icon?`；`PropertyFieldKind` 加 `'icon'`；`indicator-card` 加 4 variants + 注入 icon 字段 |
| `apps/web/src/editor/PropertyPanel.tsx` | 动态注入 icon 字段（变体门控）；渲染 `IconPickerField` + weight 下拉 |
| `apps/web/src/editor/components/BasicComponents.tsx` | `IndicatorCardComponent` → 变体分发器（4 子布局）+ `<IconKit>` |
| `apps/web/src/editor/defaults.ts` | indicator-card 默认数据加 `variant: 'plain'` |
| `apps/web/tests/` ✱new/扩展 | registry / PropertyPanel / IndicatorCardComponent / IconKit 测试 |

---

## 9. 范围外（YAGNI，显式）

- **其它组件的图标变体接入**（kpi-board / creator-stats / …）：能力已就位，逐个采纳是后续工作。
- **逐图标自定义颜色**：`colorTheme` 已统一着色，一个旋钮足够。
- **服务端 / SSR 图标渲染**：本轮仅编辑器内。
- **全量 9000 图标暴露**：仅精选目录。

---

## 10. 测试方案（vitest + @testing-library，对齐现有 `tests/`）

1. **IconKit**：已知 key → 渲染出 `<svg>`；未知 key → 回退 `null`，不抛。
2. **IndicatorCardComponent**：`plain` 不渲染 `<IconKit>`；`icon-left/top/bg` 在正确位置渲染 `<IconKit>`；`colorTheme` 着色生效；缺 `data.icon` 时回退 `variant.icon.defaultKey`。
3. **Registry**：indicator-card 有 4 variants；3 个图标变体带 `icon` 声明；`plain` 无。
4. **PropertyPanel**：激活变体带 icon → icon 字段渲染；激活 `plain` → icon 字段不渲染。

---

## 11. 工程约定对齐

- 遵循 `docs/component-system.md` §5「添加新组件配方」：shared 类型 → defaults → 组件渲染器 → REGISTRY → PropertyPanel。本轮不新增 ComponentType，只是给既有 `indicator-card` 加变体 + 引入底层图标库。
- 遵循 §6「变体机制通用」：`BlockDef.variants` 声明即得 chip 选择器；本轮扩展的是 `VariantOption` 本身的表达能力（加 `icon?`），机制保持通用。
- 不扩展 legacy `business-block` 的 `businessKind`。
