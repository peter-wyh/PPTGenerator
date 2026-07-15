# 标题块「色块下划线」颜色与形态改造 — 设计

## 背景

标题块组件（`title-block`）的 `下划线`（`underline`）变体，即「色块下划线」，渲染于
`apps/web/src/editor/components/BasicComponents.tsx` 的 `TitleBlock` → `case 'underline'`（约 441–449 行）。

现状：

| 属性 | 现值 | 类名/取值 |
|---|---|---|
| 高度 | 2px | `h-0.5` |
| 宽度占比 | 100% | `w-full` |
| 圆角 | 满（胶囊） | `rounded-full` |
| 颜色 | 跟随通用「主色」`data.color` | `backgroundColor: color`，`color = data.color ?? 'var(--color-primary)'` |

## 目标

1. **颜色可配置**：色块下划线支持「品牌色 / 黑色」二选一（独立于通用「主色」选择器）。
2. **大圆角色块**：改为中等色块（6px 高），保留大圆角（胶囊两端）。
3. **长度占比 20%**：宽度由 100% 改为 20%。
4. **与标题重叠且底对齐**：色块条带不再位于标题下方留白处，而是绝对定位贴标题底部、
   落在标题文字之后，与标题底边对齐并重叠。

## 决策（已与用户确认）

- **色块形态**：中等色块 — 高 6px（`h-1.5`）、宽 20%（`w-1/5`）、圆角满（`rounded-full`）。
- **「黑色」定义**：固定纯黑 `#000000`，不随主题变化。
- **「品牌色」定义**：主题品牌色 `var(--color-primary)`（如 `#FF5C00`，随项目主题）。
- 二者通过新增持久化字段 `underlineColor` 选择，缺省 `brand`。

## 改动清单

### 1. `packages/shared/src/types/editor.ts` — `TitleBlockData`

新增可选字段：

```ts
/** 下划线颜色（underline 样式）：品牌色 / 黑色；缺省品牌色 */
underlineColor?: 'brand' | 'black';
```

### 2. `apps/web/src/editor/registry.tsx` — `title-block` 的 `propertySchema`

在 `color` 之后追加一个 `select` 字段（复用通用 `SelectField`，与「底部分割线」同款，无需自定义字段组件）：

```ts
{ key: 'underlineColor', label: '下划线颜色', kind: 'select',
  options: [
    { value: 'brand', label: '品牌色' },
    { value: 'black', label: '黑色' },
  ] },
```

### 3. `apps/web/src/editor/components/BasicComponents.tsx` — `case 'underline'`

- 宽度：`w-full` → `w-1/5`
- 高度：`h-0.5` → `h-1.5`
- 圆角：保留 `rounded-full`
- 布局：标题包进 `relative` 容器；色块条带改为 `absolute bottom-0 left-0`，置于标题文字之后
  （标题 `relative` → 后绘制、盖在条带之上）→ 与标题**底对齐并重叠**，不再用 `mt-1.5` 下移留白。
- 颜色：由 `underlineColor` 解析，**解耦**通用 `color`：
  - `'black'` → `#000000`
  - `'brand'` 或缺省 → `var(--color-primary)`

### 4. `apps/web/src/editor/defaults.ts` — title-block 默认值

追加 `underlineColor: 'brand'`，使新建组件属性面板下拉框默认选中「品牌色」。
已存项目该字段缺省时，渲染回退品牌色（与默认一致，视觉不跳变）。

### 5. 测试 — `apps/web/tests/components.test.tsx`

新增 `TitleBlock`（`variant: 'underline'`）用例：
- `underlineColor: 'black'` → 色块 `backgroundColor === '#000000'`
- `underlineColor: 'brand'` 与缺省 → `backgroundColor === 'var(--color-primary)'`
- 色块携带 `w-1/5`、`h-1.5` 类名

## 不在范围内 / 取舍

- **无后端 / Zod 改动**：组件持久化为 `components: z.array(z.any())` 不透明 JSON
  （`apps/server/src/modules/projects/projects.schema.ts:37`），新字段仅由 TS 类型在客户端约束。
  服务端 Zod 只约束 Page 级字段。
- **通用「主色」选择器保留**：仍对所有变体显示并驱动 `bar-left` / `gradient` / `numbered`；
  对 `underline` 变体不再生效（改由「下划线颜色」驱动）。这与现有「主色 / 底部分割线」
  全变体显示的宽松模式一致；按变体条件显隐字段需引入新机制，本次不做。
- 既有潜伏 bug（`data.color` 默认 `'auto'` 未被 `??` 解析，见 `BasicComponents.tsx:415`）
  不在本次范围；新字段已为 underline 变体绕开该问题。
