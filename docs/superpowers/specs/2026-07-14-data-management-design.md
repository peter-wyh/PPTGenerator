# 数据管理：Campaign + 达人库（支持导入）

- **日期**:2026-07-14
- **状态**:已通过设计评审,待写实现计划
- **范围**:服务端新增 `DataRecord` 表 + data 模块;前端新增数据管理页、切换编辑器数据源;mock 数据种子入库

## 1. 背景

当前 campaign 与达人(达人库)数据是**硬编码 mock**:`apps/web/src/api/mock/campaigns.ts`(`MOCK_CAMPAIGNS`,6 条)与 `apps/web/src/api/mock/creators.ts`(`MOCK_CREATORS`,12 条)。`/data` 路由(`MockData.tsx`)只是只读预览页,无写入、无导入。服务端无 Campaign/Creator 表,绑定到报告时把所选 campaign/达人快照进 `projectMeta.reportData`。

问题:用户无法管理真实的 campaign/达人数据,只能看 demo mock;新增/修正/导入自己的客户数据无处可做。

用户要求:把「Mock 数据」改造为**数据管理**,管理两类数据——**Campaign 数据**与**达人库数据**,并**支持导入**。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 数据存储 | 服务端 JSON 数据集(新 `DataRecord` 表) | 复用 `Project.meta`/`Template.meta` 的 opaque-JSON 模式;跨设备持久、可共享;schema 最小(一张表 + 一个 enum) |
| Schema 形状 | 一行一记录(`kind` + `ownerId` + `data: Json`) | 并发安全(改一条不影响他人);per-record owner/删除;按 kind 在 DB 层过滤 |
| Mock 去留 | 种子导入新库(显式按钮) | demo 数据保留为可编辑/删除的普通记录;页面不空;upsert-by-id 幂等;用户主动清空后不被动重灌 |
| 归属与权限 | 共享 + 全员可管理 | campaign/达人偏运营数据,BD 各自导入、团队复用;记录带 `ownerId` 标记追溯;不沿用模板的 ADMIN-only |
| 编辑器取数 | `listCampaigns()`/`listCreators()` 改打 data API | 统一从库读取;消费方签名不变,影响面最小 |
| 绑定模型 | 仍快照进 `projectMeta.reportData`(不变) | 项目自包含;库的后续改动不回写已存报告;与现行为一致 |
| 导入方式 | CSV/XLSX 文件 + JSON 文件 + 手动新增表单 | 复用现有 `parseFile`;配模板下载;不做粘贴文本(未选) |
| 性能明细数据 | v1 不导入,保持 mock 生成器 | 用户只选定 2 类数据(Campaign/达人);性能明细(帖子/投放位/GEO/漏斗…)属另一范畴,后续阶段补 |

## 3. 不在本次范围(明确划界)

- ❌ **不导入性能明细数据**——creator performance / placements / GEO / funnel / timeline / products / summary 等。导入的真实 campaign 走 `DEFAULT_PROFILE` 生成 demo 数;`listCampaignCreators(campaignId)` 对导入 campaign 返回空(无 campaign↔达人合作明细)。
- ❌ **不做 campaign↔达人合作明细管理**(哪些达人参与了哪个 campaign)——属性能数据范畴。
- ❌ **不做粘贴文本导入**——用户未选。
- ❌ **不做批量编辑 / 排序 / 版本历史 / 软删除回收站**。
- ❌ **不改编辑器绑定模型**——仍快照,不改为实时引用(reportData 只存 id)。
- ❌ **不搬 mock 数据到 shared**——mock 文件保留为种子 payload 来源;种子由 web 侧触发灌入。

## 4. Schema 与迁移

新增 Prisma 模型与枚举(`apps/server/prisma/schema.prisma`):

```prisma
/// 数据管理库记录:Campaign / 达人库(Creator)统一存储,opaque JSON payload。
model DataRecord {
  id        String          @id @default(cuid())
  /// 记录类型:campaign 或 creator。
  kind      DataRecordKind
  /// 创建/导入者(owner 标记;全员可管,记录追溯)。
  ownerId   String
  /// 完整对象(Campaign 或 Creator),按 kind 用 Zod 校验。
  data      Json
  owner     User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([kind])
  @@index([ownerId])
}

/// 数据记录类型。
enum DataRecordKind {
  CAMPAIGN
  CREATOR
}
```

迁移:手写 SQL(`apps/server/prisma/migrations/<ts>_data_record/migration.sql`),遵循 [[prisma-migrate-dev-needs-shadow-db]]——dev DB 用户缺 CREATE DATABASE,`migrate dev` 失败 P3014,故手写建表 + 枚举 + 索引 SQL,用 `migrate deploy`/`resolve` 落库。

## 5. 服务端 API(新模块 `apps/server/src/modules/data`)

路由前缀 `/api/data`,全部需登录;`ownerId = req.user.id`;全员可 CRUD 共享库。

| Method | Path | 作用 | Body / Query |
|---|---|---|---|
| GET | `/api/data` | 列表 | `?kind=campaign\|creator` |
| GET | `/api/data/:id` | 取单条 | — |
| POST | `/api/data` | 新建单条 | `{kind, data}` |
| POST | `/api/data/import` | 批量 upsert-by-id | `{kind, items: obj[]}` → `{created, updated, skipped}` |
| PATCH | `/api/data/:id` | 更新单条(kind 不可变) | `{data}` |
| DELETE | `/api/data/:id` | 删除单条 | — |
| DELETE | `/api/data` | 清空该 kind | `?kind=...` |

GET 列表返回 `{ records: [{id, kind, ownerId, data, createdAt, updatedAt}] }`(管理页需 id/owner 做编辑/删除/追溯);GET 单条返回同一 record 形状。编辑器消费方自行 `.map(r => r.data)` 取纯对象。

### 5.1 Zod 校验

新增 `apps/server/src/modules/data/data.schema.ts`:

- `campaignRecordDataSchema`——镜像 shared `Campaign`:`id, name, advertiser, businessLine, platform, platforms?, startDate, endDate, budget, status?, owner?, metrics?`。
- `creatorRecordDataSchema`——镜像 shared `Creator`:`id, name, handle, platform, tier, followers, engagement, category, region, avatar?, metrics[]`。
- `kindEnum` = `z.enum(['campaign','creator'])`;`createDataSchema` / `importDataSchema` / `updateDataSchema`。

遵循 [[zod-strips-undeclared-meta-keys]]——服务端 Zod 必须镜像 shared 类型,否则字段被静默剥离("存不进去")。

### 5.2 服务层要点

- `list(kind)` → `prisma.dataRecord.findMany({ where: { kind }, orderBy: { createdAt: 'desc' } })`。
- `create(kind, data, ownerId)` → Zod 按 kind 校验 `data` → `prisma.dataRecord.create`。
- `import(kind, items, ownerId)` → 逐条 Zod 校验;**upsert-by-id**(`prisma.dataRecord.upsert({ where:{ id:item.id }, create:{ kind, ownerId, data:item }, update:{ data:item } })`),幂等;返回 `{created, updated, skipped}`(skipped = 校验失败行)。
- `update(id, data)` → Zod 校验 → `prisma.dataRecord.update`。
- `remove(id)` / `clear(kind)` → delete。

## 6. 种子策略

**显式按钮,非自动灌入**(按 kind/Tab 各自一个):

- 每个 Tab 加载后,若**该 kind** 库为空,显示「导入内置示例数据」按钮(Campaign Tab 灌 campaigns、达人库 Tab 灌 creators)。
- 点击 → 从 web 侧已有的 `MOCK_CAMPAIGNS`(Campaign Tab)/ `MOCK_CREATORS`(达人库 Tab)`POST /api/data/import` 灌入对应 kind。
- upsert-by-id 幂等(mock id 稳定:`camp-glowlab-q4`/`cre-mia`…),重复点击或并发首访不产生重复。
- 用户主动清空后**不**被动重灌(只有点按钮才灌)。

无需跨包搬数据、无需服务端 seed 脚本(现有 `seed.ts` 仅建 admin 用户,保持不变)。

## 7. 前端

### 7.1 API client

新增 `apps/web/src/api/dataLibrary.ts`:`listData(kind)` / `createData(kind, data)` / `importData(kind, items)` / `updateData(id, data)` / `deleteData(id)` / `clearData(kind)`。

### 7.2 编辑器数据源切换(签名不变)

- `apps/web/src/api/campaigns.ts`:`listCampaigns()`/`getCampaign(id)` 改读 `listData('campaign')`(返回 `Campaign[]`)。
- `apps/web/src/api/creators.ts`:`listCreators()` 改读 `listData('creator')`。`listCampaignCreators(campaignId)` 不变(仍从 creatorPerformance mock 派生——v1 限制,见 §3)。
- 消费方(`ImportCampaignModal`、`DataConfigOverlay`、各 importer)无需改动。

### 7.3 数据管理页

新增 `apps/web/src/routes/DataManagement.tsx`,替换 `MockData.tsx`;路由 `/data` 不变(`App.tsx:34` 懒加载指向新组件)。复用 `MockData` 中的 `DataTable` 组件(随重写搬入)。

- **两个 Tab**:Campaign | 达人库(Creator)。
- **工具栏**(每个 Tab):`[导入 CSV/XLSX]` `[导入 JSON]` `[新增]` `[导入示例数据(仅空时)]` `[清空(确认)]`。
- **表格列**:
  - Campaign:Campaign / Advertiser / Business Line / Platform / Period / Budget / Status / Owner / [编辑][删除]
  - Creator:头像+Name / Handle / Platform / Tier / Followers / Engagement / Category / Region / Owner / [编辑][删除]
- **行操作**:编辑(弹窗表单,全字段可改)→ `updateData`;删除(二次确认)→ `deleteData`。

### 7.4 导入流程

复用 `apps/web/src/editor/datasource/parse.ts` 的 `parseFile` + 现有 modal chrome(`ImportDataModal` 风格)。

- **CSV/XLSX**:隐藏 `<input type="file" accept=".csv,.xlsx,.xls">` → `parseFile` → 行映射(表头对齐字段)→ **预览弹窗**(展示解析行 + 逐行 Zod 校验错误)→ 确认 → `importData`。提供**模板下载**(客户端 Blob 生成 CSV,表头对齐字段)。
- **JSON**:隐藏 file input → `JSON.parse` → 校验为数组 → 同一预览弹窗 → `importData`。
- **手动新增**:字段表单弹窗 → `createData`。

预览弹窗:有效行可导入、无效行列出行级错误(如「第 3 行:budget 必填」),用户确认后只导有效行(对应服务端 `skipped` 计数)。

### 7.5 导航

`apps/web/src/components/Layout.tsx:35` 文案「Mock 数据」→「数据管理」;路由 `/data` 保留(避免书签失效)。

## 8. 编辑器集成(绑定模型不变)

- 数据配置面板/导入器从库选 campaign/达人 → 绑定时仍**快照**进 `projectMeta.reportData`(现行为,`store.ts:228` `setReportData`)。
- 库的后续改动(改名/删记录)**不回写**已存报告(项目自包含)。
- 删除库中已被某项目快照引用的记录:不影响该已存报告(快照已在 `reportData`);仅影响**新建绑定**时该 campaign 不再可选。

## 9. 错误处理

- **导入预览**:客户端逐行 Zod 校验,行级错误展示;有效行导入、无效行跳过并计数。
- **服务端**:Zod 再校验,非法 → 400;upsert-by-id 处理重复 id。
- **文件解析**:`parseFile` 抛错 → 提示「文件解析失败」;JSON 非法 → 「JSON 格式错误」。
- **必填校验**:`id`/`name`(campaign 与 creator 共有必填)等由 Zod 捕获。
- **网络**:统一 toast。

## 10. 测试策略(TDD)

遵循 [[web-chart-test-convention]](jsdom mock,断言 shell 文本)与项目 TDD 约定。

- **服务端 `data.service.test.ts`**:按 kind 列表 / 新建 / import upsert-by-id 幂等 / 更新 / 删除 / 清空 / 鉴权必需(未登录 401)/ owner 取自 `req.user.id` / Zod 非法 kind·data → 400。
- **服务端 `data.schema.test.ts`**:`campaignRecordDataSchema`/`creatorRecordDataSchema` 镜像 shared 类型(字段齐全、可选性正确)。
- **Web `dataLibrary.test.ts`**:records→data 映射、import payload 形状。
- **Web `DataManagement.test.tsx`**:Tab 渲染、表格从 API mock 渲染、导入预览展示解析行+错误、新增表单 create、删除二次确认、空库显示「导入示例数据」按钮。
- **Web `campaigns.test.ts`/`creators.test.ts`**:`listCampaigns`/`listCreators` 改打 API(mock fetch,断言返回 `Campaign[]`/`Creator[]`)。

## 11. 涉及文件

**服务端**:
- `apps/server/prisma/schema.prisma` — `DataRecord` + `DataRecordKind`。
- `apps/server/prisma/migrations/<ts>_data_record/migration.sql` — 手写建表 SQL。
- `apps/server/src/modules/data/{data.routes,data.controller,data.service,data.schema}.ts` — 新模块。
- `apps/server/src/modules/data/data.service.test.ts`、`data.schema.test.ts` — 测试。
- 路由注册(挂到 `/api/data`)。

**Web**:
- `apps/web/src/api/dataLibrary.ts` — 新 client。
- `apps/web/src/api/campaigns.ts`、`apps/web/src/api/creators.ts` — 切换数据源。
- `apps/web/src/routes/DataManagement.tsx` — 新页面(替换 `MockData.tsx`)。
- `apps/web/src/App.tsx` — `/data` 懒加载指向 `DataManagement`。
- `apps/web/src/components/Layout.tsx` — 导航文案。
- 导入预览组件(复用 `parseFile` + modal chrome)。
- 对应测试。

**Shared**:
- 复用现有 `Campaign`/`Creator` 类型;可选新增 `DataRecordDTO` 类型(非必须)。

## 12. 兼容性

- 现有 demo 项目已在 `reportData` 快照了 campaign/达人 → 不受数据源切换影响,行为不变。
- 新建项目绑定 campaign/达人 → 从库读取;库为空时需先「导入示例数据」或自行导入。
- 无 `Project`/`Template`/`Page` schema 改动 → 不影响存量项目持久化。
- `DataRecord` 为新增独立表 → 无破坏性迁移。
- mock 文件保留(作种子 payload)→ 不破坏现有生成器(creatorPerformance/affiliate/products 仍被报告组件消费)。
