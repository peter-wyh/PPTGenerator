# 报告组件 ← 达人合作 deliverable 绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 work-screenshot / work-metrics / comment-wordcloud / creator-work-metrics 四类报告组件能从 collaboration deliverable（一个 creator + 一个 contentType）一键导入数据。

**Architecture:** 共享 `DeliverablePicker`（选 creator → 选 contentType → 回调 deliverable）；每类数据一个 importer，一次性拷贝对应槽位进 `comp.data`。截图 importer 改造换源 mock→collaboration；其余三类新建 importer + registry `dataSource`。种子补充 wordcloud/audience。

**Tech Stack:** React + TypeScript + Tailwind + Vitest + @testing-library/react。共享类型在 `packages/shared`。

**Context — 执行环境：** 主分支 `main`，每任务独立提交。关键现有模式：`useEditorStore((s) => s.reportData.campaign)` 取战役；`useEditorStore` 的 `updateComponentData(id, patch)` + `commit()` 写组件数据；importer 习惯包一层 `<FieldGroup title=...>`；`DataSourceSection` 按 registry 的 `dataSource.projectImporter` 自动呈现 importer。`DeliverablePicker` 放 `apps/web/src/editor/property-panel/DeliverablePicker.tsx`（与 importers.tsx 同目录，细化 spec 的 `components/` 路径）。web 测试遵循 `web-chart-test-convention`。

---

## File Structure

- **Create** `apps/web/src/editor/property-panel/DeliverablePicker.tsx` — 通用「选 creator+contentType → 回调 deliverable」UI。
- **Modify** `apps/web/src/editor/property-panel/importers.tsx` — 改造 `ReportWorkScreenshotImporter`；新增 `ReportWorkMetricsImporter` / `ReportCommentWordcloudImporter` / `ReportWorkAudienceImporter`；import `DeliverablePicker`。
- **Modify** `apps/web/src/editor/registry.tsx` — 给 work-metrics / comment-wordcloud / creator-work-metrics 加 `dataSource`；import 三个新 importer。
- **Modify** `apps/web/src/api/mock/collaborationSeed.ts` — `buildSeedCollaboration` 补 wordcloud/audience。
- 测试：`apps/web/tests/deliverable-picker.test.tsx`、`apps/web/tests/report-importers.test.tsx`、`apps/web/tests/collaboration-seed.test.ts`；并更新 `apps/web/tests/property-works.test.tsx` 的截图导入用例。

---

## Task 1: DeliverablePicker 组件

**Files:**
- Create: `apps/web/src/editor/property-panel/DeliverablePicker.tsx`
- Test: `apps/web/tests/deliverable-picker.test.tsx`

- [ ] **Step 1: 写失败测试**

`apps/web/tests/deliverable-picker.test.tsx`：
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import { DeliverablePicker } from '@/editor/property-panel/DeliverablePicker';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));
import { getCollaboration } from '@/api/collaborations';

const emptyProject = { id: 'p', name: 'p', width: 1280, height: 720, pages: [{ id: 'pg', name: '第 1 页', components: [] }], createdAt: '', updatedAt: '' } as never;

const collab: CollaborationData = {
  id: collaborationId('camp-1', 'cre-1'),
  campaignId: 'camp-1', creatorId: 'cre-1',
  deliverables: [{ contentType: 'post' }, { contentType: 'reels' }],
};

beforeEach(() => {
  useEditorStore.getState().loadProject(emptyProject, 'p');
  vi.clearAllMocks();
});

describe('DeliverablePicker', () => {
  it('无战役 → 提示先选战役', () => {
    render(<DeliverablePicker pickLabel="导入" onPick={() => {}} />);
    expect(screen.getByText(/先在「数据配置」选择战役/)).toBeInTheDocument();
  });

  it('有战役+达人+合作 → 渲染 contentType 选项并回调选中 deliverable', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    const onPick = vi.fn();
    render(<DeliverablePicker pickLabel="导入" onPick={onPick} />);
    await waitFor(() => expect(screen.getByText('导入')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'post' }));
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/deliverable-picker.test.tsx`
Expected: FAIL（`DeliverablePicker` 不存在）。

- [ ] **Step 3: 实现 DeliverablePicker.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { CollaborationDeliverable } from '@mediakit/shared';
import { useEditorStore, allReportCreators } from '@/editor/store';
import { getCollaboration } from '@/api/collaborations';
import { FieldGroup } from './helpers';

/**
 * 通用「从达人合作导入」UI：选 creator → 拉 getCollaboration → 选 contentType → 回调该 deliverable。
 * 无战役/无达人/无合作记录各有空态。creator 优先取页面绑定达人，否则取 reportData 第一个。
 */
export function DeliverablePicker({
  pickLabel,
  onPick,
}: {
  pickLabel: string;
  onPick: (d: CollaborationDeliverable) => void;
}) {
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const pageCreatorId = useEditorStore((s) => {
    const p = s.pages.find((pg) => pg.id === s.currentPageId);
    return p?.creatorId;
  });
  const creators = allReportCreators(useEditorStore((s) => s.reportData));
  const campaignId = campaign?.id ?? '';

  const [creatorId, setCreatorId] = useState(pageCreatorId ?? creators[0]?.id ?? '');
  const [deliverables, setDeliverables] = useState<CollaborationDeliverable[] | null>(null); // null=加载中
  const [contentType, setContentType] = useState('');

  useEffect(() => {
    setContentType('');
    if (!campaignId || !creatorId) {
      setDeliverables([]);
      return;
    }
    let alive = true;
    setDeliverables(null);
    getCollaboration(campaignId, creatorId).then((c) => {
      if (!alive) return;
      const ds = c?.deliverables ?? [];
      setDeliverables(ds);
      setContentType(ds[0]?.contentType ?? '');
    });
    return () => {
      alive = false;
    };
  }, [campaignId, creatorId]);

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

  const chosen = (deliverables ?? []).find((d) => d.contentType === contentType);

  return (
    <FieldGroup title="从达人合作导入">
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
        <p className="text-xs text-foreground-muted">该达人暂无合作数据。先在「数据管理」录入或「导入演示数据」。</p>
      ) : (
        <>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
          >
            {deliverables.map((d) => (
              <option key={d.contentType} value={d.contentType}>{d.contentType}</option>
            ))}
          </select>
          <button
            onClick={() => chosen && onPick(chosen)}
            disabled={!chosen}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
          >
            {pickLabel}
          </button>
        </>
      )}
    </FieldGroup>
  );
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/deliverable-picker.test.tsx`
Expected: PASS（2 tests）。

- [ ] **Step 5: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/DeliverablePicker.tsx apps/web/tests/deliverable-picker.test.tsx
git commit -m "feat(web): DeliverablePicker — pick creator+contentType from collaboration"
```

---

## Task 2: 种子扩展（wordcloud + audience）

**Files:**
- Modify: `apps/web/src/api/mock/collaborationSeed.ts`
- Create: `apps/web/tests/collaboration-seed.test.ts`

- [ ] **Step 1: 写失败测试**

`apps/web/tests/collaboration-seed.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { buildSeedCollaboration } from '@/api/mock/collaborationSeed';

describe('buildSeedCollaboration', () => {
  it('每个 deliverable 含全部四槽（screenshots/metrics/wordcloud/audience）', () => {
    const c = buildSeedCollaboration('camp-glowlab-q4', 'cre-mia');
    expect(c.deliverables.length).toBeGreaterThan(0);
    for (const d of c.deliverables) {
      expect(d.screenshots?.length).toBeGreaterThan(0);
      expect(d.metrics?.length).toBeGreaterThan(0);
      expect(d.wordcloud?.length).toBeGreaterThan(0);
      expect(d.audience).toBeTruthy();
      expect(d.audience?.topCities?.length).toBeGreaterThan(0);
      expect(d.audience?.genderSplit?.length).toBeGreaterThan(0);
      expect(d.audience?.ageRange?.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-seed.test.ts`
Expected: FAIL（wordcloud/audience 当前缺省）。

- [ ] **Step 3: 扩展种子**

把 `collaborationSeed.ts` 整体替换为：
```ts
import type {
  CollaborationData,
  CollaborationDeliverable,
  CommentWordItem,
  ContentType,
  WorkAudienceInsight,
} from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

const SENTIMENTS = ['pos', 'neutral', 'neg'] as const;

/** 从 post 标题派生确定性词云（demo）。 */
function seedWordcloud(title: string, idx: number): CommentWordItem[] {
  const words = (title || '种草 推荐 实测').split(/\s|·|，|,|\|/).map((w) => w.trim()).filter(Boolean).slice(0, 3);
  if (words.length === 0) words.push('种草');
  return words.map((text, i) => ({
    text,
    weight: 80 - i * 15 - (idx % 3) * 5,
    sentiment: SENTIMENTS[(idx + i) % 3],
  }));
}

/** 确定性受众画像（demo）。 */
function seedAudience(idx: number): WorkAudienceInsight {
  return {
    topCities: [
      { label: '上海', value: 28 - idx },
      { label: '北京', value: 20 - idx },
      { label: '广州', value: 15 },
    ],
    genderSplit: [
      { label: '女', value: 70 },
      { label: '男', value: 30 },
    ],
    ageRange: [
      { label: '18-24', value: 40 },
      { label: '25-34', value: 35 },
      { label: '35+', value: 25 },
    ],
  };
}

/** 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录（演示用，四槽全填）。 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const deliverables: CollaborationDeliverable[] = [];
  let idx = 0;
  for (const p of works?.posts ?? []) {
    const contentType: ContentType = /video|reel/i.test(p.platform) ? 'reels' : 'post';
    deliverables.push({
      contentType,
      screenshots: [{ src: p.cover, caption: p.title }],
      metrics: [
        { label: '曝光', value: p.impressions },
        { label: '点赞', value: p.likes },
        { label: '评论', value: p.comments },
      ],
      wordcloud: seedWordcloud(p.title, idx),
      audience: seedAudience(idx),
    });
    idx++;
  }
  if (deliverables.length === 0) {
    deliverables.push({
      contentType: 'post',
      screenshots: [{ src: '', caption: '' }],
      metrics: [{ label: '曝光', value: '0' }],
      wordcloud: seedWordcloud('', 0),
      audience: seedAudience(0),
    });
  }
  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-seed.test.ts`
Expected: PASS。

- [ ] **Step 5: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/api/mock/collaborationSeed.ts apps/web/tests/collaboration-seed.test.ts
git commit -m "feat(web): seed wordcloud + audience in collaboration demo data"
```

---

## Task 3: ReportWorkMetricsImporter + registry

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx`（import DeliverablePicker + 新增 importer）
- Modify: `apps/web/src/editor/registry.tsx`（import + work-metrics dataSource）
- Create: `apps/web/tests/report-importers.test.tsx`

- [ ] **Step 1: 写失败测试**

`apps/web/tests/report-importers.test.tsx`：
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));
import { getCollaboration } from '@/api/collaborations';
import { ReportWorkMetricsImporter } from '@/editor/property-panel/importers';

const emptyProject = { id: 'p', name: 'p', width: 1280, height: 720, pages: [{ id: 'pg', name: '第 1 页', components: [] }], createdAt: '', updatedAt: '' } as never;

const collab: CollaborationData = {
  id: collaborationId('camp-1', 'cre-1'),
  campaignId: 'camp-1', creatorId: 'cre-1',
  deliverables: [{ contentType: 'post', metrics: [{ label: '播放', value: '1.2M', color: '#f00' }] }],
};

beforeEach(() => {
  useEditorStore.getState().loadProject(emptyProject, 'p');
  vi.clearAllMocks();
});

describe('ReportWorkMetricsImporter', () => {
  it('imports chosen deliverable metrics (+workName=contentType) into comp.data', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent('work-metrics');
    const comp = store.currentComponents()[0];
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    render(<ReportWorkMetricsImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入效果数据')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入效果数据'));
    const data = useEditorStore.getState().currentComponents()[0].data as { metrics: unknown[]; workName: string };
    expect(data.metrics).toEqual([{ label: '播放', value: '1.2M', color: '#f00' }]);
    expect(data.workName).toBe('post');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: FAIL（`ReportWorkMetricsImporter` 未导出）。

- [ ] **Step 3: import DeliverablePicker 并新增 importer**

在 `importers.tsx` 顶部 import 区（`import { FieldGroup } from './helpers';` 附近）加：
```ts
import { DeliverablePicker } from './DeliverablePicker';
```

在文件末尾新增：
```ts
/** work-metrics：从达人合作 deliverable 一键导入效果数据（一次性拷贝）。 */
export function ReportWorkMetricsImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入效果数据"
      onPick={(d) => {
        updateComponentData(comp.id, { metrics: d.metrics ?? [], workName: d.contentType });
        commit();
      }}
    />
  );
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: PASS。

- [ ] **Step 5: registry 接入**

在 `registry.tsx` 顶部 import 区（已有 `ReportWorkScreenshotImporter` 的 import 处）加：
```ts
ReportWorkMetricsImporter,
```
（与其它 importer 同一个 import 语句；若该 import 是具名列表，追加此项。）

把 `work-metrics` 条目从
```ts
  'work-metrics': {
    Component: WorkMetrics,
    defaultSize: DEFAULT_SIZES['work-metrics'],
    defaultData: () => getDefaultData('work-metrics'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'workName', label: '作品名', kind: 'text' },
      { key: 'cover', label: '作品封面', kind: 'image-url' },
    ],
  },
```
改为（在 `defaultData` 之后、`propertySchema` 之前插入 `dataSource`）：
```ts
  'work-metrics': {
    Component: WorkMetrics,
    defaultSize: DEFAULT_SIZES['work-metrics'],
    defaultData: () => getDefaultData('work-metrics'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportWorkMetricsImporter },
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'workName', label: '作品名', kind: 'text' },
      { key: 'cover', label: '作品封面', kind: 'image-url' },
    ],
  },
```

- [ ] **Step 6: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/src/editor/registry.tsx apps/web/tests/report-importers.test.tsx
git commit -m "feat(web): ReportWorkMetricsImporter — import metrics from collaboration"
```

---

## Task 4: ReportCommentWordcloudImporter + registry

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx`、`apps/web/src/editor/registry.tsx`
- Modify: `apps/web/tests/report-importers.test.tsx`（追加用例）

- [ ] **Step 1: 追加失败测试**

在 `report-importers.test.tsx` 顶部 import 加 `ReportCommentWordcloudImporter`，并追加：
```tsx
import { ReportWorkMetricsImporter, ReportCommentWordcloudImporter } from '@/editor/property-panel/importers';
```
```tsx
describe('ReportCommentWordcloudImporter', () => {
  it('imports chosen deliverable wordcloud into comp.data.words', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    store.addComponent('comment-wordcloud');
    const comp = store.currentComponents()[0];
    const wordCollab: CollaborationData = {
      id: collaborationId('camp-1', 'cre-1'),
      campaignId: 'camp-1', creatorId: 'cre-1',
      deliverables: [{ contentType: 'post', wordcloud: [{ text: '种草', weight: 80, sentiment: 'pos' }] }],
    };
    vi.mocked(getCollaboration).mockResolvedValueOnce(wordCollab);
    render(<ReportCommentWordcloudImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入评论词云')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入评论词云'));
    const data = useEditorStore.getState().currentComponents()[0].data as { words: unknown[] };
    expect(data.words).toEqual([{ text: '种草', weight: 80, sentiment: 'pos' }]);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: FAIL（`ReportCommentWordcloudImporter` 未导出）。

- [ ] **Step 3: 新增 importer**

在 `importers.tsx` 末尾新增：
```ts
/** comment-wordcloud：从达人合作 deliverable 一键导入评论词云（一次性拷贝）。 */
export function ReportCommentWordcloudImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入评论词云"
      onPick={(d) => {
        updateComponentData(comp.id, { words: d.wordcloud ?? [] });
        commit();
      }}
    />
  );
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: PASS（2 tests）。

- [ ] **Step 5: registry 接入**

在 `registry.tsx` 的 importer import 列表加 `ReportCommentWordcloudImporter,`。把 `comment-wordcloud` 条目加 `dataSource`：
```ts
  'comment-wordcloud': {
    Component: CommentWordcloud,
    defaultSize: DEFAULT_SIZES['comment-wordcloud'],
    defaultData: () => getDefaultData('comment-wordcloud'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportCommentWordcloudImporter },
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
  },
```

- [ ] **Step 6: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/src/editor/registry.tsx apps/web/tests/report-importers.test.tsx
git commit -m "feat(web): ReportCommentWordcloudImporter — import wordcloud from collaboration"
```

---

## Task 5: ReportWorkAudienceImporter + registry

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx`、`apps/web/src/editor/registry.tsx`
- Modify: `apps/web/tests/report-importers.test.tsx`（追加用例）

- [ ] **Step 1: 追加失败测试**

import 加 `ReportWorkAudienceImporter`，并追加：
```tsx
describe('ReportWorkAudienceImporter', () => {
  it('imports chosen deliverable audience into comp.data.audience', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never,
    });
    store.addComponent('creator-work-metrics');
    const comp = store.currentComponents()[0];
    const audCollab: CollaborationData = {
      id: collaborationId('camp-1', 'cre-1'),
      campaignId: 'camp-1', creatorId: 'cre-1',
      deliverables: [{ contentType: 'post', audience: { genderSplit: [{ label: '女', value: 70 }] } }],
    };
    vi.mocked(getCollaboration).mockResolvedValueOnce(audCollab);
    render(<ReportWorkAudienceImporter comp={comp} />);
    await waitFor(() => expect(screen.getByText('导入画像')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入画像'));
    const data = useEditorStore.getState().currentComponents()[0].data as { audience: { genderSplit: unknown[] } };
    expect(data.audience.genderSplit).toEqual([{ label: '女', value: 70 }]);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: FAIL（`ReportWorkAudienceImporter` 未导出）。

- [ ] **Step 3: 新增 importer**

在 `importers.tsx` 末尾新增：
```ts
/** creator-work-metrics：从达人合作 deliverable 一键导入受众画像（一次性拷贝）。 */
export function ReportWorkAudienceImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入画像"
      onPick={(d) => {
        updateComponentData(comp.id, { audience: d.audience });
        commit();
      }}
    />
  );
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/report-importers.test.tsx`
Expected: PASS（3 tests）。

- [ ] **Step 5: registry 接入**

在 `registry.tsx` 的 importer import 列表加 `ReportWorkAudienceImporter,`。把 `creator-work-metrics` 条目加 `dataSource`（在 `defaultData` 之后、`variants` 之前）：
```ts
    defaultData: () => getDefaultData('creator-work-metrics'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportWorkAudienceImporter },
    variants: [
```

- [ ] **Step 6: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/src/editor/registry.tsx apps/web/tests/report-importers.test.tsx
git commit -m "feat(web): ReportWorkAudienceImporter — import audience from collaboration"
```

---

## Task 6: 改造 ReportWorkScreenshotImporter（mock→collaboration）+ 更新其测试

**Files:**
- Modify: `apps/web/src/editor/property-panel/importers.tsx:252-406`（整体替换 ReportWorkScreenshotImporter）
- Modify: `apps/web/tests/property-works.test.tsx`（截图导入用例改走 collaboration）

- [ ] **Step 1: 更新 property-works 截图导入用例（先红）**

`property-works.test.tsx` 里 `it('imports creator work screenshots from a bound campaign', async () => {...})` 整体替换为：
```tsx
  it('imports screenshots from a bound collaboration deliverable', async () => {
    vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));
    const { getCollaboration } = await import('@/api/collaborations');
    const { collaborationId } = await import('@mediakit/shared');
    vi.mocked(getCollaboration).mockResolvedValue({
      id: collaborationId('camp-glowlab-q4', 'cre-mia'),
      campaignId: 'camp-glowlab-q4',
      creatorId: 'cre-mia',
      deliverables: [{ contentType: 'post', screenshots: [{ src: 'shot-1.jpg' }, { src: 'shot-2.jpg' }] }],
    });

    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.setReportData({
      campaign: { id: 'camp-glowlab-q4', name: 'GlowLab Q4' } as unknown as ReportCampaign,
      creators: [{ id: 'cre-mia', name: 'Mia', platform: 'tiktok', handle: '@mia' } as unknown as ReportCreator],
    });
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { images: [] });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    const btn = await screen.findByRole('button', { name: '导入截图' });
    fireEvent.click(btn);

    await waitFor(() => {
      const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
      expect(data.images).toEqual([
        { src: 'shot-1.jpg' },
        { src: 'shot-2.jpg' },
      ]);
    });
  });
```
> 注：若该文件顶部已对 `@/api/collaborations` 有模块级 `vi.mock`，则用例内改用 `vi.mocked(getCollaboration).mockResolvedValue(...)`，不要重复 `vi.mock`。检查文件顶部并保持一致。

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: FAIL（旧 importer 找不到「导入截图」按钮 / 旧 mock 流程不再命中）。

- [ ] **Step 3: 改造 ReportWorkScreenshotImporter**

把 `importers.tsx` 里整个 `ReportWorkScreenshotImporter`（约 252–406 行，从 `export function ReportWorkScreenshotImporter({ comp })` 到其闭合 `}`）整体替换为：
```tsx
/**
 * work-screenshot：从达人合作 deliverable 一键导入作品截图（单 creator + 单 contentType，一次性拷贝）。
 * 旧版多选达人、扁平化 mock posts 的行为已废弃——改为 per-deliverable。
 */
export function ReportWorkScreenshotImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  return (
    <DeliverablePicker
      pickLabel="导入截图"
      onPick={(d) => {
        updateComponentData(comp.id, { images: d.screenshots ?? [] });
        commit();
      }}
    />
  );
}
```
> 改造后 `campaignCreatorWorks` / `allCreatorWorks` / `CreatorWithWorks` / `WorkScreenshotItem` 中若不再被本文件其它代码引用，会有 unused 警告——保留 `WorkScreenshotItem`（类型可能他处用），其余按 typecheck 报错提示清理 import。

- [ ] **Step 4: 运行 property-works，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: PASS。

- [ ] **Step 5: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/editor/property-panel/importers.tsx apps/web/tests/property-works.test.tsx
git commit -m "feat(web): ReportWorkScreenshotImporter reads collaboration (per-deliverable)"
```

---

## Task 7: 全量验证

**Files:** 无（只跑检查）

- [ ] **Step 1: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS（含 deliverable-picker / report-importers / collaboration-seed / property-works）。

- [ ] **Step 2: 全量类型检查**

Run: `pnpm -r run typecheck`
Expected: PASS。

---

## Self-Review

- **Spec coverage:** 共享 DeliverablePicker（Task 1）✓；四 importer（截图改造 Task 6 + 三个新建 Task 3/4/5）✓；registry dataSource 三处（Task 3/4/5）✓；种子扩展 wordcloud/audience（Task 2）✓；一次性拷贝模型（所有 importer 均 updateComponentData+commit）✓；空态（DeliverablePicker 无战役/无达人/无合作）✓；报告绑定 live/聚合明确不在本期（spec 声明）✓。
- **Placeholder scan:** 无 TBD；每步含完整代码与命令。Task 6 Step 1 注明 `vi.mock` 顶部一致性（低风险对齐说明）。
- **Type consistency:** `DeliverablePicker({pickLabel,onPick})` 签名在 Task 1 定义，被 Task 3/4/5/6 复用；拷贝字段名与组件 data 一致（images/metrics+workName/words/audience）；`ContentType` 来自 shared；`getCollaboration` 签名沿用上一期；seed 的 `CommentWordItem`/`WorkAudienceInsight` 与 shared 一致。
- **已知风险：** Task 6 改造删除旧 importer 主体后，`importers.tsx` 顶部 mock 相关 import（`campaignCreatorWorks`/`allCreatorWorks`）可能变 unused——typecheck 会报，按提示清理。`ReportWorkScreenshotImporter` 在 `WorkScreenshotFields.tsx` 与 DataSourceSection 两处挂载，改造后行为一致。
