# 补齐达人库 Creator 缺失数据(audience + works + stats)

- **日期**:2026-07-15
- **状态**:已通过设计评审,待写实现计划
- **范围**:纯数据层(shared 类型 + 服务端 Zod + mock 种子);无 UI(importer/浮窗不动)、无 DB 迁移(opaque JSON 内)

## 1. 背景

达人库 `Creator` 记录目前只有基本信息 + 4 频道 KPI。但编辑器组件需要的达人维度数据有三类**不在库里**:

| 组件需要的数据 | 当前来源 | 问题 |
|---|---|---|
| 受众画像(genderSplit/ageRange/topCities) | `ReportCreator.audience` + `editor/defaults.ts` **硬编码 seed**(编辑器 store) | 不在 `Creator` 库记录;无 generator、无 API、未接 creatorId |
| 作品 list + 作品数据(cover/title/impressions/likes/comments/shares/engagementRate) | mock `creatorPerformance.ts`,**按 campaign 维度**;`allCreatorWorks()` 可 creator-centric | 不在 `Creator` 库记录 |
| 频道 stats(`CreatorStatItem[]`) | `ReportCreator.stats`(报告上下文) | 不在 `Creator` 库记录 |

用户要求:**按组件需要的数据,补齐达人库 `Creator` 记录缺失的字段**——让达人库成为组件所需达人数据的承载处(本次仅数据层; importer 重接留待后续)。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 补哪些 | audience + works + stats **全补**(均设为可选字段) | 用户选定全补 |
| 做到哪一步 | **只数据层**(类型 + Zod + 种子);浮窗/importer 本次不动 | 用户选定;UI/消费方重接留后续 |
| 形状 | 对齐组件已消费类型(audience=`ReportCreator.audience` 同形;works=works 组件字段;stats=已有 `CreatorStatItem`) | 将来重接 importer 零摩擦 |
| 可选性 | 三字段全 `optional` | 现有调用方 + CSV 导入(不带嵌套字段)不破 |
| works 种子来源 | **复用 `allCreatorWorks()`**(跨 campaign 聚合 + 按 creatorId 去重)映射成 `CreatorWork[]` | 与编辑器 works 组件取的数据同源一致 |
| audience/stats 种子 | 新确定性 generator(无 RNG,沿用 `buildChannelMetrics` 的 tier×platform×index 抖动模式) | 库里需要这些数据;无现成 generator |
| DRY | 提取 `CreatorAudience`/`AudienceSlice`/`CreatorWork` 到 shared;`ReportCreator.audience` 改用 `CreatorAudience` | 消除内联重复;类型等价、零行为变化 |

## 3. 不在本次范围(明确划界)

- ❌ 浮窗 `CreatorDetailDrawer` 不加 audience/works/stats 展示(仍 profile + KPI)。
- ❌ 编辑器 importer(fan-gender/age/city、works、stats)不重接(仍读 store/硬编码 seed/per-campaign mock)。
- ❌ CSV 导入不带嵌套字段(CSV 表达不了 audience/works/stats 数组);CSV 导入的达人这三字段为 `undefined`(可选,不报错)。JSON 导入可带。
- ❌ 无 Prisma 迁移、无新表(全在 `DataRecord.data` opaque JSON 内)。

## 4. Shared 类型(`packages/shared/src/types/campaign.ts`)

新增 + 扩展(全可选):

```ts
/** 受众画像单项(性别/年龄/城市占比)。value 为百分比数值。 */
export interface AudienceSlice {
  label: string;
  value: number;
  color?: string;
}

/** 达人受众画像(性别/年龄/城市分布)。Creator 与 ReportCreator 共用。 */
export interface CreatorAudience {
  genderSplit?: AudienceSlice[];
  ageRange?: AudienceSlice[];
  topCities?: AudienceSlice[];
}

/** 达人作品(列表项 + 作品数据)。对齐 works 组件渲染所需字段。 */
export interface CreatorWork {
  id: string;
  title: string;
  cover?: string;
  url?: string;
  platform?: string;
  publishedAt?: string;
  impressions?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  saves?: string;
  engagementRate?: string;
}
```

`Creator` 加 3 字段:
```ts
export interface Creator {
  // ...现有字段...
  /** 受众画像(性别/年龄/城市)。 */
  audience?: CreatorAudience;
  /** 作品列表 + 作品数据。 */
  works?: CreatorWork[];
  /** 频道维度 stat 项(creator-stats-strip 用)。 */
  stats?: CreatorStatItem[];
}
```

`ReportCreator.audience` 改用提取的 `CreatorAudience`(原内联形状等价,零行为变化;DRY)。`CreatorStatItem` 已在该文件定义,直接复用。

## 5. 服务端 Zod(`apps/server/src/modules/data/data.schema.ts`)

`creatorRecordDataSchema` 加 3 个可选字段,镜像 §4 形状。遵循 [[zod-strips-undeclared-meta-keys]]:

```ts
const audienceSliceSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});
const creatorAudienceSchema = z.object({
  genderSplit: z.array(audienceSliceSchema).optional(),
  ageRange: z.array(audienceSliceSchema).optional(),
  topCities: z.array(audienceSliceSchema).optional(),
});
const creatorWorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  cover: z.string().max(2048).optional(),
  url: z.string().max(2048).optional(),
  platform: z.string().optional(),
  publishedAt: z.string().optional(),
  impressions: z.string().optional(),
  likes: z.string().optional(),
  comments: z.string().optional(),
  shares: z.string().optional(),
  saves: z.string().optional(),
  engagementRate: z.string().optional(),
});
const creatorStatItemSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  value: z.string(),
  color: z.string(),
  selected: z.boolean().optional(),
});
```

`creatorRecordDataSchema` 增:`audience: creatorAudienceSchema.optional()`、`works: z.array(creatorWorkSchema).optional()`、`stats: z.array(creatorStatItemSchema).optional()`。

## 6. 种子(`apps/web/src/api/mock/creators.ts`)

`MOCK_CREATORS` 当前:`CREATOR_META.map((c, i) => ({ ...c, avatar: creatorAvatarUrl(c.name), metrics: buildChannelMetrics(c, i) }))`。增 3 字段:

```ts
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c, i) => ({
  ...c,
  avatar: creatorAvatarUrl(c.name),
  metrics: buildChannelMetrics(c, i),
  audience: buildAudience(c, i),
  works: buildWorks(c),
  stats: buildStats(c, i),
}));
```

新确定性 generator(沿用 `buildChannelMetrics` 的 `TIER_*` 基线 + `CHANNEL_JITTER` 抖动模式):

- **`buildAudience(meta, index)`** → `CreatorAudience`:
  - `genderSplit`:[{Female, ~52±jit},{Male, ~48±jit}](归一到合 ~100)。
  - `ageRange`:[18-24 / 25-34 / 35-44 / 45+],分布随 tier/platform 抖动(25-34 主峰)。
  - `topCities`:4 城(US: New York/Los Angeles…;CN: 上海/北京…;按 `meta.region` 选池),占比抖动。
- **`buildWorks(meta)`** → `CreatorWork[]`:**复用 `allCreatorWorks()`**(从 `./creatorPerformance` import)→ `.find((cw) => cw.creatorId === meta.id)?.posts ?? []`,映射 `{ postId→id, title, cover, platform, publishedAt, impressions, likes, comments, shares, engagementRate }`(去 creatorId/creatorName)。不在任何 campaign 的达人 → `[]`。**实现时先确认 `creatorPerformance` 不反向 import `creators`(避免循环依赖);若有,改延迟取或内联小生成器。**
- **`buildStats(meta, index)`** → `CreatorStatItem[]`:[Followers / Engagement / Avg Reach / Impressions] 各带 `color`(取自 `CAMPAIGN_COLORS` 或固定色板),`value` 复用 `buildChannelMetrics` 量级。

## 7. CSV vs JSON 导入

- CSV:`CREATOR_FIELDS` 不含 audience/works/stats(数组,CSV 表达不了)→ CSV 导入的达人这三字段 `undefined`(可选,Zod 通过)。
- JSON:`buildPreviewFromObjects` 透传完整对象 → JSON 导入可带 audience/works/stats(服务端 Zod 校验)。
- 手动新增表单(RecordFormModal):本次**不加** audience/works/stats 编辑(超出数据层范围;手动新增的达人这三字段空)。

## 8. 验证 / 测试

无 UI 消费,靠:

- **shared typecheck**:新类型编译;`ReportCreator.audience` 改引用 `CreatorAudience` 后无回归。
- **`data.schema.test.ts`**:`creatorRecordDataSchema` 合法 creator(含 audience/works/stats)通过;缺/畸形这三字段的行为(可选→缺失通过;类型错→拒绝,如 `audience.genderSplit` 项缺 `label`)。
- **seed 测试(新 `creators.test.ts` 或并入)**:`MOCK_CREATORS` 每条含 `audience`/`works`/`stats` 且形状合法(genderSplit value 为 number、works 项有 id+title、stats 项有 label+value+color)。
- **API 抽查(手动/冒烟)**:`GET /api/v1/data?kind=creator` 返回的 `data` 含 audience/works/stats。
- 遵循 [[web-chart-test-convention]](无 chart 相关);web 测试用 apps/web 路径 binary(见 [[web-vitest-run-from-root]])。

## 9. 涉及文件

- `packages/shared/src/types/campaign.ts` —— 加 `AudienceSlice`/`CreatorAudience`/`CreatorWork`;`Creator` 加 3 字段;`ReportCreator.audience` 改用 `CreatorAudience`。
- `apps/server/src/modules/data/data.schema.ts` —— `creatorRecordDataSchema` 加 3 字段镜像(+ sub-schemas)。
- `apps/server/src/modules/data/data.schema.test.ts` —— 新字段 Zod 用例。
- `apps/web/src/api/mock/creators.ts` —— 加 `buildAudience`/`buildWorks`/`buildStats`;`MOCK_CREATORS` 注入。
- `apps/web/tests/`(新或并入)—— seed 形状用例。

## 10. 兼容性

- 三字段全可选 → 现有 `Creator` 消费方(editor importers、DataConfigOverlay、data-management 列表/浮窗)零改动。
- 无 Prisma 迁移、无新表(`DataRecord.data` opaque JSON)。
- CSV 导入的达人缺这三字段(可选,不报错);JSON/seed 带上。
- `ReportCreator.audience` 类型等价替换(内联→`CreatorAudience`),无行为变化。
- 浮窗 `CreatorDetailDrawer` 仍只展示 profile + KPI(本次不展示新数据);`metrics ?? []` 等既有守卫不受影响。
