# 三层组件体系定义

| 项目 | 内容 |
|---|---|
| 文档 | PPTGenerator 三层组件模型（通用组件 / 业务组件 / 页面模板）校准与基准 |
| 日期 | 2026-07-03 |
| 状态 | 基准（试点已落地，持续迁移中） |
| 关联 | PRD `PPTGenerator PRD.md` §4.6 组件库、§11 模版规格 |

---

## 1. 为什么校准（背景）

重构前 `apps/web/src/editor/business/catalog.ts` 的 20 个"业务组件"几乎全是**整页级版式块**（560~800px 宽、预填完整故事如 `GlowLab 提案` / `Mia Chen · 1.28M followers`），粒度错位：**一层被当三层用了**。后果是组件"看起来很多但拼不出 PRD 的报告页"——缺的是页内语义块，而现有件都大得只能一页放一个。

校准目标：把三层各归其位，让 PRD §4.6 的 B1~B18 落到「业务组件」层，PRD §11 的逐页规格落到「页面模板」层。

---

## 2. 三层定义

| 层级 | 定义 | 关键判据 | 数据 | 复用粒度 |
|---|---|---|---|---|
| **① 通用组件** (Atom) | **无业务语义**的纯可视化原子件，只负责"把数据画出来"，不知道达人/商品/渠道是什么 | 换个数据源就能画完全不同的东西 | 绑**任意数据集列**或手填 | 跨一切场景，最大复用 |
| **② 业务组件** (Semantic Block) | **带领域语义、页内可复用**的语义块，绑定某个领域实体（达人/作品/商品/渠道） | 绑的是**领域数据模型**而非裸列；一页通常由 2~5 个拼成 | 绑**领域实体**（达人对象/商品对象） | 跨页、跨场景复用 |
| **③ 页面模板** (Page Layout) | 把**多个业务组件 + 通用组件**按版式编排成**一整页**，解决"这页放什么、怎么排" | 是一个**编排方案**而非单件 | 不直接绑数据，透传给内部业务组件 | 跨项目复用 |
| ④ 场景模板 | 多个页面模板按章节串成一份完整报告（MediaKit / 提报 / 双周报 / 月报） | 多页编排 | — | — |

> 一句话：**通用组件是"怎么画"，业务组件是"画什么领域的什么块"，页面模板是"这页拼哪几块"。**

**判定标准不是尺寸，而是这两条**（业务组件可能很大，如业绩看板占大半页）：
1. 是否绑定领域数据模型（绑"达人对象" vs 绑"任意数值列"）
2. 是否可在不同页面/场景复用

按这两条：业绩概览**页** = 页面模板；页里的「KPI 矩阵块」「组合图块」「Timeline 块」= 业务组件；它们底层又由通用组件（KPI 大数字 / 柱线组合图 / 表格）构成。

---

## 3. 工作示例：达人介绍页拆解

拆解前的 `creator-profile` 是一个 700×270 的单体，塞了头像、名字、一堆数据、人群标签——**一个件干了一整页的活，不可拆**。校准后：

```
页面模板：达人介绍页
├─ [通用] 标题区
├─ [业务] 达人头像卡        avatar + name + platform + tier + 简介
├─ [业务] 达人数据条        followers / ER / 触达 / 曝光（KPI strip 绑达人指标）
├─ [业务] 粉丝画像          gender / age / geo / interest（待建）
└─ [业务] 代表作品列表      封面/标题/转赞评（≈PRD B5）
```

- **头像卡 / 数据条 / 作品列表**是真业务组件——各自绑定"达人"实体的不同切面，可单独拖到任何页复用。
- **达人介绍页**是页面模板——本身不绑数据，只规定"这几块这么排"；数据透传给内部业务组件。
- 那个 KPI 数据条底层复用通用组件「KPI 大数字卡」——**业务组件 = 通用组件 + 领域语义预设 + 领域数据绑定**。

---

## 4. 现状清单（截至 2026-07-03）

### 通用组件（7）
`text` · `image` · `indicator-card` · `bar-chart` · `line-chart` · `pie-chart` · `table`

### 业务组件（7，均为一级 ComponentType，各带 3 样式变体）
| type | 领域 | ≈PRD | 变体 |
|---|---|---|---|
| `creator-avatar-card` | 达人 | — | horizontal / vertical / compact |
| `creator-stats-strip` | 达人 | — | cards / plain / metric |
| `creator-works-list` | 达人 | B5 作品list | cards / row / compact |
| `brand-wall` | 公司 | — | grid / row / marquee |
| `package-card` | 报价 | B6 套餐 | standard / featured / compact |
| `kpi-board` | 报告 | B1 业绩看板 | grid / row / compact |
| `timeline-compare` | 报告 | B13 周期对比表 | standard / mini / with-bar |

### 页面模板（13，在「新建页面」）
- 通用：`blank` · `title` · `overview` · `table`
- 达人：`creator-page`
- 公司/报价：`cover-page` · `agenda-page` · `company-page` · `package-page`
- Campaign 报告：`report-weekly-overview` · `report-monthly-overview` · `report-channel` · `report-wrapup-review`

### 待迁移（legacy `business-block` 20 kind）
原 `catalog.ts` 的整页版式块（cover/agenda/milestone/global/brand-wall/org/service/challenge/process/calendar/campaign-plan/case-showcase/campaign-overview/creator-list/creator-profile/content-analysis/retrospective/package/report/funnel）。**保留不删**，作为页面模板的参考实现，逐个迁移到「页面模板」层。

---

## 5. 添加新组件 / 模板的配方

### 新业务组件
1. `packages/shared/src/index.ts`：`ComponentType` 加类型 + Data 接口（含 `variant`）+ `ComponentData` 联合
2. `apps/web/src/editor/defaults.ts`：`DEFAULT_SIZES` + `getDefaultData`（含样例）
3. `apps/web/src/editor/components/<Domain>Components.tsx`：渲染器按 `data.variant` 分发
4. `apps/web/src/editor/registry.tsx`：`REGISTRY` 加 `BlockDef`（`Component` + `defaultSize` + `defaultData` + `variants` + `propertySchema`）
5. `apps/web/src/editor/PropertyPanel.tsx`：`LABELS` 加中文名
6. `apps/web/src/editor/Toolbar.tsx`：`SEMANTIC_TOOLS` 加按钮（走 `addComponent(type)`）

属性面板自动：声明 `variants` → 渲染变体 chips；`propertySchema` 用现有 `text/textarea/number/color/select/list/table` 字段类型。

### 新页面模板
在 `apps/web/src/editor/templates.ts` 的 `TEMPLATES` 加一项，`components: () => EditorComponent[]` 返回编排好的组件（用 `t(type,x,y,w,h)` 构造，可在模板内预设 `data.variant`）。组件 id 由 `addPageWithComponents` 重分配，无需手动管。

---

## 6. 关键工程约定

- **业务组件 = 一级 ComponentType**，与 text/chart 走同一 `addComponent` → `DEFAULT_SIZES` + `getDefaultData` + REGISTRY 路径。**不扩展** `business-block` 的 `businessKind`（那是 legacy 整页版式）。
- **变体机制通用**：`BlockDef.variants?: VariantOption[]`；属性面板 `VariantSelector` 检测到就渲染 chips 写入 `data.variant`。任何组件声明即得。
- **`table` 字段兼作"对象列表编辑器"**：多字段对象列表（作品 [封面,标题,转,赞,评] / 品牌墙 [品牌,Logo URL] / 套餐特性 / KPI / 周期对比）统一用 TableData `{headers, rows}`，复用 `TableField` 编辑。
- **三层无嵌套**：画布扁平，组件互不嵌套；"页面模板 = 编排"靠 `addPageWithComponents` 一次性落多个扁平件实现，不需要组件树。

---

## 7. 已知缺口（后续）

- **强类型 `object-list` 属性字段**：现用 `table` 编辑对象列表，语义弱（列0 当图片 URL 等）。若需"封面/标题/转赞评"带类型子 schema 的列表编辑，应新增 `object-list` field kind——试点已暴露此需求。
- **领域实体绑定**：业务组件数据现为静态样例，未接数据源。绑定"达人对象"等领域实体是数据中心（DC，PRD §4.2）的工作。
- **场景模板层（④）未建**：MediaKit/提报/双周报/月报 多页串接尚未落地，目前停在页面模板层。
- **legacy 20 kind 迁移**：见 §4 待迁移清单。
- **画布内 contentEditable 内联编辑**：延后（M4 取舍），现走属性面板。
