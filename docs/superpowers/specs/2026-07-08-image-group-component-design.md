# 组图组件（image-group）设计

> 日期：2026-07-08
> 范围：在编辑器新增一个通用「组图」组件，按图片数量提供预设版式（2/3/4/5/6/7/9/12），图片数量自由、版式自适应，可手动锁定版式。

## 1. 背景与目标

参考图给出三种典型「数量即版式」的组图：

- 3 张：上 2 小 + 下 1 宽幅（featured）
- 5 张：非对称马赛克（大图 + 宽幅 + 小图）
- 7 张：上 2（高）/ 中 3 / 下 2

现有 `'work-screenshot'`（作品截图墙）是「任意张数 + grid/masonry/hero/skew 样式版式」，与「数量即版式」是两套不同心智模型。故**新建独立组件**，不改动 `work-screenshot`。

目标：一个通用组图组件，放「基础」分组，纯图无 caption，图片数量自由、版式按数量自适应，高级用户可手动锁定某一版式。

## 2. 关键决策（已与用户确认）

1. **新建 `image-group`**，不扩展 `work-screenshot`。
2. **首版版式张数**：2、3、4、5、6、7、9、12。
3. **无 caption**：纯图片网格。
4. **图片数量自由，版式自适应**：`variant` 缺省 `'auto'`，按 `images.length` 映射到最接近张数的版式；可在面板手动锁定。

## 3. 数据模型（`packages/shared/src/index.ts`）

```ts
export type ImageGroupLayoutId =
  | 'auto' | 'duo' | 'trio' | 'quad' | 'mosaic-5' | 'hex' | 'septet' | 'nona' | 'duoza';

export interface ImageGroupItem {
  src: string;
}

export interface ImageGroupData {
  /** 版式；复用 data.variant 通道以兼容通用 VariantSelector。缺省 'auto'。 */
  variant?: ImageGroupLayoutId;
  images: ImageGroupItem[];
  /** 单元格间距（px）；可选，缺省 8。 */
  gap?: number;
}
```

- `ComponentType` 联合新增 `'image-group'`（稳定 kebab id，与 `brand-wall`/`work-screenshot` 一致）。
- `ComponentData` 联合新增 `ImageGroupData`。
- **约束**：type id 进 `Project.pages` JSON，只加不删、不重命名（[[component-type-is-persisted-schema]]）。

## 4. 版式目录

每个版式 = 一个 CSS grid 单元格模板，支持跨行跨列。采用通用单元格模型：

```ts
interface LayoutCell { c: number; r: number; cs?: number; rs?: number } // 列/行起点（1 基），可选跨度
interface LayoutDef {
  id: ImageGroupLayoutId;
  count: number;        // 自然张数
  cols: number;         // grid 列数
  rows: number;         // grid 行数
  rowHeights?: number[];// 各行相对高度（缺省等高）
  cells: LayoutCell[];  // 依次对应 images[0..]
}
```

| id | 张数 | 结构 |
|---|---|---|
| `duo` | 2 | 两张并排 |
| `trio` | 3 | 上 2 小 + 下 1 跨列宽幅 |
| `quad` | 4 | 2×2 |
| `mosaic-5` | 5 | 大图（2×2）+ 宽幅 + 小图，非对称 |
| `hex` | 6 | 3×2 |
| `septet` | 7 | 上 2（较高，跨 3 列各）/ 中 3（跨 2 列各）/ 下 2 |
| `nona` | 9 | 3×3 |
| `duoza` | 12 | 3×4 |

> 具体单元格跨度（`mosaic-5` 的大图位 / 宽幅位、`septet` 的行高比）在实现时定稿，遵循「满格、等间距、贴合参考图」。

## 5. 自适应映射

`resolveLayout(variant, count)`：

- `variant !== 'auto'` → 直接用该版式（与 count 是否相等无关）。
- `variant === 'auto'` → 在 `duo..duoza` 中选 `|def.count - count|` 最小者；平手取 count 较大者；`count > 12` 落到 `duoza`。
  - 例：3→trio、7→septet、8→nona、10→nona、11→duoza、13+→duoza。

**渲染规则**：

- 版式决定槽位数 S；`images[i]`（i < S）按序填入。
- 少于槽位 → 空槽渲染浅灰占位「图片」（与 `ImageComponent` 空态一致）。
- 多于槽位 → 忽略溢出（版式锁定时）。
- `images` 全空或不存在 → 整块占位「组图」。
- 图片 `object-cover` 铺满单元格。

## 6. 接线（6 处，沿用现有模式）

| 文件 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | `ComponentType` 加 `'image-group'`；新增 `ImageGroupLayoutId`/`ImageGroupItem`/`ImageGroupData`；加入 `ComponentData` 联合 |
| `apps/web/src/editor/defaults.ts` | `DEFAULT_SIZES['image-group'] = { w: 600, h: 420 }`；`getDefaultData('image-group')` → `{ variant: 'auto', images: [{src:''}×3] }` |
| `apps/web/src/editor/components/ImageGroupComponent.tsx`（新） | 版式目录 `LAYOUTS` + `resolveLayout()` + grid 渲染 + 空态占位 |
| `apps/web/src/editor/registry.tsx` | `REGISTRY['image-group']`：`Component`、9 个 `variants`（auto + 8 版式，复用通用 VariantSelector 写 `data.variant`）、`propertySchema: []`（图片走自定义字段） |
| `apps/web/src/editor/ComponentPanel.tsx` | 「基础」分组加 `{ type: 'image-group', label: '组图', icon: '◫' }` |
| `apps/web/src/editor/PropertyPanel.tsx` | `LABELS['image-group'] = '组图'`；新增 `ImageGroupFields`（每槽 `ImageInput` + 增删，自由数量），挂到面板 |

**属性面板交互**：

- 上方：通用版式 chip（自适应 + 8 版式），复用 `VariantSelector`。
- 下方：`ImageGroupFields` —— 每张图一个 `ImageInput`（与 `WorkScreenshotFields` 同款上传/URL/裁剪），底部「+ 添加图片」、每张 ✕ 删除。数量自由。
- `variant === 'auto'` 时，实际版式随 `images.length` 变化（chip 高亮「自适应」）。

## 7. 默认值

- 尺寸：`600 × 420`（与 `work-screenshot` 同档）。
- 默认数据：`{ variant: 'auto', images: [{src:''}, {src:''}, {src:''}] }` → 默认渲染 trio。
- 间距：`gap = 8`。
- 分组：「基础」。

## 8. 测试（vitest + jsdom）

- `ImageGroupComponent` 渲染用例（遵循 [[web-chart-test-convention]]：断言 shell 文本，本组件无图表，不涉及 recharts mock）：
  - 空数据 → 渲染占位「组图」。
  - `variant:'auto'` + N 张图（含空 src）→ 渲染对应版式的占位「图片」cell，数量 = 该版式槽位数。
  - `variant:'trio'` 锁定 → 无论 images 长度，渲染 trio 槽位数。
- 注册/默认：`getDefaultData('image-group')` 含 `variant:'auto'` 与 3 个空 images。

## 9. 非目标（YAGNI，本轮不做）

caption 说明文字、gap/圆角可配置、object-fit 切换、单元格裁切比例、批量上传、拖拽排序。后续按需迭代。
