# 顶栏「我的项目」独立菜单 — 设计

- 日期: 2026-07-15
- 状态: 已批准,待实现

## 背景

应用顶栏(`apps/web/src/components/Layout.tsx`)目前只有「数据管理」「模板管理」两个显式菜单。「我的项目」(`/projects`)是登录后的默认落地页,但顶栏里**没有对应的显式菜单项**,只能靠点 logo(MediaKit)进入,不直观。此外,顶栏所有菜单项都**没有"当前页"高亮态**,用户看不出自己在哪个模块。

## 目标

1. 把 `/projects` 拎成顶栏一个显式的独立菜单项「我的项目」。
2. 顺带给全部顶栏菜单项补上当前页高亮(active 态)。

## 改动范围

**只改一个文件**:`apps/web/src/components/Layout.tsx`。

### 1. 新增「我的项目」菜单项

在 logo(`MediaKit`)之后、`「数据管理」`之前,新增一个按钮:

```tsx
<button
  onClick={() => navigate('/projects')}
  className="<与现有菜单按钮一致的基础样式 + active 态>"
>
  我的项目
</button>
```

- **文案**:`我的项目`(与 `routes/Projects.tsx` 页面标题一致)。
- **位置**:logo 后第一位(在「数据管理」之前)—— 项目是核心入口。
- **权限**:所有用户可见(和 logo 一致,`/projects` 是默认落地页)。
- **不新增路由**:`/projects` 已存在(`App.tsx`)。

### 2. 当前页高亮(active 态)

引入 `useLocation`(`react-router-dom`,已 import `useNavigate`):

- `const location = useLocation();`
- 为每个菜单按钮按 `location.pathname` 判定 active:
  - `pathname === '/projects'` → 「我的项目」
  - `pathname === '/data'` → 「数据管理」
  - `pathname === '/templates'` → 「模板管理」
- **active 样式**:沿用项目设计 token。现有菜单按钮基础态为 `text-foreground-secondary`,hover 态为 `hover:bg-surface-hover hover:text-foreground-primary`。active 复用 hover 视觉并加 `font-medium` 区分选中:active 时 className 含 `bg-surface-hover text-foreground-primary font-medium`。
- **精确匹配**:用 `pathname === '/xxx'`,不用 `startsWith`。编辑器 `/projects/:id` 是 `bare` 布局(`App.tsx`,顶栏不渲染),因此不会被误判为 active。

为避免重复,实现时把每个菜单项的基础 className 与 active className 合并(可用模板字符串或一个小 helper),保证三个按钮样式一致。

## 不改动

- 路由表(`App.tsx`)。
- `routes/Projects.tsx`(页面标题保持「我的项目」)。
- 编辑器、`EditorTopbar.tsx`、`PageSidebar.tsx`。
- 后端 / API / 数据库 / 共享类型。

## 验证

- 手动:登录后顶栏出现「我的项目」按钮;点击进入 `/projects`;分别停留在项目页/数据页/模板页时,对应菜单高亮、其余不高亮。
- 回归:纯 UI 导航改动,不新增 API/类型/路由,现有测试不受影响。

## 风险

极低。局部、单文件、无数据与路由变更。唯一注意点(active 误判 `/projects/:id`)因 bare 布局不渲染顶栏而天然规避。
