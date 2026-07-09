# 全局样式设置（v2）：行高 / 币种 / 数字格式 / 图表样式 / 阴影 / 背景 + 安全距离默认值

**日期**：2026-07-09
**范围**：`packages/shared`（类型/常量/normalize/格式化器）、`apps/server`（Zod）、`apps/web`（编辑器 store / theme token / 设置浮层 / 业务与基础渲染器 / mock 数据）
**状态**：设计已确认，待实现
**前置**：延续 [`2026-07-08-global-style-settings-design.md`](./2026-07-08-global-style-settings-design.md)（已落地的布局尺寸：安全距离 + 网格）。本次在其 `ProjectTheme` 上扩展更多维度。

## 背景

`ProjectTheme`（`packages/shared/src/index.ts:399`）已落地配色 / 字体 / 密度 / 圆角 / 布局，经 `themeToCssVars`（`apps/web/src/editor/theme.tsx:46`）下发 CSS 变量 + `ThemeContext`，由「全局样式设置」浮层（`apps/web/src/editor/components/ReportSettingsOverlay.tsx`）配置。但仍有若干空白与硬编码：

1. **没有"行高"概念**——`*Data` 接口无任何 `lineHeight` 字段；用户「文本」组件（`BasicComponents.tsx:31-47`）不设行高，吃浏览器默认 `normal`；业务模板各自硬编码（`business/shared.tsx:70` 标题 `1.12`，`business/render.tsx` 散落 `0.8`–`1.55` 约 20 处）。无法全局控制文字行距。
2. **币种硬编码 `¥`**——金额是**创作期烤进字符串**的（`defaults.ts:254` `price:'¥80,000'`、`templates.ts:346` `'¥600K'`、`api/campaigns.ts:23-88`、`business/render.tsx:659,725`、`business/catalog.ts:226`、`shared/index.ts:955` 占位 `'¥120'`）；唯一的程序化格式化器 `creatorPerformance.ts:168` 也写死 `¥${fmt(n)}`。无 `currency` 字段、无 `Intl.NumberFormat`、不可按项目配置。
3. **无数字格式旋钮**——千分位 / 小数位 / K-M 缩写散落在 mock 与模板里，各自手写。
4. **无图表统一样式**——坐标轴 / 网格线 / 图例位置 / 柱圆角在 recharts 各组件里写死，跨图不一致。
5. **无统一卡片阴影**——`Base`/`CreatorChartShell` 等卡壳的 `box-shadow` 写死或无。
6. **无全局页面背景默认**——每页各自 `bgColor`/`bgGradient`，新建页无全局兜底。
7. **安全距离默认偏大**——`DEFAULT_THEME.layout.safeMargin = 48`（`index.ts:504`），需方期望默认 24。

## 目标

按优先级纳入 7 个维度，全部并入 `ProjectTheme`（沿用 §1 既有"扁平扩展"模式），新字段一律**可选 + normalize 兜底**，老项目零迁移：

1. **行高规则**：每项目二选一——`ratio`（行高 = 字号 × n）或 `fixed`（行高 = 字号 + Npx）。仅作用于用户「文本」组件 + 暴露基础 CSS 变量；业务模板保留各自调好的行高（决策：作用范围 = 仅文本组件 + 基础变量）。
2. **安全距离默认 24**：`DEFAULT_THEME.layout.safeMargin` 48 → 24。
3. **币种**：`format.currencySymbol`（默认 `$`）+ `currencyPosition`；`formatMoney()` 格式化器；现有烤死的 `¥` 串一次性替换为 `$`；新的数值金额走格式化器（决策：折中方案）。
4. **数字格式**：`format.{thousandsSep, decimals, compact}`；`formatNumber()` 格式器，与币种配对。
5. **图表样式**：`chart.{showAxis, showGrid, legendPosition, barRadius}`，经 `ThemeContext` 下发，recharts 组件统一消费。
6. **卡片阴影**：`shadow`（none/subtle/soft/strong）→ `--shadow-card` CSS 变量。
7. **全局页面背景**：`background.{color, gradient?}`，作为页面无自有背景时的兜底。

## 非目标（YAGNI）

- 行高按文字角色（正文/标题/数字）分别设——本次单一全局规则；业务模板行高不改。
- 行高作用于业务模板（统一覆盖）——保留模板各自的紧凑值（KPI 大数字 0.9 等）。
- 四边独立安全距离、文字基线网格——延后。
- 币种做完整数值迁移（把所有 `'¥1.24M'` 改成数值 + 格式器，含 K/M 逻辑）——工作量大且会改变现有样本显示；本次只做符号替换 + 新数值走格式器。
- 类型比例 / 字号基准、间距数值化（density 已覆盖 3 档）、透明度 token——本次不做。
- 多币种切换 / 汇率——单币种。
- 改动 `ComponentType` 联合、改动 `Page` 持久化字段集合——新维度只挂 theme。

## 设计

### §1 数据模型（`packages/shared/src/index.ts`）

`ProjectTheme` 扁平扩展 5 个可选子对象（`lineHeight`/`format`/`chart`/`background`）+ 1 个标量（`shadow`）：

```ts
interface ProjectTheme {
  color: {...}; font: {...};
  density: ThemeDensity; radius: ThemeRadius;
  layout?: { safeMargin; gridSize; showGrid?; showSafeArea? };

  lineHeight?: {
    mode: 'ratio' | 'fixed';   // ratio = 字号×n ; fixed = 字号+Npx
    value: number;             // ratio: 倍数(1.5) ; fixed: 像素(8)
  };
  format?: {                    // 币种 + 数字格式，成对
    currencySymbol: string;     // 默认 '$'
    currencyPosition: 'before' | 'after';
    thousandsSep: boolean;      // 默认 true
    decimals: 0 | 1 | 2;        // 默认 0
    compact: 'none' | 'auto';   // auto → K/M 后缀（覆盖 decimals 取 1 位）
  };
  chart?: {
    showAxis: boolean; showGrid: boolean;
    legendPosition: 'none' | 'top' | 'bottom' | 'right';
    barRadius: number;          // 0–16
  };
  shadow?: 'none' | 'subtle' | 'soft' | 'strong';
  background?: {                // 全局页面背景兜底
    color: string;
    gradient?: { type; angle; stops };  // 复用 Page 现有 gradient 形状
  };
  preset?: string;
}
```

**默认值**（`DEFAULT_THEME`，`index.ts:489`）：

```ts
const DEFAULT_THEME = {
  ...,
  layout: { safeMargin: 24, gridSize: 10, showGrid: true, showSafeArea: true }, // ← 48 改 24
  lineHeight: { mode: 'ratio', value: 1.5 },
  format: { currencySymbol: '$', currencyPosition: 'before', thousandsSep: true, decimals: 0, compact: 'none' },
  chart: { showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 4 },
  shadow: 'soft',
  background: { color: '#FFFFFF' },
};
```

**`STYLE_PRESETS`（`index.ts:509-586`）**：4 套预设各补齐新字段（随 density/radius 拉开档次），`safeMargin` 维持各预设现有 40/48/56/64（预设是风格起点，不强求 24）；行高统一 `ratio 1.5`、阴影随预设（商务=soft、科技=subtle、活力=strong、极简=none）等。点预设 → 整套填入；手改任一新字段 → `preset` 高亮置空（与现有行为一致）。

**`normalizeTheme` 扩展（`index.ts:614`）**：沿用 `parseGridNum` 风格为每个新可选字段补默认 + 容错钳制（`lineHeight.mode` 非法→ratio；`value` 非有限正数→默认；`format`/`chart` 子字段非法→逐字段补默认；`shadow` 非法→soft；`background.color` 缺失→白）。缺整个子对象→补 `DEFAULT_THEME` 对应项。不抛错。老项目（无新字段）静默升级。

### §2 格式化器（`packages/shared`，新增）

放 `packages/shared` 以便 mock 数据与渲染器共用（mock 在 `apps/web/src/api/`，渲染器在 `apps/web/src/editor/business/`）：

```ts
export function formatNumber(n: number, fmt: ThemeFormat): string;  // 纯数字
export function formatMoney(n: number, fmt: ThemeFormat): string;   // 带币种符号
```

- `compact:'auto'`：`|n|>=1e6`→`M`、`>=1e3`→`K`，**取 1 位小数**（覆盖 `decimals`）；否则按 `decimals` + `thousandsSep`（`Intl.NumberFormat('en-US', {...})`）。
- `currencyPosition:'before'`→`$1.2M`；`'after'`→`1.2M$`。
- 守卫：`NaN/undefined/null`→`''`；负数保留 `-`。

`ThemeFormat` = `Pick<ProjectTheme, 'format'>['format']`（归一化后非空）。

### §3 Token 映射（`apps/web/src/editor/theme.tsx`）

`themeToCssVars`（`:46-88`）增补：

- `--line-height`：`ratio` → `${value}`（裸倍数，如 `1.5`）；`fixed` → `calc(1em + ${value}px)`。
- `--shadow-card`：`none`→`none`；`subtle`→`0 1px 2px rgba(0,0,0,.05)`；`soft`→`0 2px 8px rgba(0,0,0,.08)`；`strong`→`0 8px 24px rgba(0,0,0,.12)`。
- `--page-bg`：`background.color`（gradient 存在时拼成 `linear-gradient(...)` 串）。

币种 / 数字格式**不走 CSS 变量**——渲染期由 `formatMoney`/`formatNumber` 应用。图表配置**不走 CSS 变量**——经 `ThemeContext`（已暴露完整 theme）下发给 recharts 组件，各图从 `useTheme()` 读 `theme.chart`。

### §4 消费者接线

- **用户「文本」组件**（`BasicComponents.tsx:31-47`）：内联样式加 `lineHeight: 'var(--line-height)'`（仅此一处接全局行高；业务模板不动）。
- **卡壳**（`business/shared.tsx` `Base`、`CreatorComponents.tsx` `CreatorChartShell` 等）：`boxShadow: 'var(--shadow-card)'`。
- **recharts 图表**（`CreatorComponents.tsx` 各 fan 图、`ReportComponents.tsx` kpi/timeline 等、`BasicComponents.tsx` bar/line/pie）：读 `theme.chart` → `CartesianGrid` 按 `showGrid`、轴按 `showAxis`、`Legend` 按 `legendPosition`、柱 `radius` 用 `barRadius`。集中在一个 `useChartStyle(theme.chart)` 小 hook 返回 recharts props，避免散落。
- **页面背景**：`Canvas`/`PageView` 当页无 `bgColor`/`bgGradient` 时回退 `theme.background`（页级覆盖全局）。

### §5 store（`apps/web/src/editor/store.ts`）

- `ThemePatch`（`:31-38`）扩 `lineHeight?`/`format?`/`chart?`/`background?`/`shadow?`。
- `setTheme`（`:366-385`）现有仅深合并 `color`/`font`/`layout`；扩展为对 `lineHeight`/`format`/`chart`/`background` 也深合并（部分编辑不清同级），`shadow`/`preset` 整体替换。抽一个 `isObject` 守卫做泛化深合并，避免再枚举字段名。
- `loadProject`（`:284-317`）已对 theme 走 `normalizeTheme`（`:292`），确认覆盖新字段；autosave/`save()`（`:327-362`）通道不变（`meta.theme` 随存）。
- 主题改动仍**不进 undo 历史**（快照只记 pages，`:42`），与现状一致。

### §6 设置 UI（`ReportSettingsOverlay.tsx`）

在现有「⑥ 布局」后新增分区（沿用浮层 `Chip` / 数字输入 / 开关控件风格，均经 `setTheme` 实时生效、无保存按钮、手改置空 `preset`）：

- **⑦ 行高**：模式切换（倍数 / 加法）+ 数字输入（ratio 0.8–2.5 @ 0.05；fixed 0–40 @ 1px）。
- **⑧ 币种与数字**：符号文本输入（默认 `$`）+ 前/后置开关；千分位开关；小数位 select(0/1/2)；K-M 缩写开关。
- **⑨ 图表样式**：坐标轴 / 网格线开关；图例位置 select(无/上/下/右)；柱圆角数字(0–16)。
- **⑩ 阴影**：chips(无 / 细微 / 柔和 / 强烈)。
- **⑪ 背景**：取色器 + 可选渐变（复用页面背景 gradient UI）。

「布局」分区 chips 保持 `[24,48,64,96]`，`24` 因成默认而被高亮。

### §7 持久化 / 服务端 Zod（关键，否则字段被存丢）

`apps/server/src/modules/projects/projects.schema.ts` 的 `projectThemeSchema`（`:34-64`）新增可选字段，镜像 §1（含 `safeMargin` 已有 `.min(0).max(500)`，不动；新增字段各加合理 min/max 或 enum）：

```ts
lineHeight: z.object({ mode: z.enum(['ratio','fixed']), value: z.number().min(0).max(100) }).optional(),
format: z.object({
  currencySymbol: z.string().max(8), currencyPosition: z.enum(['before','after']),
  thousandsSep: z.boolean(), decimals: z.union([z.literal(0),z.literal(1),z.literal(2)]),
  compact: z.enum(['none','auto']),
}).optional(),
chart: z.object({
  showAxis: z.boolean(), showGrid: z.boolean(),
  legendPosition: z.enum(['none','top','bottom','right']), barRadius: z.number().min(0).max(16),
}).optional(),
shadow: z.enum(['none','subtle','soft','strong']).optional(),
background: z.object({ color: z.string().max(32), gradient: z.any().optional() }).optional(),
```

`createProjectSchema`/`updateProjectSchema`（`:80-96`）引用同一 `projectThemeSchema`；`templates.schema.ts:2` 复用 → 模板路径自动覆盖。**不加会被 Zod 在保存时剥掉**（呼应"新持久化字段必须更新 server Zod schema"）。

### §8 一次性 `¥` → `$` 符号替换（折中方案的"替换"部分）

以下文件把烤死的 `¥` 替换为 `$`（样本/占位值，非用户数据）：

- `apps/web/src/editor/defaults.ts`（`:254` package-card、`:269-275` kpi-board、`:307` timeline-compare）
- `apps/web/src/editor/templates.ts`（`:346-348,391`）
- `apps/web/src/api/campaigns.ts`（`:23-88`）、`apps/web/src/projectsMeta.ts`（`:79`）
- `apps/web/src/editor/business/render.tsx`（`:659,725`）、`business/catalog.ts`（`:226`）
- `packages/shared/src/index.ts` 占位注释（`:955-956` `'¥120'`→`'$120'`）

mock 生成器 `creatorPerformance.ts:168` `money = n => \`¥${fmt(n)}\`` 改为 `formatMoney(n, theme.format)`（需把归一化后的 format 传入或就近读 store）。

**不动** `icons/catalog.ts:42` 的 `currency` 图标键（Phosphor `CurrencyDollar` 字形，本就是 `$`）与 `CampaignMetric.value`（`:115`）文档注释。

### §9 测试与验证

仓库前端测试基建现状：存在 `apps/web/tests/`（如 `registry.test.ts`），recharts 在 jsdom 中被 mock（断言外壳文本，不断言图内标签）。本次以 tsc + 手动回归为主，纯函数加单测：

- **单测（纯函数）**：
  - `formatNumber`/`formatMoney` 矩阵（前后置、compact、decimals、千分位、负数、NaN）。
  - `normalizeTheme`：无新字段的老 theme → 全默认；非法值 → 钳制。
  - `themeToCssVars`：ratio/fixed 两模式下的 `--line-height`、`--shadow-card`、`--page-bg`。
- **服务端**：`projectThemeSchema` 接受合法新字段、拒绝越界/非法 enum。
- **类型层**：全量 `tsc`，store/overlay/theme/渲染器类型对齐。
- **手动回归清单**：
  1. 切 4 预设 → 新维度随之变化、`preset` 高亮正确。
  2. 行高 ratio/fixed 切换 → 文本组件行距实时变；业务模板行距不变。
  3. 改币种符号/位置、千分位、小数位、K-M → mock 数据与新生成金额随之变。
  4. 图表样式：轴/网格/图例/柱圆角 → 各 recharts 图统一生效。
  5. 阴影档位 → 卡壳阴影变；背景色/渐变 → 无自有背景的页兜底显示，有自有背景的页不被覆盖。
  6. 老项目（无新字段）打开 → normalize 补默认、无报错。
  7. 保存刷新 → 新字段往返不丢；预览/分享/导出无残留辅助层（沿用前序 spec §8 重点）。
- **不新增 `ComponentType`** → 不破坏持久化联合与 registry 穷举测试（注意 `tests/registry.test.ts:6` 现已 stale 仅 26 项，与本特性无关，不在此修）。

## 实现顺序（粗，分阶段可独立 merge）

1. **schema 层**：`packages/shared`——`ProjectTheme` 新字段类型、`DEFAULT_THEME`（含 safeMargin 24）、`STYLE_PRESETS` 补字段、`normalizeTheme` 扩展、`formatNumber`/`formatMoney`。
2. **服务端**：`projectThemeSchema` 新字段 Zod 校验。
3. **token 层**：`theme.tsx`——`--line-height`/`--shadow-card`/`--page-bg`；`useChartStyle` hook。
4. **store**：`ThemePatch` + `setTheme` 泛化深合并；确认 `loadProject` normalize 覆盖。
5. **消费者**：TextComponent 接 `--line-height`；卡壳接 `--shadow-card`；recharts 图接 `useChartStyle`；页面背景兜底。
6. **格式器接入 + 符号替换**：`creatorPerformance.ts` 走 `formatMoney`；§8 文件 `¥`→`$`。
7. **设置 UI**：`ReportSettingsOverlay.tsx` 增 ⑦–⑪ 分区。
8. `tsc` 全量 + 单测 + 手动回归清单逐项。

## 风险

- **行高 `fixed` 模式 `calc(1em + Npx)` 兼容性**：现代浏览器支持；jsdom 测试断言样式字符串即可，不断言渲染高度。
- **图表统一样式改变现有外观**：给全部 recharts 图接入 `useChartStyle` 会统一此前各自写死的轴/网格/图例——属预期变化（决策已确认），回归时逐图目检；如某图刻意隐藏图例，允许组件级覆盖（hook 返回值可被局部 props 覆盖）。
- **`setTheme` 泛化深合并回归**：从枚举字段名改为 `isObject` 守卫泛化，需确认 `density`/`radius`/`preset`/`shadow` 等标量仍走替换、不被误当对象合并。
- **`¥`→`$` 漏替换**：替换面跨多文件，需全量 `grep '¥'` 复核（排除 icon key 与注释）；用户既有项目里已存的 `¥` 串不动（那是用户数据）。
- **Zod 漏改**：`projectThemeSchema` 不加新字段会导致保存丢字段——实现清单第 2 步不可跳过。
- **向后兼容**：老项目 theme 无新字段；`normalizeTheme` 必须容错补默认，字段缺失不抛错。
- **`background.gradient` 形状**：复用 Page 现有 gradient 结构；若 Page gradient 字段名/形状与本处不一致，需对齐（实现时核对 `shared/index.ts` Page 定义）。
