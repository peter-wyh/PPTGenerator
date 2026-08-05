# 作品截图 · 新增版式预设 + 可视化版式选择器

- **日期**: 2026-08-04
- **状态**: 已批准（设计确认），待实现
- **组件**: `work-screenshot`（作品截图）
- **参考**: 用户提供的「版式参考表」截图（漫画/杂志分镜式多图网格）

## 目标

1. 给「作品截图」组件**新增 8 个非对称版式预设**，覆盖参考图里的杂志/分镜式切分（等分网格已由现有 `grid` 风格 + 显示数量支持，不重复造）。
2. 把属性面板里「组合版式」那组**文字按钮升级成缩略图选择器**，每个版式用迷你 CSS Grid 预览，所见即所得。
3. **只做加法**：扩展现有 `mosaic` 引擎，不新建平行系统；不删除/不改名任何已持久化的 id（旧项目数据零影响）。

## 非目标

- 不改 6 种 `style`（grid/skew/overlap/filmstrip/diagonal/mosaic）的语义。
- 不把版式选择器提为「跨风格顶层」（避免和 `style` 语义打架；维持「mosaic 风格下选组合版式」的现状）。
- 不动 `image-group` 组件。
- 不做服务端持久化字段新增（见「服务端 schema」）。

## 数据模型

`WorkScreenshotMosaicLayout`（`packages/shared/src/types/editor.ts`）union 新增 8 个值：

```
'hero-top' | 'hero-right' | 'pz-top' | 'pz-bottom' | 'hero-2up' | 'magazine' | 'strip-h' | 'split-half'
```

每个新值在 `WorksComponents.tsx` 的 `MOSAIC_LAYOUTS` 加一个 `MosaicTemplate`（`{ gridCols, gridRows, cells: {col,row,colSpan,rowSpan}[] }`，0-indexed），并在 `MOSAIC_LAYOUT_OPTIONS` 加一项（含 `minImages` 门控）。

### 8 个新模板的 cell 定义

| id | 张数 | gridCols×gridRows | cells (col,row,colSpan,rowSpan) |
|---|---|---|---|
| `hero-top` | 4 | 3×3 | `(0,0,3,2)` 大上 + `(0,2,1,1)(1,2,1,1)(2,2,1,1)` |
| `hero-right` | 4 | 2×3 | `(1,0,1,3)` 大右 + `(0,0,1,1)(0,1,1,1)(0,2,1,1)` |
| `pz-top` | 3 | 2×2 | `(0,0,2,1)` 宽上 + `(0,1,1,1)(1,1,1,1)` |
| `pz-bottom` | 3 | 2×2 | `(0,1,2,1)` 宽下 + `(0,0,1,1)(1,0,1,1)` |
| `hero-2up` | 5 | 2×3 | `(0,0,2,1)` 大上 + `(0,1,1,1)(1,1,1,1)(0,2,1,1)(1,2,1,1)` |
| `magazine` | 5 | 6×6 | `(0,0,4,4)` + `(4,0,2,2)(4,2,2,2)` + `(0,4,2,2)(2,4,4,2)` |
| `strip-h` | 3 | 1×3 | `(0,0,1,1)(0,1,1,1)(0,2,1,1)` |
| `split-half` | 2 | 2×1 | `(0,0,1,1)(1,0,1,1)` |

> 渲染走现有「命名组合」分支（`WorksComponents.tsx` ~L418-450）：取 `tpl.cells.length` 张图，按 cell 的 `gridColumn/gridRow` 摆放，多出忽略、绝不留空位。无需改渲染主流程。

## 可视化版式选择器

`WorkScreenshotFields.tsx` 的「组合版式」段（当前是文字 button group）改为**缩略图网格**：

- 新增 `LayoutThumbnail({ template })` 子组件：按 `MosaicTemplate` 渲染迷你 CSS Grid 线框（带序号），复用同一份模板数据（单一事实源）。
- `auto` / `staggered` 无单一模板：`auto` 用 `MOSAIC_TEMPLATES[3]`（4 张代表图）作预览；`staggered` 用 3 列偏移示意。
- 保留 `minImages` 禁用逻辑（张数不足的版式灰显）。
- 选中态高亮整张缩略图卡片。

## 受影响文件

| 文件 | 改动 | 干净/脏 |
|---|---|---|
| `packages/shared/src/types/editor.ts` | union +8 值 | **脏**（已有未提交改动）→ 仅留我的 hunk 未提交 |
| `apps/web/src/editor/components/WorksComponents.tsx` | `MOSAIC_LAYOUTS` +8 模板、`MOSAIC_LAYOUT_OPTIONS` +8 项、导出 `LayoutThumbnail` | 干净 |
| `apps/web/src/editor/property-panel/custom-fields/WorkScreenshotFields.tsx` | 「组合版式」→ 缩略图网格 | 干净 |
| 测试（新增/扩展） | 8 个新模板的渲染测试 | — |

## 服务端 schema

grep 确认 `apps/server/src` **不引用** `mosaicLayout`/`WorkScreenshotMosaicLayout`（ComponentData 子字段不在服务端校验范围内）。实现时复核一次；若确实无校验，**无需服务端改动**。

## 向后兼容

- 纯加法：旧项目数据（无 `mosaicLayout` 或老值如 `hero-3`）照常工作。
- 不删除/不改名任何已有 id（遵守「type id 持久化」约束）。

## 测试

沿用现有 `WorksComponents` 测试约定（recharts 已 mock；断言外壳文本/结构）。新增用例：对每个新 `mosaicLayout`，喂入 N 张占位图，断言渲染出 `cells.length` 个图位、无空位、grid 列数正确。

## 验证

- `apps/web` 路径下跑类型检查 + vitest（用 apps/web 绝对路径 binary，不跑根 `pnpm test`）。
- 手动：在编辑器里给 `work-screenshot` 选 `mosaic` 风格，确认 8 个新缩略图出现、张数门控生效、切换版式实时重排。
