# 达人详情浮窗(头像 + 右侧滑出)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 达人库列表显示头像,新增右侧滑出达人详情浮窗(点击行打开,显示记录字段 + 4 频道 KPI)。

**Architecture:** 纯前端。新 `CreatorAvatar`(头像/首字母兜底)+ 增强 `DataTable`(可选 `onRowClick`)+ 新 `CreatorDetailDrawer`(右侧滑出,`fixed inset-y-0 right-0` + `requestAnimationFrame` 滑入)+ DataManagement 接线(creator col0 头像 + 行点击 + drawer state)。无 server/DB/shared 改动。

**Tech Stack:** React + TypeScript + Tailwind;vitest + jsdom(@testing-library/react)。复用现有 design tokens(`bg-surface-primary`、`text-foreground-*`、`border-border-subtle`、`bg-primary/10 text-primary`)。

**基线与隔离:** 在 worktree `worktree-data-management`(== main `6536403` + 本 feature 的 spec commit `4f5ef4e`)上开发。`node_modules` + prisma client 已就绪(无需 install/generate)。每 task `git add <files> && git commit -m "..."`(worktree 干净,普通原子提交即可)。命令:`pnpm --filter @mediakit/web exec vitest run <path>` / `pnpm --filter @mediakit/web exec tsc --noEmit` / `pnpm --filter @mediakit/web test`。

**spec:** `docs/superpowers/specs/2026-07-15-creator-detail-drawer-design.md`。

---

## File Structure

- **新** `apps/web/src/components/CreatorAvatar.tsx` — `{name, avatar?, size}`:img 或首字母圆。列表(28)+ 浮窗(64)共用。
- **改** `apps/web/src/components/DataTable.tsx` — 加可选 `onRowClick?: (rowIndex: number) => void`(挂 `<tr onClick>`,`cursor-pointer`)。
- **新** `apps/web/src/editor/components/CreatorDetailDrawer.tsx` — 右侧滑出浮窗:`{creator: Creator, onClose}`;scrim + 面板 + Esc + 滑入动画;内容 = 头像/基本字段网格/4 频道 KPI。
- **改** `apps/web/src/routes/DataManagement.tsx` — creator col0 改头像+name;DataTable 传 `onRowClick`;action 按钮 `stopPropagation`;加 `detailCreator` state + 渲染 drawer。
- **测试** `CreatorAvatar.test.tsx`、`DataTable` onRowClick 用例(新文件或并入)、`CreatorDetailDrawer.test.tsx`、`DataManagement.test.tsx` 补用例。

---

## Task 1: `CreatorAvatar` 组件

**Files:**
- Create: `apps/web/src/components/CreatorAvatar.tsx`
- Test: `apps/web/tests/CreatorAvatar.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/CreatorAvatar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CreatorAvatar } from '@/components/CreatorAvatar';

describe('CreatorAvatar', () => {
  it('有 avatar URL → 渲染 <img>', () => {
    const { container } = render(<CreatorAvatar name="Mia Chen" avatar="https://x/a.png" size={28} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://x/a.png');
    expect(img?.getAttribute('alt')).toBe('Mia Chen');
  });
  it('无 avatar → 首字母兜底(无 img)', () => {
    const { container } = render(<CreatorAvatar name="Mia Chen" size={28} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('M');
  });
  it('无 name → "?"', () => {
    const { container } = render(<CreatorAvatar name="" size={28} />);
    expect(container.textContent).toBe('?');
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorAvatar.test.tsx
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

创建 `apps/web/src/components/CreatorAvatar.tsx`:

```tsx
interface Props {
  name: string;
  avatar?: string;
  size: number;
}

/** 达人头像:有 URL 显图,无则首字母圆形兜底。列表(小)与详情浮窗(大)共用。 */
export function CreatorAvatar({ name, avatar, size }: Props) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        draggable={false}
        style={{ width: size, height: size }}
        className="flex-none rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-primary/10 text-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name?.slice(0, 1) || '?'}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorAvatar.test.tsx
```
Expected: PASS(3/3)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CreatorAvatar.tsx apps/web/tests/CreatorAvatar.test.tsx
git commit -m "feat(web): CreatorAvatar component (img / initials fallback)"
```

---

## Task 2: `DataTable` 加可选 `onRowClick`

**Files:**
- Modify: `apps/web/src/components/DataTable.tsx`(整体重写,加 `onRowClick`)
- Test: `apps/web/tests/DataTable.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/DataTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/DataTable';

describe('DataTable onRowClick', () => {
  it('点数据行 → onRowClick(rowIndex)', async () => {
    const onRowClick = vi.fn();
    render(<DataTable loading={false} headers={['A', 'B']} rows={[['x', 'y'], ['z', 'w']]} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row'); // [thead row, body row0, body row1]
    await userEvent.click(rows[2]); // 第二条数据行(index 1)
    expect(onRowClick).toHaveBeenCalledWith(1);
  });
  it('不传 onRowClick → tbody 行无 cursor-pointer', () => {
    const { container } = render(<DataTable loading={false} headers={['A']} rows={[['x']]} />);
    expect(container.querySelector('tbody tr')).not.toHaveClass('cursor-pointer');
  });
  it('传 onRowClick → tbody 行有 cursor-pointer', () => {
    const { container } = render(<DataTable loading={false} headers={['A']} rows={[['x']]} onRowClick={vi.fn()} />);
    expect(container.querySelector('tbody tr')).toHaveClass('cursor-pointer');
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/web exec vitest run tests/DataTable.test.tsx
```
Expected: FAIL(`onRowClick` prop 不存在;`cursor-pointer` 缺)。

- [ ] **Step 3: 重写 `DataTable.tsx`**

先读现有 `apps/web/src/components/DataTable.tsx` 确认当前结构,然后整体替换为(仅新增 `onRowClick?` prop + `<tr>` 条件挂载 + `cursor-pointer`):

```tsx
import type { ReactNode } from 'react';

interface DataTableProps {
  loading: boolean;
  headers: string[];
  rows: ReactNode[][];
  /** 行点击回调(传入则行可点击 + cursor-pointer)。 */
  onRowClick?: (rowIndex: number) => void;
}

/** 通用数据表:loading/空态占位 + 首列强调 + 行 hover;可选行点击。 */
export function DataTable({ loading, headers, rows, onRowClick }: DataTableProps) {
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              onClick={onRowClick ? () => onRowClick(ri) : undefined}
              className={`border-t border-border-subtle hover:bg-surface-hover/50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? 'font-medium text-foreground-primary'
                      : 'whitespace-nowrap text-foreground-secondary'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

> 注意:保留原 loading/空态文案与首列强调样式不变;仅加 `onRowClick` 相关。

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/web exec vitest run tests/DataTable.test.tsx
```
Expected: PASS(3/3)。

- [ ] **Step 5: typecheck + 全量 web 测试(确认无回归)**

```bash
pnpm --filter @mediakit/web exec tsc --noEmit && pnpm --filter @mediakit/web test
```
Expected:typecheck 干净;全量绿(`DataTable` 现有调用方——creator 表——未传 `onRowClick`,行为不变)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/DataTable.tsx apps/web/tests/DataTable.test.tsx
git commit -m "feat(web): DataTable optional onRowClick (+ cursor-pointer)"
```

---

## Task 3: `CreatorDetailDrawer`(右侧滑出浮窗)

**Files:**
- Create: `apps/web/src/editor/components/CreatorDetailDrawer.tsx`
- Test: `apps/web/tests/CreatorDetailDrawer.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/CreatorDetailDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorDetailDrawer } from '@/editor/components/CreatorDetailDrawer';
import type { Creator } from '@mediakit/shared';

const creator: Creator = {
  id: 'cre-1',
  name: 'Mia Chen',
  handle: '@miaglowup',
  platform: 'TikTok',
  tier: 'mega',
  followers: '1.28M',
  engagement: '8.7%',
  category: 'Beauty',
  region: 'US',
  avatar: 'https://x/avatar.png',
  metrics: [
    { label: 'Avg Reach', value: '2.4M', compare: '' },
    { label: 'Impressions', value: '18M', compare: '' },
    { label: 'Follower Growth', value: '+38K', compare: '' },
    { label: 'CPM', value: '$120', compare: '' },
  ],
};

describe('CreatorDetailDrawer', () => {
  it('渲染头部 + 基本字段 + 4 KPI', () => {
    render(<CreatorDetailDrawer creator={creator} onClose={vi.fn()} />);
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('@miaglowup')).toBeInTheDocument();
    expect(screen.getByText('1.28M')).toBeInTheDocument(); // Followers
    expect(screen.getByText('频道 KPI')).toBeInTheDocument();
    expect(screen.getByText('2.4M')).toBeInTheDocument(); // Avg Reach
    expect(screen.getByText('$120')).toBeInTheDocument(); // CPM
  });
  it('scrim 点击 → onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    await userEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });
  it('✕ → onClose', async () => {
    const onClose = vi.fn();
    render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalled();
  });
  it('Esc → onClose', () => {
    const onClose = vi.fn();
    render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('metrics 为空 → 不渲染 KPI 区', () => {
    render(<CreatorDetailDrawer creator={{ ...creator, metrics: [] }} onClose={vi.fn()} />);
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorDetailDrawer.test.tsx
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

创建 `apps/web/src/editor/components/CreatorDetailDrawer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Creator } from '@mediakit/shared';
import { CreatorAvatar } from '@/components/CreatorAvatar';

interface Props {
  creator: Creator;
  onClose: () => void;
}

/** 达人详情右侧滑出浮窗:头像 + 基本字段网格 + 4 频道 KPI。数据全取自 Creator 记录(无额外请求)。 */
export function CreatorDetailDrawer({ creator, onClose }: Props) {
  const [open, setOpen] = useState(false);
  // 挂载后下一帧切 translate-x-0 → 滑入动画。
  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);
  // Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const profile: [string, string][] = [
    ['Platform', creator.platform],
    ['Tier', creator.tier],
    ['Followers', creator.followers],
    ['Engagement', creator.engagement],
    ['Category', creator.category],
    ['Region', creator.region],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside
        className={`fixed inset-y-0 right-0 flex h-full w-[440px] max-w-[90vw] flex-col overflow-auto bg-surface-primary shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={creator.name}
      >
        {/* 头部:大头像 + name + handle + 关闭 */}
        <div className="flex items-start gap-3 border-b border-border-subtle p-5">
          <CreatorAvatar name={creator.name} avatar={creator.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <div className="font-headings text-lg font-semibold text-foreground-primary">{creator.name}</div>
            <div className="truncate text-sm text-foreground-secondary">{creator.handle}</div>
          </div>
          <button onClick={onClose} aria-label="关闭" className="rounded p-1 text-foreground-secondary hover:bg-surface-hover">
            ✕
          </button>
        </div>

        {/* 基本字段网格 */}
        <div className="grid grid-cols-2 gap-px bg-border-subtle">
          {profile.map(([k, v]) => (
            <div key={k} className="bg-surface-primary p-3">
              <div className="text-[11px] uppercase tracking-wide text-foreground-muted">{k}</div>
              <div className="text-sm font-medium text-foreground-primary">{v || '—'}</div>
            </div>
          ))}
        </div>

        {/* 频道 KPI(metrics 为空则隐藏) */}
        {creator.metrics.length > 0 && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
            <div className="grid grid-cols-2 gap-2">
              {creator.metrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-border-subtle p-3">
                  <div className="text-[11px] text-foreground-muted">{m.label}</div>
                  <div className="text-base font-semibold text-foreground-primary">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorDetailDrawer.test.tsx
```
Expected: PASS(5/5)。

- [ ] **Step 5: typecheck**

```bash
pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:干净。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/editor/components/CreatorDetailDrawer.tsx apps/web/tests/CreatorDetailDrawer.test.tsx
git commit -m "feat(web): CreatorDetailDrawer (right slide-out, profile + channel KPI)"
```

---

## Task 4: DataManagement 接线(列表头像 + 行点击 + 浮窗)

**Files:**
- Modify: `apps/web/src/routes/DataManagement.tsx`
- Modify: `apps/web/tests/DataManagement.test.tsx`(补用例)

> 改动点(先读 `DataManagement.tsx` 确认当前行号;下方给出每处 old→new):
> 1. 加 import(`CreatorAvatar`、`CreatorDetailDrawer`、`Creator` 类型)。
> 2. creator 分支 col0:`d.name` → `<CreatorAvatar>+<span>name</span>`。
> 3. `<DataTable>` 调用加 `onRowClick={(i)=>setDetailCreator(records[i].data as Creator)}`。
> 4. `actions` 容器加 `onClick={e=>e.stopPropagation()}`(点编辑/删除不开浮窗)。
> 5. `DataPanel` 加 `detailCreator` state + 渲染 `<CreatorDetailDrawer>`。

- [ ] **Step 1: 写失败测试**

在 `apps/web/tests/DataManagement.test.tsx` 顶部现有 `vi.hoisted`/`vi.mock` 不变;在 `describe('DataManagement page', ...)` 内新增:

```tsx
it('达人库行点击 → 打开详情浮窗(KPI 区出现)', async () => {
  const creatorRec = {
    id: 'cre-1', kind: 'CREATOR', ownerId: 'u', createdAt: '', updatedAt: '',
    data: {
      id: 'cre-1', name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', tier: 'mega',
      followers: '1.28M', engagement: '8.7%', category: 'Beauty', region: 'US',
      avatar: 'https://x/a.png', metrics: [{ label: 'Avg Reach', value: '2.4M', compare: '' }],
    },
  };
  listMock.mockImplementation((k: string) =>
    k === 'creator' ? Promise.resolve([creatorRec]) : Promise.resolve([]),
  );
  renderPage();
  // 切到达人库 Tab
  await userEvent.click(screen.getByText('达人库'));
  await screen.findByText('Mia Chen');
  // 点行(点 name 文本,冒泡到 tr)→ 浮窗打开
  await userEvent.click(screen.getByText('Mia Chen'));
  expect(await screen.findByText('频道 KPI')).toBeInTheDocument();
});

it('达人库编辑按钮点击不开浮窗(stopPropagation)', async () => {
  const creatorRec = {
    id: 'cre-1', kind: 'CREATOR', ownerId: 'u', createdAt: '', updatedAt: '',
    data: { id: 'cre-1', name: 'Mia Chen', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1', engagement: '1%', category: 'B', region: 'U', metrics: [] },
  };
  listMock.mockImplementation((k: string) =>
    k === 'creator' ? Promise.resolve([creatorRec]) : Promise.resolve([]),
  );
  renderPage();
  await userEvent.click(screen.getByText('达人库'));
  await screen.findByText('Mia Chen');
  await userEvent.click(screen.getByText('编辑'));
  // 浮窗未开(无 KPI 区;campaign tab 也无 '频道 KPI')
  expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
});
```

> 注:`renderPage`/`listMock`/`userEvent` 已在现有测试文件顶部引入,直接复用。

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx
```
Expected: FAIL(浮窗未接,'频道 KPI' 不出现)。

- [ ] **Step 3: 接线 DataManagement.tsx**

**3a. 加 import。** 在 `DataManagement.tsx` 顶部 import 区(`@/components/DataTable` 附近)加:

```tsx
import { CreatorAvatar } from '@/components/CreatorAvatar';
import { CreatorDetailDrawer } from '@/editor/components/CreatorDetailDrawer';
```
并确认 `Creator` 类型已从 `@mediakit/shared` 引入(文件已 `import type { Campaign, Creator }`,若无需补)。

**3b. `DataPanel` 加 state。** 在 `DataPanel` 函数内现有 `useState` 群(`preview`/`editing`/`adding`)旁加:

```tsx
  const [detailCreator, setDetailCreator] = useState<Creator | null>(null);
```

**3c. creator col0 改头像 + name。** 找到 creator 分支 `rows` 映射(当前为 `return [d.name, d.handle, d.platform, d.tier, d.followers, d.engagement, d.category, d.region, actions(r)];`),把 `d.name` 改为头像+name 的节点:

```tsx
    return [
      (
        <div key="n" className="flex items-center gap-2">
          <CreatorAvatar name={d.name} avatar={d.avatar} size={28} />
          <span>{d.name}</span>
        </div>
      ),
      d.handle, d.platform, d.tier, d.followers, d.engagement, d.category, d.region, actions(r),
    ];
```

**3d. `actions` 容器 stopPropagation。** 找到 `actions` 函数(当前 `<div className="flex gap-2">`),加 `onClick`:

```tsx
  const actions = (r: DataRecordDTO): ReactNode => (
    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setEditing(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
      <button onClick={() => void del(r.id)} className="text-xs text-red hover:underline">删除</button>
    </div>
  );
```

**3e. `<DataTable>` 加 `onRowClick`。** 找到 creator 分支渲染处的 `<DataTable loading={loading} headers={headers} rows={rows} />`,改为(仅 creator kind 传 `onRowClick`):

```tsx
        <DataTable
          loading={loading}
          headers={headers}
          rows={rows}
          onRowClick={kind === 'creator' ? (i) => setDetailCreator(records[i].data as Creator) : undefined}
        />
```

> 注:`records[i]` 的 `.data` 是 `Campaign & Creator`(泛型 `useDataRecords<Campaign & Creator>`),creator 行强转为 `Creator` 安全(creator 记录 data 即 Creator 形状)。`onRowClick` 仅 creator kind 生效,campaign 不受影响。

**3f. 渲染浮窗。** 在 `DataPanel` 的 `return (...)` JSX 末尾(`{editing && <RecordFormModal .../>}` 之后)加:

```tsx
      {detailCreator && (
        <CreatorDetailDrawer creator={detailCreator} onClose={() => setDetailCreator(null)} />
      )}
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx
```
Expected: PASS(含 2 个新用例;现有用例不回归)。

- [ ] **Step 5: typecheck + 全量 web 测试**

```bash
pnpm --filter @mediakit/web exec tsc --noEmit && pnpm --filter @mediakit/web test
```
Expected:typecheck 干净;全量绿。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/DataManagement.tsx apps/web/tests/DataManagement.test.tsx
git commit -m "feat(web): creator list avatars + click row → detail drawer"
```

---

## Self-Review

**1. Spec 覆盖:**
- §4 CreatorAvatar → Task 1 ✓
- §5 DataTable onRowClick → Task 2 ✓
- §6 列表头像 + col0 → Task 4 (3c) ✓;行点击 → Task 4 (3e) ✓;action stopPropagation → Task 4 (3d) ✓
- §7 CreatorDetailDrawer(滑出 + 动画 + Esc + 内容)→ Task 3 ✓
- §8 交互(detailCreator state + 点行 + scrim/✕/Esc 关)→ Task 3 (Esc/scrim/✕) + Task 4 (state + 点行) ✓
- §9 测试 → 每任务含 TDD ✓;DataManagement 补「编辑不开浮窗」用例覆盖 stopPropagation ✓
- §3 不在范围:无 server/DB/shared 改动(确认)、不加列(只头像)、浮窗只读(无编辑)✓
- §11 兼容性:DataTable onRowClick 可选(现有调用方不传则不变)✓;metrics 空隐藏(Task 3 用例覆盖)✓;avatar 空兜底(Task 1 用例覆盖)✓

**2. Placeholder 扫描:** 无 TBD/TODO;每步含完整代码或确切命令。Task 4 改动点给出 old→new 形态(3a-3f 完整代码块)。✓

**3. 类型一致性:**
- `CreatorAvatar` props `{name, avatar?, size}` 在 Task 1 定义,Task 3(浮窗 size=64)+ Task 4(列表 size=28)调用一致 ✓
- `DataTable` `onRowClick?: (rowIndex: number) => void` Task 2 定义,Task 4 调用 `(i) => setDetailCreator(...)` 一致 ✓
- `CreatorDetailDrawer` props `{creator: Creator, onClose}` Task 3 定义,Task 4 调用一致 ✓
- `detailCreator: Creator | null` state 与 drawer/setDetailCreator 一致 ✓

**4. 范围:** 单一聚焦 feature,4 个顺序 task(Task 4 依赖 1/2/3)。每 task 独立可测、可提交。✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-creator-detail-drawer.md`. Two execution options:

**1. Subagent-Driven (推荐)** — 每 task 派 fresh subagent,task 间两阶段 review。
**2. Inline Execution** — 本 session 内 executing-plans 批量执行 + checkpoint。

选哪种?
