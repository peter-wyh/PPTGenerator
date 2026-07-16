# 达人库构建更丰富的信息(画像字段 + 作品扩展 + 详情/表单/列表全链路)

- **日期**:2026-07-16
- **状态**:已通过设计评审,待写实现计划
- **范围**:全链路 —— shared 类型 + 服务端 Zod + 结构化表 migration + mock 种子 + CSV/JSON 导入 + 详情浮窗展示 + 表单混合录入 + 列表检索 + PPT 消费映射
- **交付策略**:方案 1 —— DataRecord 优先 + 分 Phase 1/2/3
- **前置**:[2026-07-15-creator-data-supplement-design.md](./2026-07-15-creator-data-supplement-design.md) 已补 `audience`/`works`/`stats` 数据层。本 spec 在其基础上扩展画像与作品字段,并打通 UI。

## 1. 背景

7/15 已把 `audience`/`works`/`stats` 补进 `Creator` 数据层,但**刻意只做数据层,浮窗/importer/列表均未接**。当前达人库仍存在三层"信息不够丰富":

| 缺口 | 现状 |
|---|---|
| 画像维度单薄 | `Creator` 无 `bio`/`tags`/`contact`/`rate`;达人库存不了简介、风格标签、商务联系方式、合作报价 |
| 作品字段单薄 | `CreatorWork` 无内容形式/话题标签/带货归因/时长/精选标记 |
| 已有数据看不见/填不进 | 详情浮窗 `CreatorDetailDrawer` 只展示 6 基本字段 + KPI,**不展示 audience/works/stats**;表单 `RecordFormModal` 只能填 10 扁平字段,**手动建达人永远是空壳**;列表 `CreatorPage` **无搜索/筛选/排序** |
| 结构化表缺列 | `model Creator` 无 `stats` 列(类型有 `stats?`,走结构化表会丢);顶级新字段无落点 |

用户要求:**构建更丰富的达人库信息**——扩充画像与作品字段,并让数据在详情可见、在表单可录、在列表可检索、供 PPT 业务组件消费。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 方案 | **DataRecord 优先 + 分阶段** | 达人库页面实际走 `DataRecord`(opaque JSON),主路径加字段即透传;分阶段降风险 |
| 画像字段 | `bio` + `tags[]` + `contact` + `rate` 全补,全可选 | 用户选定 |
| 作品字段 | `contentType` + `hashtags[]` + `productLink` + `attribution` + `duration` + `featured`,全可选 | 用户选定 |
| 录入方式 | **混合**:扁平字段控件 + 受众/作品/统计/标签/报价子编辑器 | 用户选定;兼顾体验与实现量 |
| 列表筛选 | **前端 in-memory filter**(搜索 + 平台/层级/品类/标签 + 排序 + 分页) | 达人库数据规模小;后端 `campaignsApi` 虽支持查询参数但本页走 `dataApi` 全量,前端筛选零后端改动 |
| 持久化主路径 | `DataRecord.data` JSON(Zod 校验)透传全字段 | 达人库页面数据源;新字段无需 migration 即可用 |
| 结构化表 | 加 `profile Json`(聚合 bio/tags/contact/rate)+ 补 `stats Json`(修复已知缺口);作品走现有 `works` Json 免迁移 | 保持 `campaignsApi.dtoToCreator` 类型一致;消除已存在的不一致 |
| 可选性 | 所有新字段全 `optional` | 现有消费方 + CSV(不带嵌套)零破坏 |
| 交付切分 | Phase 1 数据层+详情可见 / Phase 2 表单录入 / Phase 3 列表检索 | 复用 7/15"先数据后 UI"模式;每阶段可独立验证 |

## 3. 不在本次范围(明确划界)

- ❌ 不改 `ComponentType` 持久化 schema(见 [[component-type-is-persisted-schema]])。
- ❌ 不动达人库以外页面(Campaign/合作列表)的达人展示逻辑。
- ❌ 不引入达人库的批量编辑/批量导入富数据(作品/受众仍逐条编辑)。
- ❌ 不做达人评分/推荐算法(只做数据承载与检索)。
- ❌ `rate` 只做报价展示与录入,不做预算预估/比价计算。

## 4. Shared 类型扩展(`packages/shared/src/types/campaign.ts`)

### 4.1 画像字段

```ts
/** 达人商务联系方式。 */
export interface CreatorContact {
  mcn?: string;           // MCN/机构
  agency?: string;        // 经纪公司
  email?: string;         // 商务邮箱
  phone?: string;         // 商务电话
  contactPerson?: string; // 商务联系人
}

/** 达人合作报价(多档 + 货币 + 说明)。 */
export interface CreatorRate {
  currency?: string; // CNY / USD …
  post?: string;     // 图文报价
  video?: string;    // 短视频报价
  live?: string;     // 直播报价
  note?: string;     // 报价说明
}

export interface Creator {
  // ...现有: id/name/handle/platform/tier/followers/engagement/category/region/avatar
  //          metrics/audience/works/stats(7/15 已加)
  /** 达人简介 / Bio。 */
  bio?: string;
  /** 内容标签(风格/品类,如「美妆种草」「知识科普」)。 */
  tags?: string[];
  /** 商务联系方式。 */
  contact?: CreatorContact;
  /** 合作报价。 */
  rate?: CreatorRate;
}
```

### 4.2 作品字段扩展

```ts
/** 作品带货效果归因。 */
export interface CreatorWorkAttribution {
  clicks?: string;   // 点击
  orders?: string;   // 下单
  gmv?: string;      // 成交额
  ctr?: string;      // 点击率 %
  cvr?: string;      // 转化率 %
}

export interface CreatorWork {
  // ...现有: id/title/cover/url/platform/publishedAt
  //          impressions/likes/comments/shares/saves/engagementRate
  /** 内容形式:image|video|live|long|series(图文|短视频|直播|长视频|合集)。 */
  contentType?: string;
  /** 话题标签 / 关键词。 */
  hashtags?: string[];
  /** 带货 / 挂车链接。 */
  productLink?: string;
  /** 带货效果归因。 */
  attribution?: CreatorWorkAttribution;
  /** 视频 / 内容时长(如 "01:23")。 */
  duration?: string;
  /** 是否置顶 / 精选。 */
  featured?: boolean;
}
```

## 5. 服务端 Zod(`apps/server/src/modules/data/data.schema.ts`)

镜像 §4,全可选。遵循 [[isolate-feature-work-in-worktree]](server Zod 是 persisted schema 的一部分)。在现有 `creatorRecordDataSchema`(L105)/`creatorWorkSchema`(L80)基础上扩展:

```ts
const creatorContactSchema = z.object({
  mcn: z.string().optional(),
  agency: z.string().optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(64).optional(),
  contactPerson: z.string().max(120).optional(),
});

const creatorRateSchema = z.object({
  currency: z.string().max(8).optional(),
  post: z.string().max(64).optional(),
  video: z.string().max(64).optional(),
  live: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
});

const creatorWorkAttributionSchema = z.object({
  clicks: z.string().optional(),
  orders: z.string().optional(),
  gmv: z.string().optional(),
  ctr: z.string().optional(),
  cvr: z.string().optional(),
});
```

- `creatorWorkSchema` 增:`contentType`/`hashtags: z.array(z.string()).optional()`/`productLink: z.string().max(2048).optional()`/`attribution: creatorWorkAttributionSchema.optional()`/`duration`/`featured: z.boolean().optional()`。
- `creatorRecordDataSchema` 增:`bio: z.string().max(2000).optional()`、`tags: z.array(z.string()).optional()`、`contact: creatorContactSchema.optional()`、`rate: creatorRateSchema.optional()`。

## 6. 持久化策略

### 6.1 主路径:DataRecord JSON(达人库页面数据源)

`dataApi.list<Creator>('creator')` → `DataRecord.data`(Json)→ `creatorRecordDataSchema` 校验 → 列表/详情读回。**§4 全字段自动透传,无需 migration 即在达人库生效**。

### 6.2 结构化表(`model Creator`,schema.prisma L201)

- **作品新字段**:落入现有 `works Json` 列,**免迁移**。
- **顶级新字段**:新增 `profile Json` 聚合 `bio`/`tags`/`contact`/`rate`(避免每个字段单独加列)。
- **顺带修复**:补 `stats Json` 列(类型有 `stats?` 但表无列,走 `campaignsApi.dtoToCreator` 会丢 —— 这是已存在的不一致)。

```prisma
model Creator {
  // ...existing id/name/handle/platform/tier/followers/engagement/category/region/avatar
  metrics    Json?
  audience   Json?
  works      Json?
  stats      Json?   // 新增:修复已知缺列
  profile    Json?   // 新增:聚合 bio/tags/contact/rate
  ownerId    String
  // ...
}
```

- `campaignsApi.dtoToCreator`(L69)与写路径同步:`profile` Json 拆回 `bio`/`tags`/`contact`/`rate`;补 `stats` 映射。
- **migration**:手写 SQL(见 [[prisma-migrate-dev-needs-shadow-db]] —— dev DB 用户缺 CREATE DATABASE,`migrate dev` 触发 P3014;走 `ADD COLUMN ... JSON NULL` + `migrate deploy`/`migrate resolve`)。两列均 nullable,向后兼容。

## 7. Phase 1 — 数据层 + 详情可见

### 7.1 mock 种子(`apps/web/src/api/mock/creators.ts`)

沿用 `buildChannelMetrics` 的 `TIER_* × platform × index` 确定性抖动模式(无 RNG),新增生成器并注入 `MOCK_CREATORS`:

- **`buildBio(meta, index)`** → `string`:基于 `category`/`tier` 拼一句简介(确定性模板,如 `${name} 是一位 ${category} 领域 ${tier} 达人…`)。
- **`buildTags(meta, index)`** → `string[]`:按 `category` 选标签池,确定性取 2–4 个。
- **`buildContact(meta, index)`** → `CreatorContact`:确定性邮箱(`handle` 派生)/ 电话 / MCN 占位。
- **`buildRate(meta, index)`** → `CreatorRate`:按 `tier` 基线(post/video/live 三档 + currency 按 `region`)。
- **作品扩展**:`buildWorks` 已存在(复用 `allCreatorWorks()`),在映射时补 `contentType`/`hashtags`/`productLink`/`attribution`/`duration`/`featured`(确定性派生:`featured` 取每条达人首作,`contentType` 按 platform 映射)。

```ts
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c, i) => ({
  ...c,
  avatar: creatorAvatarUrl(c.name),
  metrics: buildChannelMetrics(c, i),
  audience: buildAudience(c, i),
  works: buildWorks(c),
  stats: buildStats(c, i),
  bio: buildBio(c, i),
  tags: buildTags(c, i),
  contact: buildContact(c, i),
  rate: buildRate(c, i),
}));
```

### 7.2 CSV / JSON 导入(`apps/web/src/editor/dataImport.ts`)

- **CSV**(`CREATOR_FIELDS`,L5):CSV 表达不了嵌套数组/对象 → 追加可扁平化的列:`bio`(单文本)、`tags`(分号分隔)。`contact`/`rate`/作品扩展留给 JSON 导入。CSV 导入的达人 `contact`/`rate`/作品扩展为 `undefined`(可选,Zod 通过)。
- **JSON**:`buildPreviewFromObjects` 透传完整对象 → JSON 导入可带全字段(服务端 Zod 校验)。
- **下载模板**:同步更新 CSV/JSON 模板头与新字段示例。

### 7.3 详情浮窗(`apps/web/src/editor/components/CreatorDetailDrawer.tsx`)

当前只展示 profile + KPI。重构为分区展示,**全部 `?? []` / `?? '-'` 守卫,缺字段不报错**:

1. **头部**:头像 + name + handle + `bio`(简介文本,多行)+ `tags`(chips)。
2. **基本属性网格**(现有 6 字段)+ **合作报价**(`rate` 三档卡片)+ **联系方式**(`contact` 字段列表)。
3. **频道 KPI**(现有 metrics)。
4. **受众画像**(`audience`:性别/年龄/城市 —— 浮窗内轻量内联条形/百分比展示,**不依赖 PPT 画布组件**)。
5. **作品列表**(`works`:卡片/行,展示 cover/title/contentType/发布时间/互动数据/`featured` 角标/`attribution` 归因小字)。
6. **频道统计**(`stats`:条目列表)。

> 浮窗是只读展示,不在此处做编辑(编辑走 Phase 2 表单)。

## 8. Phase 2 — 表单混合录入(`RecordFormModal.tsx`)

### 8.1 重构思路

`RecordFormModal` 当前按 `CREATOR_FORM_FIELDS`(扁平 FieldDef[])渲染。改为**基本信息区(扁平控件)+ 富数据区(子编辑器)**,`creator` kind 专用布局。

### 8.2 新增子编辑器组件(`apps/web/src/editor/components/creator-fields/`)

- **`TagsInput`**:chip 输入(回车/逗号添加,× 删除)→ `string[]`。基本信息区用。
- **`RateEditor`**:currency + post/video/live 三行输入 + note → `CreatorRate`。
- **`AudienceEditor`**:genderSplit/ageRange/topCities 三组,每组可增删 `AudienceSlice` 行(label+value),实时归一提示 → `CreatorAudience`。
- **`WorksEditor`**:作品行列表,每行可展开编辑全部字段(含 §4.2 新字段);支持增/删/上移下移/`featured` 标记 → `CreatorWork[]`。
- **`StatsEditor`**:stat 行(label+value+color+selected)增删 → `CreatorStatItem[]`。
- **`ContactEditor`**:5 字段表单 → `CreatorContact`。

### 8.3 提交

表单 state 组装回完整 `Creator`(基本字段 + 子编辑器产出),走现有 `dataApi.create/update` → Zod 校验。校验失败由服务端 400 返回,前端按 [[save-failure-http-content-type-triage]] 定位。

## 9. Phase 3 — 列表检索(`apps/web/src/routes/CreatorPage.tsx`)

**前端 in-memory filter**(数据走 `dataApi.list<Creator>('creator')` 全量,客户端过滤):

- **搜索框**:匹配 name/handle/tags(模糊)。
- **筛选**:platform(下拉)/ tier(下拉)/ category(下拉)/ tags(多选 chips,从全量聚合)。
- **排序**:followers / engagement / 最近更新(数值字段需 parse 字符串量级,如 "1.28M")。
- **分页**:前端分页(默认 20/页)。
- **列**:保留现有 8 列,新增可配置指标列(如 avg engagement、作品数、tags)。

> 多筛选为 AND 组合;tags 筛选为 OR(命中任一所选标签)。

## 10. PPT 消费映射

`DataConfigOverlay` 选达人 → `ReportDataContext.creators: ReportCreator[]`。**当前不存在 `creatorToReportCreator` 映射函数**(grep 未命中)——实现时需:

1. 定位 `Creator → ReportCreator` 的转换点(可能在 DataConfigOverlay 选人时,或报告数据 context builder)。
2. 补全新字段映射:`bio` → `ReportCreator.intro`?(`CreatorAvatarCardData.intro` 已存在);`tags` → 报告标签;作品新字段 → works 组件数据。
3. 若 `CreatorComponents` 消费的 `CreatorAvatarCardData`/works 数据类型与库 `Creator` 不同构,补映射 helper(类比 [[campaign-field-mirror-unintegrated]] 的 `campaignToReportCampaign`)。
4. 确保 `CreatorWorksList` / 作品效果卡能读到 `attribution`/`contentType`/`featured`。

> 标注为实现时确认点:转换点位置与字段映射以代码为准。

## 11. 测试策略

遵守 [[web-chart-test-convention]](recharts mock,只断言 shell 文本)、[[web-vitest-run-from-root]](用 `apps/web` 绝对路径 binary)。

- **server `data.schema.test.ts`**:`creatorRecordDataSchema` / `creatorWorkSchema` 新字段 round-trip(合法通过;畸形拒绝,如 `contact.email` 超长、`rate` 类型错)。
- **mock 种子测试**:`MOCK_CREATORS` 每条含 `bio`/`tags`/`contact`/`rate` 且形状合法;作品含新字段;确定性(同输入同输出)。
- **详情浮窗测试**:`CreatorDetailDrawer` 渲染含富数据的达人(各分区出现)、缺字段的达人(守卫不报错)。
- **子编辑器测试**:各子编辑器增删/修改 state 正确回传。
- **列表筛选测试**:`CreatorPage` 搜索/筛选/排序/分页交互(纯文本断言,不依赖 chart)。
- **类型检查**:shared 类型扩展后,`Creator` 全部消费方编译通过(`pnpm -w typecheck` 或 apps/web/server 各自)。

## 12. 涉及文件

**类型 / Schema**
- `packages/shared/src/types/campaign.ts` —— §4 类型扩展
- `apps/server/src/modules/data/data.schema.ts` —— §5 Zod 扩展
- `apps/server/prisma/schema.prisma` —— §6.2 `profile`/`stats` Json 列 + migration SQL

**数据源 / 导入**
- `apps/web/src/api/mock/creators.ts` —— §7.1 生成器 + 注入
- `apps/web/src/api/campaignsApi.ts` —— `dtoToCreator` `profile`/`stats` 映射
- `apps/web/src/editor/dataImport.ts` —— §7.2 `CREATOR_FIELDS` + 模板

**UI**
- `apps/web/src/editor/components/CreatorDetailDrawer.tsx` —— §7.3 详情分区
- `apps/web/src/editor/components/RecordFormModal.tsx` —— §8 表单重构
- `apps/web/src/editor/components/creator-fields/`(新)—— §8.2 子编辑器
- `apps/web/src/routes/CreatorPage.tsx` —— §9 列表检索

**PPT**
- `apps/web/src/editor/components/CreatorComponents.tsx` + 转换点 —— §10 消费映射

**测试**
- `apps/server/src/modules/data/data.schema.test.ts`
- `apps/web/tests/`(mock seed / 浮窗 / 子编辑器 / 列表)

## 13. 兼容性

- 所有新字段全可选 → 现有 `Creator` 消费方(DataConfigOverlay、data-management 列表、editor importers、`creatorLink.ts`)零改动。
- DataRecord 主路径:存量记录无新字段(可选,Zod 通过)。
- 结构化表新增两 nullable Json 列,向后兼容;`dtoToCreator` 守卫 `profile ?? {}`。
- CSV 导入的达人缺 `contact`/`rate`/作品扩展(可选,不报错);JSON/seed 带全字段。
- 不动 `ComponentType` 持久化 schema([[component-type-is-persisted-schema]])。

## 14. 风险与缓解

| 风险 | 缓解 |
|---|---|
| migration P3014 阴影 DB | 手写 `ADD COLUMN ... JSON NULL` SQL + `migrate deploy`/`resolve`([[prisma-migrate-dev-needs-shadow-db]]) |
| 结构化表与 DataRecord 双轨不一致 | §6 明确两路径同步;达人库页面以 DataRecord 为准,结构化表仅保 `campaignsApi` 一致性 |
| `Creator → ReportCreator` 转换点未定位 | §10 标为实现时确认;先 grep 定位,无则新建 `creatorToReportCreator` |
| Phase 2 表单重构面大 | 子编辑器组件独立、可单测;分组件提交 |
| 并发 feature 改动冲突 | 用 worktree 隔离([[isolate-feature-work-in-worktree]]);验证前确认 dev server cwd([[dev-server-cwd-may-be-worktree]]) |
| 量级字符串解析("1.28M")排序 | 排序前统一 parse 量级辅助函数,单测覆盖 |
