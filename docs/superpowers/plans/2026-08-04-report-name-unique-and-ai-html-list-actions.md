# 报告名全局唯一 + AI HTML 列表操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「报告」(Project) 名称全局唯一(新建/改名/复制/AI 保存四条路径),并在报告列表为 AI HTML 报告提供预览(新标签页)/下载/复制源码操作。

**Architecture:** 报告 = `Project`;AI HTML 报告 = `meta.styleType === 'ai-html'`、HTML 存于 `Project.htmlContent`。唯一性沿用仓库既有约定 —— 纯应用层 `prisma.project.findFirst` + `ApiError.badRequest`(对齐 `templates.service.ts`/`html-templates.service.ts`,不加 DB `@@unique`)。列表三操作走新增的 `GET /projects/:id/html` 按需取 HTML(不塞进 list 响应),前端按行缓存、共用一次 fetch。

**Tech Stack:** Node/Express + Prisma(server)、Zod 校验、React + Vite(web)、Vitest(前后端测试)。错误响应统一形如 `{ error: { code, message } }`(见 `apps/server/src/middleware/error.ts`)。

**Spec:** `docs/superpowers/specs/2026-08-04-report-name-unique-and-ai-html-list-actions-design.md`

---

## File Structure

**Server**
- Modify `apps/server/src/modules/projects/projects.service.ts` — `create`/`update`/`duplicate` 加全局重名校验 + 新增 `getHtml`。
- Create `apps/server/src/modules/projects/projects.service.test.ts` — 上述逻辑的单测(新建文件,沿用 `templates.service.test.ts` 的 prisma mock 模式)。
- Modify `apps/server/src/modules/projects/projects.controller.ts` — 新增 `getHtml` handler。
- Modify `apps/server/src/modules/projects/projects.routes.ts` — 新增 `GET /:id/html`。
- Modify `apps/server/src/modules/html-templates/html-templates.service.ts` — `saveHtmlAsNewProject` 加全局重名校验。
- Create `apps/server/src/modules/html-templates/html-templates.service.test.ts` — `saveHtmlAsNewProject` 重名单测(新建文件)。

**Web**
- Modify `apps/web/src/api/projects.ts` — `projectsApi` 新增 `getHtml`。
- Modify `apps/web/src/routes/Projects.tsx` — ai-html 行新增「HTML ▾」下拉(预览/下载/复制源码);修正 `handleCreate`/`handleEdit` 的错误文案解析(从 `response.data.error.message` 取)。
- Modify `apps/web/tests/projects.page.test.tsx` — mock 增加 `getHtml`;把陈旧的「项目」文案对齐为当前「报告」文案(该文件相对源码已 stale、当前是红的);新增 ai-html 下拉测试 + 建报告重名报错回显测试。
- Modify `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx` — `doSave` catch 改读 `response.data.error.message`,使 AI 保存重名报错能展示。

---

## Task 1: projects.service — create/update/duplicate 全局重名校验(TDD)

**Files:**
- Create: `apps/server/src/modules/projects/projects.service.test.ts`
- Modify: `apps/server/src/modules/projects/projects.service.ts`(create 约 56-113、update 约 124-144、duplicate 约 179-191)

- [ ] **Step 1: 写失败测试(新建测试文件)**

创建 `apps/server/src/modules/projects/projects.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 工厂被提升到文件顶部,用 vi.hoisted 共享 mock 句柄(对齐 templates.service.test.ts)。
const prismaMock = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { projectsService } from './projects.service';

/** 构造一个完整 Project(Prisma 形态:Date、Json 原值、htmlContent可为空)。 */
function makeProject(over: Record<string, unknown> = {}) {
  return {
    id: 'prj_1',
    name: '我的报告',
    ownerId: 'u_ap',
    pages: [{ id: 'p1', name: '第 1 页', components: [] }],
    width: 1280,
    height: 720,
    meta: null,
    htmlContent: null,
    shareToken: null,
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projects.service · create 全局重名校验', () => {
  it('重名 → 400「已存在同名报告」,不执行 create', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(projectsService.create('u_ap', { name: '我的报告' })).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「我的报告」，请使用其他名称',
    });
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it('名称先 trim 再校验/落库', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.create('u_ap', { name: '  我的报告  ' });
    expect(prismaMock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { name: '我的报告' },
    });
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告');
  });
});

describe('projects.service · update 改名校验', () => {
  it('非归属者 → 404,不查重名/不更新', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ ownerId: 'u_other' }));
    await expect(
      projectsService.update('u_ap', 'prj_1', { name: '新名' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

  it('改成他人占用名 → 400,不更新', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject());
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(
      projectsService.update('u_ap', 'prj_1', { name: '撞名' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「撞名」，请使用其他名称',
    });
    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

  it('改成未占用名 → 通过,update 收到 trim 后的名', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject());
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.project.update.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.update('u_ap', 'prj_1', { name: '  新名  ' });
    expect(prismaMock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { name: '新名', id: { not: 'prj_1' } },
    });
    expect(
      (prismaMock.project.update.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('新名');
  });
});

describe('projects.service · duplicate 自动找号', () => {
  it('「X 副本」无冲突 → 用「X 副本」', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ name: '我的报告' }));
    prismaMock.project.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.duplicate('u_ap', 'prj_1');
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告 副本');
  });

  it('「X 副本」已存在 → 用「X 副本 2」', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ name: '我的报告' }));
    prismaMock.project.findFirst
      .mockResolvedValueOnce({ id: 'prj_other' })
      .mockResolvedValueOnce(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.duplicate('u_ap', 'prj_1');
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告 副本 2');
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.service.test.ts`
Expected: FAIL(create/update 未做重名校验,duplicate 仍硬编码「X 副本」)。create 重名用例会因 `prisma.project.create` 被调用而 fail;duplicate 用例会因名字是「我的报告 副本」但没找号逻辑——实际上第一条 duplicate 用例当前实现恰好也产出「我的报告 副本」会意外通过,只有第二条(副本 2)失败。整体 describe 至少一个失败即可。

- [ ] **Step 3: 实现 create 重名校验**

在 `apps/server/src/modules/projects/projects.service.ts` 的 `create` 方法开头(`async create(` 之后、`const meta = input.meta;` 之前)插入:

```ts
    const trimmedName = input.name.trim();
    if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
    const existing = await prisma.project.findFirst({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing)
      throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);
```

并把同一方法 `data` 对象里的 `name: input.name,` 改为 `name: trimmedName,`。

- [ ] **Step 4: 实现 update 改名校验**

把 `update` 方法替换为(保留原签名与字段语义,仅加入重名校验 + trim):

```ts
  async update(
    ownerId: string,
    id: string,
    input: {
      name?: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
    },
  ): Promise<ProjectDetail> {
    await this.getOwnedOrThrow(ownerId, id);

    // 改名时拒绝重名(trim 后全局唯一),与 templates.service.update 一致。
    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
      const clash = await prisma.project.findFirst({
        where: { name: trimmedName, id: { not: id } },
        select: { id: true },
      });
      if (clash)
        throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (trimmedName !== undefined) data.name = trimmedName;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
    if (input.meta !== undefined) data.meta = input.meta as unknown as Prisma.InputJsonValue;
    const project = await prisma.project.update({ where: { id }, data });
    return toDetail(project);
  },
```

- [ ] **Step 5: 实现 duplicate 自动找号**

把 `duplicate` 方法替换为:

```ts
  async duplicate(ownerId: string, id: string): Promise<ProjectDetail> {
    const src = await this.getOwnedOrThrow(ownerId, id);
    // 生成唯一副本名:「X 副本」、「X 副本 2」…(对齐 templates.service.duplicate)
    const baseName = `${src.name} 副本`;
    let copyName = baseName;
    let suffix = 2;
    for (;;) {
      const clash = await prisma.project.findFirst({
        where: { name: copyName },
        select: { id: true },
      });
      if (!clash) break;
      copyName = `${baseName} ${suffix++}`;
    }
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: copyName,
      width: src.width,
      height: src.height,
      // 深拷贝并给每个页面/组件分配新 id，避免引用同一对象。
      pages: JSON.parse(JSON.stringify(src.pages)) as unknown as Prisma.InputJsonValue,
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
  },
```

- [ ] **Step 6: 跑测试,确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.service.test.ts`
Expected: PASS(全部用例)。

- [ ] **Step 7: 回归 templates.service.test.ts(共享 prisma mock 形态,确认未碰)**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/templates/templates.service.test.ts`
Expected: PASS(本任务未改 templates,应全绿;其中 `projects.service · createFromTemplate` describe 依赖 projects.service,确认仍通过)。

- [ ] **Step 8: 提交**

```bash
git add apps/server/src/modules/projects/projects.service.ts apps/server/src/modules/projects/projects.service.test.ts
git commit -m "$(cat <<'EOF'
feat(projects): 报告名全局唯一 — create/update/duplicate 校验

create/update 改名走 findFirst 全局查重 + trim;duplicate 自动找号「X 副本/副本 2」。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: projects.service — getHtml + GET /projects/:id/html(TDD)

**Files:**
- Modify: `apps/server/src/modules/projects/projects.service.test.ts`(追加 describe)
- Modify: `apps/server/src/modules/projects/projects.service.ts`
- Modify: `apps/server/src/modules/projects/projects.controller.ts`
- Modify: `apps/server/src/modules/projects/projects.routes.ts`

- [ ] **Step 1: 追加失败测试**

在 `projects.service.test.ts` 末尾追加:

```ts
describe('projects.service · getHtml', () => {
  it('属主 → 返回 html(htmlContent 缺省为空串)', async () => {
    prismaMock.project.findUnique.mockResolvedValue(
      makeProject({ htmlContent: '<p>hi</p>', ownerId: 'u_ap' }),
    );
    const out = await projectsService.getHtml('u_ap', 'prj_1');
    expect(out).toEqual({
      id: 'prj_1',
      name: '我的报告',
      html: '<p>hi</p>',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
  });

  it('htmlContent 为 null → html: ""', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ htmlContent: null }));
    expect((await projectsService.getHtml('u_ap', 'prj_1')).html).toBe('');
  });

  it('非属主 → 404(不泄露存在性)', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ ownerId: 'u_other' }));
    await expect(projectsService.getHtml('u_ap', 'prj_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('不存在 → 404', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expect(projectsService.getHtml('u_ap', 'nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.service.test.ts`
Expected: FAIL(`projectsService.getHtml is not a function`)。

- [ ] **Step 3: service 增加 getHtml**

在 `projects.service.ts` 的 `projectsService` 对象里(建议放在 `getOwnedOrThrow` 之后)新增:

```ts
  /** 属主读取某报告的 HTML 源码(仅供列表预览/下载/复制)。 */
  async getHtml(
    ownerId: string,
    id: string,
  ): Promise<{ id: string; name: string; html: string; updatedAt: string }> {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true, htmlContent: true, updatedAt: true },
    });
    if (!project || project.ownerId !== ownerId) {
      throw ApiError.notFound('Project not found');
    }
    return {
      id: project.id,
      name: project.name,
      html: project.htmlContent ?? '',
      updatedAt: project.updatedAt.toISOString(),
    };
  },
```

- [ ] **Step 4: controller 增加 getHtml**

在 `projects.controller.ts` 的 `projectsController` 对象里(建议放在 `get` 之后)新增:

```ts
  getHtml: asyncHandler(async (req: Request, res: Response) => {
    res.json(await projectsService.getHtml(owner(req), req.params.id));
  }),
```

- [ ] **Step 5: route 增加 GET /:id/html**

在 `projects.routes.ts` 的 `router.get('/:id', ...)` 这一行之后新增:

```ts
router.get('/:id/html', validate({ params: idParamSchema }), projectsController.getHtml);
```

- [ ] **Step 6: 跑测试,确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.service.test.ts`
Expected: PASS(含新 getHtml 用例)。

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/modules/projects/projects.service.ts apps/server/src/modules/projects/projects.service.test.ts apps/server/src/modules/projects/projects.controller.ts apps/server/src/modules/projects/projects.routes.ts
git commit -m "$(cat <<'EOF'
feat(projects): GET /projects/:id/html — 按需取报告 HTML 源码

供列表「预览/下载/复制源码」三操作按行 fetch,不塞进 list 响应;属主可见、空内容回 ''。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: html-templates.service — saveHtmlAsNewProject 全局重名校验(TDD)

**Files:**
- Create: `apps/server/src/modules/html-templates/html-templates.service.test.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`(`saveHtmlAsNewProject` 约 169-220)

- [ ] **Step 1: 写失败测试(新建测试文件)**

创建 `apps/server/src/modules/html-templates/html-templates.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), create: vi.fn() },
  campaign: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { htmlTemplateService } from './html-templates.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('html-templates.service · saveHtmlAsNewProject 全局重名', () => {
  it('重名 → 400,不建报告、不查 campaign', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(
      htmlTemplateService.saveHtmlAsNewProject('u_ap', {
        html: '<p>x</p>',
        campaignId: 'c1',
        name: '撞名报告',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「撞名报告」，请使用其他名称',
    });
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it('无重名 → 用 trim 后的名建报告', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'prj_new', ...(data as object) }),
    );
    await htmlTemplateService.saveHtmlAsNewProject('u_ap', {
      html: '<p>x</p>',
      campaignId: 'c1',
      name: '  我的 AI 报告  ',
    });
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的 AI 报告');
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/html-templates/html-templates.service.test.ts`
Expected: FAIL(重名用例:当前无校验,`create` 被调用 → 用例 fail)。

- [ ] **Step 3: 实现重名校验**

在 `html-templates.service.ts` 的 `saveHtmlAsNewProject` 方法开头(`async saveHtmlAsNewProject(` 之后、`// 查 campaign` 之前)插入:

```ts
    const trimmedName = input.name.trim();
    if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
    const existing = await prisma.project.findFirst({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing)
      throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);
```

并把同一方法 `prisma.project.create({ data: { name: input.name, ... } })` 里的 `name: input.name,` 改为 `name: trimmedName,`。

- [ ] **Step 4: 跑测试,确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/html-templates/html-templates.service.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/html-templates/html-templates.service.ts apps/server/src/modules/html-templates/html-templates.service.test.ts
git commit -m "$(cat <<'EOF'
feat(html-templates): saveHtmlAsNewProject 报告名全局唯一校验

AI 生成保存遇重名 → 400「已存在同名报告」;名称先 trim 再落库。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Web — projectsApi.getHtml + Projects.tsx 下拉与错误回显(TDD)

> 说明:本任务会触及 `projects.page.test.tsx`。该文件相对当前 `Projects.tsx` 已 stale(源码用「报告」、测试仍用「项目」),**当前是红的**。Step 1 先把陈旧文案对齐为绿,再在其上加新测试。

**Files:**
- Modify: `apps/web/src/api/projects.ts`
- Modify: `apps/web/tests/projects.page.test.tsx`
- Modify: `apps/web/src/routes/Projects.tsx`

- [ ] **Step 1: 对齐 stale 文案(项目 → 报告),让现有测试转绿**

在 `apps/web/tests/projects.page.test.tsx` 做如下精确替换:

- `expect(screen.getByText('3 / 3 个项目')).toBeInTheDocument();` → `'3 / 3 个报告'`
- `expect(screen.getByText('2 / 3 个项目')).toBeInTheDocument();` → `'2 / 3 个报告'`
- `expect(screen.getByText('1 / 3 个项目')).toBeInTheDocument();` → `'1 / 3 个报告'`
- `await screen.findByText(/还没有项目/);`(两处)→ `/还没有报告/`
- `await user.click(screen.getByRole('button', { name: /新建项目/ }));`(两处)→ `{ name: /新建报告/ }`

(行内注释 `// 打开新建项目弹窗` 可一并改为「报告」,非必须。)

- [ ] **Step 2: 跑现有测试,确认转绿**

Run: `pnpm --filter @mediakit/web exec vitest run tests/projects.page.test.tsx`
Expected: PASS(原有 6 个用例)。

- [ ] **Step 3: mock 增加 getHtml**

在 `projects.page.test.tsx` 顶部 `vi.hoisted` 的 mock 句柄里增加 `getHtmlMock`,并把 `vi.mock('@/api/projects', ...)` 的 `projectsApi` 对象增加 `getHtml`:

```ts
const {
  listMock,
  createMock,
  renameMock,
  removeMock,
  updateMock,
  duplicateMock,
  getHtmlMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  removeMock: vi.fn(),
  updateMock: vi.fn(),
  duplicateMock: vi.fn(),
  getHtmlMock: vi.fn(),
}));

vi.mock('@/api/projects', () => ({
  projectsApi: {
    list: () => listMock(),
    create: (n: string, w?: number, h?: number, meta?: unknown) => createMock(n, w, h, meta),
    rename: (id: string, n: string) => renameMock(id, n),
    update: (id: string, patch: unknown) => updateMock(id, patch),
    duplicate: (id: string) => duplicateMock(id),
    remove: (id: string) => removeMock(id),
    getHtml: (id: string) => getHtmlMock(id),
  },
}));
```

- [ ] **Step 4: 写失败测试(ai-html 下拉 + 建报告重名回显)**

在 `projects.page.test.tsx` 的 `describe('Projects page', ...)` 内追加两个用例:

```ts
  it('ai-html 报告: HTML ▾ 菜单可预览/下载/复制源码(复制走 getHtml+clipboard)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const user = userEvent.setup();
    getHtmlMock.mockResolvedValue({
      id: 'p1',
      name: 'AI 报告',
      html: '<p>HTML</p>',
      updatedAt: '',
    });
    listMock.mockResolvedValue([
      summary('p1', 'AI 报告', 0, { styleType: 'ai-html', businessLine: 'FT' }),
    ]);
    renderPage();
    await screen.findByText('AI 报告');

    await user.click(screen.getByRole('button', { name: /HTML ▾/ }));
    const copyBtn = await screen.findByRole('button', { name: '复制源码' });
    await user.click(copyBtn);

    await waitFor(() => expect(getHtmlMock).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('<p>HTML</p>'));
  });

  it('建报告遇重名 400 → 在弹窗回显后端文案', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([]);
    createMock.mockRejectedValueOnce({
      response: { data: { error: { message: '已存在同名报告「X」，请使用其他名称' } } },
    });
    renderPage();
    await screen.findByText(/还没有报告/);

    await user.click(screen.getByRole('button', { name: /新建报告/ }));
    await user.type(screen.getByPlaceholderText(/例如/), 'X');
    await user.selectOptions(screen.getByRole('combobox', { name: '业务线' }), 'FT');
    await user.click(screen.getByText('1920 × 1080'));
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() =>
      expect(screen.getByText('已存在同名报告「X」，请使用其他名称')).toBeInTheDocument(),
    );
  });
```

- [ ] **Step 5: 跑测试,确认两个新用例失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/projects.page.test.tsx`
Expected: FAIL(下拉还不存在;`handleCreate` 当前 catch 只写死「创建失败,请重试」,读不到 `error.message`)。

- [ ] **Step 6: 实现 projectsApi.getHtml**

在 `apps/web/src/api/projects.ts` 的 `projectsApi` 对象里(建议放在 `duplicate` 之后)新增:

```ts
  /** 取某报告的 HTML 源码(仅供列表预览/下载/复制,按需 fetch)。 */
  getHtml: (id: string) =>
    api
      .get<{ id: string; name: string; html: string; updatedAt: string }>(
        `/projects/${id}/html`,
      )
      .then((r) => r.data),
```

- [ ] **Step 7: 修正 Projects.tsx 错误回显(handleCreate / handleEdit)**

把 `handleCreate` 的 `catch` 块:

```ts
    } catch {
      setCreateError('创建失败，请重试');
    } finally {
```

替换为:

```ts
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setCreateError(e.response?.data?.error?.message ?? '创建失败，请重试');
    } finally {
```

把 `handleEdit` 的 `catch` 块(原 `msg` 解析读了错误路径,永远命不中)替换为:

```ts
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setEditError(e.response?.data?.error?.message ?? '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
```

> 后端错误体统一是 `{ error: { code, message } }`(见 `apps/server/src/middleware/error.ts`),故读 `response.data.error.message`。重名 400 的文案为「已存在同名报告「X」，请使用其他名称」。

- [ ] **Step 8: 实现 Projects.tsx「HTML ▾」下拉**

8a. 在 `Projects` 组件内已有 state 区(例如 `const [fromTplError ...]` 之后)新增:

```ts
  // ai-html 行的 HTML 操作:下拉开合 + 按行缓存 + busy
  const [htmlMenuFor, setHtmlMenuFor] = useState<string | null>(null);
  const [htmlCache, setHtmlCache] = useState<Record<string, string>>({});
  const [htmlBusy, setHtmlBusy] = useState<string | null>(null);

  async function ensureHtml(p: ProjectSummary): Promise<string | null> {
    if (htmlCache[p.id] !== undefined) return htmlCache[p.id];
    setHtmlBusy(p.id);
    try {
      const { html } = await projectsApi.getHtml(p.id);
      setHtmlCache((prev) => ({ ...prev, [p.id]: html }));
      return html;
    } catch {
      toast.error('读取 HTML 失败');
      return null;
    } finally {
      setHtmlBusy(null);
    }
  }

  async function handlePreviewHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleDownloadHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    try {
      await navigator.clipboard.writeText(html);
      toast.success('已复制 HTML 源码');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }
```

8b. 在行操作 `<td>` 里(GrapesJS/可视化编辑按钮之后、`编辑` 按钮之前)插入 ai-html 专属下拉:

```tsx
                      {p.meta?.styleType === 'ai-html' && (
                        <span className="relative ml-1 inline-block">
                          <button
                            onClick={() => setHtmlMenuFor(htmlMenuFor === p.id ? null : p.id)}
                            className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                          >
                            HTML ▾
                          </button>
                          {htmlMenuFor === p.id && (
                            <>
                              {/* 点击外部关闭 */}
                              <button
                                className="fixed inset-0 z-10 cursor-default"
                                tabIndex={-1}
                                onClick={() => setHtmlMenuFor(null)}
                              />
                              <span className="absolute right-0 z-20 mt-1 w-28 rounded-md border border-border-default bg-surface-primary py-1 shadow-lg">
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handlePreviewHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  预览
                                </button>
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handleDownloadHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  下载
                                </button>
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handleCopyHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  复制源码
                                </button>
                              </span>
                            </>
                          )}
                        </span>
                      )}
```

- [ ] **Step 9: 跑测试,确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/projects.page.test.tsx`
Expected: PASS(原有 + 2 个新用例)。

- [ ] **Step 10: 提交**

```bash
git add apps/web/src/api/projects.ts apps/web/src/routes/Projects.tsx apps/web/tests/projects.page.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): 报告列表 ai-html 行 HTML 预览/下载/复制源码 + 重名错误回显

- projectsApi.getHtml 按需取 HTML(不塞 list 响应)
- ai-html 行新增「HTML ▾」下拉:预览(新标签页)/下载/复制源码,按行缓存
- handleCreate/handleEdit 读 response.data.error.message,正确回显重名文案
- 顺带把 stale 的 projects.page.test 文案对齐为「报告」

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Web — GenerateHtmlReportOverlay.doSave 错误回显

> AI 保存路径(saveHtmlAsNewProject)遇重名时,弹窗需展示「已存在同名报告…」。当前 `doSave` 的 catch 读 `e?.response?.data?.message`(错误路径,命不中)。该组件无既有测试、依赖较多,本任务为定向 wiring 修复 + 手测验证。

**Files:**
- Modify: `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx`(doSave 的 catch,约 210-211)

- [ ] **Step 1: 修正 doSave 错误解析**

把 `GenerateHtmlReportOverlay.tsx` 中 `doSave` 的 catch:

```ts
    } catch (e: any) {
      setError(e?.response?.data?.message || '保存失败');
    } finally {
```

替换为:

```ts
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '保存失败');
    } finally {
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @mediakit/web exec tsc -b`
Expected: 通过(纯字符串路径调整,无类型变化)。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx
git commit -m "$(cat <<'EOF'
fix(web): AI 保存报告失败回显后端文案

doSave catch 改读 response.data.error.message,使重名 400「已存在同名报告」能展示。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 全量验证

- [ ] **Step 1: server 全量测试**

Run: `pnpm --filter @mediakit/server test`
Expected: PASS(含新 `projects.service.test.ts`、`html-templates.service.test.ts`,且未破坏 `templates.service.test.ts`)。

- [ ] **Step 2: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS(含对齐后的 `projects.page.test.tsx`)。

- [ ] **Step 3: 类型检查(双端)**

Run:
```
pnpm --filter @mediakit/server exec tsc -b
pnpm --filter @mediakit/web exec tsc -b
```
Expected: 通过。

- [ ] **Step 4: 手测(需起 dev server + DB)**

- 新建报告/改名/复制/AI 保存遇重名 → 弹窗字段下出现「已存在同名报告「X」，请使用其他名称」。
- 复制「X」→「X 副本」;再复制「X」→「X 副本 2」。
- ai-html 报告行点「HTML ▾」:预览(新标签页渲染)/下载(`${name}.html`)/复制源码(粘贴为完整 HTML)。
- 非 ai-html 行不显示「HTML ▾」。

> dev server 可能跑在 worktree(参见记忆 dev-server-cwd-may-be-worktree);看效果前先 `lsof -i :5173` 确认 PID 的 cwd。

---

## Self-Review

**Spec coverage:**
- 需求一·全局唯一:create(Task1)/update(Task1)/duplicate(Task1)/AI 保存(Task3)—— 四条路径全覆盖;文案「已存在同名报告「X」，请使用其他名称」一致;不加 DB 约束(符合 spec)。✓
- 需求一·前端回显:CreateProjectDialog 经 `error` prop(Task4 Step7 handleCreate)、编辑经 handleEdit(Task4 Step7)、AI 保存经 doSave(Task5)。✓
- 需求二·`GET /projects/:id/html`(Task2)、列表三操作 + 「HTML ▾」下拉(Task4)、预览新标签页(Step8 handlePreviewHtml)、下载 `${name}.html`(handleDownloadHtml)、复制源码(handleCopyHtml)、按行缓存(ensureHtml)。✓
- 非目标守住:canvas/ppt/single 行不显示下拉(gated by `styleType === 'ai-html'`);HtmlTemplate CRUD 不动。✓

**Placeholder scan:** 无 TBD/TODO;每个改代码的步骤都给了完整代码;测试为真实可运行代码。✓

**Type consistency:** `getHtml` 返回 `{ id, name, html, updatedAt }` —— service(Task2 Step3)、controller(Task2 Step4,透传)、`projectsApi.getHtml`(Task4 Step6)三处签名一致;前端 `ensureHtml` 读 `const { html } = await projectsApi.getHtml(...)`。`update` 的 `trimmedName` 仅在 `input.name !== undefined` 分支定义,下游用 `if (trimmedName !== undefined)` 判定,无 TS「用前未赋值」问题。✓

**已知偏离 TDD 处(已注明):** Task5(overlay doSave)为定向 wiring 修复,组件无既有测试、依赖重,采用类型检查 + 手测验证,未新增单测;其上游(saveHtmlAsNewProject)的行为由 Task3 的单测覆盖。
