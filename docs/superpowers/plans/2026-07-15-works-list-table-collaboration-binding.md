# 作品列表/表格 ← 达人合作 deliverable 绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `creator-works-list` 与 `creator-works-table` 从一个达人的 collaboration 记录一键生成对齐的 `headers`/`rows`/`insights[]`（每行一个作品类型）。

**Architecture:** 新增 `buildWorksTable(deliverables)` helper 把 deliverables 组装成对齐的表数据；重写 `ReportCreatorWorksImporter` 读 `getCollaboration`（mock→collaboration），creator 下拉→「导入作品列表」；把同一 importer 注册给 `creator-works-table`（新增 dataSource）。

**Tech Stack:** React + TypeScript + Tailwind + Vitest + @testing-library/react。

**Context — 执行环境：** 主分支 `main`，每任务独立提交。现有模式：`usePageCreator()`（页面绑定达人预选）、`useEditorStore((s) => s.reportData.campaign)`、`updateComponentData`+`commit`、`FieldGroup`、`getCollaboration(campaignId, creatorId)`（上一期已建）。`buildWorksTable` 与重写后的 importer 都在 `apps/web/src/editor/property-panel/importers.tsx`。web 测试遵循 `web-chart-test-convention`。

---

## File Structure

- **Modify** `apps/web/src/editor/property-panel/importers.tsx` — 新增 `buildWorksTable`；重写 `ReportCreatorWorksImporter`（读 collaboration）；import `CollaborationDeliverable`/`getCollaboration`；清理变 unused 的 `campaignCreatorWorks`/`CreatorWithWorks`。
- **Modify** `apps/web/src/editor/registry.tsx` — `creator-works-table` 新增 `dataSource`（复用 `ReportCreatorWorksImporter`）。
- 测试：追加到 `apps/web/tests/report-importers.test.tsx`（buildWorksTable 单测 + 两个组件类型的 importer 测试）。

---

## Task 1: buildWorksTable helper

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx`（在 `ReportCreatorWorksImporter` 之前插入 helper）
- Test: `apps/web/tests/report-importers.test.tsx`（追加）

- [ ] **Step 1: 追加失败测试**

在 `report-importers.test.tsx` 顶部 import 加 `buildWorksTable`：
```tsx
import {
  ReportWorkMetricsImporter,
  ReportCommentWordcloudImporter,
  ReportWorkAudienceImporter,
  buildWorksTable,
} from '@/editor/property-panel/importers';
```
并追加（需 import `CollaborationDeliverable` 类型）：
```tsx
import type { CollaborationDeliverable } from '@mediakit/shared';

describe('buildWorksTable', () => {
  const deliverables: CollaborationDeliverable[] = [
    {
      contentType: 'post',
      screenshots: [{ src: 'p.jpg' }],
      metrics: [{ label: '曝光', value: '1.2M' }, { label: '点赞', value: '86K' }],
      audience: { genderSplit: [{ label: '女', value: 70 }] },
    },
    {
      contentType: 'reels',
      screenshots: [{ src: 'r.jpg' }],
      metrics: [{ label: '曝光', value: '500K' }],
      audience: { genderSplit: [{ label: '男', value: 60 }] },
    },
  ];
  it('headers = 封面/类型 + 首个 deliverable 的 metric labels', () => {
    expect(buildWorksTable(deliverables).headers).toEqual(['封面', '类型', '曝光', '点赞']);
  });
  it('rows 每行 = 封面/类型/metric值（按 label，缺失→空），与 deliverables 同序同长', () => {
    const { rows } = buildWorksTable(deliverables);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['p.jpg', 'post', '1.2M', '86K']);
    expect(rows[1]).toEqual(['r.jpg', 'reels', '500K', '']);
  });
  it('insights 与 deliverables 同序同长，对齐 audience', () => {
    const { insights } = buildWorksTable(deliverables);
    expect(insights).toHaveLength(2);
    expect(insights[0]).toEqual({ genderSplit: [{ label: '女', value: 70 }] });
  });
  it('无 audience 的 deliverable → insights[i] = {}', () => {
    expect(buildWorksTable([{ contentType: 'post' }]).insights[0]).toEqual({});
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: FAIL（`buildWorksTable` 未导出）。

- [ ] **Step 3: 实现 helper**

在 `importers.tsx` 的 `ReportCreatorWorksImporter` 函数**之前**插入：
```ts
import type { CollaborationDeliverable, WorkAudienceInsight } from '@mediakit/shared';
```
（与文件顶部既有 type import 合并；若顶部已 import `CollaborationDeliverable` 则不重复。）

```ts
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

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: buildWorksTable 的 4 个用例 PASS（既有 3 个 importer 用例仍 PASS）。

- [ ] **Step 5: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/tests/report-importers.test.tsx
git commit -m "feat(web): buildWorksTable — aligned rows+insights from deliverables"
```

---

## Task 2: 重写 ReportCreatorWorksImporter + 注册给 creator-works-table

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx`（重写 `ReportCreatorWorksImporter`；清理 unused import）
- Modify: `apps/web/src/editor/registry.tsx`（`creator-works-table` 加 dataSource）
- Test: `apps/web/tests/report-importers.test.tsx`（追加两个 importer 用例）

- [ ] **Step 1: 追加失败测试**

import 加 `ReportCreatorWorksImporter`：
```tsx
import {
  ReportWorkMetricsImporter,
  ReportCommentWordcloudImporter,
  ReportWorkAudienceImporter,
  ReportCreatorWorksImporter,
  buildWorksTable,
} from '@/editor/property-panel/importers';
```
追加：
```tsx
describe('ReportCreatorWorksImporter', () => {
  const collab: CollaborationData = {
    id: collaborationId('camp-1', 'cre-1'),
    campaignId: 'camp-1',
    creatorId: 'cre-1',
    deliverables: [
      { contentType: 'post', screenshots: [{ src: 'p.jpg' }], metrics: [{ label: '曝光', value: '1.2M' }], audience: { genderSplit: [{ label: '女', value: 70 }] } },
      { contentType: 'reels', screenshots: [{ src: 'r.jpg' }], metrics: [{ label: '曝光', value: '500K' }] },
    ],
  };

  async function setupImport(type: 'creator-works-list' | 'creator-works-table') {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent(type);
    const comp = store.currentComponents()[0];
    vi.mocked(getCollaboration).mockResolvedValue(collab);
    render(<ReportCreatorWorksImporter comp={comp} />);
    const btn = await screen.findByRole('button', { name: /导入作品列表/ });
    fireEvent.click(btn);
    return () => useEditorStore.getState().currentComponents()[0].data as {
      headers: string[]; rows: string[][]; insights: { genderSplit?: { label: string; value: number }[] }[];
    };
  }

  it('creator-works-list: 写入对齐的 headers/rows/insights', async () => {
    const getData = await setupImport('creator-works-list');
    const data = getData();
    expect(data.headers).toEqual(['封面', '类型', '曝光']);
    expect(data.rows).toEqual([
      ['p.jpg', 'post', '1.2M'],
      ['r.jpg', 'reels', '500K'],
    ]);
    expect(data.insights).toHaveLength(2);
    expect(data.insights[0]?.genderSplit).toEqual([{ label: '女', value: 70 }]);
  });

  it('creator-works-table: 同样写入对齐数据', async () => {
    const getData = await setupImport('creator-works-table');
    const data = getData();
    expect(data.rows).toHaveLength(2);
    expect(data.insights).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: FAIL（旧 importer 无「导入作品列表」按钮 / 仍读 mock）。

- [ ] **Step 3: 重写 ReportCreatorWorksImporter**

在 `importers.tsx` 顶部 import 增加（与既有 import 合并；`getCollaboration` 从 `@/api/collaborations`）：
```ts
import { getCollaboration } from '@/api/collaborations';
```
把整个旧 `ReportCreatorWorksImporter`（从 `export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {` 到其闭合 `}`，含 mock 取数/多选/apply）整体替换为：
```tsx
/**
 * creator-works-list / creator-works-table：从达人合作 deliverable 生成对齐的
 * headers/rows/insights（每行一个作品类型）。一个达人 → 它所有 contentType 各一行。
 * 旧版从 mock posts 填 rows 的行为已废弃。
 */
export function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const { creator: pageCreator, creatorId: pageCreatorId, creators } = usePageCreator();
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const campaignId = campaign?.id ?? '';
  const [creatorId, setCreatorId] = useState(pageCreatorId ?? creators[0]?.id ?? '');
  const [deliverables, setDeliverables] = useState<CollaborationDeliverable[] | null>(null);

  useEffect(() => {
    if (!campaignId || !creatorId) {
      setDeliverables([]);
      return;
    }
    let alive = true;
    setDeliverables(null);
    getCollaboration(campaignId, creatorId).then((c) => {
      if (alive) setDeliverables(c?.deliverables ?? []);
    });
    return () => {
      alive = false;
    };
  }, [campaignId, creatorId]);

  function apply() {
    if (!deliverables || deliverables.length === 0) return;
    const { headers, rows, insights } = buildWorksTable(deliverables);
    updateComponentData(comp.id, { headers, rows, insights });
    commit();
  }

  if (!campaignId) {
    return (
      <FieldGroup title="从达人合作导入">
        <p className="text-xs text-foreground-muted">先在「数据配置」选择战役。</p>
      </FieldGroup>
    );
  }
  if (creators.length === 0) {
    return (
      <FieldGroup title="从达人合作导入">
        <p className="text-xs text-foreground-muted">请先在「数据配置」选择达人。</p>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup title="从达人合作导入">
      {pageCreator && (
        <p className="mb-1 text-[10px] text-accent-primary">🔗 页面达人：{pageCreator.name}</p>
      )}
      <select
        value={creatorId}
        onChange={(e) => setCreatorId(e.target.value)}
        className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
      >
        {creators.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {deliverables === null ? (
        <p className="text-xs text-foreground-muted">加载…</p>
      ) : deliverables.length === 0 ? (
        <p className="text-xs text-foreground-muted">该达人暂无合作数据。</p>
      ) : (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          导入作品列表（{deliverables.length} 个作品类型）
        </button>
      )}
    </FieldGroup>
  );
}
```

- [ ] **Step 4: 清理 unused import**

重写后 `campaignCreatorWorks`、`CreatorWithWorks` 在 `importers.tsx` 不再被引用。运行 typecheck，按报错把：
```ts
import { campaignCreatorWorks, listPlacementTypeSummary, type CreatorWithWorks } from '@/api/creatorPerformance';
```
改为（仅保留仍被引用的 `listPlacementTypeSummary`，若它也 unused 则整行删除）：
```ts
import { listPlacementTypeSummary } from '@/api/creatorPerformance';
```
（若 typecheck 显示 `listPlacementTypeSummary` 也 unused，则删除整行。）

- [ ] **Step 5: 运行 importer 测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: PASS（buildWorksTable 4 + 既有 3 + 新 2 = 9 用例）。

- [ ] **Step 6: registry — creator-works-table 加 dataSource**

`creator-works-table` 在 registry 中已 import `ReportCreatorWorksImporter`（Task 上一期未加；本任务需确认 registry 顶部 import 已含 `ReportCreatorWorksImporter`——它在 `creator-works-list` 的 dataSource 已引用，故 import 已存在）。

把 `creator-works-table` 条目（在 `defaultData` 之后、`variants` 之前）加 `dataSource`：
```ts
    defaultData: () => getDefaultData('creator-works-table'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportCreatorWorksImporter },
    variants: [
```

- [ ] **Step 7: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/src/editor/registry.tsx apps/web/tests/report-importers.test.tsx
git commit -m "feat(web): works-list/table import aligned rows+insights from collaboration"
```

---

## Task 3: 全量验证

**Files:** 无（只跑检查）

- [ ] **Step 1: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS（含 report-importers 新增用例）。

- [ ] **Step 2: 全量类型检查**

Run: `pnpm -r run typecheck`
Expected: PASS。

---

## Self-Review

- **Spec coverage:** buildWorksTable helper（Task 1）✓；重写 ReportCreatorWorksImporter 读 collaboration（Task 2 Step 3）✓；creator-only 下拉、无 contentType 选择（Task 2 Step 3）✓；注册给 creator-works-table（Task 2 Step 6）✓；insights[] 对齐填充（buildWorksTable + Task 2 测试）✓；不写 title（Task 2 apply 仅写 headers/rows/insights）✓；清理 unused mock import（Task 2 Step 4）✓；空态（无战役/无达人/无合作，Task 2 Step 3）✓。
- **Placeholder scan:** 无 TBD；每步含完整代码与命令。Task 2 Step 4 的清理按 typecheck 报错定（低风险，明确指引）。
- **Type consistency:** `buildWorksTable(deliverables): {headers, rows, insights}` 签名在 Task 1 定义，Task 2 importer 复用；`CollaborationDeliverable`/`WorkAudienceInsight`/`getCollaboration` 来源一致；按钮文案「导入作品列表」在实现与测试 query 一致；insights 元素类型 `WorkAudienceInsight`（`{}` 合法，字段全可选）。
- **已知风险：** 重写删除旧 mock 取数后，`campaignCreatorWorks`/`CreatorWithWorks` 变 unused——typecheck 会报，Task 2 Step 4 清理。`creator-works-list` 的 `'detailed'` 变体与 `creator-works-table` 的 `'insight'` 变体按 `insights[i]` 渲染，未改组件渲染层（数据已对齐即可）。
