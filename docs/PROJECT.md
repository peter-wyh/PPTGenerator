# MediaKit PPTGenerator — 立项信息

> 最后更新：2026-06-26

## 项目背景与目标

广告投放/营销运营人员每个 campaign 结束后需要产出复盘报告，目前主流做法是用 PPT 手工拼装数据截图与图表，**耗时长、复用难、版本混乱**。

**MediaKit** 把这一场景产品化：业务方在浏览器里拖拽业务组件（Campaign 概览 / 达人名单 / 周报月报等）+ 绑定数据源，即可生成可演示、可导出的复盘报告。

**目标用户**：营销/广告运营人员、增长顾问、达人经纪团队。

**核心价值**：把"做一份复盘报告"的时间从小时级压缩到分钟级，且支持模板复用。

## 范围

### 已实现（v0.1 原型）

- 三栏布局：左侧页面列表 / 中间画布（1280×720）/ 右侧属性面板
- 顶部工具栏：撤销 / 重做 / 预览 / 导出（占位）
- 业务组件库（5 类）：团队组织架构、核心服务矩阵、Campaign 概览、达人名单、周报/月报
- 基础组件：文本、图片、柱状图、折线图、饼图、指标卡、表格
- 页面管理：增删页面、缩略图切换
- 选中 / 拖拽 / 缩放 / 多选 / 复制粘贴
- 数据源绑定（达人、CPS 计划、指标等）

### 未实现（占位 / 计划中）

- 导出（PPT / PDF）— 当前仅 toast 占位（`demo.html:2661`）
- 返回项目列表 — 当前仅 toast 占位（`demo.html:2602`）
- 持久化（无 localStorage / 后端）
- 多人协作

## 技术选型

| 维度 | 选择 | 原因 |
|---|---|---|
| 形态 | 单 HTML 文件（`demo.html`） | 原型阶段便于快速迭代与分享 |
| 构建 | 无构建系统 | 同上 |
| 框架 | 原生 HTML/CSS/JS | 无依赖、无打包 |
| 字体 | Google Fonts：Funnel Sans（标题）、Inter（正文）、IBM Plex Mono（数据） | 免费、商用可读性强 |
| 图标 | 内联 SVG | 无图标库依赖 |
| 主题 | CSS 设计 tokens（主色 `#FF5C00`） | 易于换肤 |
| 状态 | 全局 `state` 对象 + history 栈（撤销/重做） | 简单够用 |

## 当前状态

**v0.3 — 前端薄 UI 完成**（2026-06-26，分支 `frontend-thin-ui`）

- 后端 API（Express + TS + Prisma）上线：认证（JWT access/refresh + Redis 黑名单 + 轮换）、管理员用户管理、项目 CRUD（含所有权隔离）
- 前端薄 UI（`apps/web`，Vite + React + TS + Tailwind + Zustand + React Router + axios）上线：登录、项目列表（新建/重命名/删除）、项目外壳占位页、受保护路由、刷新页 session 恢复、axios 401 自动 refresh
- 数据模型：`User` / `Project` / `Role`（MySQL 8）；`Dataset` / `ExportJob` / `shareSlug` 待后续阶段
- 测试：后端 22 项（supertest + vitest）、前端 10 项（vitest + testing-library）通过；`tsc` 类型检查与构建通过
- 仓库为 pnpm monorepo（`apps/server` + `apps/web` + `packages/shared` type-only）
- 本地基础设施：`docker-compose.yml`（mysql:8 + redis:7）+ 种子脚本（admin/admin123）
- `demo.html` 原型保留未动，作为编辑器内核（下一期）的视觉参考

## 后续计划

1. **P1：React 编辑器内核** — Vite + TS + Tailwind + Zustand，复刻 `demo.html` 三栏 + 7 个基础组件 + 持久化对接 P0 API
2. **P2：业务组件库** — 20+ 业务组件 + 注册表，完整复刻 `demo.html`
3. **P3：数据源** — 上传 CSV/Excel + API 拉取 + 组件 binding（真实数据接入）
4. **P4：导出 + 分享** — Puppeteer PDF + 公开分享链接
5. 数据源 API 拉取鉴权头、乐观锁、审计日志等（spec §16 待定项）
