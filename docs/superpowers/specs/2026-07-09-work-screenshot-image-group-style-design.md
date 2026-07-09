# 作品截图组件：复用组图样式 + 接入达人作品 mock

**日期**：2026-07-09
**范围**：编辑器 `work-screenshot` 组件重构（不新增 ComponentType、不改服务端）

## 背景

现有 `work-screenshot`（作品截图）组件自带 4 种版式：等分网格 / 瀑布流 / 主图+缩略图 / 斜切，渲染逻辑独立、版式较朴素。`image-group`（组图）组件则有更精致的"按张数自动选版"马赛克引擎（`resolveLayout`：auto/duo/trio/quad/mosaic-5/hex/septet/nona/duoza），但无标题、无说明。

目标：让作品截图**复用组图的版式引擎**（保留其标题卡片 + 截图说明外壳），并接入**达人作品 mock 数据**——既作为添加组件时的默认种子数据，也提供"从达人数据导入"入口。

## 目标 / 非目标

**目标**
1. `work-screenshot` 渲染层改用组图的 `resolveLayout` 版式引擎。
2. 保留标题（Shell）+ 截图说明（caption）+ 空占位能力。
3. 默认种子数据来自某 campaign 合作的达人作品截图（mock）。
4. 属性面板提供"从达人数据导入"，按已绑 Campaign 拉取达人作品封面。
5. 不破坏老存档（向后兼容旧 variant 值）。

**非目标（YAGNI）**
- 不新增 ComponentType、不动服务端 Zod、不加新面板条目。
- 不保留 masonry/hero/skew 版式（按"换用组图"整体替换）。
- 不做版式编辑器之外的交互（如拖拽排序截图）。

## 现状关键事实（实现依据）

- `resolveLayout(variant, count)` 已从 `ImageGroupComponent.tsx` 导出；未命中 `BY_ID` 的 variant 值会落到按张数的 auto 选版——**天然向后兼容**旧 variant（grid/masonry/hero/skew）。
- 服务端 `pageSchema` 对 `components` 用 `z.any()`（`projects.schema.ts:19`），改 variant 类型与默认数据**零服务端改动**。
- `listCampaigns()`（`api/campaigns.ts`）的 campaign id（`camp-glowlab-q4` 等）与 `creatorPerformance.ts` 的 `CAMPAIGN_PROFILE` key 完全一致 → 导入器用 `reportData.campaign?.id` 调 `listCreatorPerformance` 可命中真实 mock。
- `PostEffect.cover` = `https://picsum.photos/seed/${pid}/640/360`（确定性）。
- `camp-glowlab-q4`：Mia(头部,4帖)+Sofia(腰部,3)+Tom(KOC,2) = **9 张**作品封面。

## 设计

### D1. Shared 类型（`packages/shared/src/index.ts`）

`WorkScreenshotData` 调整：

```ts
export interface WorkScreenshotData {
  variant?: ImageGroupLayoutId; // 原 'grid'|'masonry'|'hero'|'skew' → 组图版式
  title?: string;
  images: WorkScreenshotItem[]; // { src: string; caption?: string } 不变
  gap?: number; // 新增，与组图对齐，缺省 8
}
```

向后兼容：老存档 `variant:'grid'` 等不在组图 `BY_ID` → `resolveLayout` 自动按张数选版，不崩、不迁移。

### D2. Mock 数据源（`apps/web/src/api/creatorPerformance.ts`）

新增**同步**导出：

```ts
export function campaignWorkScreenshots(campaignId: string): WorkScreenshotItem[] {
  const perfs = MOCK_PERFORMANCE[campaignId] ?? [];
  const out: WorkScreenshotItem[] = [];
  for (const p of perfs) {
    for (const post of p.posts) {
      out.push({ src: post.cover ?? '', caption: `${p.creatorName} · ${post.title}` });
    }
  }
  return out;
}
```

- 确定性、同步（直接读 `MOCK_PERFORMANCE`，不走 `setTimeout`）。
- `camp-glowlab-q4` → 9 张 → auto 选 nona(3×3)。

### D3. 组图版式工具抽取（`ImageGroupComponent.tsx`）

抽取并导出两个工具（封装现有内联计算），`ImageGroupComponent` 自身改用、`work-screenshot` 复用，消重 ~15 行：

- `buildGridStyle(layout, gap): CSSProperties` — gridTemplateColumns / Rows。
- `cellStyle(cell): CSSProperties` — gridColumn / gridRow span + borderRadius + overflow。

### D4. 渲染层重写（`apps/web/src/editor/components/WorksComponents.tsx`）

`WorkScreenshot` 重写为：

```tsx
export function WorkScreenshot({ data }) {
  const { variant, title, images = [], gap = 8 } = data;
  if (images.length === 0) return <Shell title={title}>{/* 暂无作品截图 */}</Shell>;
  const layout = resolveLayout(variant, images.length);
  return (
    <Shell title={title}>
      <div style={buildGridStyle(layout, gap)}>
        {layout.cells.map((cell, i) => (
          <div key={i} style={cellStyle(cell)} className="bg-surface-hover">
            <Screenshot src={images[i]?.src} caption={images[i]?.caption} />
          </div>
        ))}
      </div>
    </Shell>
  );
}
```

- 复用现有 `Shell`、`Screenshot`（含 caption 条 + 占位"作品截图"文案）。
- 删除 `GridGallery`/`MasonryGallery`/`HeroGallery`/`SkewGallery`。
- `cellStyle` 与 image-group 一致（gridColumn/gridRow span + borderRadius）。

### D5. 默认种子数据（`apps/web/src/editor/defaults.ts`）

```ts
case 'work-screenshot':
  return {
    variant: 'auto',
    title: '达人作品截图',
    images: campaignWorkScreenshots('camp-glowlab-q4'),
  };
```

`defaults.ts` 新增 `import { campaignWorkScreenshots } from '@/api/creatorPerformance'`（`@/` 已在 routes 中验证可用）。

### D6. Registry 变体芯片（`apps/web/src/editor/registry.tsx`）

`work-screenshot.variants` 由 4 旧版式改为组图 9 版式（与 `image-group` 一致），使 VariantSelector 芯片匹配：

```ts
variants: [
  { id: 'auto', label: '自适应' },
  { id: 'duo', label: '2 张' },
  { id: 'trio', label: '3 张' },
  { id: 'quad', label: '4 张' },
  { id: 'mosaic-5', label: '5 张' },
  { id: 'hex', label: '6 张' },
  { id: 'septet', label: '7 张' },
  { id: 'nona', label: '9 张' },
  { id: 'duoza', label: '12 张' },
],
```

### D7. 属性面板导入器（`apps/web/src/editor/PropertyPanel.tsx`）

保留 `WorkScreenshotFields`（图片列表 + caption + 增删）。新增 `ReportWorkScreenshotImporter`（仿 `ImportCampaignButton`）：

- 读 `reportData.campaign?.id`。
- 已绑 Campaign 且有作品 → 「⚡ 导入「{campaign.name}」作品」按钮：调 `listCreatorPerformance(id)` → `posts.cover` 映射为 `{src, caption: creator·title}` → 覆盖 `data.images`（保留 title/variant）。
- 未绑 Campaign → 提示去「数据配置」绑定 + 提供全部 mock campaign（`listCampaigns`）下拉兜底。
- 接入位置：`WorkScreenshotFields` 内部顶部（或紧随其后）渲染。

### D8. 测试

| 文件 | 改动 |
|---|---|
| `works.test.tsx` | 变体集合 grid/masonry/hero/skew → 组图版式；调整默认图与占位断言 |
| `property-works.test.tsx` | 默认图数 3 → 9；新增导入器测试（mock store reportData.campaign + listCreatorPerformance） |
| 新增 `campaignWorkScreenshots` 单测 | 断言 `camp-glowlab-q4` → 9 项、确定性 |
| `registry.test.ts` | **不动**（无新 ComponentType） |

recharts/jsdom 约定不涉及（无图表）。组件 shell 文本断言沿用现有约定。

## 数据流

```
添加组件 → getDefaultData('work-screenshot')
        → campaignWorkScreenshots('camp-glowlab-q4') [同步, 读 MOCK_PERFORMANCE]
        → 9 张 {src: picsum cover, caption: 达人·标题}
渲染 → WorkScreenshot → resolveLayout(variant, 9) → nona(3×3) → Shell + Screenshot
导入 → ReportWorkScreenshotImporter
     → reportData.campaign.id → listCreatorPerformance(id) [异步 250ms]
     → posts.cover → 覆盖 images
```

## 风险

- **持久化兼容**：variant 值空间变更。已确认 `resolveLayout` 对未知 variant 回落 auto，老存档安全。无迁移脚本。
- **默认体积**：默认 9 张图在 600×420 组件上每格约 200×140，可接受；用户可删减。
- **导入异步**：`listCreatorPerformance` 有 250ms 延迟，导入按钮需 loading 态。
