# 作品截图「组合版式」选择器 — 设计

- 日期：2026-07-14
- 状态：已批准（待实现）
- 范围：`work-screenshot` 组件（`apps/web/src/editor/components/WorksComponents.tsx`）

## 背景

作品截图墙 `WorkScreenshot` 已有 6 种视觉风格（`style: grid | mosaic | diagonal | skew | overlap | filmstrip`）。其中不对称的「组合」版式都集中在 `mosaic` 风格下，由 `MOSAIC_TEMPLATES`（按图片张数自动挑选**唯一**模板）驱动：

- 4 张图当前是「L 型」（左上大 + 右上 + 右下 + 左下宽条），**不是**经典的「1 大 3 小」。
- 用户无法按名称指定某个组合（如「1 大 3 小」「错落」），版式完全由张数自动决定。
- `variant` 字段虽在 registry 注册，但 UI 隐藏且渲染器忽略。

## 目标

为 `mosaic` 风格新增一个显式的「组合版式」选择器，提供更多命名组合（含「1 大 3 小」「错落」），并按当前图片数智能过滤可选项。其他 5 种风格保持不变。

## 方案

新增一个可选字段 `mosaicLayout`，仅在 `style === 'mosaic'` 时生效。不复用 `variant`（与 `ImageGroupComponent` 共享、且为按张数命名），也不编码进 `style`（会膨胀联合类型并混淆两个维度）。新字段是**加法式、正交、向后兼容**的（缺省 `'auto'` = 现行为）。

## 数据模型

`packages/shared/src/types/editor.ts`：

```ts
export type WorkScreenshotMosaicLayout =
  | 'auto' | 'hero-3' | 'hero-4' | 'hero-5' | 'staggered' | 'grid-3x3';

// WorkScreenshotData 新增：
mosaicLayout?: WorkScreenshotMosaicLayout; // 仅 style==='mosaic' 生效；缺省 'auto'
```

服务端无需改动 —— 组件数据以 `z.any()` 持久化（`apps/server/src/modules/projects/projects.schema.ts:53` `components: z.array(z.any())`）。

## 组合集

每个组合（除 `auto`/`staggered`）映射到一个 cell 模板，复用既有 `MosaicCell`/`MosaicTemplate` 结构，渲染仍走 grid-span 范式：

| id | label | 最少张数 | 版式 |
|---|---|---|---|
| `auto` | 自动 | 1 | 现有按张数的 `MOSAIC_TEMPLATES`（不变） |
| `hero-3` | 1大2小 | 3 | 左大(1×2) + 右侧 2 张竖排 |
| `hero-4` | 1大3小 ★ | 4 | 左大(1×3) + 右侧 3 张竖排 |
| `hero-5` | 1大4小 | 5 | 左大(1×2) + 右侧 2×2 小图 |
| `staggered` | 错落 ★ | 4 | 3 列网格，按列交替竖向偏移（新渲染分支，取 `min(count,6)`） |
| `grid-3x3` | 九宫格 | 9 | 均匀 3×3 |

### Cell 模板定义（gridCols × gridRows，cell = {col,row,colSpan,rowSpan}）

- `hero-3`：gridCols 2, gridRows 2 → `[{0,0,1,2},{1,0,1,1},{1,1,1,1}]`
- `hero-4`：gridCols 2, gridRows 3 → `[{0,0,1,3},{1,0,1,1},{1,1,1,1},{1,2,1,1}]`
- `hero-5`：gridCols 4, gridRows 2 → `[{0,0,2,2},{2,0,1,1},{3,0,1,1},{2,1,1,1},{3,1,1,1}]`（左大占半宽全高，右侧 2×2 小图）
- `grid-3x3`：gridCols 3, gridRows 3 → 9 个 `{c,r,1,1}`

### 渲染分支（`WorkScreenshot` 的 `mosaic` 分支内）

```
const layout = data.mosaicLayout ?? 'auto';
if (layout === 'staggered') return <错落渲染/>;
if (layout === 'auto')      { /* 现有按张数模板逻辑，不变 */ }
else                        { const tpl = MOSAIC_LAYOUTS[layout]; 按 tpl.cells 渲染 images.slice(0, cells.length) }
```

`staggered`：3 列 grid，每列按列序交替施加 `translateY` 偏移（如 0 / +10% / +5%），不旋转，`min(count,6)` 张。

## UX 规则

「组合版式」按钮组**仅在 `style === 'mosaic'` 时**显示，位于「视觉样式」下方。有效张数 = `displayCount ?? images.length`。

- 组合在「有效张数 ≥ 最少张数」时**可用**，否则**禁用**并提示 `需 N 张`。
- 选中后渲染取 `images.slice(0, cells)`；多出的图忽略（与 `displayCount` 语义一致），**绝不渲染空占位格**。
- `staggered` 在 ≥4 时启用，渲染 `min(count,6)`。

## 改动文件

1. `packages/shared/src/types/editor.ts` — 新增 `WorkScreenshotMosaicLayout` 类型 + `mosaicLayout?` 字段。
2. `apps/web/src/editor/components/WorksComponents.tsx` — `MOSAIC_LAYOUTS` 映射；`mosaic` 分支按 `mosaicLayout` 分流；新增 `staggered` 渲染。
3. `apps/web/src/editor/property-panel/custom-fields/WorkScreenshotFields.tsx` — 「组合版式」按钮组 + 按张数禁用。
4. `apps/web/src/editor/defaults.ts` — （可选）显式 `mosaicLayout: 'auto'`。
5. 测试：
   - `apps/web/tests/works.test.tsx`：`hero-4`(4 图) → `gridTemplateRows='repeat(3, 1fr)'` 且大格 rowSpan 3；`grid-3x3`(9 图) → 3×3；`staggered`(5 图) 冒烟；`hero-4`(6 图) → 仅渲染 4 张；`auto` 回归（保持 `repeat(2,1fr)`）。
   - `apps/web/tests/property-works.test.tsx`：点击组合按钮写入 `mosaicLayout`；张数不足时禁用。

无服务端改动。

## 向后兼容

既有项目（`style:'mosaic'`、无 `mosaicLayout`）→ `'auto'` → 渲染完全不变，含现有 4 图「L 型」。`works.test.tsx:67`（期望 `repeat(2,1fr)`）保持通过。

## 决策记录

- **`1大3小` 默认 vs 可选**：采用**可选**（`auto` 保持 L 型不破坏存量），用户显式挑选。如需把 4 图默认也改成 1大3小，仅改 `MOSAIC_TEMPLATES[3]` 一处。
- **字段选择**：新增 `mosaicLayout`，不复用 `variant`、不进 `style`（理由见「方案」）。
