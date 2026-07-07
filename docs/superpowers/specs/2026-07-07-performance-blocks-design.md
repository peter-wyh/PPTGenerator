# 业绩·商品 组新增组件：作品截图 / 作品数据 / 评论词云

- 日期：2026-07-07
- 范围：`apps/web` 编辑器 + `packages/shared`
- 状态：设计已确认，待实现

## 1. 目标

在组件库 **业绩·商品** 分组中新增三个「业绩展示」类业务组件，用于在报告 PPT 中呈现达人/作品的证据素材：

1. **作品截图** —— 多图作品截图墙，内置 4 种组图版式。
2. **作品数据** —— 单个作品的多维指标大数字卡。
3. **评论词云** —— 带情感色的评论关键词云。

「粉丝情况」不在本次范围 —— 复用达人组已有的 性别占比 / 城市分布 / 年龄段 / 兴趣标签 四个组件。

## 2. 非目标（明确不做）

- 评论词云的原始文本自动分词（需分词库，后续迭代）。
- 作品截图 / 作品数据 / 评论词云 的 CSV/Excel 导入（基础设施已存在 `parseFile` / `ImportDataModal`，后续低成本接入）。
- `ComponentRenderer` 对未知 `type` 的兜底硬化（独立项，本次不捆绑）。

## 3. 现有约定（实现须严格遵循）

- 每个组件 = 一个 `ComponentType` 联合成员 + 一个 `XxxData` 类型（`@mediakit/shared`）+ 一个 `REGISTRY` 条目（`Component`/`defaultSize`/`defaultData`/`propertySchema`/可选 `variants`）+ `ComponentPanel` 分组项 + `PropertyPanel` 的 `LABELS`。
- **`type` 用稳定 kebab-case 英文**；`label` 用中文显示文案。`type` 是持久化字符串，改名会破坏存量数据（见 2026-07-07 的一次事故），不可随意本地化。
- 样式版式走 `data.variant`；`BlockDef.variants: VariantOption[]` 声明后属性面板自动渲染 chip 选择器。
- `propertySchema` 字段种类：`text` / `textarea` / `number` / `color` / `select` / `image-url` / `list` / `table` / `icon`。其中 `list` **固定**编辑 `{label, value, color}[]`，无法承载任意形状。
- 富数据编辑的既有模式：按 `comp.type` 特判的自定义区块（参考 `CreatorStatsFields`、`KpiRowStyleField`、`BusinessFields`），渲染在通用字段之上。
- 图表用 recharts（jsdom 测试中整体 mock，测试只断言 DOM 文本，见 [[web-chart-test-convention]]）。本需求中仅词云/截图/指标卡为纯 DOM 渲染，不依赖 recharts。
- 空数据占位约定：`EmptyChart` / 封面占位「作品封面」式样。

## 4. 组件契约（数据形态）

新增于 `packages/shared/src/index.ts`：

```ts
// ComponentType 联合新增三个成员
| 'work-screenshot' | 'work-metrics' | 'comment-wordcloud'

// 作品截图
interface WorkScreenshotItem {
  src: string;
  caption?: string;
}
interface WorkScreenshotData {
  variant: 'grid' | 'masonry' | 'hero' | 'skew';
  title?: string;
  images: WorkScreenshotItem[];
}

// 作品数据（单作品多维指标）
interface WorkMetricItem {
  label: string;
  value: string;   // 大数字，允许带单位/万/亿等文案
  color?: string;
}
interface WorkMetricsData {
  title?: string;
  subtitle?: string;
  cover?: string;     // 可选作品封面
  workName?: string;  // 可选作品标题
  metrics: WorkMetricItem[];
}

// 评论词云
type Sentiment = 'pos' | 'neg' | 'neutral';
interface CommentWordItem {
  text: string;
  weight: number;     // 数值越大字号越大
  sentiment: Sentiment;
}
interface CommentWordcloudData {
  title?: string;
  subtitle?: string;
  words: CommentWordItem[];
}
```

> 这三个 Data 类型加入既有的 `ComponentData` 联合（与 `CreatorFanGenderData` 等并列）。

## 5. 渲染（新文件 `apps/web/src/editor/components/WorksComponents.tsx`）

风格对齐 `CreatorComponents.tsx` / `ReportComponents.tsx`：圆角卡片 + `border-border-default` + `bg-surface-primary`，数值用 `font-data`，标题用 `font-semibold`。

### 5.1 作品截图 `WorkScreenshot`

- 共享 `Screenshot({src, alt, cls})`：有 `src` 渲染 `<img object-cover>`；无 `src` 渲染占位「作品截图」。
- `variant` 分支：
  - `grid`（默认）：CSS grid 等分方格（如 `grid-cols-3`），正方形裁切。
  - `masonry`：CSS `columns` 瀑布流，图按原比例排布。
  - `hero`：一张大主图 + 下方一排缩略图（主图取 `images[0]`，缩略图取其余）。
  - `skew`：卡片网格，每张 `rotate(±3deg)` 交替 + 阴影，polaroid 感。
- 可选 `title` 顶部标题。空 `images` → 占位提示。

### 5.2 作品数据 `WorkMetrics`

- 可选头部：`cover`（小缩略图）+ `workName` + `title`/`subtitle`。
- 主体：`metrics` 响应式网格（`grid-cols-2`/`grid-cols-3`），每格为大数字卡 —— `label`（小号次色）+ `value`（大号 `font-data`，颜色取 `metric.color`，缺省用 `text-foreground-primary`）。
- `metrics` 为空 → 占位提示。

### 5.3 评论词云 `CommentWordcloud`

- 外壳复用 `CreatorChartShell` 同款（标题 + 可选副标题 + 图区）—— 该 shell 目前在 `CreatorComponents.tsx` 内部；本组件在 `WorksComponents.tsx` 内复制一份等价 shell（避免跨文件依赖私有组件），保持视觉一致。
- 词云渲染 = **弹性流（Option A）**：
  - 容器 `flex flex-wrap justify-center items-center gap-x-3 gap-y-1`，居中换行。
  - 每词 `<span>`，`font-size` 由 `weight` 线性映射并 clamp 到 12–40px（映射基于当前词集的 min/max weight，单点时取中值）。
  - 颜色按 `sentiment`：`pos`=`#22C55E`、`neg`=`#EF4444`、`neutral`=`#9CA3AF`。
  - `opacity` 随 weight 略增以增强层次。
  - `words` 为空 → `EmptyChart`「暂无数据」。
- 零依赖、确定性、jsdom 可测。

## 6. 编辑（`apps/web/src/editor/PropertyPanel.tsx`）

- **作品数据**：`metrics` 的 `value` 是展示字符串（如 "1.2万"/"95%"），而通用 `kind: 'list'` 强制数值输入，不匹配 —— 故新增自定义区块 `WorkMetricsFields`（按 `comp.type === 'work-metrics'` 特判）：每条 `metrics` 项一行 —— label 文本 + value 文本（非数值）+ color 色块 + 删除；底部「+ 添加」。`title`/`subtitle`/`workName`/`cover` 走 `propertySchema`（`text`/`image-url`）。这与 `creator-stats-strip`（同为字符串指标）用自定义区块的先例一致。
- **作品截图**：新增 `WorkScreenshotFields`（按 `comp.type === 'work-screenshot'` 特判）：每条 `images` 项一行 —— `ImageInput`（复用，含上传+裁剪）+ caption 文本框 + 删除；底部「+ 添加」。
- **评论词云**：新增 `CommentWordcloudFields`（按 `comp.type === 'comment-wordcloud'` 特判）：每条 `words` 项一行 —— text 文本 + weight 数字 + sentiment `<select>`（正面/负面/中性）+ 删除；底部「+ 添加」。
- 三者的 `title`/`subtitle` 经 `propertySchema` 的 `text` 字段；版式 chip 由 `variants` 自动渲染。
- `LABELS` 增加三项：`'work-screenshot': '作品截图'`、`'work-metrics': '作品数据'`、`'comment-wordcloud': '评论词云'`。

## 7. 注册清单（6 个改动点）

1. `packages/shared/src/index.ts` —— 3 个联合成员 + 3 个 Data 接口 + `Sentiment` + 并入 `ComponentData` 联合。
2. `apps/web/src/editor/defaults.ts` —— `DEFAULT_SIZES` 三项（建议 `work-screenshot {w:600,h:420}`、`work-metrics {w:560,h:320}`、`comment-wordcloud {w:560,h:360}`）+ `getDefaultData` 三分支（含合理示例数据：截图 3 张占位、指标 播放/点赞/评论/转发/完播率、词云 ~8 词带混合情感）。
3. `apps/web/src/editor/components/WorksComponents.tsx` —— 新文件，导出 `WorkScreenshot` / `WorkMetrics` / `CommentWordcloud`。
4. `apps/web/src/editor/registry.tsx` —— import 三个组件 + 三个 `REGISTRY` 条目：
   - `work-screenshot`：`variants: [grid/masonry/hero/skew]`，`propertySchema: [title(text)]`。
   - `work-metrics`：`propertySchema: [title(text), subtitle(text), workName(text), cover(image-url)]`（`metrics` 由自定义区块 `WorkMetricsFields` 编辑）。
   - `comment-wordcloud`：`propertySchema: [title(text), subtitle(text)]`。
5. `apps/web/src/editor/ComponentPanel.tsx` —— `业绩·商品` 分组 `items` 末尾追加三项（type/label/icon）。
6. `apps/web/src/editor/PropertyPanel.tsx` —— `LABELS` 三项 + 渲染区按 `comp.type` 挂载 `WorkScreenshotFields` / `WorkMetricsFields` / `CommentWordcloudFields`。

## 8. 测试

- `apps/web/tests/registry.test.ts` —— `TYPES` 数组追加三个 type id；既有的「每个 type 都有 REGISTRY 条目 / defaultSize / defaultData」扫描自动覆盖。
- 新增 `apps/web/tests/works.test.tsx`：
  - 渲染 `WorkScreenshot`（grid/masonry/hero/skew 各一）+ 默认数据，断言标题与占位文本。
  - 渲染 `WorkMetrics` + 默认数据，断言各指标 label 出现。
  - 渲染 `CommentWordcloud` + 默认数据，断言示例词文本出现、空数据时「暂无数据」。
  - 仅断言 DOM 文本（[[web-chart-test-convention]]）。
- `WorkScreenshotFields` / `WorkMetricsFields` / `CommentWordcloudFields`：轻量测试，给定含示例数据的组件，断言输入框数量/文案。

## 9. 风险与回滚

- `type` 改名是持久化破坏性变更 —— 本次使用全新 id（`work-screenshot` 等），不动既有 id，存量项目不受影响。
- 词云字号映射基于运行时词集 min/max，单词/等权时有 clamp 兜底，不会越界。
- 改动均为新增（新联合成员、新文件、新 REGISTRY 条目），回滚 = revert 相关提交即可，无 schema 迁移。

## 10. 实现顺序建议

1. shared 类型 → 2. defaults → 3. WorksComponents 渲染 → 4. registry + ComponentPanel → 5. PropertyPanel 编辑区块 → 6. 测试。每步可独立编译/运行。
