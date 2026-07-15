# 业绩看板·指标数值颜色限定为 黑/白/品牌色 — 设计

- 日期：2026-07-15
- 范围：`apps/web` 编辑器 + `packages/shared` 类型
- 相关组件：业绩看板 `kpi-board`（`KpiBoard.tsx`）

## 需求

业绩看板组件中，**指标数值的颜色仅支持选择黑色、白色或者品牌色**。

## 现状

- 指标数值颜色持久化于 `KpiBoardData.valueColors: (KpiColorToken | null)[]`，与 `rows` 逐行对齐（`packages/shared/src/types/editor.ts:567`）。
- `KpiColorToken = 'primary' | 'success' | 'warning' | 'danger' | 'info'`（默认/绿/橙/红/蓝，`editor.ts:556`）。
- token → CSS 映射在 `apps/web/src/editor/kpiTokens.ts` 的 `KPI_COLOR_TOKENS`；可选项数组 `KPI_COLOR_OPTIONS`。
- 拾色器 `KpiRowStyleField`（`apps/web/src/editor/property-panel/custom-fields.tsx:334-431`）遍历 `KPI_COLOR_OPTIONS` 渲染色块，点击写入 `valueColors[i]`。
- 渲染端 `KpiBoard.tsx:23`：`token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : undefined` —— 对任意 token 通用。
- 颜色语义已有先例：`BasicComponents.tsx:425,458,554` 的 `titleColor`/`underlineColor` 用 `'black'`→`#000000`、`'brand'`→`var(--color-primary)`、白→`#fff`。

## 方案

**扩充 token 集 + 收窄可选项；渲染与拾色器逻辑零改动。**

旧 5 个 token 保留在类型与映射表中（继续渲染历史数据），仅把可选项数组 `KPI_COLOR_OPTIONS` 收窄为黑/白/品牌色三项。已存为绿/橙/红/蓝的旧项目观感不变，零迁移、零崩溃风险。

### 颜色映射（沿用既有约定）

| 选项 | token | 解析为 |
|---|---|---|
| 黑色 | `black` | `#000000` |
| 白色 | `white` | `#fff` |
| 品牌色 | `brand` | `var(--color-primary)` |

品牌色取项目主题主品牌色 `--color-primary`（默认 `#FF5C00`，由 `apps/web/src/editor/theme.tsx:70` 注入）。

## 改动清单

### 1. `packages/shared/src/types/editor.ts:556`

`KpiColorToken` 追加三个 token，旧五个保留：

```ts
export type KpiColorToken =
  | 'primary' | 'success' | 'warning' | 'danger' | 'info' // 旧：保留以渲染历史数据，不再出现在拾色器
  | 'black' | 'white' | 'brand';                          // 新：黑/白/品牌色
```

### 2. `apps/web/src/editor/kpiTokens.ts`

`KPI_COLOR_TOKENS` 增加三条（`softBg` 沿用 `color-mix` 12% 透明同款）：

```ts
black: { fg: '#000000', softBg: 'color-mix(in srgb, #000000 12%, transparent)' },
white: { fg: '#fff',    softBg: 'color-mix(in srgb, #fff 12%, transparent)' },
brand: { fg: 'var(--color-primary)', softBg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' },
```

`KPI_COLOR_OPTIONS` 替换为三项（去掉「默认/绿/橙/红/蓝」）：

```ts
export const KPI_COLOR_OPTIONS: { token: KpiColorToken; label: string }[] = [
  { token: 'black', label: '黑色' },
  { token: 'white', label: '白色' },
  { token: 'brand', label: '品牌色' },
];
```

### 3. `apps/web/src/editor/property-panel/custom-fields.tsx`（仅一处 UI 微调）

色块未选中态当前为 `border-transparent`，新增的白色色块在浅色面板上不可见。把未选中色块的边框改为极淡常驻边框（如 `border-black/10`），三色都看得见；选中态仍为 `border-foreground-primary`。其余逻辑（toggle 写入 / 清空）不变。

> 拾色器遍历 `KPI_COLOR_OPTIONS` 自动收窄为三色，无需改动遍历逻辑。

### 4. `apps/web/tests/kpi-tokens.test.ts`

- 第 20 行「`KPI_COLOR_OPTIONS` 覆盖 5 个 token」断言改为三项 `['black', 'white', 'brand']`。
- 「每个 option 的 token 都有 `KPI_COLOR_TOKENS` 映射」那条循环断言依然成立（三项均已在映射表中），保持。
- `resolveKpiColor` 缺省/null 回退 `primary`、`'success'` → `success` 的断言不变（旧 token 仍在表中）。

## 不需改动

- **`KpiBoard.tsx`**：token→`fg` 解析对任意 token 通用，新 token 自动生效。各变体（grid/card/flat/gradient/minimal/compact/row）无需调整。
- **server Zod**：`projects.schema.ts:53` 的 `components: z.any()`，组件 data 透传，无 schema 改动。
- **`custom-fields/KpiRowStyleField.tsx`**（死代码副本）：导入同一 `KPI_COLOR_OPTIONS`，随源自动收窄；按约定不维护死代码。

## 设计决策

- **旧 token 保留、仅从可选项摘掉**：保证历史项目继续渲染、无崩溃、无迁移。
- **去掉「默认」色块**：未选状态（`null`）仍走主题默认前景色（浅底≈黑）；再次点击已选中色块即清空回 `null`，复用现有 toggle 行为。需求要求「仅」黑/白/品牌色，故不再单列「默认」。
- **白色色块加淡边框**：新增白色带来的唯一 UI 副作用；保证其在浅色面板可见。
- **颜色值取字面量 hex / `var(--color-primary)`**：与 `BasicComponents.tsx` 既有 `titleColor`/`underlineColor` 完全一致，保持代码库内一致。

## 已知边界（本次不动）

需求范围是「指标数值颜色」。下列属 token 耦合的既有行为，不在本次范围：

- `card` 变体的图标底色 `softBg` 与图标前景随同一 token —— 选白色时浅卡片上图标偏淡。
- `gradient` 变体强制白字（`text-white`）—— 选白色 token 在该变体下无意义。

如需把数值色与图标色解耦，另立 spec。

## 测试与验证

- 更新 `kpi-tokens.test.ts`（见上）。
- 从 `apps/web` 绝对路径跑 vitest + tsc（[[web-vitest-run-from-root]]）。
- 手测：新建 kpi-board，逐行点黑/白/品牌色，确认数值文字色生效；旧项目（若存在绿/橙/红/蓝值）仍正常渲染且拾色器不再露出旧色。
