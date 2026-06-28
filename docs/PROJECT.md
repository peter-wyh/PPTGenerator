# MediaKit PPTGenerator — 立项信息

> 最后更新：2026-06-28

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

**v0.6 — demo.html 还原 G2 基础组件补齐完成**（2026-06-28，分支 `demo-g2`）

- 后端 API（Express + TS + Prisma）上线：认证（JWT access/refresh + Redis 黑名单 + 轮换）、管理员用户管理、项目 CRUD（含所有权隔离）
- 前端薄 UI（`apps/web`，Vite + React + TS + Tailwind + Zustand + React Router + axios）上线：登录、项目列表（新建/重命名/删除）、受保护路由、刷新页 session 恢复、axios 401 自动 refresh
- 编辑器内核 MVP（`apps/web/src/editor/*`）上线：1280×720 画布 + zoom + 文本/图片组件 + 选中/拖动/8 向缩放 + 属性面板 + debounce 自动保存；`/projects/:id` 为真编辑器
- **G2 基础组件补齐**（`apps/web/src/editor/blocks/*`）：引入组件注册表 `REGISTRY`（`getBlock` 降级 fallback），画布从 text/image 扩到 **7 类基础组件**（文本/图片/指标卡/柱状图/折线图/饼图/表格，图表用 recharts + 空数据占位）；`store.addComponent` / `ComponentView` / `Toolbar` / `PropertyPanel` 全部改为注册表/schema 驱动（属性面板支持 text/textarea/number/color/select/list/table 七种 kind）
- 邮件编辑器（还原 `ai_studio_code-40.html`）上线：`/email-editor`，左侧表单分区 + 右侧 iframe `srcDoc` 实时预览 + 复制 HTML，纯前端
- 数据模型：`User` / `Project` / `Role`（MySQL 8）；`Dataset` / `ExportJob` / `shareSlug` 待后续阶段
- 测试：后端 22 项（supertest + vitest）、前端 62 项（vitest + testing-library，含 G2 注册表/块/工具栏/属性面板）通过；`tsc` 类型检查与 `vite build` 通过
- 仓库为 pnpm monorepo（`apps/server` + `apps/web` + `packages/shared` type-only）
- 本地基础设施：`docker-compose.yml`（mysql:8 + redis:7）+ 种子脚本（admin/admin123）
- `demo.html` 原型保留未动，作为完整还原的参考（G2 已完成；G4/G1/G3/G5/G6 待续）

## 后续计划

> demo.html 完整还原路线图（执行顺序已与用户确认：依赖/价值序）

1. ✅ **G2 基础组件**（已完成，分支 `demo-g2`，2026-06-28）：组件注册表 + 7 类基础组件（recharts 图表）+ schema 驱动属性面板。
2. **G4 业务组件库**：把 `demo.html` 的 20 种 business-block（cover/agenda/milestone/global/brand-wall/org/service/challenge/process/calendar/campaign-plan/case-showcase/campaign-overview/creator-list/creator-profile/content-analysis/retrospective/package/report/funnel，含 standard/cards/accent/stats 等变体）用注册表模式移植；复用 G2 的 `REGISTRY`。**移植前需 brainstorm 忠实度（像素级复刻 demo 手写 HTML vs 数据驱动近似）**。
3. **G1 交互补全**：多选/框选、撤销重做（history 栈）、复制/剪切/粘贴、键盘快捷键、图层上移/下移/置顶/置底、锁定。
4. **G3 页面管理**：增删/改名/排序/缩略图/模板。
5. **G5 数据源**：上传 CSV/Excel + API 拉取 + 组件 binding（真实数据接入）。
6. **G6 预览 + 导出**：只读演示模式 + Puppeteer PDF / PPT 导出 + 公开分享链接。

### 已知技术债（G2）

- `PropertyPanel` 的 `list`/`table` 编辑器用数组索引作 React `key`：受控输入（值始终来自 store）下功能正确，但删除中间项时不是最佳（后续若加非受控子组件需换稳定 key）。
- `select` 布尔字段（仅 `indicator-card.trendUp`）用 `typeof val === 'boolean'` 嗅探：当前可行，后续扩展 schema 时改为声明式（`PropertyField.coerce` / `booleanMap`）。
- recharts 拉高首包体积（build 产物 ~693kB）：后续 G6 或性能优化时按需 code-split。
