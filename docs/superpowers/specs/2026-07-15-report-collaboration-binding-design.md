# 报告组件 ← 达人合作 deliverable 绑定 — 设计

- 日期：2026-07-15
- 状态：已批准（待实现）
- 范围：`apps/web/src/editor/property-panel/importers.tsx`、`apps/web/src/editor/registry.tsx`、`apps/web/src/api/mock/collaborationSeed.ts`、新增 `DeliverablePicker` 组件

## 背景

上一期新增了 `COLLABORATION` 数据记录：一条合作 = (campaign, creator)，含 `deliverables[]`，每种作品类型（contentType）携带四类数据 `screenshots/metrics/audience/wordcloud`（类型与报告组件数据字段完全一致）。

当前报告组件的数据流：全部「一次性拷贝」进 `comp.data`（无 live 绑定；`EditorComponent.binding` 是未实现的 CSV 桩）。只有 `work-screenshot` 有 importer，且读的是 **mock**（`campaignCreatorWorks`），不是 collaboration 记录。`work-metrics`、`comment-wordcloud`、`creator-work-metrics`（画像载体）既无 importer 也无 `dataSource`。

## 目标

让四类报告组件能从 collaboration deliverable 一键导入数据（替换/新增 importer，数据源从 mock 切到 collaboration 记录）。沿用既有「一次性拷贝」模型——报告是数据快照，组件数据拷贝后静态。

## 已确认的决策

1. **绑定模型**：一次性拷贝（importer 把 deliverable 槽位拷进 `comp.data`）。不引入 live 绑定（报告是快照；保持组件数据为静态 blob 的不变量）。
2. **粒度**：每个组件绑定 **一个 deliverable**（一个 creator + 一个 contentType）。要展示 post 与 reels 就加两个组件。（不本期做跨 contentType 聚合。）
3. **范围**：全部四类——作品截图（改造现有 importer 换源 mock→collaboration）+ 效果数据 + 评论词云 + 画像（后三类新建 importer + registry `dataSource`）。
4. **截图改造的 UX 变更**：现有 `ReportWorkScreenshotImporter` 从「多选达人、扁平化全部 posts」改为「单选 (creator, contentType) → 该 deliverable 的 screenshots」。这是行为变更，但符合 per-deliverable 模型。
5. **种子扩展**：`buildSeedCollaboration` 补充 `wordcloud` 与 `audience`，让新 importer 有演示数据。

## 方案：per-component importer + 共享 DeliverablePicker

每类数据一个 importer，全部读 collaboration（不读 mock）。共享 `DeliverablePicker` 处理通用 UX（选 creator → 选 contentType → 回调该 deliverable）。否决：单一 mega-importer 自动判别组件类型（过度设计、难测）；live 引用绑定（上一期已否决）。

### DeliverablePicker（新 `apps/web/src/components/DeliverablePicker.tsx`）

```tsx
export function DeliverablePicker({
  onPick,           // (d: CollaborationDeliverable) => void
  pickLabel,        // 按钮文案，如「导入截图」
}: { onPick: (d: CollaborationDeliverable) => void; pickLabel: string })
```

行为：
1. 取 `reportData.campaign?.id` 作 campaignId；无 → 显示「先在「数据配置」选择战役」。
2. creator：优先 `usePageCreator()`（页面绑定达人，自动预选）；否则下拉选 `reportData` 的 creators/campaignCreators。
3. `getCollaboration(campaignId, creatorId)` → 无记录 → 「该达人暂无合作数据，先在「数据管理」录入或「导入演示数据」」。
4. 有记录 → contentType 下拉（`deliverables.map(d => d.contentType)`）+ 「导入」按钮 → `onPick(选中的 deliverable)`。

空数据槽（如 deliverable.screenshots 缺省）由 importer 自行处理（拷贝空数组或提示）。

### 四个 importer（均一次性拷贝）

| Importer | 组件 | 拷贝动作 |
|---|---|---|
| `ReportWorkScreenshotImporter`（**改造**） | work-screenshot | `updateComponentData(id, { images: d.screenshots ?? [] })` |
| `ReportWorkMetricsImporter`（新） | work-metrics | `updateComponentData(id, { metrics: d.metrics ?? [], workName: d.contentType })` |
| `ReportCommentWordcloudImporter`（新） | comment-wordcloud | `updateComponentData(id, { words: d.wordcloud ?? [] })` |
| `ReportWorkAudienceImporter`（新） | creator-work-metrics | `updateComponentData(id, { audience: d.audience })` |

每个 importer 形如：
```tsx
export function ReportWorkMetricsImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入效果数据"
      onPick={(d) => { updateComponentData(comp.id, { metrics: d.metrics ?? [], workName: d.contentType }); commit(); }}
    />
  );
}
```

`ReportWorkScreenshotImporter` 改造：移除 `campaignCreatorWorks` mock 取数与多选扁平化逻辑，改为渲染 `<DeliverablePicker pickLabel="导入截图" onPick={...} />`。

### Registry + 触发 UI

`registry.tsx` 给 `work-metrics`、`comment-wordcloud`、`creator-work-metrics` 加：
```ts
dataSource: { modes: ['manual', 'project'], projectImporter: ReportXxxImporter },
```
通用 `DataSourceSection`（`PropertyPanel.tsx` 已按 `def.dataSource` 挂载）会自动呈现 mode 切换 + importer——无需新触发 UI。`work-screenshot` 的 `dataSource` 已存在（importer 引用换掉即可）。

> 注：`work-screenshot` 还在 `WorkScreenshotFields.tsx` 直接挂了 `ReportWorkScreenshotImporter`（常显，与 mode 无关）；改造后两处都指向新行为，保持一致。

### 种子扩展（`collaborationSeed.ts`）

`buildSeedCollaboration` 每个 deliverable 补：
- `wordcloud`：从 post 标题派生 3–5 个词（确定性，`sentiment` 轮转 pos/neutral/neg，`weight` 30–80）。
- `audience`：确定性 `WorkAudienceInsight`（topCities 3 项、genderSplit 2 项、ageRange 3 项，复用既有 named-value 形状）。

保持幂等（确定性 id 不变）。

## 不在本期范围

- Live 绑定（组件渲染时按引用实时取数）——保持一次性拷贝。
- 跨 contentType 聚合（一个组件合并多个 deliverable）。
- `EditorComponent.binding` CSV 桩的清理。
- 画像的 `creator-works-list` / `creator-works-table` 的 `insights[]`（数组索引型）——本期只做单 `audience` 的 `creator-work-metrics`。

## 测试

- **DeliverablePicker**：mock `getCollaboration` 返回合作 → 渲染 creator/contentType 下拉 + 按钮；无战役/无合作 → 对应空态文案。
- **四个 importer**：mock `getCollaboration` 返回含目标槽位的 deliverable，模拟 onPick → 断言 `useEditorStore` 里 `comp.data` 对应字段被拷贝（screenshots→images、metrics→metrics+workName、wordcloud→words、audience→audience）。
- **种子**：`buildSeedCollaboration` 返回的 deliverable 含全部四槽（screenshots/metrics/wordcloud/audience）。
- 遵循 `web-chart-test-convention`（recharts 在 jsdom 被 mock，只断言外壳/数据）。
