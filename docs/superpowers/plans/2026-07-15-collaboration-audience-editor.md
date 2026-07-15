# 达人合作详情 · 受众画像编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `CollaborationDetail` 的画像部分从只读概要改为可编辑的四个子列表（城市/性别/年龄/趋势）+ trendLabel。

**Architecture:** 在 `DeliverableEditor` 里加 `setAudience` setter + 一个 `NamedValueSection`（label/value 行编辑，复用 `Section`），替换只读画像 `<div>`。仅 editing 模式可编辑，跳过 color（图表自动上色）。

**Tech Stack:** React + TypeScript + Tailwind + Vitest + @testing-library/react。

**Context — 执行环境：** 主分支 `main`，每任务独立提交。`CollaborationDetail.tsx` 已有 `Section` helper 与 `setScreenshots`/`setMetrics`/`setWords` setter 模式——本计划照搬该模式。web 测试遵循 `web-chart-test-convention`。

---

## File Structure

- **Modify** `apps/web/src/components/CollaborationDetail.tsx` — import `WorkAudienceInsight`；加 `setAudience` setter；加 `NamedValueSection` helper；用 4 个 `NamedValueSection` + trendLabel 替换只读画像块。
- **Modify** `apps/web/tests/collaboration-detail.test.tsx` — 追加 editing 编辑/保存用例 + 非编辑只读用例（import `within`）。

---

## Task 1: 受众画像编辑器

**Files:**
- Modify: `apps/web/src/components/CollaborationDetail.tsx`
- Modify: `apps/web/tests/collaboration-detail.test.tsx`

- [ ] **Step 1: 追加失败测试**

`collaboration-detail.test.tsx` 顶部 import 加 `within`：
```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
```
import `saveCollaboration` 到 mock（既有 mock 只含 getCollaboration）——把文件顶部：
```tsx
vi.mock('@/api/collaborations', () => ({
  getCollaboration: vi.fn(),
}));
import { getCollaboration } from '@/api/collaborations';
```
改为：
```tsx
vi.mock('@/api/collaborations', () => ({
  getCollaboration: vi.fn(),
  saveCollaboration: vi.fn().mockResolvedValue(undefined),
  removeCollaboration: vi.fn().mockResolvedValue(undefined),
}));
import { getCollaboration, saveCollaboration } from '@/api/collaborations';
```
在最后一个 `it(...)` 之后、`describe` 闭合 `});` 之前追加两个用例：
```tsx
  it('editing 模式可编辑受众画像并保存', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce({
      id: collaborationId('c1', 'cr1'),
      campaignId: 'c1',
      creatorId: 'cr1',
      deliverables: [{ contentType: 'post' }],
    });
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('编辑合作')).toBeInTheDocument());
    fireEvent.click(screen.getByText('编辑合作'));

    // 受众·城市 section：点 + 添加，填 label/value
    const citySection = screen.getByText('受众·城市').closest('.mb-1')!;
    fireEvent.click(within(citySection).getByText('+ 添加'));
    fireEvent.change(within(citySection).getByPlaceholderText('标签'), { target: { value: '上海' } });
    fireEvent.change(within(citySection).getByPlaceholderText('值'), { target: { value: '28' } });

    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(saveCollaboration).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveCollaboration).mock.calls[0][0];
    expect(saved.deliverables[0].audience?.topCities).toEqual([{ label: '上海', value: 28 }]);
  });

  it('非 editing 模式画像行只读（disabled，无 + 添加）', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce({
      id: collaborationId('c1', 'cr1'),
      campaignId: 'c1',
      creatorId: 'cr1',
      deliverables: [{ contentType: 'post', audience: { topCities: [{ label: '上海', value: 28 }] } }],
    });
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('post')).toBeInTheDocument());
    const citySection = screen.getByText('受众·城市').closest('.mb-1')!;
    expect(within(citySection).getByDisplayValue('上海')).toBeDisabled();
    expect(within(citySection).queryByText('+ 添加')).toBeNull();
  });
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx`
Expected: FAIL（无「受众·城市」文本——画像仍是只读概要）。

- [ ] **Step 3: 加类型 import**

`CollaborationDetail.tsx` 顶部 type import 加 `WorkAudienceInsight`：
```ts
import type {
  CollaborationData,
  CollaborationDeliverable,
  ContentType,
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from '@mediakit/shared';
```

- [ ] **Step 4: 加 setAudience setter**

在 `DeliverableEditor` 的 `setWords` 之后加：
```ts
  const setAudience = (p: Partial<WorkAudienceInsight>) =>
    patch({ audience: { ...(deliverable.audience ?? {}), ...p } });
```

- [ ] **Step 5: 用可编辑画像块替换只读概要**

把
```tsx
      {/* 画像（v1 只读概要，编辑留后续） */}
      <div className="text-foreground-muted">
        画像：
        {audience
          ? `${(audience.topCities ?? []).length} 城 / ${(audience.genderSplit ?? []).length} 性别 / ${(audience.ageRange ?? []).length} 年龄`
          : '暂无'}
      </div>
```
替换为：
```tsx
      {/* 受众画像（城市/性别/年龄/趋势，editing 可编辑） */}
      <NamedValueSection title="受众·城市" items={audience?.topCities ?? []} editing={editing}
        onChange={(items) => setAudience({ topCities: items })} />
      <NamedValueSection title="受众·性别" items={audience?.genderSplit ?? []} editing={editing}
        onChange={(items) => setAudience({ genderSplit: items })} />
      <NamedValueSection title="受众·年龄" items={audience?.ageRange ?? []} editing={editing}
        onChange={(items) => setAudience({ ageRange: items })} />
      <NamedValueSection title="受众·趋势" items={audience?.trend ?? []} editing={editing}
        onChange={(items) => setAudience({ trend: items })} />
      <div className="ml-2 mb-1 flex items-center gap-1 text-foreground-secondary">
        <span>趋势名</span>
        <input
          value={audience?.trendLabel ?? ''}
          placeholder="如 播放趋势"
          disabled={!editing}
          onChange={(e) => setAudience({ trendLabel: e.target.value })}
          className="w-28 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
        />
      </div>
```

- [ ] **Step 6: 加 NamedValueSection helper**

在文件末尾的 `Section` 函数**之后**追加：
```tsx
/** 受众画像的 label/value 行编辑器（城市/性别/年龄/趋势共用）。复用 Section；跳过 color（图表自动上色）。 */
function NamedValueSection({
  title,
  items,
  editing,
  onChange,
}: {
  title: string;
  items: { label: string; value: number }[];
  editing: boolean;
  onChange: (items: { label: string; value: number }[]) => void;
}) {
  return (
    <Section title={title} editing={editing} onAdd={() => onChange([...items, { label: '', value: 0 }])}>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={it.label}
            placeholder="标签"
            disabled={!editing}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
            className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
          />
          <input
            type="number"
            value={it.value}
            placeholder="值"
            disabled={!editing}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, value: Number(e.target.value) } : x)))}
            className="w-16 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
          />
          {editing && (
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-red">✕</button>
          )}
        </div>
      ))}
    </Section>
  );
}
```

- [ ] **Step 7: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx`
Expected: PASS（既有 2 + 新 2 = 4 用例）。

- [ ] **Step 8: 类型检查 + Commit**

```bash
pnpm --filter @mediakit/web run typecheck
git add apps/web/src/components/CollaborationDetail.tsx apps/web/tests/collaboration-detail.test.tsx
git commit -m "feat(web): editable audience (画像) in CollaborationDetail"
```

---

## Task 2: 全量验证

**Files:** 无（只跑检查）

- [ ] **Step 1: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS（含 collaboration-detail 新增用例）。

- [ ] **Step 2: 全量类型检查**

Run: `pnpm -r run typecheck`
Expected: PASS。

---

## Self-Review

- **Spec coverage:** 替换只读画像为可编辑（Task 1 Step 5）✓；setAudience setter（Task 1 Step 4）✓；四个子列表 + trendLabel（Task 1 Step 5）✓；仅 editing 可编辑（NamedValueSection 用 `disabled={!editing}`，+添加 由 Section 的 editing 控制）✓；跳过 color（NamedValueSection 不含 color 输入）✓；测试 editing 写入 + 非编辑只读（Task 1 Step 1）✓。
- **Placeholder scan:** 无 TBD；每步含完整代码与命令。
- **Type consistency:** `WorkAudienceInsight` import（Step 3）↔ setAudience 参数类型（Step 4）↔ NamedValueSection onChange 写入字段（topCities/genderSplit/ageRange/trend）一致；`{label,value}[]` 与 `{label,value,color?}[]`/WorkTrendPoint 结构兼容（color 可选、缺失合法）；placeholder「标签」「值」在测试 query 与实现一致；test 用 `closest('.mb-1')` 定位 Section 包裹层（与 Section 渲染的 `div.mb-1` 一致）。
- **已知风险：** `closest('.mb-1')` 依赖 Section 的 className；若 Section className 改动需同步测试。NamedValueSection 的 items 类型 `{label,value}[]` 接收 `topCities`（`{label,value,color?}[]`）——TS 结构兼容，但 color 会在编辑时丢失（重新构造为 `{label,value}`）；可接受（color 自动上色）。
