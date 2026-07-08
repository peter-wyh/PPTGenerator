# 全局样式设置：布局尺寸（安全距离 + 网格）

**日期**：2026-07-08
**范围**：`packages/shared`（类型/常量/normalize）、`apps/server`（Zod）、`apps/web`（编辑器 store / Canvas / 键盘 / 设置浮层 / theme token）
**状态**：设计已确认，待实现

## 背景

现有"报告设置"浮层（`apps/web/src/editor/components/ReportSettingsOverlay.tsx`）已落地一套完整的视觉主题 `ProjectTheme`（`packages/shared/src/index.ts:192`）：配色 / 字体 / 密度 / 圆角 + 4 套 `STYLE_PRESETS` 预设，经 `themeToCssVars`（`apps/web/src/editor/theme.tsx:46`）下发 CSS 变量 + `ThemeContext`。这是"提供默认几套风格"的地基。

但**布局尺寸是空的**：

1. **没有"安全距离"概念**——`Page`/`EditorComponent` 均为满版自由画布、绝对 `x/y` 定位（`PageView.tsx:46-53`、`Canvas.tsx:268-308`），全文搜 `safe|safeArea|safeMargin|pagePadding` 零命中。无内缩参考线、无吸附辅助。
2. **"网格大小"散落且不一致**——4 处独立硬编码：移动吸附 `MOVE_SNAP=10`（`defaults.ts:40`、`store.ts:510-511`）、拖拽实时吸附 `SNAP=10`（`Canvas.tsx:15,52-53`）、键盘 `Shift+方向键=10`（`useEditorKeyboard.ts:91`）、**可见网格叠加 20px**（`Canvas.tsx:276-284`）。可见网格(20) 与吸附(10) 对不上，且 **缩放(`resize()`)完全不走吸附**。

## 目标

1. 新增**布局尺寸**两个旋钮：**安全距离**（四面统一内缩的安全区）+ **网格大小**（单一值统一驱动可见网格与全部吸附）。
2. 安全区以**参考线 + 磁吸**形式工作：靠近时吸附到安全线，仍允许手动越界做满版出血。
3. 布局并入 `ProjectTheme`，**4 套预设各带布局值**，点预设即填入完整全局风格（配色/字体/密度/圆角/安全距离/网格）。
4. 顺手修复：统一散落常量、消除可见网格 20≠吸附 10 的不一致、把缩放纳入网格吸附。

## 非目标

- 四边独立安全距离（上/右/下/左各调）、12 栏栅格（列宽/槽距）、文字基线网格——属"丰富版"，延后。
- 安全区作为**硬约束**（禁止越界）——本次只做磁吸，不禁止出血。
- vision / 参考图解析——仍是占位按钮。
- 改动 `ComponentType`、改动 `Page` 字段集合——布局只挂在 theme 上，不动组件类型与页面 schema。
- 引入前端测试框架——沿用现有 tsc + 手动回归。

## 设计

### §1 数据模型（`packages/shared/src/index.ts`）

`ProjectTheme` 新增可选 `layout` 子对象：

```ts
interface ProjectTheme {
  color: {...}; font: {...};
  density: ThemeDensity; radius: ThemeRadius; preset?: string;
  layout?: {
    safeMargin: number;     // 四面统一内缩 px；0=不画安全区
    gridSize: number;       // 网格大小 px；驱动可见网格 + 移动/拖拽/键盘/缩放吸附
    showGrid?: boolean;     // 显示可见网格叠加；缺省 true
    showSafeArea?: boolean; // 显示安全区虚线；缺省 true
  };
}
```

- **放 theme 上的原因**：布局要与预设绑定（决策③），theme 是 `StylePreset.theme` 的唯一载体。
- **可选 + 统一值的原因**：老项目无 `layout` → `normalizeTheme` 补默认；四边独立/12 栏属"丰富版"非目标。

默认值：

```ts
const DEFAULT_THEME = {
  ...,
  layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
};
```

（48px ≈ 1280 宽的 3.75%；`gridSize: 10` 保持现状吸附手感。画布默认 1280×720，另有 1920×1080、竖版 1080×1920。）

**`normalizeTheme` 扩展**（`packages/shared/src/index.ts:394`）：在现有容错逻辑基础上，缺 `layout` 时整体补 `DEFAULT_THEME.layout`；`layout` 部分存在时按字段补齐（`safeMargin`/`gridSize` 非有限正数→默认，`showGrid`/`showSafeArea` 非布尔→默认）。不抛错。

### §2 预设（`STYLE_PRESETS`，每套加 `layout`）

随 density 拉开档次，作为起点（用户可再调）：

| 预设 | density | safeMargin | gridSize |
|---|---|---|---|
| 商务沉稳 business-sober | standard | 48 | 10 |
| 科技简约 tech-minimal | compact | 40 | 8 |
| 活力潮流 vibrant-trendy | spacious | 64 | 12 |
| 极简素雅 minimal-elegant | standard | 56 | 10 |

`showGrid`/`showSafeArea` 均默认 `true`。点预设 → 整套（含布局）填入；手改任一布局字段 → `preset` 高亮置空（与现有配色/字体手改行为一致）。

### §3 常量统一（消除散落 + 20≠10 不一致）

运行时唯一来源 = `theme.layout.gridSize`：

- `apps/web/src/editor/defaults.ts`：`MOVE_SNAP=10` 退役为兜底常量 `DEFAULT_GRID_SIZE=10`（仅 theme 不可得时回退，如未加载项目的新建态）。
- `apps/web/src/editor/Canvas.tsx`：删除本地 `const SNAP = 10`（line 15），实时拖拽从 theme 读 `gridSize`；可见网格 `backgroundSize` 由写死 `'20px 20px'` 改为 `${gridSize}px`（顺修 20≠10）。
- `apps/web/src/editor/useEditorKeyboard.ts`：`Shift+方向键` 步长 = `gridSize`；普通方向键保持 1px 微调。
- `apps/web/src/editor/store.ts` `resize()`（line 517-537）：新增按 `gridSize` 取整（移动边与 w/h 均对齐网格）——目前完全不走吸附。

### §4 行为：安全区参考线 + 磁吸（决策①）

**参考线渲染**（仅编辑画布 `Canvas.tsx`，与现有网格 overlay 同层）：

- `showSafeArea` 为真时，渲染 `safeMargin` 四面内缩的虚线矩形（`pointer-events-none`，低对比度颜色，如 `var(--color-neutral-text)` 低 alpha）。
- `safeMargin === 0` 时不渲染。
- `PageView.tsx`（预览/分享）、`PreviewOverlay`、**导出（puppeteer）路径一律不渲染**——作者辅助，不进成品。

**磁吸**（`store.move()` / 拖拽 / `resize()`，在网格吸附之后）：

- 常量 `SAFE_SNAP_THRESHOLD = 6`（px，做成常量便于后续调手感）。
- 若组件某条边（左/右/上/下）落在安全区对应边线 ±阈值 内，把该边吸到安全线。
- **可出血**：磁吸只在"靠近"时把边拉到线上；继续拖仍可越过安全线做满版出血背景。不做硬约束。
- 实现集中在一个 `snapToSafeArea(edge, value, safeArea, threshold)` 纯函数，便于复用与回归。

### §5 Token 映射（`apps/web/src/editor/theme.tsx`）

`themeToCssVars` 增补两个变量（供需要引用的组件/样式用，零成本）：

- `--grid-size: ${gridSize}px`
- `--safe-margin: ${safeMargin}px`

沿用现有 CSS 变量 + `ThemeContext` 双通道模式，不新增 context（布局值都是静态标量，CSS 变量足够）。

### §6 设置 UI（`ReportSettingsOverlay.tsx`）

在「⑤ 圆角」与「⑥ 解析参考图」之间新增 **「布局」** 分区：

- **安全距离**：数字输入（px）+ 快选 chips（24 / 48 / 64 / 96）
- **网格大小**：数字输入（px）+ chips（8 / 10 / 12 / 20）
- 两个开关：**显示网格** / **显示安全区**

数据流：经扩展的 `setTheme({ layout: {...} })` 实时生效（无保存按钮，与现有行为一致）；手改任一字段置空 `preset` 高亮。复用浮层现有 `Chip` / 数字输入控件风格。

**命名**：浮层头与顶栏按钮「报告设置」→ 改名 **「全局样式设置」**（贴合需求措辞）；`EditorTopbar.tsx` 同步改按钮文案与 `title`（`EditorTopbar.tsx:89-95`）。

### §7 持久化 / 服务端 Zod（关键，否则字段被存丢）

`apps/server/src/modules/projects/projects.schema.ts` 的 `projectThemeSchema`（line 34-56）新增可选 `layout`：

```ts
layout: z.object({
  safeMargin: z.number().min(0).max(500),
  gridSize: z.number().min(1).max(100),
  showGrid: z.boolean().optional(),
  showSafeArea: z.boolean().optional(),
}).optional()
```

**不加就会被 Zod 在保存时剥掉**（呼应"新持久化字段必须更新 server Zod schema"）。`createProjectSchema`/`updateProjectSchema` 引用同一 `projectThemeSchema`，模板路径复用，自动覆盖。

`autosave`/`meta` 通道不变（`meta.theme` 已随 autosave 持久化）。

### §8 测试与验证（沿用现有：tsc + 手动回归）

仓库无前端测试基建（见 `2026-07-04-report-style-design.md` §5），本次以类型检查 + 手动目检为主：

- **类型层**：`ProjectTheme.layout` 变更后全量 `tsc`，store / overlay / Canvas / 键盘 / theme 类型对齐。
- **回归清单（手动）**：
  1. 切 4 个预设 → 安全区参考线与可见网格随之变化、`preset` 高亮正确。
  2. 拖组件靠近安全边 → 吸到安全线；继续拖越过 → 出血不受阻。
  3. 移动 / 缩放 / Shift+方向键 → 均落在 `gridSize`。
  4. 老项目（无 `layout`）打开 → `normalizeTheme` 补默认、无报错、渲染正常。
  5. **预览 / 分享 / 导出 → 无参考线 / 网格残留**（重点验证 puppeteer 导出路径）。
  6. 保存后刷新 → `layout` 往返不丢。
  7. `safeMargin=0` → 不画安全区；关闭两个开关 → overlay 消失。
- **可选单测**：若顺手，在 `apps/web/tests/editor.m3.test.tsx` 加 `normalizeTheme` 对 `layout` 缺省/部分缺省的断言。

## 实现顺序（粗）

1. `packages/shared`：`ProjectTheme.layout` 类型、`DEFAULT_THEME.layout`、`normalizeTheme` 扩展、4 套 `STYLE_PRESETS` 补 `layout`。
2. `apps/server`：`projectThemeSchema` 增 `layout` 校验。
3. `apps/web/theme.tsx`：`--grid-size` / `--safe-margin` 变量。
4. `apps/web/store.ts`：`ThemePatch.layout`；`gridSize` 接入 `move()`/`resize()`；`snapToSafeArea` 纯函数 + 磁吸；`loadProject` 走 `normalizeTheme`（已有，确认覆盖 layout）。
5. `apps/web/Canvas.tsx`：网格 overlay 用 `gridSize`；渲染安全区虚线；删本地 `SNAP`，拖拽吸附读 theme。
6. `apps/web/defaults.ts` + `useEditorKeyboard.ts`：`gridSize` 用于键盘微调；`MOVE_SNAP` → `DEFAULT_GRID_SIZE`。
7. `apps/web/ReportSettingsOverlay.tsx`：新增「布局」分区；`EditorTopbar.tsx` 改名「全局样式设置」。
8. 验证导出路径不含 overlay（puppeteer 渲染走 `PageView`，确认无安全线/网格）。
9. `tsc` 全量 + 手动回归清单逐项。

## 风险

- **磁吸手感**：阈值 6px 可能偏粘或偏松；做成常量，回归后按手感微调。
- **可见网格过密**：`gridSize=10` 时网格较密；overlay 用低对比度样式弱化，必要时默认 `showGrid` 仍 true 但样式更淡。
- **缩放新增吸附改变手感**：现有缩放是自由像素，本次改为对齐网格——属预期变化（决策已确认），回归时确认不卡顿。
- **导出残留 overlay**：若 puppeteer 导出复用带 overlay 的画布而非 `PageView`，会把参考线/网格导进成品；实现时必须确认导出走不含 overlay 的渲染路径，否则加显式隐藏。
- **向后兼容**：老项目 theme 无 `layout`；`normalizeTheme` 必须容错补默认，字段缺失不抛错。
- **Zod 漏改**：`projectThemeSchema` 不加 `layout` 会导致保存丢字段——实现清单第 2 步不可跳过。
