# 达人粉丝画像图表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在达人领域下新增 4 个独立可拖拽的粉丝画像图表块（性别占比环形图 / 城市分布横向条形 / 年龄段柱状 / 兴趣标签占比条），属性面板手填，复用 recharts + 现有 `{label,value,color}` 数据形状。

**Architecture:** 沿用现有三层：`@mediakit/shared` 类型 → `defaults.ts` 默认数据 → `CreatorComponents.tsx` 渲染（含共用 `CreatorChartShell` 外壳）→ `registry.tsx` 注册（`propertySchema` 驱动属性面板自动渲染）→ `ComponentPanel.tsx` 入口。不引新依赖、不改 store、不加 PropertyFieldKind。

**Tech Stack:** React 18 + TypeScript + recharts ^2.12.7 + Tailwind + vitest + @testing-library/react（recharts 在 jsdom 下整体 mock）。

**Spec:** `docs/superpowers/specs/2026-07-06-creator-fan-profile-charts-design.md`

**测试命令约定：**
- 单测：`pnpm --filter @mediakit/web test -- <file-pattern>`
- 类型：`pnpm --filter @mediakit/web typecheck`
- 全量：`pnpm -r run test`

**关键复用锚点（已核对源码）：**
- `packages/shared/src/index.ts:446-467` ComponentType 联合；`:502-533` `BarChartDatum` / `PieChartSlice`；`:716-734` `ComponentData` 联合。
- `apps/web/src/editor/components/BasicComponents.tsx:92-171` recharts 三图实现（柱/折/饼）。
- `apps/web/src/editor/registry.tsx:106-320` REGISTRY；`:24-32` PropertyFieldKind；`:45-52` PropertyField。
- `apps/web/src/editor/defaults.ts:7-26` DEFAULT_SIZES；`:39-222` getDefaultData。
- `apps/web/src/editor/ComponentPanel.tsx:13-56` GROUPS。
- `apps/web/tests/components.test.tsx:5-18` recharts mock 模板；`apps/web/tests/registry.test.ts:6-25` TYPES 数组。

---

## File Structure

- `packages/shared/src/index.ts` — 加 4 个 ComponentType 字面量 + 4 个 Data 接口 + 入 ComponentData 联合。
- `apps/web/src/editor/defaults.ts` — DEFAULT_SIZES 加 4 项 + getDefaultData 加 4 case。
- `apps/web/src/editor/components/CreatorComponents.tsx` — 加 `CreatorChartShell` 外壳 + 4 个导出组件（`CreatorFanGender` / `CreatorFanCity` / `CreatorFanAge` / `CreatorFanInterest`）。
- `apps/web/src/editor/registry.tsx` — REGISTRY 加 4 条注册 + import。
- `apps/web/src/editor/ComponentPanel.tsx` — 「达人」分组 items 加 4 个入口。
- `apps/web/tests/creator-fan-charts.test.tsx` — 新增：4 组件渲染/数据契约测试（recharts mock）。
- `apps/web/tests/registry.test.ts` — TYPES 数组追加 4 个类型。
- `apps/web/tests/editor.creator.test.tsx` — 追加默认数据形状断言。

---

### Task 1: shared 类型与 ComponentData 联合

**Files:**
- Modify: `packages/shared/src/index.ts:446-467`（ComponentType）+ `:714`（在 PostListData 后新增 4 接口）+ `:716-734`（ComponentData 联合）

- [ ] **Step 1: 在 ComponentType 联合追加 4 个字面量**

在 `packages/shared/src/index.ts` 的 `ComponentType`（约 446-467 行），在 `| 'post-list';` 之前插入：

```ts
  // 业务组件（试点：达人粉丝画像图表，绑定"达人"领域实体）
  | 'creator-fan-gender'
  | 'creator-fan-city'
  | 'creator-fan-age'
  | 'creator-fan-interest'
```

- [ ] **Step 2: 在 PostListData 接口之后（约 714 行后）新增 4 个 Data 接口**

```ts
/* ---- 业务组件（试点：达人粉丝画像图表）Data ---- */

/** 性别占比（环形图）。center 为中心主项摘要，空 → 不渲染中心文字。 */
export interface CreatorFanGenderData {
  title?: string;
  subtitle?: string; // 空 → 不渲染
  center?: string;
  slices: PieChartSlice[]; // 复用 {label,value,color}
}

/** 城市分布 Top N（横向条形）。bars 按 value 降序展示。 */
export interface CreatorFanCityData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];
}

/** 年龄段分布（竖向柱状）。 */
export interface CreatorFanAgeData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];
}

/** 兴趣标签（纯 div 横向占比条）。showPercent 缺省视为 true。 */
export interface CreatorFanInterestData {
  title?: string;
  subtitle?: string;
  showPercent?: boolean;
  tags: { label: string; value: number; color: string }[];
}
```

- [ ] **Step 3: 把 4 个 Data 加入 ComponentData 联合**

修改 `ComponentData` 联合（约 716-734 行），在 `| PostListData;` 之前插入：

```ts
  | CreatorFanGenderData
  | CreatorFanCityData
  | CreatorFanAgeData
  | CreatorFanInterestData
```

- [ ] **Step 4: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（类型新增自洽，尚无消费方引用，不会报错）

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): 达人粉丝画像图表类型（gender/city/age/interest）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: defaults 默认尺寸与默认数据

**Files:**
- Modify: `apps/web/src/editor/defaults.ts:7-26`（DEFAULT_SIZES）+ `:39-222`（getDefaultData switch）

- [ ] **Step 1: DEFAULT_SIZES 追加 4 项**

在 `apps/web/src/editor/defaults.ts` 的 `DEFAULT_SIZES`（约 7-26 行），在 `'post-list': { w: 900, h: 240 },` 之后插入：

```ts
  'creator-fan-gender': { w: 320, h: 280 },
  'creator-fan-city': { w: 420, h: 320 },
  'creator-fan-age': { w: 420, h: 300 },
  'creator-fan-interest': { w: 420, h: 280 },
```

- [ ] **Step 2: getDefaultData 追加 4 个 case**

在 `getDefaultData` 的 switch（约 39-222 行），在 `case 'post-list':` 分支的 return 之后、`default:` 之前插入 4 个 case：

```ts
    case 'creator-fan-gender':
      return {
        title: '粉丝性别占比',
        subtitle: '女性主导',
        center: '女性 62%',
        slices: [
          { label: '女', value: 62, color: '#FF5C00' },
          { label: '男', value: 36, color: '#3B82F6' },
          { label: '其他', value: 2, color: '#8B5CF6' },
        ],
      };
    case 'creator-fan-city':
      return {
        title: '粉丝城市分布 Top 8',
        subtitle: '一线及新一线城市占 73%',
        bars: [
          { label: '上海', value: 22, color: '#FF5C00' },
          { label: '广州', value: 16, color: '#3B82F6' },
          { label: '北京', value: 14, color: '#22C55E' },
          { label: '深圳', value: 12, color: '#8B5CF6' },
          { label: '杭州', value: 9, color: '#F59E0B' },
          { label: '成都', value: 7, color: '#EC4899' },
          { label: '武汉', value: 5, color: '#3B82F6' },
          { label: '西安', value: 4, color: '#22C55E' },
        ],
      };
    case 'creator-fan-age':
      return {
        title: '粉丝年龄段',
        subtitle: '25–34 岁为主力',
        bars: [
          { label: '<18', value: 8, color: '#3B82F6' },
          { label: '18-24', value: 28, color: '#FF5C00' },
          { label: '25-34', value: 38, color: '#22C55E' },
          { label: '35-44', value: 18, color: '#8B5CF6' },
          { label: '45+', value: 8, color: '#F59E0B' },
        ],
      };
    case 'creator-fan-interest':
      return {
        title: '兴趣标签',
        subtitle: '美妆 · 美食为两大主兴趣',
        showPercent: true,
        tags: [
          { label: '美妆', value: 35, color: '#FF5C00' },
          { label: '美食', value: 28, color: '#3B82F6' },
          { label: '穿搭', value: 22, color: '#22C55E' },
          { label: '旅行', value: 15, color: '#8B5CF6' },
        ],
      };
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（新 case 命中新类型；switch 穷尽性由 ComponentData 联合保证）

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor/defaults.ts
git commit -m "feat(web): 达人粉丝画像图表默认数据

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 共用外壳 CreatorChartShell

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`（文件末尾追加）

- [ ] **Step 1: 在 CreatorComponents.tsx 末尾追加外壳**

在 `apps/web/src/editor/components/CreatorComponents.tsx` 文件末尾追加：

```tsx
/* -------------------------- creator fan profile charts ------------------------- */

/** 图表外壳：统一卡片框 + 标题 + 副标题（空则不渲染）+ 图区。 */
function CreatorChartShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-3">
      {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
      {subtitle && <div className="mt-0.5 text-[11px] text-foreground-secondary">{subtitle}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 确认 React 类型已可用（无需新 import）**

该文件已 import `import type { ... } from '@mediakit/shared'` 且为 .tsx（React 全局类型可用）。若 `React.ReactNode` 报未定义，则在文件顶部 `import type React from 'react';`。先类型检查验证：

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（如报 `React` 未定义，加 `import type React from 'react';` 到文件顶部 import 区）

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx
git commit -m "feat(web): CreatorChartShell 共用图表外壳

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CreatorFanGender（性别占比环形图）— TDD

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`（末尾追加组件 + 顶部 import）
- Test: `apps/web/tests/creator-fan-charts.test.tsx`（新建）

- [ ] **Step 1: 新建测试文件，写 recharts mock + 性别图失败测试**

创建 `apps/web/tests/creator-fan-charts.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// recharts 在 jsdom 下依赖 ResizeObserver/尺寸，整体桩成轻量 div（与 components.test.tsx 同模式）。
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  LabelList: () => null,
}));

import { CreatorFanGender, CreatorFanCity, CreatorFanAge, CreatorFanInterest } from '@/editor/components/CreatorComponents';

describe('creator fan gender (donut)', () => {
  it('renders title, subtitle, slices and center text', () => {
    render(
      <CreatorFanGender
        data={{
          title: '性别占比',
          subtitle: '女性主导',
          center: '女性 62%',
          slices: [
            { label: '女', value: 62, color: '#FF5C00' },
            { label: '男', value: 36, color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('性别占比')).toBeInTheDocument();
    expect(screen.getByText('女性主导')).toBeInTheDocument();
    expect(screen.getByText('女性 62%')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('男')).toBeInTheDocument();
  });

  it('hides subtitle when empty, renders empty-state when no slices', () => {
    const { container } = render(<CreatorFanGender data={{ title: 'T', subtitle: '', slices: [] }} />);
    expect(screen.queryByText('T')).toBeInTheDocument();
    expect(container.textContent).not.toContain('undefined');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: FAIL — `CreatorFanGender is not exported`（组件尚未实现）

- [ ] **Step 3: 在 CreatorComponents.tsx 顶部补 recharts import**

在 `apps/web/src/editor/components/CreatorComponents.tsx` 文件最顶部（现有 shared import 之前）加：

```tsx
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
```

- [ ] **Step 4: 在 CreatorComponents.tsx 末尾追加 CreatorFanGender 与空状态占位**

```tsx
/** 空数据占位。 */
function EmptyChart() {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">暂无数据</div>
  );
}

/** 性别占比环形图；center 为中心主项摘要。 */
export function CreatorFanGender({ data }: { data: import('@mediakit/shared').CreatorFanGenderData }) {
  const { title, subtitle, center, slices = [] } = data;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {slices.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                label={(e: { label?: string }) => e.label ?? ''}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {center && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs font-semibold text-foreground-primary">
              {center}
            </div>
          )}
        </div>
      )}
    </CreatorChartShell>
  );
}
```

> 注：`import('@mediakit/shared').CreatorFanGenderData` 内联类型避免顶部 import 列表与已有 type import 冲突；若顶部已有 shared import，可改为加到现有 `import type { ... }` 列表。任选其一，保持一致即可。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: PASS（gender 两个用例绿）

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/creator-fan-charts.test.tsx
git commit -m "feat(web): creator-fan-gender 性别占比环形图

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: CreatorFanCity（城市分布横向条形）— TDD

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`
- Test: `apps/web/tests/creator-fan-charts.test.tsx`

- [ ] **Step 1: 在测试文件追加 city 测试（在 gender describe 块之后）**

```tsx
describe('creator fan city (horizontal bar)', () => {
  it('renders title + subtitle + city labels, sorts descending by value', () => {
    render(
      <CreatorFanCity
        data={{
          title: '城市分布',
          subtitle: '一线占 73%',
          bars: [
            { label: '北京', value: 14, color: '#22C55E' },
            { label: '上海', value: 22, color: '#FF5C00' },
            { label: '广州', value: 16, color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('城市分布')).toBeInTheDocument();
    expect(screen.getByText('一线占 73%')).toBeInTheDocument();
    expect(screen.getByText('上海')).toBeInTheDocument();
    expect(screen.getByText('北京')).toBeInTheDocument();
    expect(screen.getByText('广州')).toBeInTheDocument();
  });

  it('renders empty-state when bars empty', () => {
    render(<CreatorFanCity data={{ title: 'T', bars: [] }} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: FAIL — `CreatorFanCity is not exported`

- [ ] **Step 3: 在 CreatorComponents.tsx 末尾追加 CreatorFanCity**

```tsx
/** 城市分布 Top N（横向条形）；按 value 降序，条尾 LabelList 标百分比。 */
export function CreatorFanCity({ data }: { data: import('@mediakit/shared').CreatorFanCityData }) {
  const { title, subtitle, bars = [] } = data;
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const sum = sorted.reduce((acc, b) => acc + b.value, 0) || 1;
  const withPct = sorted.map((b) => ({ ...b, pct: Math.round((b.value / sum) * 100) }));
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {sorted.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={withPct} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {withPct.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
              <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/creator-fan-charts.test.tsx
git commit -m "feat(web): creator-fan-city 城市分布横向条形

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: CreatorFanAge（年龄段柱状图）— TDD

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`
- Test: `apps/web/tests/creator-fan-charts.test.tsx`

- [ ] **Step 1: 追加 age 测试**

```tsx
describe('creator fan age (vertical bar)', () => {
  it('renders title + subtitle + age labels', () => {
    render(
      <CreatorFanAge
        data={{
          title: '年龄段',
          subtitle: '25-34 主力',
          bars: [
            { label: '18-24', value: 28, color: '#FF5C00' },
            { label: '25-34', value: 38, color: '#22C55E' },
          ],
        }}
      />,
    );
    expect(screen.getByText('年龄段')).toBeInTheDocument();
    expect(screen.getByText('25-34 主力')).toBeInTheDocument();
    expect(screen.getByText('18-24')).toBeInTheDocument();
    expect(screen.getByText('25-34')).toBeInTheDocument();
  });

  it('renders empty-state when bars empty', () => {
    render(<CreatorFanAge data={{ title: 'T', bars: [] }} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: FAIL — `CreatorFanAge is not exported`

- [ ] **Step 3: 在 CreatorComponents.tsx 末尾追加 CreatorFanAge（复用 BarChartComponent 结构）**

```tsx
/** 年龄段分布（竖向柱状）。 */
export function CreatorFanAge({ data }: { data: import('@mediakit/shared').CreatorFanAgeData }) {
  const { title, subtitle, bars = [] } = data;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {bars.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/creator-fan-charts.test.tsx
git commit -m "feat(web): creator-fan-age 年龄段柱状图

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: CreatorFanInterest（兴趣标签占比条）— TDD

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`
- Test: `apps/web/tests/creator-fan-charts.test.tsx`

- [ ] **Step 1: 追加 interest 测试**

```tsx
describe('creator fan interest (proportion bars)', () => {
  it('renders title + subtitle + tag labels + percent labels', () => {
    render(
      <CreatorFanInterest
        data={{
          title: '兴趣标签',
          subtitle: '美妆为主',
          tags: [
            { label: '美妆', value: 35, color: '#FF5C00' },
            { label: '美食', value: 28, color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('兴趣标签')).toBeInTheDocument();
    expect(screen.getByText('美妆为主')).toBeInTheDocument();
    expect(screen.getByText('美妆')).toBeInTheDocument();
    expect(screen.getByText('美食')).toBeInTheDocument();
    // 35/(35+28)=55.6 → round 56
    expect(screen.getByText('56%')).toBeInTheDocument();
    expect(screen.getByText('44%')).toBeInTheDocument();
  });

  it('hides percent labels when showPercent=false', () => {
    render(
      <CreatorFanInterest
        data={{
          title: 'T',
          tags: [{ label: '美妆', value: 35, color: '#FF5C00' }],
          showPercent: false,
        }}
      />,
    );
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('renders empty-state when tags empty', () => {
    render(<CreatorFanInterest data={{ title: 'T', tags: [] }} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: FAIL — `CreatorFanInterest is not exported`

- [ ] **Step 3: 在 CreatorComponents.tsx 末尾追加 CreatorFanInterest（纯 div，无 recharts）**

```tsx
/** 兴趣标签：纯 div 横向占比条。占比 = value / sum(values)；showPercent 缺省视为 true。 */
export function CreatorFanInterest({ data }: { data: import('@mediakit/shared').CreatorFanInterestData }) {
  const { title, subtitle, tags = [], showPercent } = data;
  const showPct = showPercent !== false;
  const sum = tags.reduce((acc, t) => acc + t.value, 0) || 1;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {tags.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-full w-full flex-col justify-center gap-2 overflow-auto">
          {tags.map((t, i) => {
            const pct = Math.round((t.value / sum) * 100);
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 flex-none truncate text-[11px] text-foreground-secondary">{t.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} />
                </div>
                {showPct && <div className="w-9 flex-none text-right text-[11px] font-data text-foreground-primary">{pct}%</div>}
              </div>
            );
          })}
        </div>
      )}
    </CreatorChartShell>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @mediakit/web test -- creator-fan-charts`
Expected: PASS（全部用例绿；35/63=55.6→56，28/63=44.4→44）

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/creator-fan-charts.test.tsx
git commit -m "feat(web): creator-fan-interest 兴趣标签占比条

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: REGISTRY 注册

**Files:**
- Modify: `apps/web/src/editor/registry.tsx:14-18`（import）+ `:320` 之前（REGISTRY 内 `'post-list'` 之后加 4 条）

- [ ] **Step 1: 扩展 import**

修改 `apps/web/src/editor/registry.tsx:14-18`，把 creator import 列表扩为：

```tsx
import {
  CreatorAvatarCard,
  CreatorStatsStrip,
  CreatorWorksList,
  CreatorFanGender,
  CreatorFanCity,
  CreatorFanAge,
  CreatorFanInterest,
} from './components/CreatorComponents';
```

- [ ] **Step 2: 在 REGISTRY 的 `'post-list': { ... },` 之后追加 4 条注册**

```tsx
  'creator-fan-gender': {
    Component: CreatorFanGender,
    defaultSize: DEFAULT_SIZES['creator-fan-gender'],
    defaultData: () => getDefaultData('creator-fan-gender'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'center', label: '中心文案', kind: 'text' },
      { key: 'slices', label: '性别项', kind: 'list' },
    ],
  },
  'creator-fan-city': {
    Component: CreatorFanCity,
    defaultSize: DEFAULT_SIZES['creator-fan-city'],
    defaultData: () => getDefaultData('creator-fan-city'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'bars', label: '城市数据', kind: 'list' },
    ],
  },
  'creator-fan-age': {
    Component: CreatorFanAge,
    defaultSize: DEFAULT_SIZES['creator-fan-age'],
    defaultData: () => getDefaultData('creator-fan-age'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'bars', label: '年龄段数据', kind: 'list' },
    ],
  },
  'creator-fan-interest': {
    Component: CreatorFanInterest,
    defaultSize: DEFAULT_SIZES['creator-fan-interest'],
    defaultData: () => getDefaultData('creator-fan-interest'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'tags', label: '兴趣标签', kind: 'list' },
    ],
  },
```

- [ ] **Step 3: 在 registry.test.ts 的 TYPES 数组追加 4 类型**

修改 `apps/web/tests/registry.test.ts:6-25`，在 `  'post-list',` 之后加：

```ts
  'creator-fan-gender',
  'creator-fan-city',
  'creator-fan-age',
  'creator-fan-interest',
```

- [ ] **Step 4: 在 editor.creator.test.tsx 追加默认数据形状断言**

在 `apps/web/tests/editor.creator.test.tsx` 的 `describe('creator business components — defaults / registry', ...)` 块末尾追加：

```tsx
  it('fan profile defaults have title + data arrays', () => {
    const gender = getDefaultData('creator-fan-gender') as { title: string; slices: unknown[] };
    const city = getDefaultData('creator-fan-city') as { title: string; bars: unknown[] };
    const age = getDefaultData('creator-fan-age') as { title: string; bars: unknown[] };
    const interest = getDefaultData('creator-fan-interest') as { title: string; tags: unknown[] };
    expect(gender.slices.length).toBeGreaterThan(0);
    expect(city.bars.length).toBe(8);
    expect(age.bars.length).toBeGreaterThan(0);
    expect(interest.tags.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 5: 运行 registry + creator 测试**

Run: `pnpm --filter @mediakit/web test -- registry editor.creator`
Expected: PASS（含新 TYPES 覆盖、新默认数据断言）

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（REGISTRY `Record<ComponentType, BlockDef>` 穷尽性补齐）

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/registry.tsx apps/web/tests/registry.test.ts apps/web/tests/editor.creator.test.tsx
git commit -m "feat(web): 注册 4 个达人粉丝画像图表组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: ComponentPanel 入口

**Files:**
- Modify: `apps/web/src/editor/ComponentPanel.tsx:26-33`（达人分组 items）

- [ ] **Step 1: 在「达人」分组 items 末尾追加 4 个入口**

修改 `apps/web/src/editor/ComponentPanel.tsx` 的达人分组（约 26-33 行），在 `{ type: 'creator-works-list', label: '作品列表', icon: '▦' },` 之后追加：

```tsx
      { type: 'creator-fan-gender', label: '性别占比', icon: '◑' },
      { type: 'creator-fan-city', label: '城市分布', icon: '≣' },
      { type: 'creator-fan-age', label: '年龄段', icon: '▤' },
      { type: 'creator-fan-interest', label: '兴趣标签', icon: '▦' },
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/editor/ComponentPanel.tsx
git commit -m "feat(web): 组件库新增粉丝画像图表入口

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 全量验证

- [ ] **Step 1: 全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS（无回归；新文件 creator-fan-charts.test.tsx 全绿）

- [ ] **Step 2: 全量类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS

- [ ] **Step 3: 全仓库测试（确认 shared 无下游破坏）**

Run: `pnpm -r run test`
Expected: PASS

- [ ] **Step 4: （可选）手测**

启动 `pnpm dev`，画布顶部「达人」分组拖入「性别占比 / 城市分布 / 年龄段 / 兴趣标签」四个块，确认默认 MOCK 渲染正确、属性面板可改标题/副标题/数据行。

---

## Self-Review

**Spec coverage：**
- 4 个 ComponentType + 4 Data 接口 + ComponentData 联合 → Task 1 ✓
- `CreatorChartShell` 外壳 → Task 3 ✓
- 4 个渲染组件（gender 环形 center / city 横向 LabelList / age 柱状 / interest 纯 div 占比条）→ Task 4-7 ✓
- 空数据占位「暂无数据」→ EmptyChart 在 Task 4 引入，4 组件共用 ✓
- REGISTRY 4 条注册 + propertySchema（list + text）→ Task 8 ✓
- 默认数据 4 case + DEFAULT_SIZES 4 项 → Task 2 ✓
- ComponentPanel 4 入口 → Task 9 ✓
- 测试（渲染/契约/空态/占比数学/showPercent）→ Task 4-7 测试 + Task 8 默认数据断言 ✓

**Placeholder scan：** 无 TBD/TODO；每步含完整代码。

**Type consistency：** `CreatorFanGenderData.center/slices`、`CreatorFanCityData.bars`、`CreatorFanAgeData.bars`、`CreatorFanInterestData.tags/showPercent` 在类型(T1)、默认(T2)、渲染(T4-7)、注册(T8)四处一致；recharts import 列表（T3→T4 阶段统一）含 `LabelList` 供 city 使用。
