# 报告设置：字体设置 + 整体风格定义

**日期**：2026-07-04
**范围**：`apps/web`（编辑器）、`packages/shared`（类型与常量）
**状态**：设计已确认，待实现

## 背景

当前"报告设置"入口（`apps/web/src/editor/components/ReportSettingsOverlay.tsx`）只提供三项：主品牌色 `primary`、次品牌色 `secondary`、单一 `fontFamily`。`ProjectTheme`（`packages/shared/src/index.ts:91`）形状为 `{ primary?, secondary?, fontFamily? }`，在 `Editor.tsx:27-35` 映射成根节点 CSS 变量后级联。

存在两个问题：

1. **字体设置不足**——只有单一全局字体，无法分别指定文本与数字字体。
2. **"整体风格"未真正生效**——主题 token 仅部分接入 UI 铬（chrome），业务/报告组件大量硬编码 hex 颜色与字体（`business/shared.tsx`、`BasicComponents.tsx:65-71` 等），切换主题时内容不跟随。

## 目标

1. 在报告设置中提供**文本字体 / 数字字体（/可选 标题字体）**的独立设置。
2. 引入**整体风格**定义，覆盖配色、字体、密度、圆角、命名预设五个维度，并让**全部组件**读取这些 token，实现真正的全局风格。
3. "解析参考图"入口**预留**（占位按钮），为后续 vision 接入留好接口，本次不实现 vision。

## 非目标

- 不引入 vision / LLM 后端（本次只留 UI 占位）。
- 不引入前端测试框架（保持现有无测试基建）。
- 不改动属性面板 `propertySchema` 的字段集合（逐组件字体覆盖入口保留在数据模型，但不在 UI 暴露）。
- 不改动页面尺寸 / 场景等项目创建期设置。

## 设计

### §1 数据模型

扩展 `packages/shared/src/index.ts` 中的 `ProjectTheme`，从扁平 3 字段升级为结构化 `ThemeSpec`：

```ts
interface ProjectTheme {
  color: {
    primary: string;        // 主品牌色（原 primary）
    secondary: string;      // 次品牌色（原 secondary）
    chartPalette: string[]; // 图表配色序列，6 色，用于柱/折/饼
    neutralText: string;    // 主文字色（中性）
    neutralBg: string;      // 页面/卡片背景色
  };
  font: {
    text: string;     // 文本字体 key（如 'noto-sans-sc'）
    number: string;   // 数字字体 key（如 'inter'）
    heading?: string; // 标题字体 key，可选，缺省=跟随 text
  };
  density: 'compact' | 'standard' | 'spacious';
  radius: 'sharp' | 'small' | 'large';
  preset?: string;    // 当前命中的预设 key，仅用于 UI 高亮；手改字段后置空
}
```

两个配套常量（放 `packages/shared`，前后端共用）：

```ts
interface FontOption {
  key: string;            // 'noto-sans-sc'
  label: string;          // '思源黑体'
  category: 'text' | 'number' | 'heading';
  stack: string;          // 实际 CSS font-family 值
  loadUrl?: string;       // Google Fonts <link>，按需注入 <head>
}
const FONT_OPTIONS: FontOption[]; // 预置清单

interface StylePreset {
  key: string;        // 'business-sober'
  name: string;       // '商务沉稳'
  description: string;
  theme: ProjectTheme; // 一整套值
}
const STYLE_PRESETS: StylePreset[]; // 约 4 个预设
```

**向后兼容**：现有项目存储的仍是旧形状 `{ primary, secondary, fontFamily }`。提供 `normalizeTheme(raw): ProjectTheme`，把旧字段映射进新结构（`primary→color.primary`、`secondary→color.secondary`、`fontFamily→font.text`，其余给默认值）。store 加载项目时调用一次。默认值由一套 `DEFAULT_THEME` 常量提供。

### §2 Token 映射层

把 `ProjectTheme` 拆成两条通道下发给组件。

**① CSS 变量（静态样式）**——在 `Editor.tsx:27-35` 现有 `themeStyle` 基础上扩展，挂在编辑器根节点。组件用 `var(--…)` 或 Tailwind 任意值（`bg-[var(--color-primary)]`）引用：

- `--font-text` / `--font-number` / `--font-heading`
- `--color-primary` / `--color-secondary`
- `--color-neutral-text` / `--color-neutral-bg`
- `--radius-card` / `--radius-pill`（由 `radius` 派生）
- `--space-pad-sm` / `--space-pad-md` / `--space-pad-lg`（由 `density` 派生）
- `--chart-1 … --chart-6`（图表配色也同步暴露成 var，饼图可用）

派生规则集中在 `themeToCssVars(theme): Record<string,string>` 一个函数里（如 `radius:'large'→--radius-card:16px`、`density:'spacious'→--space-pad-md:20px`），不散落。

**② React Context（数组型 token）**——新增 `ThemeContext`，只暴露 `chartPalette: string[]`。仅柱图/折线图/饼图组件用 `useTheme()` 取这个数组渲染 SVG 序列色。其余组件一律走 CSS 变量，不碰 context。

**字体加载**：`Editor.tsx` 根据当前 `font.text/number/heading` 对应的 `FontOption.loadUrl`，用 `useEffect` 把所需 `<link rel="stylesheet">` 注入 `<head>`，按 `key` 去重；切换字体时旧 link 保留（避免已挂载文字闪退），新增按需追加。

token 来源唯一（`ProjectTheme`），派生集中在一个函数；颜色/字体/圆角/间距走 CSS 变量零 JS，仅图表配色走 context。

### §3 报告设置 UI

改造 `ReportSettingsOverlay.tsx`。顶部一行**预设选择器**（chips：商务沉稳 / 科技简约 / 活力潮流 / 极简素雅），点中即把整套 `ProjectTheme` 填入下方所有字段；下方任意字段被手改后，预设 chip 高亮自动取消（`preset` 置空）。

其余按分区纵向排列：

- **配色**——主品牌色、次品牌色（沿用现有 color picker + hex 输入控件）；新增中性文字色、背景色（同控件）；图表配色板 6 色（6 个小色块 + 各自 picker，整体作为一个序列）。
- **字体**——三个下拉：文本字体、数字字体、标题字体（标题下拉含"跟随文本字体"选项）。下拉项来自 `FONT_OPTIONS`，按 `category` 过滤。
- **密度**——3 选 chip（紧凑 / 标准 / 宽松）。
- **圆角**——3 选 chip（直角 / 小圆角 / 大圆角）。
- **解析参考图**——底部一个次要按钮，点击弹 toast「参考图解析即将上线，敬请期待」，纯占位，为后续 vision 接入预留入口与回调签名。

**数据流**：overlay 直接读写 store 的 `projectMeta.theme`（沿用 `store.ts:257-264` 现有 `updateTheme` action 模式，扩成接受新结构）。所有字段实时生效，无需"保存"按钮（与现有行为一致）。color picker 复用 overlay 已有的内联控件；chip 选择器复用组件 `variants` 已在用的样式风格。

### §4 组件迁移

把硬编码值替换成 token，按类型分四组：

**① 字体**——`BasicComponents.tsx:33` 与 `defaults.ts:45` 的 `'Inter'` 改为不设默认（继承根节点 `--font-text`）；`business/shared.tsx` 的 `'Funnel Sans'`（大数字）→ `var(--font-number)`、`'IBM Plex Sans'`→`var(--font-text)`、`'IBM Plex Mono'`→`var(--font-number)`。保留 `TextData.fontFamily` 字段作为逐组件覆盖入口（本次不动 schema）。

**② 颜色（语义）**——业务块状态色 `#22C55E`、`#EF4444`、`#3B82F6`、`#F59E0B` 等改成已有的 `var(--green/--red/--blue/--yellow/--purple)`（`index.css:6-27` 已定义，未被内容组件用上）。主品牌色相关 `#FF5C00` / `#FF8533` → `var(--color-primary/secondary)`。

**③ 颜色（指标卡 THEME map）**——`BasicComponents.tsx:65-71` 写死的指标卡配色表，改为从图表配色板 `chartPalette` 派生（按指标序号取色），随主题切换而变。

**④ 图表**——柱图/折线图/饼图三个组件用 `useTheme()` 取 `chartPalette`，序列色按 index 取；轴线/网格用 `var(--color-neutral-*)`。这是唯一走 context 的组件族。

**⑤ 几何**——卡片/容器组件的 `borderRadius` 与内边距改成 `var(--radius-card)` 与 `var(--space-pad-*)`。

涉及文件：`BasicComponents.tsx`、`business/shared.tsx`、`business/render.tsx`、`datasource/resolve.ts`、`ReportComponents.tsx`、`CompanyComponents.tsx`、`CreatorComponents.tsx`、`defaults.ts`。

为避免"改了但没验证"，迁移按组件族分批，每批改完在画布上目检主品牌色切换、字体切换、密度切换是否生效。

### §5 测试与验证

仓库目前无前端测试基建，本次以**类型检查 + 手动目检**为主，不引入新测试框架（YAGNI）：

- **类型层**：`ProjectTheme` 结构变更后，`tsc` 全量过一遍，确保 store、overlay、各组件类型对齐；`normalizeTheme` 输入输出有明确类型。
- **回归清单（手动）**：迁移每批组件后，在画布上验证 4 个开关——切换主品牌色 / 切换文本字体 / 切换数字字体 / 切换密度+圆角，确认硬编码处确实跟随。
- **向后兼容**：用一个旧 shape（`{primary, secondary, fontFamily}`）的项目打开，确认 `normalizeTheme` 正确还原、不报错、渲染正常。
- **预设**：依次点 4 个预设，确认所有字段被正确填充；手改一个字段后预设高亮取消。

## 实现顺序（粗）

1. `packages/shared`：新 `ProjectTheme` 类型、`FontOption` / `STYLE_PRESETS` / `FONT_OPTIONS` / `DEFAULT_THEME` 常量、`normalizeTheme`。
2. token 层：`themeToCssVars`、`ThemeContext` + `useTheme`、`Editor.tsx` 接线（含字体 `<link>` 注入）。
3. store：`updateTheme` 适配新结构，加载项目时调用 `normalizeTheme`。
4. UI：`ReportSettingsOverlay` 重写（预设 + 5 分区 + 占位解析按钮）。
5. 组件迁移：按 §4 五组分批替换硬编码值。
6. 手动回归清单逐项验证。

## 风险

- **硬编码值分散**：迁移面较广，可能漏掉个别 hex/字体；靠回归清单 + 全文搜索 `#`、`'Inter'`、`Funnel`、`IBM Plex` 收口。
- **字体加载延迟**：Web 字体首次注入有 FOUT；可接受，必要时后续加 `font-display: swap`。
- **向后兼容遗漏**：旧项目数据形状不一；`normalizeTheme` 必须容错（字段缺失用默认值，不抛错）。
