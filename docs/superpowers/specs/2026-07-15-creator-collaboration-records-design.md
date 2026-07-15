# 达人合作（Collaboration）记录 — 设计

- 日期：2026-07-15
- 状态：已批准（待实现）
- 范围：数据管理模块（`apps/server/src/modules/data`、`apps/web/src/routes/DataManagement.tsx`、`packages/shared`）

## 背景

数据管理模块当前用 opaque-JSON 的 `DataRecord`（`kind: CAMPAIGN | CREATOR`）持久化。Campaign↔Creator 的唯一持久化联系是 `Campaign.creatorIds: string[]`（扁平 id 列表，无每达人细节）。**所有**作品级数据（posts、截图、效果、画像、词云、placements、cps）只存在于 mock（`apps/web/src/api/mock/creatorPerformance.ts`），不入库。四个报告组件（WorkScreenshot / WorkMetrics / CommentWordcloud / 画像）是互不关联、无共享 key 的独立数据块。没有「合作」概念把 post+reels 这样的多作品类型组合起来。

## 目标

在「达人合作详情」（DataManagement 抽屉，`aria-label="达人合作详情"`）中建模并持久化**一次合作**：一个达人在一个战役里的合作，由多种「作品类型」（post/reels/video…）组成，每种作品类型携带自己的四类数据（作品截图 / 效果数据 / 画像 / 评论词云）。「合作方式」= 这些作品类型的组合本身（无独立业务模式字段）。

## 已确认的决策

1. **数据落点**：入库——新增 `COLLABORATION` 记录类型（沿用 DataRecord 模式）。
2. **合作方式 = 作品类型组合**：模型只有 `deliverables[]`，「合作方式」标签从 contentType 列表派生，不单独存储。
3. **本期范围**：只数据管理侧（建模 + 入库 + Zod + CRUD/导入 + 抽屉展示与编辑）。**报告组件绑定留作下一期**（数据模型预留支持）。
4. **ContentType**：固定枚举 `'post' | 'reels' | 'video' | 'image' | 'live' | 'story'`（可后续扩展）。
5. **抽屉编辑器**：v1 用功能性内联表单（复用 `ImageInput` 等既有输入组件）。
6. **演示数据**：显式「导入演示数据」动作从 `creatorPerformance.ts` 种子生成 collaboration 记录（幂等，按确定性 id upsert）；不自动写库，抽屉无记录时显示空态。

## 方案：新增 `COLLABORATION` DataRecord kind

新增第三个 `DataRecordKind`：**`COLLABORATION`**。一条记录 = 一个达人在一个战役里的一次合作。否决的替代方案：
- *扩展 Campaign 记录嵌 collaborations 树*：Campaign 记录膨胀，ManageCollaboratorsModal 整体重写，多达人并发编辑冲突，不扩展。
- *扩展 Creator 记录按 campaignId 存*：合作数据与达人记录耦合，「战役 X 的所有合作」难查，跨战役膨胀。

独立 kind 让记录聚焦（一合作一记录）、贴合既有 DataRecord 模式、可扩展。**确定性 id `collab:{campaignId}:{creatorId}`** → 幂等导入 + 直接 `get`（无需 list 过滤 opaque JSON；抽屉已知 `creatorIds`）。

## 数据模型

### Prisma（`apps/server/prisma/schema.prisma`）

`DataRecordKind` 枚举新增 `COLLABORATION` + 一个迁移（`ALTER TYPE ... ADD VALUE`）。无新模型——复用 `DataRecord`，`kind: COLLABORATION`，`data: Json`。

### 共享类型（新文件 `packages/shared/src/types/collaboration.ts`）

```ts
import type {
  CommentWordItem, WorkAudienceInsight, WorkMetricItem, WorkScreenshotItem,
} from './editor';

/** 作品类型（合作方式的构成单元）。 */
export type ContentType = 'post' | 'reels' | 'video' | 'image' | 'live' | 'story';

/** 一次合作中的一种作品类型 + 它的四类数据（均可选，按需填充）。 */
export interface CollaborationDeliverable {
  contentType: ContentType;
  screenshots?: WorkScreenshotItem[];  // 作品截图（src/caption?；captionHidden 为渲染开关，存储忽略）
  metrics?: WorkMetricItem[];          // 效果数据（label/value/color?）
  audience?: WorkAudienceInsight;      // 画像（topCities?/genderSplit?/ageRange?/trend?/trendLabel?）
  wordcloud?: CommentWordItem[];       // 评论词云（text/weight/sentiment）
}

/** 一条合作记录的 data 载荷。 */
export interface CollaborationData {
  campaignId: string;
  creatorId: string;
  deliverables: CollaborationDeliverable[];
}
```

复用 editor.ts 的四个 item 类型（均在 `packages/shared` 内，无跨包层问题）；`WorkScreenshotItem.captionHidden` 为渲染开关，存储层忽略。导出 `CollaborationData`/`CollaborationDeliverable`/`ContentType`，并在 `packages/shared/src/types/index.ts` re-export。

「合作方式」展示标签由 `deliverables.map(d => d.contentType).join(' + ')` 派生（如 `post + reels`）。

### Server Zod（`apps/server/src/modules/data/data.schema.ts`）

```ts
const contentTypeSchema = z.enum(['post', 'reels', 'video', 'image', 'live', 'story']);

const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  screenshots: screenshotItemSchema.optional(),      // 复用/镜像 WorkScreenshotItem
  metrics: metricItemSchema.optional(),              // {label,value,color?}
  audience: audienceInsightSchema.optional(),        // topCities?/genderSplit?/ageRange?/trend?/trendLabel?
  wordcloud: wordItemSchema.optional(),              // {text,weight,sentiment}
});

export const collaborationRecordDataSchema = z.object({
  campaignId: z.string().min(1),
  creatorId: z.string().min(1),
  deliverables: z.array(deliverableSchema).min(1),
});
```

`kindSchema` 扩为 `z.enum(['campaign', 'creator', 'collaboration'])`；`dataSchemaForKind('collaboration')` 返回 `collaborationRecordDataSchema`。子 schema（screenshot/metric/audience/word）镜像 editor 类型——若 editor 侧已有 Zod 可复用则复用，否则在此定义。（`screenshotItemSchema` 不含 `captionHidden`，存储忽略。）

Service（`data.service.ts`）的 create/update/importMany 已 kind-agnostic（按 `dataSchemaForKind` 校验），除枚举外无需改动逻辑。

## Web API

`apps/web/src/api/dataLibrary.ts`：`DataKind` 增 `'collaboration'`。新增 helper（`apps/web/src/api/collaborations.ts`，或并入 campaigns.ts）：

```ts
export const collaborationId = (campaignId: string, creatorId: string) =>
  `collab:${campaignId}:${creatorId}`;

export async function getCollaboration(campaignId, creatorId): Promise<CollaborationData | null> {
  const r = await dataApi.get<CollaborationData>('collaboration', collaborationId(campaignId, creatorId)).catch(...);
  return r ?? null;  // 404 → null
}
export async function saveCollaboration(data: CollaborationData) {
  return dataApi.update('collaboration', collaborationId(data.campaignId, data.creatorId), data)
    .catch(() => dataApi.create('collaboration', { id: collaborationId(...), data }));  // 不存在则建
}
export async function removeCollaboration(campaignId, creatorId) { ... }
```

## 抽屉 UI（`apps/web/src/routes/DataManagement.tsx`）

`CollaboratorPanel` 当前对每个 collaborator（由 `creatorIds` 解析）展示 mock 的 `CreatorPerfDetail`。改为：

- 每个 creator 行可展开 → 展开后拉取 `getCollaboration(campaignId, creatorId)`。
- **合作详情视图**：
  - 顶部「合作方式」chip：`deliverables.map(d => d.contentType).join(' + ')`（无记录时显示「未设置合作」+「编辑合作」按钮）。
  - 每种 deliverable 一个分区：contentType 标题 + 四类数据编辑器：
    - 作品截图：`ImageInput` 列表（src + caption），可增删。
    - 效果数据：`{label, value, color?}` 行编辑。
    - 画像：Top 城市 / 性别 / 年龄段 `{label, value, color?}` 行编辑（趋势留可选）。
    - 评论词云：`{text, weight, sentiment}` 行编辑。
  - 空 slot 显示「暂无」+ 添加控件。
- 「编辑合作」保存 → `saveCollaboration`；「删除」→ `removeCollaboration`。
- 替换现有 mock `CreatorPerfDetail`（mock 不再作为抽屉数据源）。

编辑器复用既有输入组件与表单模式（参考 `WorkScreenshotFields` 等 property-panel 的行编辑样式），v1 重功能不重美观。

## CRUD / 导入 / 种子

- **创建/编辑/删除**：经抽屉按 (campaign, creator) 操作。
- **批量导入**：`POST /api/v1/data/import`，既有按 id 幂等 upsert 路径；确定性 id 保证重复导入不重复。
- **演示种子**：抽屉或数据管理页提供「导入演示数据」动作，从 `creatorPerformance.ts` 的 mock（`campaignCreatorWorks` 等）为现有 (campaign, creator) 组装 `CollaborationData` 并 upsert。显式触发，不自动写库。

## 不在本期范围（下一期）

报告组件绑定：WorkScreenshot / WorkMetrics / CommentWordcloud / 画像从指定 `(creator, contentType)` deliverable 导入，替换 mock。数据模型已为此塑形；既有 `ReportWorkScreenshotImporter` 是未来钩子点。

## 测试

- **Server**：Zod 接受/拒绝 collaboration 载荷（缺 campaignId/creatorId、空 deliverables、非法 contentType 各拒绝）；service create/import 幂等 upsert（同 id 二次导入计 updated）。
- **Web**：`getCollaboration` 404→null；`collaborationId` 确定性；抽屉渲染合作方式 chip + 各 deliverable 编辑器；保存写入记录（store/api mock）。
- 遵循 `web-chart-test-convention`：recharts 在 jsdom 被 mock，只断言外壳。
