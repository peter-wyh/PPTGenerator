# 业绩看板 Campaign 数据导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在业绩看板（`kpi-board`）属性面板新增「从 Campaign 导入」按钮 + 模态框，选择某 campaign 后将其投放表现指标导入看板 `headers`/`rows`，与现有 Excel/CSV 导入并列。

**Architecture:** 给 `Campaign`（shared 类型，前端 mock）加 `metrics?: CampaignMetric[]`，`CampaignMetric` 与 kpi-board 行 `[指标, 数值, 对比]` 同构。新增纯函数 `metricsToRows(metrics)` 做映射（独立可测），新增 `ImportCampaignModal`（内部 `listCampaigns()` 拉取、下拉选择、实时预览、确认回传 `metrics`），PropertyPanel 新增 `ImportCampaignButton` 负责打开模态 + 写入 store。覆盖 `headers`/`rows`、重置 `icons`/`valueColors`、保留 `variant`。

**Tech Stack:** TypeScript · React 18 · Zustand · Vitest + jsdom + @testing-library/react。Monorepo（pnpm workspace），`@mediakit/shared` 以源码 `src/index.ts` 直接被消费（无构建步骤，改完 typecheck 即生效）。

**约定参考：**
- kpi-board 行列约定 `[指标, 数值, 对比]`；对比单元格由渲染器按首字符 `+/-` 自动着色（`ReportComponents.tsx` 的 `KpiBoard`）。
- 现有 Excel 导入 `KpiImportButton`（`apps/web/src/editor/PropertyPanel.tsx:973-1021`）写入方式：`setComponentData(comp.id, { ...comp.data, headers, rows })`。
- 模态参考 `apps/web/src/editor/components/ImportDataModal.tsx`（overlay + 卡片 + 底部确认/取消）。
- 测试约定 [[web-chart-test-convention]]：断言 shell 文本，不依赖图表内部；本特性无图表。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/index.ts` | `CampaignMetric` 类型 + `Campaign.metrics?` | 改 |
| `apps/web/src/api/campaigns.ts` | 给 6 个 mock campaign 各填 6 项投放指标 | 改 |
| `apps/web/src/editor/campaignMetrics.ts` | 纯函数 `metricsToRows(metrics)`：指标 → 看板数据补丁 | 新建 |
| `apps/web/src/editor/components/ImportCampaignModal.tsx` | 选 campaign + 预览 + 确认回传 metrics | 新建 |
| `apps/web/src/editor/PropertyPanel.tsx` | `ImportCampaignButton` + 挂到 kpi-board 分支 | 改 |
| `apps/web/tests/editor.metrics-to-rows.test.ts` | `metricsToRows` 单测 | 新建 |
| `apps/web/tests/editor.import-campaign-modal.test.tsx` | 模态渲染/交互测试 | 新建 |

---

## Task 1: shared 类型 — `CampaignMetric` + `Campaign.metrics`

**Files:**
- Modify: `packages/shared/src/index.ts:112-124`（`Campaign` 接口）

- [ ] **Step 1: 在 `Campaign` 之前新增 `CampaignMetric`，并给 `Campaign` 加 `metrics?`**

把 `packages/shared/src/index.ts` 中现有的：

```ts
/** 上游 Campaign 实体（接入上游接口；demo 中 mock）。 */
export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
}
```

替换为：

```ts
/** Campaign 投放表现指标项；与 kpi-board 行 [指标, 数值, 对比] 同构。 */
export interface CampaignMetric {
  label: string;   // 指标名，如 "花费"
  value: string;   // 数值，如 "¥128,000"
  compare: string; // 对比文本，如 "+15%"（kpi-board 渲染器按首字符 +/- 自动着色）
}

/** 上游 Campaign 实体（接入上游接口；demo 中 mock）。 */
export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
  /** 投放表现指标（供业绩看板「从 Campaign 导入」）。 */
  metrics?: CampaignMetric[];
}
```

- [ ] **Step 2: typecheck 验证**

Run: `pnpm --filter @mediakit/shared typecheck`
Expected: 无错误退出（exit 0）。新增字段为可选，不破坏现有引用。

- [ ] **Step 3: 提交**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): Campaign 类型增加投放表现指标 metrics"
```

---

## Task 2: mock campaign 补充投放指标

**Files:**
- Modify: `apps/web/src/api/campaigns.ts`（`MOCK_CAMPAIGNS` + 顶部 import）

- [ ] **Step 1: 给 import 行补 `CampaignMetric` 类型，并加一个小构造器 `m` 保持 DRY**

把 `apps/web/src/api/campaigns.ts:1` 的：

```ts
import type { Campaign } from '@mediakit/shared';
```

替换为：

```ts
import type { Campaign, CampaignMetric } from '@mediakit/shared';
```

在 import 块与 `MOCK_CAMPAIGNS` 之间（原第 8 行注释之后、`const MOCK_CAMPAIGNS` 之前）插入：

```ts
/** 构造指标项，省去重复字段名。 */
const m = (label: string, value: string, compare: string): CampaignMetric => ({
  label,
  value,
  compare,
});

/** 标准 6 项投放表现指标（顺序即看板行序）。 */
const STANDARD_METRICS: Record<string, CampaignMetric[]> = {
  'camp-glowlab-q4': [
    m('花费', '¥312,400', '+18%'),
    m('展示', '2,840,000', '+12%'),
    m('点击', '89,500', '+9%'),
    m('转化', '5,420', '+22%'),
    m('点击率 (CTR)', '3.15%', '+0.3%'),
    m('投资回报率 (ROAS)', '4.2', '+0.5'),
  ],
  'camp-lumiere-launch': [
    m('花费', '¥498,700', '+6%'),
    m('展示', '1,920,000', '-4%'),
    m('点击', '61,200', '+3%'),
    m('转化', '3,880', '-8%'),
    m('点击率 (CTR)', '3.19%', '+0.2%'),
    m('投资回报率 (ROAS)', '3.4', '-0.2'),
  ],
  'camp-nova-home-618': [
    m('花费', '¥762,000', '+24%'),
    m('展示', '4,310,000', '+15%'),
    m('点击', '142,800', '+18%'),
    m('转化', '8,960', '+31%'),
    m('点击率 (CTR)', '3.31%', '+0.4%'),
    m('投资回报率 (ROAS)', '5.1', '+0.8'),
  ],
  'camp-motion-spring': [
    m('花费', '¥241,300', '-5%'),
    m('展示', '1,180,000', '+2%'),
    m('点击', '28,600', '-6%'),
    m('转化', '1,540', '-9%'),
    m('点击率 (CTR)', '2.42%', '-0.1%'),
    m('投资回报率 (ROAS)', '2.9', '-0.3'),
  ],
  'camp-everyday-bf': [
    m('花费', '¥125,000', '+40%'),
    m('展示', '980,000', '+35%'),
    m('点击', '32,400', '+28%'),
    m('转化', '1,820', '+33%'),
    m('点击率 (CTR)', '3.31%', '+0.5%'),
    m('投资回报率 (ROAS)', '3.6', '+0.4'),
  ],
  'camp-wander-summer': [
    m('花费', '¥358,200', '+11%'),
    m('展示', '1,540,000', '+7%'),
    m('点击', '41,300', '+13%'),
    m('转化', '2,260', '+16%'),
    m('点击率 (CTR)', '2.68%', '+0.2%'),
    m('投资回报率 (ROAS)', '3.9', '+0.3'),
  ],
};
```

- [ ] **Step 2: 给每个 mock campaign 对象加 `metrics`**

为 `MOCK_CAMPAIGNS` 中每个对象，在 `owner: '...'` 行之后加一行 `metrics: STANDARD_METRICS['<该 campaign 的 id>'],`。

示例——第一个 campaign 改为：

```ts
  {
    id: 'camp-glowlab-q4',
    name: 'GlowLab Q4 敏感肌精华上市',
    advertiser: 'GlowLab',
    businessLine: 'FT',
    platform: 'TikTok',
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '¥300K',
    status: '投放中',
    owner: 'alex',
    metrics: STANDARD_METRICS['camp-glowlab-q4'],
  },
```

对其余 5 个（`camp-lumiere-launch`、`camp-nova-home-618`、`camp-motion-spring`、`camp-everyday-bf`、`camp-wander-summer`）做同样的事，`metrics` 取对应 id 的 `STANDARD_METRICS[...]`。

- [ ] **Step 3: typecheck 验证**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: exit 0。`Campaign.metrics` 现已存在，赋值合法。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/api/campaigns.ts
git commit -m "feat(web): mock campaign 补充投放表现指标"
```

---

## Task 3: 纯函数 `metricsToRows`（TDD）

**Files:**
- Test: `apps/web/tests/editor.metrics-to-rows.test.ts`
- Create: `apps/web/src/editor/campaignMetrics.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/editor.metrics-to-rows.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { metricsToRows } from '@/editor/campaignMetrics';
import type { CampaignMetric } from '@mediakit/shared';

describe('metricsToRows', () => {
  const metrics: CampaignMetric[] = [
    { label: '花费', value: '¥128,000', compare: '+15%' },
    { label: '点击', value: '38,500', compare: '-2%' },
  ];

  it('headers 固定为 [指标, 数值, 对比]', () => {
    expect(metricsToRows(metrics).headers).toEqual(['指标', '数值', '对比']);
  });

  it('每条 metric 映射为一行 [label, value, compare]', () => {
    expect(metricsToRows(metrics).rows).toEqual([
      ['花费', '¥128,000', '+15%'],
      ['点击', '38,500', '-2%'],
    ]);
  });

  it('icons / valueColors 长度 = rows 长度，且全为 null', () => {
    const { icons, valueColors, rows } = metricsToRows(metrics);
    expect(icons).toHaveLength(rows.length);
    expect(valueColors).toHaveLength(rows.length);
    expect(icons.every((x) => x === null)).toBe(true);
    expect(valueColors.every((x) => x === null)).toBe(true);
  });

  it('空 metrics → 空 rows / 空 icons / 空 valueColors，headers 仍固定', () => {
    const r = metricsToRows([]);
    expect(r.rows).toEqual([]);
    expect(r.icons).toEqual([]);
    expect(r.valueColors).toEqual([]);
    expect(r.headers).toEqual(['指标', '数值', '对比']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.metrics-to-rows.test.ts`
Expected: FAIL——`Failed to resolve import "@/editor/campaignMetrics"`（模块尚未创建）。

- [ ] **Step 3: 实现 `metricsToRows`**

创建 `apps/web/src/editor/campaignMetrics.ts`：

```ts
import type { CampaignMetric, KpiBoardData } from '@mediakit/shared';

/**
 * 把 Campaign 投放表现指标映射为 kpi-board 数据补丁。
 * - headers 固定 [指标, 数值, 对比]；
 * - 每条 metric → 一行 [label, value, compare]；
 * - icons / valueColors 按行数置空（干净起点；对比单元格由渲染器按 +/- 自动着色）。
 * 保留 variant / iconWeight 由调用处展开（见 ImportCampaignButton）。
 */
export function metricsToRows(
  metrics: CampaignMetric[],
): Pick<KpiBoardData, 'headers' | 'rows' | 'icons' | 'valueColors'> {
  const rows = metrics.map((mm) => [mm.label, mm.value, mm.compare]);
  return {
    headers: ['指标', '数值', '对比'],
    rows,
    icons: rows.map(() => null),
    valueColors: rows.map(() => null),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.metrics-to-rows.test.ts`
Expected: PASS——`Test Files 1 passed`，4 个测试全过。

- [ ] **Step 5: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: exit 0（`KpiBoardData` 的 `icons`/`valueColors` 为可选，`null[]` 可赋值）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/campaignMetrics.ts apps/web/tests/editor.metrics-to-rows.test.ts
git commit -m "feat(web): metricsToRows 映射 campaign 指标到看板行"
```

---

## Task 4: `ImportCampaignModal`（TDD）

**Files:**
- Test: `apps/web/tests/editor.import-campaign-modal.test.tsx`
- Create: `apps/web/src/editor/components/ImportCampaignModal.tsx`

**设计要点：**
- Props：`{ defaultCampaignId?: string; fetchCampaigns?: () => Promise<Campaign[]>; onConfirm: (metrics: CampaignMetric[]) => void; onCancel: () => void }`。`fetchCampaigns` 默认 `listCampaigns`，注入点便于测试「无指标 campaign」分支。
- 内部 `useEffect` 拉取 campaign 列表；列表到达后若当前未选中（或选中不在列表）则默认选第一个。
- 预览 = 选中 campaign 的 `metrics`；为空 → 显示「该 Campaign 暂无可导入的指标」且确认按钮禁用。

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/editor.import-campaign-modal.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportCampaignModal } from '@/editor/components/ImportCampaignModal';
import type { Campaign, CampaignMetric } from '@mediakit/shared';

/* 本组件无图表，按 [[web-chart-test-convention]] 断言 shell 文本。
   listCampaigns 默认带 300ms setTimeout；用 findBy* / waitFor 异步等待。 */

const metrics: CampaignMetric[] = [
  { label: '花费', value: '¥128,000', compare: '+15%' },
  { label: '展示', value: '1,240,000', compare: '+8%' },
];

const withMetrics: Campaign = {
  id: 'c1',
  name: 'Campaign A',
  advertiser: 'A',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  budget: '¥100K',
  metrics,
};

describe('ImportCampaignModal', () => {
  it('加载后默认选中第一个 campaign，预览其指标', async () => {
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByText('花费')).toBeInTheDocument();
    expect(screen.getByText('展示')).toBeInTheDocument();
  });

  it('切换 campaign 更新预览', async () => {
    const c2: Campaign = { ...withMetrics, id: 'c2', name: 'Campaign B', metrics: [{ label: '点击', value: '9,000', compare: '+3%' }] };
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics, c2])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await screen.findByText('花费');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'c2');
    expect(screen.getByText('点击')).toBeInTheDocument();
  });

  it('选中无指标的 campaign → 显示空态、确认禁用', async () => {
    const noMetrics: Campaign = { ...withMetrics, metrics: undefined };
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([noMetrics])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByText('该 Campaign 暂无可导入的指标')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled();
  });

  it('确认时回传当前 campaign 的 metrics', async () => {
    const onConfirm = vi.fn();
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await screen.findByText('花费');
    await userEvent.click(screen.getByRole('button', { name: '确认导入' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(metrics);
  });

  it('取消按钮触发 onCancel', async () => {
    const onCancel = vi.fn();
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await screen.findByText('花费');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.import-campaign-modal.test.tsx`
Expected: FAIL——`Failed to resolve import "@/editor/components/ImportCampaignModal"`。

- [ ] **Step 3: 实现 `ImportCampaignModal`**

创建 `apps/web/src/editor/components/ImportCampaignModal.tsx`：

```tsx
import { useEffect, useState } from 'react';
import type { Campaign, CampaignMetric } from '@mediakit/shared';
import { listCampaigns } from '../../api/campaigns';

interface Props {
  /** 默认预选 campaign（如项目已绑定的 projectMeta.campaignId）。 */
  defaultCampaignId?: string;
  /** 注入式数据源，默认 listCampaigns；便于测试「无指标」等分支。 */
  fetchCampaigns?: () => Promise<Campaign[]>;
  onConfirm: (metrics: CampaignMetric[]) => void;
  onCancel: () => void;
}

export function ImportCampaignModal({
  defaultCampaignId,
  fetchCampaigns = listCampaigns,
  onConfirm,
  onCancel,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(defaultCampaignId ?? '');

  useEffect(() => {
    let alive = true;
    setCampaigns(null);
    setFailed(false);
    fetchCampaigns()
      .then((list) => {
        if (!alive) return;
        setCampaigns(list);
        if (!selectedId || !list.some((c) => c.id === selectedId)) {
          setSelectedId(list[0]?.id ?? '');
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // 仅首屏拉取；selectedId 初值来自 defaultCampaignId，不放进依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCampaigns]);

  const selected = campaigns?.find((c) => c.id === selectedId) ?? null;
  const metrics = selected?.metrics ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          从 Campaign 导入
        </div>

        {failed && <p className="text-xs text-red">加载 Campaign 失败，请重试。</p>}

        {!campaigns && !failed && (
          <p className="text-xs text-foreground-muted">加载中…</p>
        )}

        {campaigns && (
          <>
            <label className="block text-xs text-foreground-secondary">
              <span className="mb-1 block">Campaign</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded border border-border-default p-2">
              <div className="mb-1 text-xs text-foreground-muted">预览（导入到业绩看板）</div>
              {metrics.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-foreground-muted">
                      <th className="text-left font-normal">指标</th>
                      <th className="text-right font-normal">数值</th>
                      <th className="text-right font-normal">对比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((mm, i) => (
                      <tr key={i}>
                        <td className="text-left">{mm.label}</td>
                        <td className="text-right">{mm.value}</td>
                        <td
                          className="text-right"
                          style={{
                            color: mm.compare.trim().startsWith('-')
                              ? 'var(--color-danger, #dc2626)'
                              : 'var(--color-success, #16a34a)',
                          }}
                        >
                          {mm.compare}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-foreground-muted">该 Campaign 暂无可导入的指标</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                取消
              </button>
              <button
                disabled={metrics.length === 0}
                onClick={() => onConfirm(metrics)}
                className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
              >
                确认导入
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.import-campaign-modal.test.tsx`
Expected: PASS——`Test Files 1 passed`，5 个测试全过。

- [ ] **Step 5: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: exit 0。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/components/ImportCampaignModal.tsx apps/web/tests/editor.import-campaign-modal.test.tsx
git commit -m "feat(web): ImportCampaignModal 选 campaign 导入指标"
```

---

## Task 5: PropertyPanel 接入「从 Campaign 导入」按钮

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（顶部 import + 第 84 行 kpi-board 分支 + 新增 `ImportCampaignButton` 函数，置于 `KpiImportButton` 之后）

- [ ] **Step 1: 加 import**

在 `apps/web/src/editor/PropertyPanel.tsx` 现有 import 区（`ImportDataModal` import 附近，约 31-33 行）追加两行：

```ts
import { ImportCampaignModal } from './components/ImportCampaignModal';
import { metricsToRows } from './campaignMetrics';
```

具体：把

```ts
import { ImportDataModal } from './components/ImportDataModal';
import type { ChartData } from './datasource/resolve';
import { parseFile } from './datasource/parse';
```

替换为：

```ts
import { ImportDataModal } from './components/ImportDataModal';
import { ImportCampaignModal } from './components/ImportCampaignModal';
import { metricsToRows } from './campaignMetrics';
import type { ChartData } from './datasource/resolve';
import { parseFile } from './datasource/parse';
```

- [ ] **Step 2: 在 kpi-board 分支挂上 `ImportCampaignButton`**

把第 84 行：

```tsx
      {comp.type === 'kpi-board' && <KpiImportButton comp={comp} />}
```

替换为：

```tsx
      {comp.type === 'kpi-board' && (
        <>
          <KpiImportButton comp={comp} />
          <ImportCampaignButton comp={comp} />
        </>
      )}
```

- [ ] **Step 3: 新增 `ImportCampaignButton` 函数**

在 `KpiImportButton` 函数之后（约第 1021 行 `}` 之后）插入：

```tsx
/** kpi-board：从 Campaign 导入投放表现指标 → 覆盖 headers/rows、重置 icons/valueColors、保留 variant。 */
function ImportCampaignButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const defaultCampaignId = useEditorStore((s) => s.projectMeta?.campaignId);
  const [open, setOpen] = useState(false);

  return (
    <FieldGroup title="从 Campaign 导入">
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        选择 Campaign 导入
      </button>
      <div className="text-[11px] text-foreground-muted">
        导入选中 campaign 的投放表现指标（花费/展示/点击/转化/CTR/ROAS），覆盖当前表格。
      </div>
      {open && (
        <ImportCampaignModal
          defaultCampaignId={defaultCampaignId}
          onConfirm={(metrics) => {
            const patch = metricsToRows(metrics);
            setComponentData(comp.id, { ...comp.data, ...patch });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </FieldGroup>
  );
}
```

- [ ] **Step 4: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: exit 0。`{ ...comp.data, ...patch }` 与现有 `KpiImportButton` 的 `{ ...comp.data, headers, rows }` 同型，可编译。

- [ ] **Step 5: 跑全量测试确认无回归**

Run: `pnpm --filter @mediakit/web test`
Expected: 全部通过（含本轮新增的 2 个测试文件 + 既有用例）。

- [ ] **Step 6: 手动验证（真实 App）**

启动前端（与后端同源代理到 :4000；本特性纯前端，后端非必需）：

```bash
pnpm --filter @mediakit/web dev
```

在浏览器打开编辑器（如 `http://localhost:5173`），进入一个项目编辑页：

1. 从组件面板拖入「业绩看板」组件并选中。
2. 属性面板「数据导入」分组下方出现新的「从 Campaign 导入」分组 + 「选择 Campaign 导入」按钮。
3. 点击 → 弹模态框；下拉默认选中第一个 campaign（若项目已绑定 campaign 则预选它），预览表展示 6 项指标。
4. 切换 campaign → 预览数值随之变化。
5. 点「确认导入」→ 看板表格被覆盖为 6 行指标；对比列 `+` 绿 / `-` 红。
6. 再次打开模态、切到任一 campaign、确认 → 行内图标/颜色被清空（变体仍保留）。
7. 点模态「取消」或遮罩 → 关闭，看板不变。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx
git commit -m "feat(web): 业绩看板属性面板接入 Campaign 导入"
```

---

## Self-Review

**1. Spec 覆盖：**
- §3 数据模型（CampaignMetric + Campaign.metrics）→ Task 1 ✓
- §4 mock 6 项指标 → Task 2 ✓
- §5.1 ImportCampaignModal（下拉/预选/预览/确认/空态/加载态）→ Task 4 ✓（加载失败态 Step 3 内 `failed` 分支覆盖）
- §5.2 ImportCampaignButton + setComponentData 写入 → Task 5 ✓
- §6 覆盖 headers/rows、重置 icons/valueColors、保留 variant → Task 3 `metricsToRows` + Task 5 写入 ✓
- §7 涉及文件清单 → 全部对应 ✓
- §8 测试 → Task 3、Task 4 ✓

**2. 占位扫描：** 无 TBD/TODO；每步含完整代码或确切命令。

**3. 类型一致：** `CampaignMetric`、`metricsToRows`、`ImportCampaignModal`（props：`defaultCampaignId` / `fetchCampaigns` / `onConfirm(metrics)` / `onCancel`）、`ImportCampaignButton` 在各 Task 间命名与签名一致；`onConfirm` 回传 `CampaignMetric[]`（Task 4 定义、Task 5 消费）一致。

无缺口。
