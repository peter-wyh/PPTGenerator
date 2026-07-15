# 顶栏「我的项目」独立菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在顶栏 logo 后新增「我的项目」菜单按钮(指向 `/projects`),并给全部顶栏菜单项补上当前页 active 高亮。

**Architecture:** 只改 `Layout.tsx` 一个文件。引入 `useLocation`,用一个 `navBtn(active)` className helper 统一生成三个菜单项(我的项目 / 数据管理 / 模板管理)的基础态与 active 态。active 用精确路径匹配;编辑器 `/projects/:id` 是 bare 布局、不渲染此顶栏,天然不误判。TDD:先写 `Layout.test.tsx` 覆盖"按钮渲染 + active 三态",再改实现。

**Tech Stack:** React 18 + react-router-dom v6 + Tailwind(设计 token)+ vitest + @testing-library/react + jsdom。

**运行目录:** 所有命令在 `apps/web/` 下执行(`cd /Users/ap/Desktop/PPTGenerator/apps/web`)。包管理器为 pnpm。

**隔离提示:** 用户偏好把特性改动隔离在 worktree(见项目 memory `isolate-feature-work-in-worktree`)。本改动只碰干净的 `Layout.tsx` + 新增 test 文件,不触及当前 dirty 的 `dataLibrary.ts`;执行时按 `superpowers:using-git-worktrees` 决定是否开 worktree,commit 时只 `git add` 本特性的文件。

---

### Task 1: 顶栏「我的项目」菜单 + 当前页 active 高亮(TDD)

**Files:**
- Create: `apps/web/tests/Layout.test.tsx`
- Modify: `apps/web/src/components/Layout.tsx`(整个 `Layout` 函数体)

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/Layout.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/stores/auth';

// Layout 内部用 useNavigate/useLocation，需要 router 上下文。
// 用 MemoryRouter + initialEntries 控制当前路径，验证 active 高亮。
function renderLayoutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Layout><div>PAGE</div></Layout>} />
      </Routes>
    </MemoryRouter>,
  );
}

const userBase = {
  id: '1',
  email: 'a@x.com',
  name: 'A',
  role: 'USER' as const,
  createdAt: '',
  updatedAt: '',
};

describe('Layout 顶栏导航', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authed', user: userBase });
  });

  it('渲染「我的项目」菜单项', () => {
    renderLayoutAt('/projects');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).toBeInTheDocument();
  });

  it('当前页在 /projects 时「我的项目」高亮', () => {
    renderLayoutAt('/projects');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).toHaveClass('bg-surface-hover');
  });

  it('当前页在 /data 时「数据管理」高亮、「我的项目」不高亮', () => {
    renderLayoutAt('/data');
    expect(
      screen.getByRole('button', { name: '数据管理' }),
    ).toHaveClass('bg-surface-hover');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).not.toHaveClass('bg-surface-hover');
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `pnpm vitest run tests/Layout.test.tsx`
Expected: FAIL —— 「我的项目」按钮找不到(`Unable to find a role="button" with name「我的项目」`)。第三个用例同理(`数据管理` 按钮没有 `bg-surface-hover` class,因为现在还没有 active 态)。

- [ ] **Step 3: 改 Layout.tsx 实现**

把 `apps/web/src/components/Layout.tsx` 整体替换为:

```tsx
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Button } from './Button';

interface LayoutProps {
  children: ReactNode;
}

/** 菜单按钮 className：active 时给选中态，否则给默认态 + hover。 */
function navBtn(active: boolean) {
  return `rounded px-2 py-1 text-sm ${
    active
      ? 'bg-surface-hover text-foreground-primary font-medium'
      : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
  }`;
}

/** 受保护页面的外壳：顶栏（logo / 项目名占位 / 当前用户 / 登出）。 */
export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border-default bg-surface-primary px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="font-headings text-base font-semibold tracking-tight text-foreground-primary"
          >
            MediaKit
          </button>
          <button
            onClick={() => navigate('/projects')}
            className={navBtn(location.pathname === '/projects')}
          >
            我的项目
          </button>
          <button
            onClick={() => navigate('/data')}
            className={navBtn(location.pathname === '/data')}
          >
            数据管理
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => navigate('/templates')}
              className={navBtn(location.pathname === '/templates')}
            >
              模板管理
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-foreground-secondary">
              {user.name ?? user.email}
              {user.role === 'ADMIN' && (
                <span className="ml-1 rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                  ADMIN
                </span>
              )}
            </span>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            登出
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

要点:
- 第 2 行新增 `useLocation` import。
- 新增 `navBtn(active)` helper —— 三个菜单项共用,保证样式一致(DRY)。
- logo(`MediaKit`)保持原样,其后新增「我的项目」按钮,再接「数据管理」「模板管理」。
- active 判定用精确匹配 `location.pathname === '/xxx'`。
- 顶栏右侧(用户名/登出)不动。

- [ ] **Step 4: 跑测试,确认通过**

Run: `pnpm vitest run tests/Layout.test.tsx`
Expected: PASS(3 个用例全过)。

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 无错误退出(`tsc --noEmit` 通过)。

- [ ] **Step 6: 跑全量 web 测试,确认无回归**

Run: `pnpm test`
Expected: 全部通过(含新增的 Layout 测试)。

> Caveat:当前工作树有其他特性的未提交改动(`apps/web/src/api/dataLibrary.ts`、untracked `apps/web/tests/collaborations-api.test.ts`)。若全量测试里**只有这些无关文件**失败,而 `tests/Layout.test.tsx` 自身通过,即视为本特性无回归 —— 不要去修那些失败。先 `pnpm vitest run tests/Layout.test.tsx` 单独确认本特性绿,再判全量。

- [ ] **Step 7: 提交(只 add 本特性文件,原子操作)**

```bash
git add apps/web/src/components/Layout.tsx apps/web/tests/Layout.test.tsx
git commit -m "feat(web): 顶栏新增「我的项目」菜单 + 当前页高亮

把 /projects 从只能点 logo 拎成顶栏显式菜单项，并给全部顶栏菜单
（我的项目/数据管理/模板管理）补 useLocation 精确匹配的 active 态。" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

注意:不要 `git add -A` 或 add 整个 dirty 文件(`dataLibrary.ts` 等是其他特性的未提交改动)。

---

## 验证(手动,可选)

提交后启动应用 `pnpm dev`,登录后检查:
1. 顶栏 logo 右侧出现「我的项目」按钮。
2. 点击进入 `/projects`。
3. 分别停在 项目页 / 数据页 / 模板页(ADMIN),对应菜单高亮、其余不高亮。
