# 业务线置顶 + Campaign 按业务线过滤 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建项目对话框把「业务线」做成第一个必填字段，campaign 下拉只显示该业务线的 campaign；编辑器「数据配置」面板同样按项目业务线过滤 campaign。

**Architecture:** 纯前端改动。`CreateProjectDialog` 把 `businessLine` 提到场景之前、所有场景必填，campaign 列表客户端按 `c.businessLine === businessLine` 过滤，切业务线时清空已选 campaign。`DataConfigOverlay` 读取 `projectMeta.businessLine` 过滤 campaign 下拉，存量项目无业务线时显示全部（向后兼容），已绑定 campaign 即便不在过滤结果里仍保留其 option。无服务端 schema / shared 类型改动（`businessLine` 已存在）。

**Tech Stack:** React + TypeScript + zustand + Vitest + @testing-library/react。测试遵循 web-chart-test 约定（只断言 shell 文本）。

**Spec:** `docs/superpowers/specs/2026-07-14-businessline-campaign-filter-design.md`

---

## 基线与隔离说明（执行前必读）

当前 `design/template-project-linking` 工作区有两类未提交改动与本任务相关：

- `CreateProjectDialog.tsx`：工作区已加了一个**可选的** `businessLine` state（`!isCampaign` 条件渲染）+ `styleType` 选择器。**HEAD（已提交）版本没有这两者。**
- `DataConfigOverlay.tsx`：工作区有一处 327 行的无关重写（draft 模式）。**HEAD 版本仍是直接读写 store。**

本计划的代码块基于 **HEAD 已提交版本**编写（即推荐在 worktree-from-HEAD 中执行）。`styleType` 属于另一条并行工作线，**本计划不引入**。

> 若改为「在工作区原地执行」：`CreateProjectDialog` 里那个可选 `businessLine` state 已存在，Task 1 的「新增 state」改为「把现有可选 state 改为必填 + 上移 + 去掉 `!isCampaign`」；`DataConfigOverlay` 因被 327 行重写过，需对照实际代码调整过滤插入点。代码块给的是**终态**，整段替换即可，两种基线都适用。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `apps/web/src/components/CreateProjectDialog.tsx` | 新建/编辑项目表单 | 修改 |
| `apps/web/src/editor/components/DataConfigOverlay.tsx` | 报告数据配置（绑定 campaign） | 修改 |
| `apps/web/tests/create-project-dialog.test.tsx` | CreateProjectDialog 测试 | 新建 |
| `apps/web/tests/data-config-overlay.test.tsx` | DataConfigOverlay 测试 | 新建 |

测试运行（仓库根目录）：
- 单文件：`pnpm --filter @mediakit/web exec vitest run tests/<file>`
- 全量 web 测试：`pnpm --filter @mediakit/web test`
- 类型检查：`pnpm --filter @mediakit/web typecheck`

---

## Task 1: CreateProjectDialog — 业务线置顶必填 + campaign 过滤 + media-kit 合并

**Files:**
- Modify: `apps/web/src/components/CreateProjectDialog.tsx`
- Test: `apps/web/tests/create-project-dialog.test.tsx`

终态区域预览（用于对照；本任务分步替换到这个形态）：

- state：新增 `businessLine`（置顶），删除 `mkBusinessLine`，保留 `mkAdvertiser`。
- `canSubmit`：加 `&& !!businessLine`。
- JSX：业务线 select 移到「项目名称」之后、「场景」之前；去掉 `!isCampaign` 条件（所有场景可见，必填，placeholder 改为「（请选择业务线）」）。
- campaign 下拉：`const visibleCampaigns = campaigns.filter((c) => c.businessLine === businessLine);` 改用它；空时显示「该业务线暂无可选 Campaign」。
- 切业务线 / 切场景时 `setCampaignId('')`。
- media-kit 块：删掉业务线 select，只留广告主。
- `submit`：media-kit 与兜底分支用 `businessLine`。

- [ ] **Step 1: 新建测试文件骨架 + listCampaigns mock + 业务线必填测试**

Create `apps/web/tests/create-project-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import type { Campaign } from '@mediakit/shared';

/* listCampaigns 默认带 300ms setTimeout；统一 mock 成同步 Promise，
   并提供跨业务线的 fixture 以验证过滤。 */
const FIXTURE: Campaign[] = [
  { id: 'ft-1', name: 'GlowLab Q4', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K' },
  { id: 'ft-2', name: 'GlowLab Summer', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-06-01', endDate: '2026-07-01', budget: '$120K' },
  { id: 'sm-1', name: 'LUMIÈRE Launch', advertiser: 'LUMIÈRE', businessLine: 'SM', platform: 'TikTok', startDate: '2026-09-01', endDate: '2026-09-30', budget: '$520K' },
];

vi.mock('@/api/campaigns', () => ({
  listCampaigns: () => Promise.resolve(FIXTURE.map((c) => ({ ...c }))),
}));

const noop = () => {};

describe('CreateProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('业务线为必填：未选时创建按钮禁用，选了才启用', async () => {
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onCancel={noop} onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: '创建' });

    // 只填名称 → 仍禁用（缺业务线）
    await userEvent.type(screen.getByPlaceholderText(/2026 Q4/), '我的项目');
    expect(submit).toBeDisabled();

    // 选业务线 → 启用
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'FT');
    expect(submit).toBeEnabled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: FAIL — `getByLabelText('业务线')` 找不到（HEAD 里业务线 select 在 media-kit 块、label 是「业务线」但仅 media-kit 场景渲染；未选场景时不渲染）。

- [ ] **Step 3: 实现 — 新增 businessLine state、置顶必填、canSubmit**

在 `apps/web/src/components/CreateProjectDialog.tsx`：

① state 声明区，把：
```tsx
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [creator, setCreator] = useState('');

  // campaign（上游 mock）
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState('');

  // media-kit 手动字段
  const [mkBusinessLine, setMkBusinessLine] = useState('');
  const [mkAdvertiser, setMkAdvertiser] = useState('');
```
替换为：
```tsx
  const [name, setName] = useState('');
  // 业务线：置顶必填，campaign 按此过滤
  const [businessLine, setBusinessLine] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [creator, setCreator] = useState('');

  // campaign（上游 mock）
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState('');

  // media-kit 手动字段（广告主；业务线已上移为通用必填）
  const [mkAdvertiser, setMkAdvertiser] = useState('');
```

② init `useEffect` 内，把 `setMkBusinessLine(m?.businessLine ?? '');` 替换为 `setBusinessLine(m?.businessLine ?? '');`。

③ `canSubmit`，把：
```tsx
  const canSubmit =
    !!name.trim() && (!scenario || !isCampaignScenario(scenario as Scenario) || !!campaignId);
```
替换为：
```tsx
  const canSubmit =
    !!name.trim() &&
    !!businessLine &&
    (!scenario || !isCampaignScenario(scenario as Scenario) || !!campaignId);
```

④ JSX：在「项目名称」`<Input ... />` 之后、「场景」`<label>` 之前，插入业务线 select（所有场景可见、必填）：
```tsx
          {/* 业务线（必填，置顶；campaign 据此过滤） */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block font-medium">业务线</span>
            <select
              className={selectCls}
              value={businessLine}
              onChange={(e) => {
                setBusinessLine(e.target.value);
                setCampaignId('');
              }}
            >
              <option value="">（请选择业务线）</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
```

⑤ 删除「场景」`onChange` 里已有的 `setCampaignId('')` 无需改（保留）；业务线 change 也加了 `setCampaignId('')`（④ 已含）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: PASS（业务线 select 现在置顶渲染、必填）。

- [ ] **Step 5: 追加测试 — campaign 按业务线过滤 + 切业务线清空**

在 `describe` 块内追加：

```tsx
  it('选业务线 FT 后，campaign 下拉只显示 FT 的 campaign', async () => {
    render(<CreateProjectDialog open onCancel={noop} onSubmit={noop} />);
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await userEvent.selectOptions(screen.getByLabelText('场景'), 'campaign-report');

    // 等待 FT campaign 选项加载出现（listCampaigns mock 异步 resolve）
    await screen.findByText(/GlowLab Q4/);
    expect(screen.getByText(/GlowLab Summer/)).toBeInTheDocument();
    // SM 的 LUMIÈRE 不应出现
    expect(screen.queryByText(/LUMIÈRE/)).not.toBeInTheDocument();
  });

  it('切业务线后已选 campaign 被清空', async () => {
    render(<CreateProjectDialog open onCancel={noop} onSubmit={noop} />);
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await userEvent.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    // 等待选项加载后再选 campaign
    await screen.findByText(/GlowLab Q4/);
    const campaignSelect = screen.getByLabelText(/^Campaign/) as HTMLSelectElement;
    await userEvent.selectOptions(campaignSelect, 'ft-1');
    expect(campaignSelect.value).toBe('ft-1');

    // 切到 SM → campaign 清空
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'SM');
    expect((screen.getByLabelText(/^Campaign/) as HTMLSelectElement).value).toBe('');
  });

  it('该业务线无 campaign 时下拉显示空态文案', async () => {
    render(<CreateProjectDialog open onCancel={noop} onSubmit={noop} />);
    // DG 业务线在 fixture 中无 campaign
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'DG');
    await userEvent.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await screen.findByText('该业务线暂无可选 Campaign');
  });
```

- [ ] **Step 6: 运行测试确认失败（过滤尚未实现）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: FAIL — campaign 下拉仍显示全部 campaign（含 LUMIÈRE）；切业务线后 value 仍为 'ft-1'。

- [ ] **Step 7: 实现 — campaign 过滤 + 空态**

在 `apps/web/src/components/CreateProjectDialog.tsx`，`selectedCampaign` 那一行之后，新增过滤派生量：

```tsx
  const isCampaign = isCampaignScenario(scenario as Scenario);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const visibleCampaigns = businessLine
    ? campaigns.filter((c) => c.businessLine === businessLine)
    : [];
```

把 campaign 下拉里的：
```tsx
                  <option value="">{campaignsLoading ? '加载中…' : '（选择 Campaign）'}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
```
替换为：
```tsx
                  <option value="">
                    {campaignsLoading
                      ? '加载中…'
                      : visibleCampaigns.length === 0
                        ? '该业务线暂无可选 Campaign'
                        : '（选择 Campaign）'}
                  </option>
                  {visibleCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
```

> 注：`visibleCampaigns` 在未选业务线时为 `[]`，配合必填校验保证选了业务线才看得到 campaign。

- [ ] **Step 8: 运行测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: PASS（3 个新用例 + 必填用例全过）。

- [ ] **Step 9: 追加测试 — media-kit 复用顶层业务线 + 删除 mkBusinessLine**

在 `describe` 块内追加：

```tsx
  it('media-kit 场景：业务线用顶层必填字段，提交时写入 meta.businessLine', async () => {
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onCancel={noop} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/2026 Q4/), 'MediaKit 项目');
    await userEvent.selectOptions(screen.getByLabelText('业务线'), 'CX');
    await userEvent.selectOptions(screen.getByLabelText('场景'), 'media-kit');

    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].meta.businessLine).toBe('CX');
    expect(onSubmit.mock.calls[0][0].meta.scenario).toBe('media-kit');
  });
```

- [ ] **Step 10: 运行测试确认失败（media-kit 仍读 mkBusinessLine，且未删）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: FAIL — `meta.businessLine` 为 undefined（media-kit 分支仍引用已被删的 `mkBusinessLine`，TS 也会报错；运行时 undefined）。

- [ ] **Step 11: 实现 — media-kit 合并到顶层业务线**

在 `apps/web/src/components/CreateProjectDialog.tsx`：

① `submit()` 内，把：
```tsx
    } else if (scenario === 'media-kit') {
      meta.businessLine = mkBusinessLine || undefined;
      meta.advertiser = mkAdvertiser || undefined;
    }
```
替换为：
```tsx
    } else if (scenario === 'media-kit') {
      meta.businessLine = businessLine || undefined;
      meta.advertiser = mkAdvertiser || undefined;
    } else {
      meta.businessLine = businessLine || undefined;
    }
```

② JSX media-kit 块，把「业务线」那个 `<label>`（含 `mkBusinessLine` 的 select）整段删除，只保留「广告主」label：
```tsx
          {/* media-kit：手动选广告主（业务线已上移为通用必填） */}
          {scenario === 'media-kit' && (
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">广告主</span>
              <select className={selectCls} value={mkAdvertiser} onChange={(e) => setMkAdvertiser(e.target.value)}>
                <option value="">（选填）</option>
                {ADVERTISERS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
```

- [ ] **Step 12: 运行全部 CreateProjectDialog 测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/create-project-dialog.test.tsx`
Expected: PASS（全部 5 个用例）。

- [ ] **Step 13: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误（确认 `mkBusinessLine` / `setMkBusinessLine` 已无残留引用）。

- [ ] **Step 14: 提交**

```bash
git add apps/web/src/components/CreateProjectDialog.tsx apps/web/tests/create-project-dialog.test.tsx
git commit -m "feat(create-project): businessLine-first required + campaign filter by business line"
```

---

## Task 2: DataConfigOverlay — 按项目业务线过滤 campaign

**Files:**
- Modify: `apps/web/src/editor/components/DataConfigOverlay.tsx`
- Test: `apps/web/tests/data-config-overlay.test.tsx`

终态：读取 `projectMeta?.businessLine`，campaign 下拉按 `c.businessLine === bl` 过滤；`bl` 为空显示全部；已绑定 campaign 不在结果里时仍拼进下拉。

> **基线注意**：若在「工作区原地」执行，`DataConfigOverlay` 已被 327 行重写为 draft 模式（`useEditorStore.getState()` + 本地 `setReportData` 包装）。过滤逻辑插入点改为该 draft 上下文中的 campaign 列表派生处，但 `projectMeta.businessLine` 的读取方式一致。终态过滤表达式不变。

- [ ] **Step 1: 新建测试文件 + store 种子 + listCampaigns/listCreators mock + 过滤测试**

Create `apps/web/tests/data-config-overlay.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataConfigOverlay } from '@/editor/components/DataConfigOverlay';
import { useEditorStore } from '@/editor/store';
import type { Campaign } from '@mediakit/shared';

const FIXTURE: Campaign[] = [
  { id: 'ft-1', name: 'GlowLab Q4', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K' },
  { id: 'sm-1', name: 'LUMIÈRE Launch', advertiser: 'LUMIÈRE', businessLine: 'SM', platform: 'TikTok', startDate: '2026-09-01', endDate: '2026-09-30', budget: '$520K' },
];

vi.mock('@/api/campaigns', () => ({
  listCampaigns: () => Promise.resolve(FIXTURE.map((c) => ({ ...c }))),
}));
vi.mock('@/api/creators', () => ({
  listCreators: () => Promise.resolve([]),
  listCampaignCreators: () => Promise.resolve([]),
}));

const noop = () => {};

function seedStore(businessLine?: string, boundCampaignId?: string) {
  useEditorStore.setState({
    projectMeta: businessLine ? { businessLine } : null,
    reportData: boundCampaignId
      ? { campaign: { id: boundCampaignId, name: 'Bound', advertiser: 'X', platform: 'TikTok', startDate: '', endDate: '', budget: '' } as never }
      : { campaign: null },
  } as never);
}

describe('DataConfigOverlay', () => {
  beforeEach(() => {
    seedStore();
  });

  it('项目 businessLine=FT 时，campaign 下拉只显示 FT', async () => {
    seedStore('FT');
    render(<DataConfigOverlay onClose={noop} />);
    const select = await screen.findByRole('combobox');
    expect(select.textContent).toContain('GlowLab Q4');
    expect(select.textContent).not.toContain('LUMIÈRE');
  });

  it('项目无 businessLine（存量项目）时，campaign 下拉显示全部', async () => {
    seedStore(undefined);
    render(<DataConfigOverlay onClose={noop} />);
    const select = await screen.findByRole('combobox');
    expect(select.textContent).toContain('GlowLab Q4');
    expect(select.textContent).toContain('LUMIÈRE');
  });

  it('已绑定 campaign 不属于当前业务线时，仍保留其 option', async () => {
    // 业务线 FT，但已绑定的是 SM 的 campaign
    seedStore('FT', 'sm-1');
    render(<DataConfigOverlay onClose={noop} />);
    const select = await screen.findByRole('combobox');
    expect(select.textContent).toContain('GlowLab Q4'); // FT（过滤内）
    expect(select.textContent).toContain('LUMIÈRE');   // 已绑定，保留显示
    expect((select as HTMLSelectElement).value).toBe('sm-1');
  });
});
```

> `findByRole('combobox')`：Campaign tab 默认激活，且该 tab 内仅有一个 `<select>`（campaign 选择）。若断言受 Creator Library 影响，改用 `screen.findByLabelText` 并在实现里给 campaign select 加 `aria-label="Campaign"`（见 Step 3 末尾备注）。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/data-config-overlay.test.tsx`
Expected: FAIL — `businessLine=FT` 时下拉仍含 LUMIÈRE（未过滤）。

- [ ] **Step 3: 实现 — 读取项目业务线 + 过滤 + 已绑定 campaign 保底**

在 `apps/web/src/editor/components/DataConfigOverlay.tsx`：

① 与 `reportData` 同处新增读取项目业务线（HEAD 版本是 `useEditorStore((s) => ...)`)：
```tsx
  const reportData = useEditorStore((s) => s.reportData);
  const setReportData = useEditorStore((s) => s.setReportData);
  const projectBusinessLine = useEditorStore((s) => s.projectMeta?.businessLine);
```

② 在 campaign 列表 `useEffect` 之后（`selectedCampaignId` 附近），新增过滤派生量：
```tsx
  const selectedCampaignId = reportData.campaign?.id ?? '';

  // 按项目业务线过滤；无业务线（存量项目）显示全部；已绑定 campaign 即便不在过滤内也保留
  const visibleCampaigns =
    campaigns?.filter((c) => !projectBusinessLine || c.businessLine === projectBusinessLine) ?? [];
  const boundMissing =
    selectedCampaignId && !visibleCampaigns.some((c) => c.id === selectedCampaignId)
      ? campaigns?.find((c) => c.id === selectedCampaignId) ?? null
      : null;
  const dropdownCampaigns = boundMissing ? [boundMissing, ...visibleCampaigns] : visibleCampaigns;
```

③ 把 campaign `<select>` 里的：
```tsx
                    <option value="">— No campaign —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c.advertiser}）
                      </option>
                    ))}
```
替换为：
```tsx
                    <option value="">— No campaign —</option>
                    {dropdownCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c.advertiser}）
                      </option>
                    ))}
```

> 备注：为提升测试稳健性，可给该 `<select>` 加 `aria-label="Campaign"`，并把测试里的 `findByRole('combobox')` 改为 `screen.findByLabelText('Campaign')`。两者皆可；任选其一保持一致。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/data-config-overlay.test.tsx`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/components/DataConfigOverlay.tsx apps/web/tests/data-config-overlay.test.tsx
git commit -m "feat(data-config): filter campaign dropdown by project business line"
```

---

## Final Verification

- [ ] **Step 1: 全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: 全部 PASS（含既有用例无回归）。

- [ ] **Step 2: 全量类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 无错误。

- [ ] **Step 3: 手动校验（可选）**

启动 web（`pnpm --filter @mediakit/web dev`），新建项目：
- 业务线为第一项且必填（不选无法创建）。
- 选 FT + campaign-report → campaign 下拉只有 GlowLab。
- 切业务线 → campaign 清空。
- 打开既有 FT 项目的「数据配置」→ campaign 下拉只剩 FT。
