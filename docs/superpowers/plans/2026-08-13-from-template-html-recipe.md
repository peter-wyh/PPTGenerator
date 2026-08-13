# 从 HTML 模版新建 → 活的 recipe 报告 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 HTML 类型模版新建时产出活的 recipe 报告（绑模版自带 campaign、数据实时、只能改时间段），复用已落地的 `createRecipeVersion`。

**Architecture:** `POST /from-template` 加可选 `reportPeriod` → `projectsService.createFromTemplate` 覆盖 `meta.reportPeriod` → controller 在 `styleType==='ai-html' && campaignId` 时调 `htmlTemplateService.createRecipeVersion` 建活版本；前端弹窗（`CreateFromTemplateDialog`）对 ai-html 模版显示日期输入（默认模版 `reportPeriod`）。

**Tech Stack:** Express + Prisma + Zod（server）、React + Vite + axios（web）、vitest。

**Spec:** `docs/superpowers/specs/2026-08-13-from-template-html-recipe-design.md`

---

## 隔离 / WIP 注意

`projects.*`、`Projects.tsx`、`api/templates.ts`、`CreateFromTemplateDialog.tsx` 是用户**未提交的并发 WIP**。每个 task 先读当前 WIP 状态再改；文件级原子提交，不夹带其它 WIP（`git add <具体文件> && git commit`，记忆 `ide-resets-git-index` / `ff-merge-to-main-with-dirty-tree`）。`POST /from-template` 路由当前**无 validate 中间件**——保持现状，controller 直接读 `req.body`（不新增 schema/validate，匹配既有风格；这是对 spec §5.3 的务实简化）。

## File Map

- **Modify** `apps/server/src/modules/projects/projects.service.ts` — `createFromTemplate` 加 `reportPeriod?` 参，覆盖 `meta.reportPeriod`。
- **Modify** `apps/server/src/modules/projects/projects.controller.ts` — `createFromTemplate` handler 读 `reportPeriod`、建完 project 后对 ai-html+campaignId 调 `createRecipeVersion`；顶部 import `htmlTemplateService`。
- **Modify** `apps/server/src/modules/projects/projects.service.test.ts` — 加 `createFromTemplate` reportPeriod 覆盖用例（扩 prismaMock.template）。
- **Modify** `apps/web/src/api/templates.ts` — `createProjectFromTemplate` 加 `reportPeriod?` 参。
- **Modify** `apps/web/src/components/CreateFromTemplateDialog.tsx` — 对选中 ai-html 模版显示起止日期输入（默认模版 `reportPeriod`）；onSubmit 带 `reportPeriod`。
- **Modify** `apps/web/src/routes/Projects.tsx` — `handleCreateFromTemplate` 签名加 `reportPeriod`，透传 api。

---

## Task 1: service — `createFromTemplate` 支持 reportPeriod 覆盖（TDD）

**Files:**
- Modify: `apps/server/src/modules/projects/projects.service.ts`（`createFromTemplate`，约 330-370 行）
- Test: `apps/server/src/modules/projects/projects.service.test.ts`

- [ ] **Step 1: 扩 prismaMock + 写失败用例**

先读 `projects.service.test.ts` 顶部 `prismaMock`（`vi.hoisted`），确保含 `template.findUnique`（没有就加：在 hoisted 对象里 `template: { findUnique: vi.fn() }`）。在文件末尾追加：

```ts
describe('projects.service · createFromTemplate reportPeriod 覆盖', () => {
  it('传 reportPeriod → 新 project meta.reportPeriod 被覆盖,其余 meta 保留', async () => {
    prismaMock.template.findUnique.mockResolvedValue({
      id: 'tpl1', name: 'TPL', status: 'PUBLISHED', width: 1280, height: 720,
      pages: [] as any, htmlContent: '<html/>',
      meta: { styleType: 'ai-html', campaignId: 'c1', reportPeriod: { startDate: '2026-07-01', endDate: '2026-07-31' } },
    });
    prismaMock.project.findFirst.mockResolvedValue(null); // 无重名
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'prj_new', ownerId: 'u1', createdAt: new Date(), updatedAt: new Date(), ...(data as object) }),
    );

    await projectsService.createFromTemplate('u1', 'tpl1', undefined, {
      startDate: '2026-08-01', endDate: '2026-08-11',
    });

    const createData = (prismaMock.project.create.mock.calls[0][0] as any).data;
    expect(createData.meta.reportPeriod).toEqual({ startDate: '2026-08-01', endDate: '2026-08-11' });
    expect(createData.meta.styleType).toBe('ai-html');
    expect(createData.meta.campaignId).toBe('c1');
    expect(createData.meta.isDefault).toBeUndefined(); // isDefault 仍被剥离
  });

  it('不传 reportPeriod → 沿用模版 reportPeriod', async () => {
    prismaMock.template.findUnique.mockResolvedValue({
      id: 'tpl1', name: 'TPL', status: 'PUBLISHED', width: 1280, height: 720, pages: [] as any,
      meta: { reportPeriod: { startDate: '2026-07-01', endDate: '2026-07-31' } },
    });
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.project.create.mockResolvedValue({ id: 'prj2', ownerId: 'u1', createdAt: new Date(), updatedAt: new Date() });

    await projectsService.createFromTemplate('u1', 'tpl1');

    const createData = (prismaMock.project.create.mock.calls[0][0] as any).data;
    expect(createData.meta.reportPeriod).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm vitest run src/modules/projects/projects.service.test.ts -t createFromTemplate
```
Expected: FAIL（`createFromTemplate` 不接受第 4 参 / reportPeriod 未覆盖）。

- [ ] **Step 3: 改 service 签名 + 覆盖 meta.reportPeriod**

读 `projects.service.ts` 当前 `createFromTemplate`（约 330 行）。把签名加第 4 参，并把 meta 构造改为可覆盖：

```ts
  async createFromTemplate(
    ownerId: string,
    templateId: string,
    name?: string,
    reportPeriod?: { startDate?: string; endDate?: string },
  ): Promise<ProjectDetail> {
    const tpl = await prisma.template.findUnique({ where: { id: templateId } });
    if (!tpl || tpl.status !== 'PUBLISHED') {
      throw ApiError.notFound('Template not found or not published');
    }
    const desiredName = name?.trim() || tpl.name;
    let projectName = desiredName;
    let copyNumber = 0;
    for (;;) {
      const clash = await prisma.project.findFirst({
        where: { name: projectName },
        select: { id: true },
      });
      if (!clash) break;
      copyNumber++;
      projectName = copyNumber === 1 ? `${desiredName} 副本` : `${desiredName} 副本 ${copyNumber}`;
    }
    // 构建 meta(剥 isDefault);reportPeriod 传入则覆盖
    let meta: Record<string, unknown> | undefined;
    if (tpl.meta) {
      const { isDefault: _omit, ...rest } = tpl.meta as Record<string, unknown>;
      void _omit;
      meta = rest;
    }
    if (reportPeriod) meta = { ...(meta ?? {}), reportPeriod };
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: projectName,
      width: tpl.width,
      height: tpl.height,
      pages: JSON.parse(JSON.stringify(tpl.pages)) as unknown as Prisma.InputJsonValue,
      ...(meta ? { meta: meta as unknown as Prisma.InputJsonValue } : {}),
      ...(tpl.htmlContent ? { htmlContent: tpl.htmlContent } : {}),
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
  },
```

- [ ] **Step 4: 跑测试确认通过**

```
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm vitest run src/modules/projects/projects.service.test.ts -t createFromTemplate
```
Expected: 2 passed。再跑全文件 `pnpm vitest run src/modules/projects/projects.service.test.ts` 确认无回归。

- [ ] **Step 5: 提交（原子，2 文件）**

```
git -C /Users/ap/Desktop/PPTGenerator add apps/server/src/modules/projects/projects.service.ts apps/server/src/modules/projects/projects.service.test.ts && git -C /Users/ap/Desktop/PPTGenerator commit -m "feat(projects): createFromTemplate 支持 reportPeriod 覆盖 meta

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: controller — ai-html+campaignId 时建 recipe 版本

**Files:**
- Modify: `apps/server/src/modules/projects/projects.controller.ts`（顶部 import + `createFromTemplate` handler）

- [ ] **Step 1: 加 import**

在 `projects.controller.ts` 顶部 import 段（第 2 行 `import { projectsService }` 附近）加：
```ts
import { htmlTemplateService } from '../html-templates/html-templates.service';
```
（`html-templates.service` 不 import `projects.service`，无循环依赖。）

- [ ] **Step 2: 改 handler——读 reportPeriod + 编排 createRecipeVersion**

读当前 `createFromTemplate` handler（约 42-51 行）。改为：
```ts
  createFromTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { templateId, name, reportPeriod } = req.body as {
      templateId?: string;
      name?: string;
      reportPeriod?: { startDate?: string; endDate?: string };
    };
    if (!templateId) {
      res.status(400).json({ message: 'templateId is required' });
      return;
    }
    const project = await projectsService.createFromTemplate(owner(req), templateId, name, reportPeriod);
    // HTML 模版且绑了 campaign → 建活 recipe 版本(数据实时,只能改周期);否则保留静态 htmlContent 兜底
    const meta = (project.meta ?? {}) as Record<string, unknown>;
    if (meta.styleType === 'ai-html' && meta.campaignId) {
      await htmlTemplateService.createRecipeVersion(project.id, owner(req), { reportPeriod });
    }
    res.status(201).json({ project });
  }),
```
（`owner(req)` 是文件已有的 helper，沿用。）

- [ ] **Step 3: 类型检查**

```
cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit
```
Acceptable：唯一可能存在的预存错误是 `ai-generate.service.ts` 相关（并发 WIP）；本 task 改的 `projects.controller.ts`/`projects.service.ts` 必须无错。

- [ ] **Step 4: 提交（原子，1 文件）**

```
git -C /Users/ap/Desktop/PPTGenerator add apps/server/src/modules/projects/projects.controller.ts && git -C /Users/ap/Desktop/PPTGenerator commit -m "feat(projects): from-template 对 ai-html+campaignId 建活 recipe 版本

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: web api — `createProjectFromTemplate` 加 reportPeriod

**Files:**
- Modify: `apps/web/src/api/templates.ts`（`createProjectFromTemplate`，约 88 行）

- [ ] **Step 1: 加第三参**

```ts
export function createProjectFromTemplate(
  templateId: string,
  name?: string,
  reportPeriod?: { startDate?: string; endDate?: string },
): Promise<ProjectDetail> {
  return api
    .post<{ project: ProjectDetail }>('/projects/from-template', { templateId, name, reportPeriod })
    .then((r) => r.data.project);
}
```

- [ ] **Step 2: 提交（原子，1 文件）**

```
git -C /Users/ap/Desktop/PPTGenerator add apps/web/src/api/templates.ts && git -C /Users/ap/Desktop/PPTGenerator commit -m "feat(web): createProjectFromTemplate 带 reportPeriod

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: `CreateFromTemplateDialog` — ai-html 模版显示日期输入

**Files:**
- Modify: `apps/web/src/components/CreateFromTemplateDialog.tsx`

- [ ] **Step 1: 读当前对话框，定位 Props.onSubmit + 模版列表 + submit()**

读全文。关键：`Props.onSubmit: (values: { templateId: string; name: string }) => void`；`selected = templates.find(t => t.id === selectedId)`；`submit()` 调 `onSubmit({templateId: selected.id, name: ...})`。`TemplateSummary.meta` 含 `styleType`/`reportPeriod`。

- [ ] **Step 2: 加日期 state + 选中模版时回填默认周期**

在组件 state 区加：
```ts
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
```
加 effect：`selectedId` 变化时，把选中模版的 `reportPeriod` 回填到日期输入：
```ts
  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    const rp = (t?.meta as { reportPeriod?: { startDate?: string; endDate?: string } } | undefined)?.reportPeriod;
    setStartDate(rp?.startDate ?? '');
    setEndDate(rp?.endDate ?? '');
  }, [selectedId, templates]);
```
（`useEffect` 已在文件 import。）

- [ ] **Step 3: Props.onSubmit 签名加 reportPeriod**

```ts
  onSubmit: (values: { templateId: string; name: string; reportPeriod?: { startDate?: string; endDate?: string } }) => void;
```

- [ ] **Step 4: 渲染日期输入（仅 ai-html 模版）+ submit 带上**

在模版列表/名称输入之后、按钮之前，加（仅当选中模版是 ai-html 时显示）：
```tsx
      {selected?.meta?.styleType === 'ai-html' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs text-foreground-secondary">
            起始日期
            <input
              aria-label="起始日期"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
            />
          </label>
          <label className="block text-xs text-foreground-secondary">
            结束日期
            <input
              aria-label="结束日期"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
            />
          </label>
          <p className="col-span-2 text-[10px] text-foreground-muted">HTML 报告会按此时间段生成实时数据；创建后可在编辑器里改周期重算。</p>
        </div>
      )}
```
改 `submit()`：
```ts
  const submit = () => {
    if (!selected) return;
    const isAiHtml = selected.meta?.styleType === 'ai-html';
    onSubmit({
      templateId: selected.id,
      name: name.trim() || selected.name,
      ...(isAiHtml ? { reportPeriod: { startDate, endDate } } : {}),
    });
  };
```

- [ ] **Step 5: web 类型检查**

```
cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force
```
Expected: exit 0（你的 4 个改动文件无新错；预存的 63 个 WIP 测试失败与本改动无关）。

- [ ] **Step 6: 提交（原子，1 文件）**

```
git -C /Users/ap/Desktop/PPTGenerator add apps/web/src/components/CreateFromTemplateDialog.tsx && git -C /Users/ap/Desktop/PPTGenerator commit -m "feat(web): CreateFromTemplateDialog 对 ai-html 模版带时间段(默认模版 reportPeriod)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: `Projects.tsx` — handleCreateFromTemplate 透传 reportPeriod

**Files:**
- Modify: `apps/web/src/routes/Projects.tsx`（`handleCreateFromTemplate`，约 171 行）

- [ ] **Step 1: 改签名 + 透传**

读当前 `handleCreateFromTemplate(values: { templateId: string; name: string })`（约 171 行）。改为：
```ts
  async function handleCreateFromTemplate(values: { templateId: string; name: string; reportPeriod?: { startDate?: string; endDate?: string } }) {
    setFromTplLoading(true);
    setFromTplError(null);
    try {
      const p = await createProjectFromTemplate(values.templateId, values.name, values.reportPeriod);
      setShowFromTemplate(false);
      // ai-html 报告进 html-studio(RecipeEditor);其它进编辑器(沿用现有 navigate 逻辑)
      ... // 保持原有的 navigate 不变
    } catch ...
  }
```
（只加 `values.reportPeriod` 透传 + 签名；其余 try/catch/navigate 逻辑不动。`createProjectFromTemplate` 已在文件 import。）

- [ ] **Step 2: web 类型检查**

```
cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force
```
Expected: exit 0。

- [ ] **Step 3: 提交（原子，1 文件）**

```
git -C /Users/ap/Desktop/PPTGenerator add apps/web/src/routes/Projects.tsx && git -C /Users/ap/Desktop/PPTGenerator commit -m "feat(web): handleCreateFromTemplate 透传 reportPeriod

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 验证（tsc + 手动端点）

- [ ] **Step 1: server 全量 tsc + 测试**

```
cd /Users/ap/Desktop/PPTGenerator/apps/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit && pnpm vitest run src/modules/projects/projects.service.test.ts
```
Expected: tsc 你的文件无错；service 测试全绿。

- [ ] **Step 2: 手动端点验证（用 dev token 打 from-template）**

server 在 hot-reload（无需重启）。用一个**真实 ai-html 模版 id**（先 `GET /api/v1/templates?status=PUBLISHED` 找一个 `meta.styleType==='ai-html' && meta.campaignId` 的）打：

```
POST /api/v1/projects/from-template
{ "templateId": "<那个 ai-html 模版 id>", "name": "from-tpl 测试", "reportPeriod": {"startDate":"2026-08-01","endDate":"2026-08-11"} }
→ 201 { project: {...} }
```
然后 `GET /api/v1/html-templates/projects/<新 projectId>/html-versions` 应看到一条 `recipeId:'campaign-report'`、`isActive:true` 的版本，其 `reportContent.trend.labels` = 8/1~8/11。

dev token 签法（HS256，secret=`dev-access-secret-change-me`，sub=`cmr48ukqo000014isepy48i6b`，role=ADMIN）见 recipe G4 用过的 node 片段。

- [ ] **Step 3: 浏览器手测（你侧）**

刷新项目列表 → 「从模板新建」→ 选一个 ai-html 模版 → 弹窗显示日期（默认模版周期）→ 改成 8/1~8/11 → 创建 → 进 html-studio 应是 RecipeEditor + 8 月数据；DataPanel 改周期重算生效。

> 无代码改动。

---

## Self-Review（写完后自查）

1. **Spec 覆盖**：§5.1 service reportPeriod 覆盖→Task 1；§5.2 controller 编排→Task 2；§5.3 schema→务实简化为「不新增 validate,controller 读 body」（plan 顶部已说明）；§6.1 api→Task 3；§6.2 弹窗→Task 4；§6.3 handleCreateFromTemplate→Task 5；§7 边界（无 campaignId 跳过 recipe）→Task 2 的 `if` 守卫；§8 测试→Task 1 单测 + Task 6 手动。全覆盖。
2. **占位符**：每步含完整代码 / 确切命令。
3. **类型一致性**：`reportPeriod?: { startDate?: string; endDate?: string }` 在 service/controller/api/dialog/handleCreateFromTemplate 签名一致；`createRecipeVersion(projectId, ownerId, { reportPeriod })` 与已落地的 service 签名一致；`onSubmit` values 形状 dialog↔Projects.tsx 一致。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-from-template-html-recipe.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 每 task 派新 subagent，task 间 review。
2. **Inline Execution** — 本会话批量执行，带 checkpoint。

Which approach?
