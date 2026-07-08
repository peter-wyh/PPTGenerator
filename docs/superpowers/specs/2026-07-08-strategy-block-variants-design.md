# 策略块组件（strategy-block）样式变体扩展

> 日期：2026-07-08
> 范围：给已有 `strategy-block` 组件增加 2 个新样式变体（参考图 #4 卡片标签、#5 卡片列表），通过 variant chip 切换。

## 1. 背景与目标

`strategy-block` 现仅 1 种样式：平铺 `flex flex-col gap-3`，每行 = 图标 + 深色大写标题 + 高亮正文（`renderHighlighted`）。

参考图给出两种新样式（两次识别一致）：

- **#4（粉）「卡片标签」**：卡片（圆角+阴影+边框）；多块堆叠，每块 = 图标 + **主题色大写标签标题** + 高亮正文；块间发丝分隔线。
- **#5（绿）「卡片列表」**：卡片；**首行作小标题**（图标+标题，下方分隔线）；其余行作 `•` 项目符号列表（高亮正文）。

目标：加 `variant` 选择器，3 个选项；老数据无 `variant` 字段时落到默认样式，外观不变。

## 2. 关键决策（已确认）

1. 三个 variant：`default`（现有平铺）、`labeled`（#4）、`bulleted`（#5）。
2. `bulleted` 数据映射：`rows[0]` = 小标题（图标+标题）；`rows[1:]` = `•` 列表（取每行 content 列，回退 title 列）。标题行的 content 不渲染。
3. **配色跟随主题**（`text-accent-secondary`），与现有图标/高亮一致 —— 参考图的粉/绿只是示例主题色，不硬编码。
4. 数据模型仅新增可选 `variant`：无 schema 变更、无迁移、老项目无损。

## 3. 数据模型（`packages/shared/src/index.ts`）

```ts
export type StrategyBlockVariant = 'default' | 'labeled' | 'bulleted';

export interface StrategyBlockData {
  variant?: StrategyBlockVariant; // 缺省 'default'
  headers: string[];
  rows: string[][];
  highlights?: string;
}
```

## 4. 渲染（`apps/web/src/editor/components/ReportComponents.tsx`）

`StrategyBlockComponent` 按 `data.variant`（缺省 `default`）分支：

- **`default`**：现有平铺渲染（抽为 `StrategyDefault`，逻辑不变）。
- **`labeled`（`StrategyLabeled`）**：卡片 `rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm`；每行 = 图标(`text-accent-secondary`) + **主题色**大写标签标题(`text-accent-secondary`) + 高亮正文；非首行 `mt-3 border-t border-border-subtle pt-3`（发丝分隔）。
- **`bulleted`（`StrategyBulleted`）**：同款卡片；`rows[0]` = 小标题（图标 + 深色大写标题 `text-foreground-primary`）；`rows[1:]` 渲染为 `•`(`text-accent-secondary`) + 高亮正文，整组 `mt-3 border-t border-border-subtle pt-3`。`rows` 为空 → 卡片内占位「策略块」。

卡片外壳沿用 `CreatorChartShell` 的 `rounded-xl border border-border-default bg-surface-primary` 风格，加 `shadow-sm`。

## 5. 接线（5 处）

| 文件 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | 新增 `StrategyBlockVariant`；`StrategyBlockData` 加 `variant?` |
| `apps/web/src/editor/components/ReportComponents.tsx` | `StrategyBlockComponent` 分支 + `StrategyLabeled` / `StrategyBulleted` |
| `apps/web/src/editor/registry.tsx` | `strategy-block` 加 `variants: [default, labeled, bulleted]`（chip 复用通用 `VariantSelector`，写 `data.variant`） |
| `apps/web/src/editor/defaults.ts` | `strategy-block` 默认数据加 `variant: 'default'` |
| `apps/web/tests/editor.strategy-block.test.tsx`（新） | variant 渲染断言 |

属性面板无需新增自定义字段 —— 现有 `table` + `highlights` 字段不变；variant chip 由通用 `VariantSelector` 自动渲染。

## 6. 测试（vitest + jsdom，断言 shell 文本）

- `default`（无 variant）→ 两个标题 `INSIGHT`/`STRATEGY` 均出现，无 `•`。
- `labeled` → 两个标题出现，无 `•`（区别于列表）。
- `bulleted`（2 行）→ 首行标题 `INSIGHT` 出现（作小标题），`STRATEGY` **不**出现（row[1] 标题丢弃），`•` 出现 1 次（1 个 body 行）。
- 向后兼容：`variant` 缺省等同 `default`。

## 7. 非目标（YAGNI）

不引入新数据字段、不改 `headers/rows` schema、不加固定配色、不加图标位开关。
