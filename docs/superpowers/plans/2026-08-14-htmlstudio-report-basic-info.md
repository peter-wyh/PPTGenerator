# html-studio 报告基础信息透出 + 编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 html-studio 顶部表头常驻透出报告基础信息标签(业务线/广告主/周期),并支持点「✏️ 编辑」复用现有 `CreateProjectDialog` 模态框编辑全部基础信息字段。

**Architecture:** 纯前端单文件改动(`apps/web/src/routes/HtmlStudio.tsx`)+ 新增一个 vitest 测试文件。表头是 recipe/AI 两种模式共享的 JSX,所以改动对两种模式自动生效。透出 = 从 `project.meta` 构建标签数组并渲染为 pill;编辑 = 复用 `CreateProjectDialog`(edit 模式,`lockScenario`)→ `projectsApi.update` → `setProject` 刷新(标签与下传 `RecipeEditor` 的 `reportPeriod` 自动更新)。**零后端改动**。TDD:先写失败测试 → 实现 → 通过 → 提交。

**Tech Stack:** React + TypeScript + react-router-dom、vitest + @testing-library/react、Tailwind class、`@mediakit/shared`(`formatReportPeriod`)、`@/components/Toast`(`toast.success`)、`@/components/CreateProjectDialog`、`@/api/projects`(`projectsApi`)。

**Spec:** `docs/superpowers/specs/2026-08-14-htmlstudio-report-basic-info-design.md`

---

## File Structure

| 文件 | 职责 | 操作 |
|---|---|---|
| `apps/web/src/routes/HtmlStudio.tsx` | 沉浸式报告工作台;新增表头标签组 + 编辑按钮 + `CreateProjectDialog` 接线 + `handleEditBasicInfo` | Modify |
| `apps/web/src/routes/HtmlStudio.test.tsx` | 覆盖:标签渲染、空值省略、编辑按钮打开对话框 | Create |

**不改**:`CreateProjectDialog`、server schema、prisma、API 路由、`RecipeEditor`。

### 关键既有契约(已核实,直接复用)

- `CreateProjectDialog` props(`apps/web/src/components/CreateProjectDialog.tsx:96-108`):`open / loading? / error? / initial?: { name; width; height; meta? } | null / lockScenario? / title? / submitLabel? / onCancel / onSubmit`。`onSubmit` 签名:`(values: { name; width; height; meta: ProjectMeta; templateId? }) => void`。编辑模式下 `submit` 会先 spread `initial.meta` 再覆盖管理字段(`:327-339`),`canSubmit` 需 `name + businessLine` 非空(`:284-286`)。
- `projectsApi.update(id, patch)`(`apps/web/src/api/projects.ts:15-18`):返回更新后的 `ProjectDetail`(已 `.then(r => r.data.project)`)。patch 形状 `{ name?; width?; height?; meta? }` 与对话框 `onSubmit` 的 values **直接兼容**。
- `formatReportPeriod(rp: ReportPeriod, scenarioSub?: string): string`(`packages/shared/src/theme/utils.ts:268`):`{ month: '2026-08' }` → `"2026年8月"`;`{ startDate, endDate }` → `"2026-08-01 ~ 2026-08-31"`;无值 → `''`。
- 标签 pill 样式参考 `EditorTopbar.tsx:111-118`:`hidden rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary md:inline`。
- `HtmlStudio.tsx:138-141` 已用 `project?.meta?.campaignId` / `project?.meta?.reportPeriod` 派生状态(在所有 early-return 之前,project 可能为 null → 用可选链)。`HtmlStudio.tsx:22` 现有 `import type { ProjectDetail, ProjectMeta } from '@mediaket/shared'` 是 typo 包名(缺 `i`),本计划顺手合并修正为 `@mediakit/shared`。

### 命令约定(已验证可运行)

- 单测:`cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/routes/HtmlStudio.test.tsx`
- 全量 web 测:`cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run`
- 类型检查(CI 闸):`cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`
- 仓库根提交需原子 `git add <精确文件> && git commit`(IDE 会跨调用清暂存区)。

---

## Task 1: 表头透出报告基础信息标签(display)

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`(import + 派生 `basicInfoTags` + 表头标签 JSX)
- Create: `apps/web/src/routes/HtmlStudio.test.tsx`

- [ ] **Step 1: 写失败测试(标签渲染 + 空值省略)**

创建 `apps/web/src/routes/HtmlStudio.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mock 路由 hooks(避免 MemoryRouter 包裹) ──
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'p1' }), useNavigate: () => vi.fn() };
});

// ── mock API:projects(默认带业务线/广告主/周期) ──
const fullProject = {
  id: 'p1',
  name: '季度复盘',
  width: 1920,
  height: 1080,
  pages: [],
  meta: {
    businessLine: 'DG',
    advertiser: '花西子',
    scenarioSub: 'monthly',
    reportPeriod: { month: '2026-08', startDate: '2026-08-01', endDate: '2026-08-31' },
  },
};
vi.mock('@/api/projects', () => ({
  projectsApi: {
    get: vi.fn().mockResolvedValue(fullProject),
    getHtml: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(fullProject),
  },
}));

// ── mock API:html-templates(无版本 → AI 模式,不进 RecipeEditor) ──
vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    listHtmlVersions: vi.fn().mockResolvedValue([]),
    getHtmlVersion: vi.fn().mockResolvedValue(null),
  },
  // 类型具名导出(Json),仅占位
}));

// ── mock 重子组件,隔离表头行为 ──
vi.mock('@/editor/components/AiGenerateForm', () => ({
  AiGenerateForm: () => <div data-testid="ai-form" />,
}));

// ── mock toast ──
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { projectsApi } from '@/api/projects';
import { HtmlStudio } from './HtmlStudio';

beforeEach(() => vi.clearAllMocks());

describe('HtmlStudio 表头基础信息', () => {
  it('从 meta 透出 业务线/广告主/周期 标签', async () => {
    render(<HtmlStudio />);
    await waitFor(() => expect(projectsApi.get).toHaveBeenCalledWith('p1'));
    expect(screen.getByText('DG')).toBeTruthy();
    expect(screen.getByText('花西子')).toBeTruthy();
    expect(screen.getByText('2026年8月')).toBeTruthy();
  });

  it('meta 缺字段时不渲染对应标签', async () => {
    projectsApi.get.mockResolvedValueOnce({
      id: 'p1',
      name: '空报告',
      width: 1920,
      height: 1080,
      pages: [],
      meta: {},
    });
    render(<HtmlStudio />);
    await waitFor(() => expect(projectsApi.get).toHaveBeenCalled());
    expect(screen.queryByText('DG')).toBeNull();
    expect(screen.queryByText('花西子')).toBeNull();
    expect(screen.queryByText('2026年8月')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/routes/HtmlStudio.test.tsx`
Expected: FAIL — `screen.getByText('DG')` 抛 Unable to find(表头当前只显示 `· {project.name}`,无标签)。

- [ ] **Step 3: 修正 import 包名 + 引入 formatReportPeriod**

Modify `apps/web/src/routes/HtmlStudio.tsx:22`:

旧:
```ts
import type { ProjectDetail, ProjectMeta } from '@mediaket/shared';
```
新:
```ts
import { type ProjectDetail, type ProjectMeta, formatReportPeriod } from '@mediakit/shared';
```
> 顺带把 typo 包名 `@mediaket/shared` 修正为正确包名 `@mediakit/shared`;`type` 内联修饰保留类型只导入语义,同时新增值导入 `formatReportPeriod`。

- [ ] **Step 4: 派生 basicInfoTags**

在 `apps/web/src/routes/HtmlStudio.tsx` 现有派生(第 138-141 行 `campaignId` / `reportPeriod`)之后紧接插入:

```ts
  // ★ 报告基础信息透出标签(业务线/广告主/周期);空值不进标签。
  const basicInfoTags: string[] = [];
  if (project?.meta?.businessLine) basicInfoTags.push(project.meta.businessLine);
  if (project?.meta?.advertiser) basicInfoTags.push(project.meta.advertiser);
  const periodText = project?.meta?.reportPeriod
    ? formatReportPeriod(project.meta.reportPeriod, project.meta.scenarioSub)
    : '';
  if (periodText) basicInfoTags.push(periodText);
```

- [ ] **Step 5: 表头渲染标签组**

在 `apps/web/src/routes/HtmlStudio.tsx` 表头左 div 内,`{generating && (...)}` 块(约第 657-662 行)之后、左 `</div>`(约第 663 行)之前,插入常驻标签容器(Task 2 会在同容器追加「编辑」按钮):

```tsx
            {/* ★ 报告基础信息透出标签 */}
            <div className="flex items-center gap-1">
              {basicInfoTags.map((t, i) => (
                <span
                  key={i}
                  className="hidden rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary md:inline"
                >
                  {t}
                </span>
              ))}
            </div>
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/routes/HtmlStudio.test.tsx`
Expected: PASS — 2 个用例通过(`DG` / `花西子` / `2026年8月` 渲染;空 meta 时均不存在)。

- [ ] **Step 7: 类型检查**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`
Expected: 无错误退出(0)。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/routes/HtmlStudio.tsx apps/web/src/routes/HtmlStudio.test.tsx && git commit -m "feat(html-studio): 表头透出报告基础信息标签(业务线/广告主/周期)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 编辑入口 — 复用 CreateProjectDialog

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`(state + handler + 编辑按钮 + 对话框渲染 + import)
- Modify: `apps/web/src/routes/HtmlStudio.test.tsx`(新增编辑用例 + 必要 mock)

- [ ] **Step 1: 写失败测试(点编辑 → 对话框以编辑模式打开)**

在 `apps/web/src/routes/HtmlStudio.test.tsx` 顶部 mock 区追加(对话框打开时会调用这些 lookup/campaigns 接口,用 allSettled 容错,但仍需模块存在):

```tsx
vi.mock('@/api/lookup', () => ({
  lookupApi: {
    listBusinessLines: vi.fn().mockResolvedValue([]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/api/campaigns', () => ({ listCampaigns: vi.fn().mockResolvedValue([]) }));
```

在 `describe` 块内追加用例:

```tsx
  it('点「编辑」以编辑模式打开 CreateProjectDialog(标题=编辑报告,名称预填)', async () => {
    render(<HtmlStudio />);
    await waitFor(() => expect(projectsApi.get).toHaveBeenCalledWith('p1'));

    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));

    await waitFor(() => expect(screen.getByText('编辑报告')).toBeTruthy());
    // 名称输入框预填为项目名
    expect((screen.getByDisplayValue('季度复盘') as HTMLInputElement)).toBeTruthy();
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/routes/HtmlStudio.test.tsx`
Expected: FAIL — `getByRole('button', { name: /编辑/ })` 抛 Unable to find(尚无编辑按钮)。

- [ ] **Step 3: 引入 toast 与 CreateProjectDialog**

在 `apps/web/src/routes/HtmlStudio.tsx` 顶部 import 区(`projectsApi` import 之后,约第 20-21 行)追加:

```ts
import { toast } from '@/components/Toast';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
```

- [ ] **Step 4: 新增编辑相关 state**

在 `apps/web/src/routes/HtmlStudio.tsx` 现有 useState 集中(约第 56-58 行 `saved` state 附近)追加:

```ts
  // ★ 报告基础信息编辑对话框
  const [showEdit, setShowEdit] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
```

- [ ] **Step 5: 实现 handleEditBasicInfo**

在 `apps/web/src/routes/HtmlStudio.tsx` 的 `updateAiHtmlStatus` useCallback 之后(约第 155 行后)追加:

```ts
  // ★ 编辑报告基础信息:复用 CreateProjectDialog → PATCH /projects/:id → 刷新 project
  // 仅持久化 + 刷新;不自动重算/重生成(recipe 模式下用户在 DataPanel 手动重新生成)。
  const handleEditBasicInfo = async (values: {
    name: string;
    width: number;
    height: number;
    meta: ProjectMeta;
    templateId?: string;
  }) => {
    if (!id) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await projectsApi.update(id, values);
      setProject(updated);
      setShowEdit(false);
      toast.success('报告信息已更新');
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error?.message ??
        e?.message ??
        '保存失败，请重试';
      setEditError(typeof msg === 'string' ? msg : '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  };
```

- [ ] **Step 6: 在标签容器内追加「编辑」按钮(生成中禁用)**

将 Task 1 Step 5 插入的标签容器替换为「标签 + 编辑按钮」一体容器(编辑按钮始终渲染,生成中 disabled):

```tsx
            {/* ★ 报告基础信息透出标签 + 编辑入口 */}
            <div className="flex items-center gap-1">
              {basicInfoTags.map((t, i) => (
                <span
                  key={i}
                  className="hidden rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary md:inline"
                >
                  {t}
                </span>
              ))}
              <button
                onClick={() => setShowEdit(true)}
                disabled={generating}
                className="rounded px-1.5 py-0.5 text-[10px] text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
                title="编辑报告基础信息"
              >
                ✏️ 编辑
              </button>
            </div>
```

- [ ] **Step 7: 渲染 CreateProjectDialog**

在 `apps/web/src/routes/HtmlStudio.tsx` 根 `<div>` 闭合前(即 `ResizablePanels` / `RecipeEditor` 三元之后、最外层 `</div>` 之前,约第 723 行前)追加:

```tsx
      {/* ★ 报告基础信息编辑对话框(复用 CreateProjectDialog) */}
      <CreateProjectDialog
        open={showEdit}
        loading={editSubmitting}
        error={editError}
        title="编辑报告"
        submitLabel="保存"
        lockScenario
        initial={
          project
            ? {
                name: project.name,
                width: project.width,
                height: project.height,
                meta: project.meta,
              }
            : null
        }
        onCancel={() => !editSubmitting && setShowEdit(false)}
        onSubmit={handleEditBasicInfo}
      />
```

- [ ] **Step 8: 运行测试确认通过(含 Task 1 回归)**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/routes/HtmlStudio.test.tsx`
Expected: PASS — 3 个用例全过(标签渲染、空值省略、编辑对话框打开 + 名称预填)。

- [ ] **Step 9: 类型检查**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`
Expected: 无错误退出(0)。

- [ ] **Step 10: 提交**

```bash
git add apps/web/src/routes/HtmlStudio.tsx apps/web/src/routes/HtmlStudio.test.tsx && git commit -m "feat(html-studio): 编辑入口复用 CreateProjectDialog 编辑报告基础信息

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 全量验证 + 手动核对

**Files:** 无代码改动(仅运行验证;如发现问题再就地修并追加提交)。

- [ ] **Step 1: 全量 web 测试**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run`
Expected: 全绿(新 3 用例 + 既有用例无回归)。

- [ ] **Step 2: 全量类型检查**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`
Expected: 无错误退出(0)。

- [ ] **Step 3: 手动核对(浏览器,两种模式)**

在本地 dev 打开 `http://localhost:5173/projects/cmsg1unro0001lnjr6sb0siy6/html-studio`,逐项核对:

1. **AI 模式**:表头项目名右侧显示 业务线/广告主/周期 标签;点「✏️ 编辑」弹出「编辑报告」对话框,字段预填当前值。
2. 改「报告周期」→ 保存 → 标签周期文本更新;**不**自动重生成(已生成 HTML 不变),符合「仅持久化+刷新」决策。
3. 改「业务线/广告主/创建人」→ 保存 → 标签相应更新;toast「报告信息已更新」。
4. **Recipe 模式**(若有 recipe 版本的项目):表头标签同样显示;改周期保存后,`RecipeEditor` DataPanel 的周期同步更新,点其「重新生成」可按新周期重算。
5. 生成进行中(`生成中` 指示亮起)时「编辑」按钮置灰不可点。
6. 空字段项目:对应标签不显示,但「编辑」按钮仍在。

- [ ] **Step 4: 若 Step 1-3 发现问题就修复并追加提交;否则无新提交**

如需修,原子提交:`git add <精确文件> && git commit -m "fix(html-studio): <具体问题>"`。

---

## Self-Review(写计划后自查)

- **Spec 覆盖**:§3.1 透出标签 → Task 1;§3.2 编辑对话框 → Task 2 Step 6/7;§3.3 handleEditBasicInfo → Task 2 Step 5;§3.4 生成中禁用 → Task 2 Step 6 `disabled={generating}`;§3.4 两种模式 → 表头共享 JSX,Task 3 Step 3 手动双模核对;§4 改动范围 → 仅 HtmlStudio.tsx + 测试;§5 测试 → Task 1/2 三个用例(提交→update→刷新与生成中禁用涉及 SSE/表单异步,转 Task 3 手动核对,已在计划注明,避免脆弱测试)。
- **占位符扫描**:无 TBD/TODO;每步含完整代码与精确命令。
- **类型一致性**:`basicInfoTags`(Task 1 Step 4)与渲染(Task 1 Step 5 / Task 2 Step 6)同名;`handleEditBasicInfo`(Task 2 Step 5)签名与 `CreateProjectDialog.onSubmit` 契约(`{name;width;height;meta;templateId?}`)一致;`showEdit/editSubmitting/editError`(Task 2 Step 4)在 Step 6/7 与 handler 中引用一致;import 路径统一为正确包名 `@mediakit/shared`。
