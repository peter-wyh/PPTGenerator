# 作品列表/表格 ← 达人合作 deliverable 绑定 — 设计

- 日期：2026-07-15
- 状态：已批准（待实现）
- 范围：`apps/web/src/editor/property-panel/importers.tsx`、`apps/web/src/editor/registry.tsx`、新增 `buildWorksTable` helper

## 背景

`creator-works-list`（`CreatorWorksListData`）与 `creator-works-table`（`CreatorWorksTableData`）都是表状组件：`headers` + `rows: string[][]` + 可选 `insights?: WorkAudienceInsight[]`（按行索引对齐；list 的 `'detailed'` 变体、table 的 `'insight'` 变体使用）。现有 `ReportCreatorWorksImporter`（importers.tsx）只给 `creator-works-list` 用，从 **mock posts** 填 `headers`/`rows`，从不填 `insights[]`；`creator-works-table` 根本没有 importer/dataSource。

上一期已让单 deliverable 数据（截图/效果/词云/单个画像）能导入报告组件。本期把「多个 deliverable → 多行 + 每行画像」接上。

## 目标

让 `creator-works-list` 与 `creator-works-table` 能从一个达人的 collaboration 记录一键生成**对齐**的 `headers`/`rows`/`insights[]`：每个作品类型（contentType）一行，行与画像同源、天然对齐。

## 已确认的决策

1. **行模型**：每行 = 一个作品类型 deliverable（post/reels/video…）。一个达人 → 它所有 contentType 各一行。比旧 mock「每条 post 一行」更粗（作品类型粒度）。
2. **行+画像同源**：rows 与 insights[] 都从 collaboration deliverables 派生，按下标对齐，杜绝错位。
3. **共享 importer**：重写 `ReportCreatorWorksImporter` 读 collaboration，并把它也注册给 `creator-works-table`（两个组件共用）。
4. **不写 title**：importer 只写 `{ headers, rows, insights }`——两个组件共享同一导入，避免给 list 的 data blob 留无用 title 字段。title 仍手动编辑。
5. **列模型**：headers = `['封面','类型', ...deliverables[0].metrics 的 label]`；每行按 label 取 metrics value（缺失→空串）。假设同一达人的各 deliverable metrics label 一致（seed 与真实录入均如此）。

## 方案

### `buildWorksTable(deliverables)` helper（新，放 importers.tsx 或独立 util）

```ts
import type { CollaborationDeliverable, WorkAudienceInsight } from '@mediakit/shared';

/** 把一个达人的 deliverables 组装成对齐的 headers/rows/insights（每行一个作品类型）。 */
export function buildWorksTable(deliverables: CollaborationDeliverable[]): {
  headers: string[];
  rows: string[][];
  insights: WorkAudienceInsight[];
} {
  const metricLabels = (deliverables[0]?.metrics ?? []).map((m) => m.label);
  const headers = ['封面', '类型', ...metricLabels];
  const rows = deliverables.map((d) => {
    const byLabel = new Map((d.metrics ?? []).map((m) => [m.label, m.value]));
    return [d.screenshots?.[0]?.src ?? '', d.contentType, ...metricLabels.map((l) => byLabel.get(l) ?? '')];
  });
  const insights = deliverables.map((d) => d.audience ?? {});
  return { headers, rows, insights };
}
```

`insights[i] = d.audience ?? {}`（空对象 → 该行无画像，组件渲染跳过）。结果：N 个 deliverable → N 行 + N 画像，同序同长。

### 重写 `ReportCreatorWorksImporter`（mock→collaboration）

```tsx
export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creatorId: pageCreatorId, creators } = usePageCreator();
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const campaignId = campaign?.id ?? '';
  const [creatorId, setCreatorId] = useState(pageCreatorId ?? creators[0]?.id ?? '');
  const [deliverables, setDeliverables] = useState<CollaborationDeliverable[] | null>(null);

  useEffect(() => {
    if (!campaignId || !creatorId) { setDeliverables([]); return; }
    let alive = true;
    setDeliverables(null);
    getCollaboration(campaignId, creatorId).then((c) => { if (alive) setDeliverables(c?.deliverables ?? []); });
    return () => { alive = false; };
  }, [campaignId, creatorId]);

  function apply() {
    if (!deliverables || deliverables.length === 0) return;
    const { headers, rows, insights } = buildWorksTable(deliverables);
    updateComponentData(comp.id, { headers, rows, insights });
    commit();
  }
  // 渲染：无战役/无达人/无合作 各空态；否则 creator 下拉 + 「导入作品列表」按钮
}
```

UX：creator 下拉（页面绑定达人自动预选）→ 「导入作品列表」。**无 contentType 选择**（所有 deliverable 都成行）。空态文案同 DeliverablePicker 风格（无战役/无达人/该达人暂无合作数据）。

### Registry

- `creator-works-list`：保留现有 `dataSource`（importer 引用不变，行为已重写）。
- `creator-works-table`：**新增** `dataSource: { modes: ['manual', 'project'], projectImporter: ReportCreatorWorksImporter }`。

### 清理

重写后 `campaignCreatorWorks` / `CreatorWithWorks` 若在 importers.tsx 不再被引用，typecheck 会报 unused——按提示删除 import（与截图重写时清 `allCreatorWorks` 同法）。

## 不在本期范围

- per-post 粒度（collaboration 无此数据）。
- 跨 deliverable 不一致 metric label 的动态列并集（本期假设一致，缺失填空）。
- live 绑定。

## 测试

- **buildWorksTable**：给定 2 个 deliverable（各含 metrics+audience），产出 headers 长度 = 2 + metricLabel 数；rows 与 insights 长度 = 2；insights[i] 对应 deliverable.audience；metric value 按 label 取（缺失→''）。
- **importer（list 与 table）**：mock `getCollaboration` 返回多 deliverable，选达人→「导入作品列表」→ `comp.data` 的 `headers`/`rows`/`insights` 被写入且对齐。两个组件类型各一例。
- 遵循 `web-chart-test-convention`（recharts 在 jsdom mock，只断言数据/外壳）。
