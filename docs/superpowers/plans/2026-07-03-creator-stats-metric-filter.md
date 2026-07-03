# 达人数据条 — 指标筛选与文案编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `creator-stats-strip` 组件上新增「指标库勾选启用」筛选 + 每个已选指标的 label/value/color 文案编辑。

**Architecture:** 给 stat 项加可选 `key` / `selected` 字段（向后兼容），渲染层过滤 `selected !== false`；属性面板新增自定义区块 `CreatorStatsFields`，渲染指标库勾选清单 + 已选项文案编辑行；写入走现有 `updateComponentData` + `commit()`，不改 store。

**Tech Stack:** React + TypeScript + Zustand + Vitest + @testing-library/react，monorepo（`@mediakit/shared`）。

参考 spec：`docs/superpowers/specs/2026-07-03-creator-stats-metric-filter-design.md`

---

## File Structure

- Modify: `packages/shared/src/index.ts` — 抽出 `CreatorStatItem`，加 `key?` / `selected?`；导出 `CREATOR_METRIC_CATALOG`。
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx` — `CreatorStatsStrip` 过滤可见项后分发。
- Modify: `apps/web/src/editor/defaults.ts` — 默认 4 项补 `key` + `selected: true`。
- Modify: `apps/web/src/editor/registry.tsx` — 移除 `creator-stats-strip` 的 `propertySchema`（改由自定义区块负责）。
- Modify: `apps/web/src/editor/PropertyPanel.tsx` — 新增 `CreatorStatsFields` 区块 + 注入。
- Test: `apps/web/tests/editor.creator.test.tsx` — 渲染过滤 + 向后兼容。
- Test: `apps/web/tests/editor.scenario.test.ts` — 勾选启停 / 文案修改经 store 持久化。

---

## Task 1: 数据模型 — CreatorStatItem + 指标库常量

**Files:**
- Modify: `packages/shared/src/index.ts`（`CreatorStatsStripData` 定义处，约 245-250 行）

- [ ] **Step 1: 写失败测试 — 指标库与字段类型**

新增测试文件 `apps/web/tests/shared.types.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { CREATOR_METRIC_CATALOG, type CreatorStatItem } from '@mediakit/shared';

describe('creator stat types & catalog', () => {
  it('catalog has 8 standard metrics with stable keys', () => {
    const keys = CREATOR_METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual([
      'followers', 'engagement', 'reach', 'impressions',
      'cpm', 'cpe', 'completion', 'growth',
    ]);
    for (const m of CREATOR_METRIC_CATALOG) {
      expect(typeof m.label).toBe('string');
      expect(typeof m.color).toBe('string');
      expect(typeof m.placeholder).toBe('string');
    }
  });

  it('CreatorStatItem accepts optional key/selected', () => {
    const item: CreatorStatItem = { label: '粉丝', value: '1M', color: '#FF5C00' };
    const full: CreatorStatItem = { key: 'followers', label: '粉丝', value: '1M', color: '#FF5C00', selected: true };
    expect(item.selected).toBeUndefined();
    expect(full.selected).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/shared.types.test.ts`
Expected: FAIL — `CREATOR_METRIC_CATALOG` / `CreatorStatItem` 未导出。

- [ ] **Step 3: 实现 — 修改 shared 类型**

在 `packages/shared/src/index.ts` 中，把现有：

```ts
export type CreatorStatsVariant = 'cards' | 'plain' | 'metric';
export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: { label: string; value: string; color: string }[];
}
```

替换为：

```ts
export type CreatorStatsVariant = 'cards' | 'plain' | 'metric';

/** 达人数据条单项。key 命中指标库；selected 缺省视为 true（向后兼容）。 */
export interface CreatorStatItem {
  key?: string;
  label: string;
  value: string;
  color: string;
  selected?: boolean;
}

export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: CreatorStatItem[];
}

/** 常用达人指标库（属性面板勾选用）。 */
export const CREATOR_METRIC_CATALOG: {
  key: string;
  label: string;
  color: string;
  placeholder: string;
}[] = [
  { key: 'followers', label: '粉丝数', color: '#FF5C00', placeholder: '1.28M' },
  { key: 'engagement', label: '互动率', color: '#3B82F6', placeholder: '8.7%' },
  { key: 'reach', label: '平均触达', color: '#22C55E', placeholder: '640K' },
  { key: 'impressions', label: '曝光量', color: '#8B5CF6', placeholder: '12.6M' },
  { key: 'cpm', label: 'CPM', color: '#EC4899', placeholder: '¥120' },
  { key: 'cpe', label: 'CPE', color: '#14B8A6', placeholder: '¥3.2' },
  { key: 'completion', label: '完播率', color: '#F59E0B', placeholder: '42%' },
  { key: 'growth', label: '粉丝增量', color: '#6366F1', placeholder: '+38K' },
];
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/shared.types.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/shared/src/index.ts apps/web/tests/shared.types.test.ts
git commit -m "feat(shared): CreatorStatItem + CREATOR_METRIC_CATALOG 指标库"
```

---

## Task 2: 渲染层 — 过滤 selected

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx:115-120`
- Test: `apps/web/tests/editor.creator.test.tsx`

- [ ] **Step 1: 写失败测试 — selected:false 不渲染**

在 `apps/web/tests/editor.creator.test.tsx` 的 `describe('creator business components — render', ...)` 块末尾加：

```ts
  it('stats strip hides items with selected:false', () => {
    render(
      <CreatorStatsStrip
        data={{
          variant: 'cards',
          stats: [
            { label: '粉丝', value: '1.28M', color: '#FF5C00' },
            { label: '互动率', value: '8.7%', color: '#3B82F6', selected: false },
          ],
        }}
      />,
    );
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.queryByText('互动率')).not.toBeInTheDocument();
  });

  it('stats strip shows all items when selected absent (backward compat)', () => {
    render(
      <CreatorStatsStrip
        data={{
          variant: 'metric',
          stats: [
            { label: '粉丝', value: '1M', color: '#FF5C00' },
            { label: '曝光', value: '2M', color: '#8B5CF6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.getByText('曝光')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试，确认失败（新 case）**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.creator.test.tsx`
Expected: 第一个新 case FAIL（互动率 仍被渲染）。

- [ ] **Step 3: 实现 — CreatorStatsStrip 过滤**

把 `CreatorComponents.tsx` 的：

```ts
export function CreatorStatsStrip({ data }: { data: CreatorStatsStripData }) {
  const { variant = 'cards', stats = [] } = data;
  if (variant === 'plain') return <StatsPlain stats={stats} />;
  if (variant === 'metric') return <StatsMetric stats={stats} />;
  return <StatsCards stats={stats} />;
}
```

改为：

```ts
export function CreatorStatsStrip({ data }: { data: CreatorStatsStripData }) {
  const { variant = 'cards', stats = [] } = data;
  // selected 缺省视为 true（向后兼容）；selected:false 不渲染。
  const visible = stats.filter((s) => s.selected !== false);
  if (variant === 'plain') return <StatsPlain stats={visible} />;
  if (variant === 'metric') return <StatsMetric stats={visible} />;
  return <StatsCards stats={visible} />;
}
```

（同时把 import 行的 `CreatorStatsStripData` 保留；类型已含 `CreatorStatItem`，无需改 import。）

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.creator.test.tsx`
Expected: PASS（全部 case）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/editor.creator.test.tsx
git commit -m "feat(web): 达人数据条按 selected 过滤渲染"
```

---

## Task 3: 默认数据 — 补 key + selected

**Files:**
- Modify: `apps/web/src/editor/defaults.ts:113-122`

- [ ] **Step 1: 写失败测试 — 默认数据带 key/selected**

在 `apps/web/tests/editor.creator.test.tsx` 的 `describe('creator business components — defaults / registry', ...)` 块（约第 90 行起）内加：

```ts
  it('creator-stats-strip default stats carry catalog keys + selected:true', () => {
    const data = getDefaultData('creator-stats-strip');
    const keys = data.stats.map((s) => s.key);
    expect(keys).toEqual(['followers', 'engagement', 'reach', 'impressions']);
    expect(data.stats.every((s) => s.selected === true)).toBe(true);
  });
```

> 若该 describe 块顶部未 import `getDefaultData`，在文件 import 区补：`import { getDefaultData } from '@/editor/defaults';`（已有则跳过）。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.creator.test.tsx`
Expected: FAIL（默认 stats 无 key / selected）。

- [ ] **Step 3: 实现 — 修改 defaults**

把 `defaults.ts` 的 `case 'creator-stats-strip':` 返回体：

```ts
    case 'creator-stats-strip':
      return {
        variant: 'cards',
        stats: [
          { label: '粉丝', value: '1.28M', color: '#FF5C00' },
          { label: '互动率', value: '8.7%', color: '#3B82F6' },
          { label: '平均触达', value: '640K', color: '#22C55E' },
          { label: '曝光', value: '12.6M', color: '#8B5CF6' },
        ],
      };
```

改为：

```ts
    case 'creator-stats-strip':
      return {
        variant: 'cards',
        stats: [
          { key: 'followers', label: '粉丝', value: '1.28M', color: '#FF5C00', selected: true },
          { key: 'engagement', label: '互动率', value: '8.7%', color: '#3B82F6', selected: true },
          { key: 'reach', label: '平均触达', value: '640K', color: '#22C55E', selected: true },
          { key: 'impressions', label: '曝光', value: '12.6M', color: '#8B5CF6', selected: true },
        ],
      };
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.creator.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/defaults.ts apps/web/tests/editor.creator.test.tsx
git commit -m "feat(web): 达人数据条默认数据补 key/selected"
```

---

## Task 4: registry — 移除重复的 list 字段

**Files:**
- Modify: `apps/web/src/editor/registry.tsx:195-205`
- Test: `apps/web/tests/registry.test.ts`

- [ ] **Step 1: 写失败测试 — propertySchema 不再含 list 字段**

在 `apps/web/tests/registry.test.ts` 末尾加：

```ts
import { REGISTRY } from '@/editor/registry';

describe('creator-stats-strip registry', () => {
  it('defers stats editing to custom panel (no list field in propertySchema)', () => {
    const def = REGISTRY['creator-stats-strip'];
    expect(def.propertySchema).toEqual([]);
  });
});
```

> 若文件已 import `REGISTRY`，跳过重复 import。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediaket/web exec vitest run apps/web/tests/registry.test.ts`（注意拼写：`@mediakit/web`）
Expected: FAIL（propertySchema 仍含 `{ key: 'stats', kind: 'list' }`）。

- [ ] **Step 3: 实现 — 清空 propertySchema**

把 `registry.tsx` 的：

```ts
  'creator-stats-strip': {
    Component: CreatorStatsStrip,
    defaultSize: DEFAULT_SIZES['creator-stats-strip'],
    defaultData: () => getDefaultData('creator-stats-strip'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'plain', label: '极简' },
      { id: 'metric', label: '指标' },
    ],
    propertySchema: [{ key: 'stats', label: '数据项', kind: 'list' }],
  },
```

改为：

```ts
  'creator-stats-strip': {
    Component: CreatorStatsStrip,
    defaultSize: DEFAULT_SIZES['creator-stats-strip'],
    defaultData: () => getDefaultData('creator-stats-strip'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'plain', label: '极简' },
      { id: 'metric', label: '指标' },
    ],
    // stats 由 PropertyPanel 的自定义区块 CreatorStatsFields 负责（指标库勾选 + 文案编辑）。
    propertySchema: [],
  },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/registry.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/registry.tsx apps/web/tests/registry.test.ts
git commit -m "refactor(web): 达人数据条 stats 改由自定义区块编辑"
```

---

## Task 5: PropertyPanel — CreatorStatsFields 区块

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（顶部 import + 第 59 行注入 + 文件底部新增组件）
- Test: `apps/web/tests/editor.scenario.test.ts`

- [ ] **Step 1: 写失败测试 — 勾选启停 + 文案修改经 store 持久化**

在 `apps/web/tests/editor.scenario.test.ts` 文件顶部 import 区确认有 `useEditorStore`（已有）。在文件末尾追加：

```ts
describe('达人数据条 — 指标筛选与文案（store 持久化）', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('updateComponentData 切换 selected 后影响数据', () => {
    const id = 'c1';
    useEditorStore.getState().addPagesBatch([
      {
        name: 'p',
        components: [
          {
            id, type: 'creator-stats-strip', x: 0, y: 0, w: 400, h: 120,
            data: {
              variant: 'cards',
              stats: [
                { key: 'followers', label: '粉丝', value: '1M', color: '#FF5C00', selected: true },
                { key: 'engagement', label: '互动率', value: '8%', color: '#3B82F6', selected: true },
              ],
            },
          },
        ],
      },
    ]);
    useEditorStore.getState().updateComponentData(id, {
      stats: [
        { key: 'followers', label: '粉丝', value: '1M', color: '#FF5C00', selected: true },
        { key: 'engagement', label: '互动率', value: '8%', color: '#3B82F6', selected: false },
      ],
    });
    const comp = useEditorStore.getState().currentPage()!.components[0];
    const stats = (comp.data as { stats: { selected?: boolean }[] }).stats;
    expect(stats[1].selected).toBe(false);
    expect(stats[0].selected).toBe(true);
  });

  it('updateComponentData 修改文案 value 持久化', () => {
    const id = 'c2';
    useEditorStore.getState().addPagesBatch([
      {
        name: 'p',
        components: [
          {
            id, type: 'creator-stats-strip', x: 0, y: 0, w: 400, h: 120,
            data: {
              variant: 'cards',
              stats: [{ key: 'followers', label: '粉丝', value: '1M', color: '#FF5C00', selected: true }],
            },
          },
        ],
      },
    ]);
    useEditorStore.getState().updateComponentData(id, {
      stats: [{ key: 'followers', label: '粉丝数', value: '2.5M', color: '#FF5C00', selected: true }],
    });
    const comp = useEditorStore.getState().currentPage()!.components[0];
    const s = (comp.data as { stats: { label: string; value: string }[] }).stats[0];
    expect(s.label).toBe('粉丝数');
    expect(s.value).toBe('2.5M');
  });
});
```

- [ ] **Step 2: 运行测试，确认通过（store 行为已具备）**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.scenario.test.ts`
Expected: PASS（这两个用例验证 store 路径；UI 在后续步骤接入）。若失败，先确认 `updateComponentData` 签名与 `addPagesBatch` 用法（参考同文件 139-170 行 updatePage 块）。

- [ ] **Step 3: 实现 — 顶部 import**

在 `PropertyPanel.tsx` 顶部 import 区加：

```ts
import { CREATOR_METRIC_CATALOG, type CreatorStatItem, type CreatorStatsStripData } from '@mediakit/shared';
```

（已有 `EditorComponent, ComponentData` 的 import 行；可合并到该行。）

- [ ] **Step 4: 实现 — 注入自定义区块**

把第 59 行：

```tsx
      {comp.type === 'business-block' && <BusinessFields comp={comp} />}
```

改为：

```tsx
      {comp.type === 'business-block' && <BusinessFields comp={comp} />}

      {comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}
```

- [ ] **Step 5: 实现 — 新增 CreatorStatsFields 组件**

在 `PropertyPanel.tsx` 文件底部（`BindingEditor` 之后）追加：

```tsx
/* --------------------------- 达人数据条字段 ---------------------------- */

/** 达人数据条：指标库勾选筛选 + 已选指标文案编辑。 */
function CreatorStatsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorStatsStripData;
  const stats = data.stats ?? [];

  const write = (next: CreatorStatItem[]) => {
    updateComponentData(comp.id, { stats: next } as Partial<CreatorStatsStripData>);
    commit();
  };

  // 命中指标库：存在同 key 且 selected !== false 视为启用。
  const isEnabled = (key: string) =>
    stats.some((s) => s.key === key && s.selected !== false);

  const toggle = (key: string) => {
    const meta = CREATOR_METRIC_CATALOG.find((m) => m.key === key)!;
    const existing = stats.find((s) => s.key === key);
    if (existing) {
      // 切换 selected（保留文案）。
      write(stats.map((s) => (s.key === key ? { ...s, selected: s.selected === false } : s)));
    } else {
      // 首次启用：用指标库默认 label/color，value 留空待用户填。
      write([...stats, { key, label: meta.label, value: '', color: meta.color, selected: true }]);
    }
  };

  const setItem = (i: number, patch: Partial<CreatorStatItem>) =>
    write(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const visible = stats.filter((s) => s.selected !== false);

  return (
    <FieldGroup title="达人数据">
      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">筛选指标</div>
        <div className="grid grid-cols-2 gap-1">
          {CREATOR_METRIC_CATALOG.map((m) => (
            <label key={m.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={isEnabled(m.key)}
                onChange={() => toggle(m.key)}
                className="h-3 w-3"
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">文案修改</div>
        {visible.length === 0 && <p className="text-foreground-muted">请先勾选要展示的指标。</p>}
        <div className="space-y-1">
          {visible.map((s) => {
            const idx = stats.indexOf(s);
            return (
              <div key={s.key ?? idx} className="flex items-center gap-1">
                <input
                  value={s.label}
                  onChange={(e) => setItem(idx, { label: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  value={s.value}
                  placeholder={CREATOR_METRIC_CATALOG.find((m) => m.key === s.key)?.placeholder ?? ''}
                  onChange={(e) => setItem(idx, { value: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => setItem(idx, { color: e.target.value })}
                  className="h-6 w-6 rounded border border-border-default"
                />
              </div>
            );
          })}
        </div>
      </div>
    </FieldGroup>
  );
}
```

- [ ] **Step 6: 运行相关测试 + 类型检查**

Run: `pnpm --filter @mediakit/web exec vitest run apps/web/tests/editor.scenario.test.ts apps/web/tests/editor.creator.test.tsx apps/web/tests/registry.test.ts`
Expected: PASS。

Run: `pnpm --filter @mediakit/web exec tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.scenario.test.ts
git commit -m "feat(web): 达人数据条 指标库勾选筛选 + 文案编辑面板"
```

---

## Task 6: 全量回归 + 收尾

**Files:** 无（仅验证）

- [ ] **Step 1: 跑全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: 全绿。

- [ ] **Step 2: 跑类型检查 + 构建**

Run: `pnpm --filter @mediakit/web exec tsc --noEmit && pnpm --filter @mediakit/web build`
Expected: 成功。

- [ ] **Step 3: 手动验证（可选，给用户的说明）**

启动 dev，拖入「达人数据条」组件 → 右侧面板出现「达人数据」分组：勾选/取消指标库项目 → 画布同步显示/隐藏；修改 label/value/color → 画布实时更新；切 variants（卡片/极简/指标）仍生效。

- [ ] **Step 4: 收尾提交（如有遗留改动）**

```bash
git status
# 若有未提交改动：
git add -A && git commit -m "test(web): 达人数据条 指标筛选与文案 全量回归"
```

---

## Self-Review

- **Spec 覆盖**：① 数据模型（key/selected + 指标库）→ Task 1；② 渲染过滤 → Task 2；③ 默认数据补字段 → Task 3；④ registry 移除 list → Task 4；⑤ 自定义面板（筛选 + 文案）→ Task 5；⑥ 测试 → Task 1-5 内联 + Task 6 回归。✓
- **占位扫描**：无 TBD/TODO；每步含完整代码与命令。✓
- **类型一致**：`CreatorStatItem`（Task 1）贯穿 defaults/registry/PropertyPanel/测试；`CREATOR_METRIC_CATALOG` 字段（key/label/color/placeholder）在 Task 1 定义、Task 5 使用一致；`updateComponentData` + `commit()` 与现有 `BusinessFields`/`ListField` 一致。✓
