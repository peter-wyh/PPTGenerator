# strategy-block 内容富文本化设计

- 日期：2026-07-08
- 范围：`apps/web` 编辑器 + 渲染层
- 目标组件：`strategy-block`（`ComponentType` 已存在）

## 1. 背景与目标

`strategy-block` 是达人画像页用于呈现 INSIGHT / STRATEGY 等内容策略的块。其类型注释虽名为"内容策略富文本块"，但实际**不是富文本**：内容列是纯字符串，渲染走 `whitespace-pre-wrap`，唯一格式能力是一个全局"高亮词"机制（逗号分隔的关键词，渲染时包成强调色 span）。

本次目标：把 `strategy-block` 每一项的**内容**从纯文本升级为**轻量富文本**（加粗、斜体、无序列表、换行），不引入任何第三方富文本库。

### 决策摘要（已与用户确认）

| 决策点 | 选择 |
|---|---|
| 方向 | 升级现有 `strategy-block` 的内容为富文本（保留多 item 结构与 3 个变体） |
| 富文本能力范围 | 轻量：加粗、斜体、无序列表、换行。不引入第三方库 |
| 富文本存储格式 | 受限 HTML 字符串（白名单标签，无属性） |
| 属性面板 | 新增 `strategy-block` 专属编辑区块，替代通用 `TableField` |
| 高亮词机制 | 保留，作用于富文本渲染后的文本节点 |

## 2. 现状

- 数据类型 `StrategyBlockData`：`packages/shared/src/index.ts:798`
  - `{ variant?, headers: string[], rows: string[][], highlights?: string }`
  - `rows` 每行约定 `[iconKey?, title, content]`，`content` 是纯字符串
- 渲染：`apps/web/src/editor/components/ReportComponents.tsx:374-473`
  - `StrategyBlockComponent` 分发到 `StrategyDefault` / `StrategyLabeled` / `StrategyBulleted`
  - 内容渲染统一走 `renderHighlighted(content, highlights)`（`ReportComponents.tsx:356`），在纯文本上按高亮词 split 包 span
- 属性面板：`registry.tsx:331-334`，用通用 `table` 字段（`TableField`，二维 input 网格）+ `highlights` textarea
- 默认数据：`defaults.ts:196`
- 测试：`apps/web/tests/editor.strategy-block.test.tsx`（6 个用例，断言基于纯文本与 `•`）
- 项目**无任何富文本编辑器依赖**（无 tiptap/slate/lexical/draft/quill/prosemirror）

## 3. 数据模型 —— 零改动

`StrategyBlockData` 结构**不变**。`rows[i][2]`（内容列）的**语义**从"纯文本"升级为"受限 HTML 字符串"：

- 允许标签白名单：`b, strong, i, em, ul, ol, li, br, p`
- 禁止任何属性（`style / class / href / onclick` 等一律剥离）
- 禁止白名单外的标签（其文本内容保留，标签丢弃）

**向后兼容**：旧项目 `strategy-block` 的 content 是纯文本（无 HTML 标签），经 `sanitizeRichText` 后原样输出，渲染正常，高亮词正常生效。**无需数据迁移，无需改服务端 schema**（`projects.schema.ts` 的 `components` 是 `z.array(z.any())` 透传）。

## 4. 富文本编辑控件（新增）

新增可复用组件 `RichTextField`：

- 结构：toolbar（`B` 加粗 / `I` 斜体 / `•••` 无序列表）+ `contentEditable` 编辑区
- 编辑命令：`document.execCommand('bold' | 'italic' | 'insertUnorderedList')`（deprecated 但轻量场景最实际，免依赖；换行由 contentEditable 默认行为产出）
- 写回：`onBlur` 时取 `innerHTML` → `sanitizeRichText(html)` → 调 `useDataUpdate` 写回 data
- 受控：初始化时以 sanitize 后的 HTML 作为 `contentEditable` 内容

新增纯函数 `sanitizeRichText(html: string): string`：

- 用 `DOMParser` 解析字符串
- 递归遍历，对每个元素节点：
  - 白名单内标签（`b/strong/i/em/ul/ol/li/br/p`）→ 移除所有属性，保留标签
  - 白名单外的**块级**标签（`div` 等，即 `contentEditable` 按 Enter 的典型产物）→ 用其子节点替换（unpack），但在 unpack 前后插入一个 `<br>` 以**保留换行语义**
  - 白名单外的其他标签 → unpack（用子节点替换，保留文本），不插 `<br>`
- 序列化 `body.innerHTML` 返回
- 纯函数，jsdom 可单测；约 40–50 行

> 换行规范化的目的：避免 `contentEditable` 产出的 `<div>` 被剥离后换行丢失。单测须覆盖该边界。

## 5. 属性面板 —— strategy-block 专属编辑器

新增 `StrategyBlockFields` 专属区块（参考既有 `ImageGroupFields`、`creator-stats-strip` 自定义面板先例）：

- 每行编辑器：图标选择（复用现有 icon 选择）+ 标题 input + 内容 `RichTextField`
- 行操作：增删行、上下移（与现有行编辑体验一致）
- 保留 `highlights` textarea 字段
- `registry.tsx` 中 `strategy-block` 的 `propertySchema` 改为标记走该专属区块（类似 image-group 的标记方式）

理由：通用 `TableField` 是二维 `<input>` 网格，无法承载 contentEditable 富文本；为该组件污染通用组件不合适。

## 6. 渲染 —— 3 变体统一

新增纯函数 `renderHtmlWithHighlights(html: string, highlights?: string): string`：

1. `sanitizeRichText(html)` → 安全 HTML
2. 解析为 DOM，遍历**文本节点**，按 `highlights` 词（逗号分隔、转义、大小写无关）split，命中部分包 `<span class="text-accent-secondary font-medium">`
3. 序列化返回安全 + 高亮的 HTML 字符串

三个变体 `StrategyDefault` / `StrategyLabeled` / `StrategyBulleted` 的内容渲染：

- 由 `<div className="whitespace-pre-wrap ...">{renderHighlighted(content, highlights)}</div>`
- 改为 `<div className="text-sm text-foreground-secondary" dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }} />`
- `bulleted` 变体保留每行外层 `•`，content 作为该项的富文本内容

安全性：内容经 `sanitizeRichText` 白名单清洗（剥离一切属性与非白名单标签）后，再经高亮处理（只插入限定 class 的 span），`dangerouslySetInnerHTML` 的输入是受控的。

## 7. 测试策略（遵循 jsdom 约定）

- `sanitizeRichText`、`renderHtmlWithHighlights` 为纯函数，直接单测：
  - sanitize：剥离属性、剥离非白名单标签但保留文本、保留白名单标签
  - 高亮：在含标签的 HTML 文本节点上正确切分、不破坏标签结构
- 渲染层：断言 sanitize + 高亮后的 DOM（`dangerouslySetInnerHTML` 产物）
- contentEditable / `execCommand` 交互**不在 jsdom 测**（参考既有 recharts mock 约定，编辑交互测不了）
- 现有 `editor.strategy-block.test.tsx` 6 个断言更新：纯文本 → HTML 渲染产物；并新增 sanitize 单测

## 8. 改动文件清单

| 文件 | 改动 |
|---|---|
| `apps/web/src/editor/components/ReportComponents.tsx` | 新增 `sanitizeRichText`、`renderHtmlWithHighlights`；3 变体改内容渲染 |
| `apps/web/src/editor/PropertyPanel.tsx`（或同目录新文件） | 新增 `RichTextField` 组件 + `StrategyBlockFields` 专属区块 + switch 分发 |
| `apps/web/src/editor/registry.tsx` | `strategy-block` 的 `propertySchema` 改为走专属区块 |
| `apps/web/tests/editor.strategy-block.test.tsx` | 更新现有断言 + 新增 sanitize / 高亮纯函数单测 |
| `packages/shared/src/index.ts` | 仅更新 `StrategyBlockData` 注释（说明 content 为受限 HTML）；**结构不改** |
| 服务端 schema / `defaults.ts` | **不改** |

## 9. 非目标（YAGNI）

- 不做链接、图片、标题级别、引用、下划线、有序列表之外的高级格式（用户未选）
- 不引入富文本编辑器库
- 不改 `StrategyBlockData` 数据结构、不做数据迁移
- 不重构其他复用 `TableData` 的组件（meta-strip / kpi-board 等保持原样）
