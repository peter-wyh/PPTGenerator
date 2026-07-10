# 策略块：高亮工具栏化 + 卡片列表多卡网格

- 日期：2026-07-10
- 范围：`apps/web` 编辑器 + 渲染层；`packages/shared` 类型；`apps/web` 测试
- 目标组件：`strategy-block`（`ComponentType` 已存在，3 变体：默认 / 卡片标签 / 卡片列表）

## 0. 取代既有决策

本设计**显式取代**两份既有 spec 的相关决策（其余部分不变）：

| 既有 spec | 既有决策 | 本设计改为 |
|---|---|---|
| `2026-07-08-strategy-block-rich-text-design.md` §1 决策表 | 高亮词机制：**保留**，作用于富文本渲染后的文本节点（全局逗号分隔词，渲染时包 span） | **删除全局高亮词机制**；高亮改为富文本工具栏的内联功能（选中文字→点按钮→`<mark>` 包裹，持久化进正文 HTML） |
| `2026-07-08-strategy-block-variants-design.md` §2/§4 | `bulleted`（卡片列表）：`rows[0]` 作小标题，`rows[1:]]` 作 `•` 项目符号列表（content 列，丢弃 title/icon） | **每行 = 一张独立卡片**（图标+标题+正文富文本），`grid-cols-2` 网格；卡片内不再有 `•` 列表 |

`default` / `labeled` 变体的外观与既有 spec 保持一致，仅把"渲染时按全局高亮词包 span"换成"渲染正文里已持久化的 `<mark>`"。

## 1. 背景与目标

用户反馈两处逻辑问题：

1. **高亮应是富文本编辑器的功能**，而非一个独立的全局"高亮词（逗号分隔）"字段。当前用户要先在全局字段填词、再回到正文里间接看到效果，割裂且不直观。
2. **卡片列表**应当是"多张卡片"：每张卡片只有「标题图标 / 标题 / 正文富文本」3 个字段，卡片内不应塞多个 `•` 子项。当前 `bulleted` 把首行当标题、其余行压成 bullet 列表（且丢弃这些行的图标与标题），与"卡片列表"语义不符。

目标：把高亮做成富文本工具栏按钮（内联、所见即所得、持久化）；把卡片列表重写为多卡网格。

## 2. 决策摘要（已与用户确认）

| 决策点 | 选择 |
|---|---|
| 高亮标记载体 | `<mark>` 标签 + 手动选区包裹（无属性，语义化） |
| 全局高亮词字段 | **删除**（`StrategyBlockData.highlights` 移除） |
| 高亮持久化 | `<mark>` 作为内联标签存进 `rows[i][2]` 正文 HTML，经 `sanitizeRichText` 保留 |
| 卡片列表模型 | 多卡片网格（`grid-cols-2`），每行一张卡（图标+标题+正文），去掉卡片内 `•` 列表 |
| 应用范围 | 全部 3 个变体（共用同一编辑器与渲染清洗链路） |
| 存量数据迁移 | **不做**（旧 `highlights` 被忽略、旧正文无 `<mark>` 故旧高亮不再显示）；仅样例数据改为内嵌 `<mark>` 保留展示 |
| 高亮按钮 active 态 | v1 **不做**（点击 toggle 即可；列为后续可选） |

## 3. 现状（重构后路径）

- 类型 `StrategyBlockData`：`packages/shared/src/types/editor.ts:429-442`
  - `{ variant?: StrategyBlockVariant; headers: string[]; rows: string[][]; highlights?: string }`
  - `rows` 每行约定 `[iconKey, title, content]`，`content` 为受限 HTML 字符串
- 渲染：`apps/web/src/editor/components/report/StrategyBlock.tsx`
  - `StrategyBlockComponent` 分发 `StrategyDefault` / `StrategyLabeled` / `StrategyBulleted`
  - 三处内容渲染统一走 `renderHtmlWithHighlights(content, data.highlights)`
  - `StrategyBulleted`：`rows[0]` 当 header，`rows[1:]` 进 2 列 `•` 网格（仅取 content）
- 富文本清洗：`apps/web/src/editor/richText.ts`
  - `sanitizeRichText`：白名单 `B/STRONG/I/EM/UL/OL/LI/BR/P`，去属性，DIV unpack 补 `<br>`
  - `renderHtmlWithHighlights`：按逗号分隔高亮词在文本节点上 split 包 `<span class="text-accent-secondary font-medium">`
- 编辑器：`apps/web/src/editor/property-panel/custom-fields/StrategyBlockFields.tsx`
  - 全局「高亮词（逗号分隔）」input + 行列表（图标 picker + 标题 input + `RichTextField`）+ `+ 添加项`
- 富文本控件：`apps/web/src/editor/property-panel/fields/RichTextField.tsx`
  - toolbar：`B` / `I` / `•`；contentEditable；`highlights` 入参仅用于未聚焦时的高亮预览
  - **仅被 `StrategyBlockFields` 引用**（已确认无其他调用方）
- 默认数据：`apps/web/src/editor/defaults.ts`（`strategy-block` case，含 `highlights: 'beauty, tips'`）
- 全局样式：`apps/web/src/index.css`（`--accent-secondary: #ff8533`）
- 测试：`apps/web/tests/richText.test.ts`、`editor.strategy-block.test.tsx`、`editor.strategy-panel.test.tsx` 等

**范围外（不动）**：
- `PlacementData.highlights`（`editor.ts:474`）—— 无关的纯文本 caption 字段，不走 `renderHtmlWithHighlights`。
- `apps/web/src/editor/property-panel/fields.tsx`（flat）内的内联 `RichTextField` 与 `apps/web/src/editor/PropertyPanel.tsx`（root）—— 重构进行中的遗留/并行实现，归重构负责。

## 4. 数据模型变更（最小化，保护存量项目）

`StrategyBlockData`：

```ts
export interface StrategyBlockData {
  variant?: StrategyBlockVariant;       // 不变
  headers: string[];                     // 不变（仅标签）
  rows: string[][];                      // 不变：每行 [iconKey, title, content(受限HTML)]
  // highlights?: string;               // ← 删除
}
```

- **删除 `highlights?: string`**。高亮不再用独立字段表达。
- `rows[i][2]`（content）语义从"受限 HTML（b/strong/i/em/ul/ol/li/br/p）"扩展为"受限 HTML（…同上…**外加 `mark`**）"。
- `headers` / `rows` 结构不变 → 已存项目的 `rows` 数组形态不受影响。

**向后兼容**：存量项目里 `strategy-block` 的 `highlights` 字段变成未知多余字段——
- 若服务端 `components` 校验为 `z.any()` 透传（见 §7 核实），多余字段无害、被忽略。
- 存量正文里没有 `<mark>`，故旧高亮不再显示（可接受；用户已确认不做迁移）。

## 5. 高亮 = 富文本工具栏功能

### 5.1 清洗层 `richText.ts`

- `ALLOWED_TAGS` 增加 `'MARK'`。
- **保留 `renderHtmlWithHighlights`**：它仍被 flat `property-panel/fields.tsx` 的内联 `RichTextField`（line 218）与 root `editor/PropertyPanel.tsx`（line 948，重构期路径）使用；本设计**不删除**，避免破坏重构中的代码。strategy-block 链路（提取出的 `fields/RichTextField.tsx` 与 `StrategyBlock.tsx`）改为不再调用它。
- `sanitizeRichText` 行为不变（对 `<mark>` 同样：保留标签、剥属性、递归清洗子节点）。

### 5.2 富文本控件 `fields/RichTextField.tsx`

- **去掉 `highlights` 入参**（唯一调用方 `StrategyBlockFields` 同步改）。
- toolbar 在 `B` / `I` / `•` 之后新增**高亮按钮**（优先复用 `@phosphor-icons/react` 的 `Highlighter` 图标，`size={12}`；该依赖已在 `apps/web` 中；若无则退化为字符 `H`）：
  - 点击 = `toggleHighlight()`：
    1. 取 `window.getSelection()`；若 `rangeCount===0` 或 `isCollapsed` → 无操作（v1 需先选中文本）。
    2. 取 `getRangeAt(0)`。
    3. 若选区的 `commonAncestorContainer` 最近祖先为单个 `<mark>` 且该 `<mark>` 完全落在选区内 → **解包**（用 `<mark>` 的子节点替换它）。
    4. 否则 **包裹**：`const mark = document.createElement('mark')`；优先 `range.surroundContents(mark)`；跨节点边界抛错时回退 `range.extractContents()` → `mark.appendChild(frag)` → `range.insertNode(mark)`。
    5. `commit()` 写回（`sanitizeRichText` 会保留 `<mark>`）。
  - 用 `onMouseDown` + `e.preventDefault()`（与既有 B/I 一致），避免点击按钮使 contentEditable 失焦丢选区。
- 同步逻辑：未聚焦时 `el.innerHTML = sanitizeRichText(value)`（原为 `renderHtmlWithHighlights(value, highlights)`）。`<mark>` 在 value 内、sanitize 保留，故未聚焦预览正确显示高亮。
- v1 不实现"光标位于 `<mark>` 内时按钮 active 高亮"（后续可选）。

### 5.3 全局样式 `apps/web/src/index.css`

新增（复刻旧粉色高亮观感）：

```css
mark {
  color: var(--accent-secondary);
  font-weight: 500;
  background: transparent;
}
```

（编辑器 contentEditable 与渲染 `dangerouslySetInnerHTML` 共用此全局规则，无需各处重复 `[&_mark]`。）

## 6. 卡片列表 = 多卡网格

`StrategyBulleted`（`StrategyBlock.tsx`）重写：

- 删除"`rows[0]` 当 header / `rows[1:]` 进 `•` 网格"逻辑。
- 改为 `rows.map` → 每行渲染为一张卡片：
  - 外层：`rounded-xl border border-border-default bg-surface-primary p-3 shadow-sm`
  - 标题行：`findIcon(r[0])` 图标（`size={16} text-secondary`）+ 大写标题（`r[1]`，`text-xs font-semibold uppercase tracking-wide`）
  - 正文：`dangerouslySetInnerHTML={{ __html: sanitizeRichText(r[2] ?? '') }}`（`<mark>` 由全局 CSS 染色）
- 容器：`grid grid-cols-2 gap-3`（保留原"2 列"意图；1 张卡占左、2 张并排、3+ 自动换行）。
- `rows` 为空 → 沿用占位「策略块」卡片。

`StrategyDefault` / `StrategyLabeled`：仅把内容渲染从 `renderHtmlWithHighlights(content, data.highlights)` 改为 `sanitizeRichText(content)`，其余（布局、图标、标题、分隔线）**不变**。

## 7. 服务端 schema

既有 spec 记录 `projects.schema.ts` 的 `components` 为 `z.array(z.any())` 透传。**核实当前 `apps/server/src/modules/projects/projects.schema.ts`**：

- 若仍为 `z.any()` 透传 → **无需改动**（删除 `highlights` 字段不影响校验，存量多余字段也不报错）。
- 若已收紧为按 `type` 的判别联合且对 strategy-block 字段严格 → 移除 `highlights` 约束、并确保对未知字段宽容（`.passthrough()` 或去掉 `.strict()`），否则存量数据里的 `highlights` 会让校验失败。

预期结论：无需改动（实现时核实确认）。

## 8. 测试策略（遵循 jsdom 约定）

- `sanitizeRichText` 为纯函数，jsdom 可测；新增：`<mark>foo</mark>` 经 sanitize **保留**（标签在、属性被剥）。
- `renderHtmlWithHighlights` 函数**保留**（供 flat `fields.tsx` / 旧 PropertyPanel 等路径）→ 其既有用例保留不动；`tests/richText.test.ts` 仅**新增**"`<mark>` 经 sanitize 保留"用例。
- `editor.strategy-block.test.tsx`：
  - 去掉 `data.highlights` 相关断言。
  - `default` / `labeled`：内容渲染断言改为 `sanitizeRichText` 产物；若样例正文带 `<mark>`，断言高亮文本出现。
  - `bulleted`：**翻转**既有断言——每行（含原"被丢弃"的 row[1]）的标题与图标均出现；不再出现 `•` 列表项。
- `editor.strategy-panel.test.tsx`：去掉全局「高亮词」字段的断言；保留行编辑（图标/标题/富文本）断言。
- contentEditable / `execCommand` / 选区包裹交互**不在 jsdom 测**（沿用既有约定）。

## 9. 改动文件清单

| 文件 | 改动 |
|---|---|
| `packages/shared/src/types/editor.ts` | `StrategyBlockData` 删 `highlights?`；注释说明 content 允许 `mark` |
| `apps/web/src/editor/richText.ts` | `ALLOWED_TAGS` 加 `MARK`（`renderHtmlWithHighlights` **保留**供 flat fields.tsx / 旧 PropertyPanel 等路径使用） |
| `apps/web/src/editor/property-panel/fields/RichTextField.tsx` | 去 `highlights` 入参；加高亮按钮 + `toggleHighlight`；同步改用 `sanitizeRichText` |
| `apps/web/src/editor/property-panel/custom-fields/StrategyBlockFields.tsx` | 删全局「高亮词」input；不再向 `RichTextField` 传 `highlights` |
| `apps/web/src/editor/components/report/StrategyBlock.tsx` | 3 变体内容渲染改 `sanitizeRichText`；重写 `StrategyBulleted` 为多卡网格 |
| `apps/web/src/editor/defaults.ts` | `strategy-block` 默认数据删 `highlights`；样例正文内嵌 `<mark>` 保留高亮展示 |
| `apps/web/src/index.css` | 加 `mark { color: var(--accent-secondary); font-weight:500; background:transparent; }` |
| `apps/web/tests/richText.test.ts` | 删 `renderHtmlWithHighlights` 用例；加 `<mark>` 保留用例 |
| `apps/web/tests/editor.strategy-block.test.tsx` | 翻转/更新 highlights 与 bulleted 断言 |
| `apps/web/tests/editor.strategy-panel.test.tsx` | 去掉 highlights 字段断言 |
| `apps/server/src/modules/projects/projects.schema.ts` | （核实）若非 `z.any()` 透传则放宽；预期无需改动 |

## 10. 非目标（YAGNI）

- 不做存量数据自动迁移（旧 `highlights` → `<mark>`）。
- 不做高亮按钮 active 态指示。
- 不把高亮工具栏推广到 flat `fields.tsx` 的内联 `RichTextField`（归重构）。
- 不改 `rows` 数据形态（仍 `string[][]`）、不改 `headers`、不加新字段。
- 不动 `default` / `labeled` 的布局。
