# 数据管理：Campaign→达人 下钻(合作达人关联)— 设计补充

- **日期**:2026-07-14
- **状态**:已通过设计评审,待修订实现计划
- **基线**:本文件**修订(增补)** `docs/superpowers/specs/2026-07-14-data-management-design.md` 与对应 plan `docs/superpowers/plans/2026-07-14-data-management.md`(9 task,尚未实现)。基线 spec/plan 的一切结论(DataRecord 表、CSV/JSON 导入、CRUD、双 Tab、显式种子、编辑器数据源切换)继续有效;本文件仅**反转基线 §3 对「campaign↔达人合作明细」的排除**,并补齐下钻所需的数据模型、UX 与接口。

## 1. 背景

用户对「数据管理」的要求(本次清单):

1. **Campaign 下的达人合作数据,通过 campaign 列表下钻查看** —— 在 Campaign Tab 的列表里点一条 campaign,展开看它合作的达人。
2. **区分两个大 Tab:Campaign 与达人库** ——(基线 plan Task 9 已覆盖,本次不变)。

基线 spec §3 明确写「❌ 不做 campaign↔达人合作明细管理……`listCampaignCreators(campaignId)` 对导入 campaign 返回空」。本次把第 1 条加回范围:campaign 记录上带 `creatorIds`,下钻按 id 从达人库解析合作达人。**仅关联「哪些达人参与」,不导入/存储执行效果明细**(曝光/帖数/GMV/CPS 等)——执行效果仍走现有 mock 生成器,仅作为 demo campaign 的展开增强(见 §4)。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 合作关系建模 | campaign 记录 `data.creatorIds: string[]`(opaque JSON 内) | 复用基线一行一记录的 opaque-JSON 模式;无需新表/外键;按 id 解析,per-record 粒度;导入可带 |
| 下钻内容 | **轻量**:合作达人列表(基本信息) | 用户选定;执行效果属另一范畴(基线 §3)。demo campaign 额外走 mock 生成器显示效果,导入 campaign 仅列表 |
| 执行效果数据源 | 不导入,保留 mock 生成器 | 避免引入 (campaign,达人) 级指标存储/导入面;demo 体验不回退 |
| 下钻交互 | campaign 行可展开 accordion(内联子表) | 复用现有 `CreatorPerformanceSection` 的展开模式;「通过 campaign 列表下钻」最贴切 |
| 关联建立途径 | 三入口:种子派生 / 导入携带 / 链接 UI 勾选 | demo 一键种子即有;真实数据可 JSON/CSV 导入或手工勾选 |
| 读接口 | 新增 `listCampaignCollaborators(campaignId)` | 与现有 `listCampaignCreators`(perf 派生)解耦;不改编辑器既有消费方 |
| 孤儿 id 容忍 | 解析时静默跳过已删除的达人 | 去正规化链接,删达人不应让下钻报错 |

## 3. 数据模型

### 3.1 shared `Campaign` 增字段

`packages/shared/src/types/campaign.ts` 的 `Campaign` interface 末尾追加:

```ts
/** 参与 campaign 合作的达人 id 列表(数据管理库 Creator 记录 id;下钻解析用)。 */
creatorIds?: string[];
```

可选字段 → 存量快照/记录无该字段不受影响。

### 3.2 服务端 Zod 增字段

基线 plan Task 2 的 `campaignRecordDataSchema` 追加一行(`creatorRecordDataSchema` **不动**):

```ts
creatorIds: z.array(z.string()).optional(),
```

`createDataSchema`/`importDataSchema`/`updateDataSchema` 入参仍是 `{kind, data}` / `{kind, items}` / `{data}`,`creatorIds` 随 `data` 透传并按 kind 校验——无需改入参 schema。

### 3.3 持久化形状

`DataRecord.data`(campaign 记录)示例:

```json
{
  "id": "camp-glowlab-q4",
  "name": "GlowLab Q4 Sensitive Skin Serum Launch",
  "advertiser": "GlowLab",
  "businessLine": "FT",
  "platform": "TikTok",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "budget": "$100K",
  "creatorIds": ["cre-mia", "cre-sofia", "cre-ava"]
}
```

无新表、无外键、无枚举改动 → **无新迁移**(`DataRecord` 表结构与基线 Task 1 一致)。

## 4. 下钻 UX(Campaign Tab)

基线 plan Task 9 的 Campaign Tab 表格,把首列(Campaign 名)行改为**可展开 accordion**:

- **展开 campaign 行** → 内联渲染合作达人子表:头像+Name / Handle / Platform / Tier / Followers / Engagement,数据来自 `listCampaignCollaborators(campaignId)`(§5)解析 `creatorIds`。
- **demo campaign**(种子灌入,带 `creatorIds` 且命中 mock):每个达人行**再可展开**,显示执行效果(帖数/曝光/互动/CPS/GMV),数据走现有 `listCreatorPerformance(campaignId)` mock 生成器——**保留当前 `CreatorPerformanceSection` 的丰富体验**。
- **导入 campaign**(无 perf 数据):达人行为普通列表,不可二级展开。
- 孤儿 id(达人已从达人库删除):子表跳过,不报错、不阻断。
- 子表顶部一个「管理合作达人」按钮 → 打开多选(列出达人库全部 Creator)→ 增删 `creatorIds` → `dataApi.update(campaignId, { creatorIds })` → 刷新。

一个统一下钻;执行效果是「数据存在时才显示」的增强,不是第二套下钻。

## 5. 新增读接口 `listCampaignCollaborators`

`apps/web/src/api/creators.ts`(基线 Task 6 已把该文件改为读 data library)新增:

```ts
/**
 * 取某 campaign 的合作达人列表(按 campaign.creatorIds 从达人库解析)。
 * 孤儿 id(达人已删)静默跳过。导入 campaign 无 creatorIds → 返回空。
 * 与 listCampaignCreators(creatorPerformance mock 派生,服务 demo 效果展开)解耦。
 */
export async function listCampaignCollaborators(campaignId: string): Promise<Creator[]> {
  const campaign = await getCampaign(campaignId); // Campaign | undefined(读 DataRecord)
  const ids = campaign?.creatorIds ?? [];
  if (ids.length === 0) return [];
  const settled = await Promise.allSettled(ids.map((id) => dataApi.get<Creator>(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<DataRecordDTO<Creator>> => r.status === 'fulfilled')
    .map((r) => r.value.data);
}
```

- `getCampaign` 来自基线 Task 6(读 `dataApi.get<Campaign>`);`dataApi.get(id)` 按 record id 取,记录 kind 自洽(creator 记录返回 Creator 数据)。
- N 个并行 get-by-id;孤儿(404)settled 为 rejected → 过滤。v1 已知限制:无批量端点(可后续加 `GET /data?ids=`)。
- **不改动** `listCampaignCreators` / `listCreatorPerformance` —— 仍服务 demo 效果展开与编辑器既有消费方,行为零回归。

## 6. `creatorIds` 的三条来源

### 6.1 种子派生(demo)

基线 plan Task 9 的 `seed()`(Campaign Tab「导入示例数据」按钮)灌 `MOCK_CAMPAIGNS` 前,为每条 demo campaign 派生 `creatorIds`:

```ts
const items = await Promise.all(
  MOCK_CAMPAIGNS.map(async (c) => ({
    ...c,
    creatorIds: (await listCampaignCreators(c.id)).map((cr) => cr.id),
  })),
);
await dataApi.importMany('campaign', items);
```

可行性已验证:`creatorPerformance.ts:39` 的 `ROSTER` 由 `MOCK_CREATORS` 构建 —— **两套 id 完全一致**,故种子灌入的 `creatorIds` 在达人库(同步种子 `MOCK_CREATORS`)中能解析命中。

### 6.2 导入携带

- **JSON** 导入:每条 campaign 对象带 `creatorIds: string[]` → `buildPreviewFromObjects` 只校验必填(基线 Task 7),`creatorIds` 原样保留 → 服务端 `campaignRecordDataSchema` 校验通过。
- **CSV/XLSX** 导入:模板新增 `creatorIds` 列(分号分隔,如 `cre-mia;cre-sofia`);`buildPreviewFromRows` 解析该列拆成数组(字段定义 `CAMPAIGN_FIELDS` 增 `creatorIds`,非必填)。

### 6.3 链接 UI(真实数据主路径)

- **下钻子表顶部「管理合作达人」**:多选(列出 `listCreators()` 全部达人)→ 增删 → `update`。
- **新增/编辑 Campaign 表单(`RecordFormModal`,kind=campaign)**:同样一个多选组件(复用同一 `<CreatorMultiSelect>`)。

两处共用一个组件,避免重复实现。

## 7. 向后兼容

- `Campaign.creatorIds` 可选 → 存量 `reportData` 快照、存量 DataRecord、shared 类型消费方零影响。
- 无 `Project` / `Template` / `Page` schema 改动 → 不影响存量项目持久化(遵循 [[component-type-is-persisted-schema]] 的谨慎)。
- `DataRecord` 表结构不变 → 无破坏性迁移。
- `reportData` 快照模型不变(仍快照;`creatorIds` 随 campaign 一起快照,若有)。
- `listCampaignCreators` / `listCreatorPerformance` 不改 → 编辑器既有用法零回归。

## 8. 错误处理

- **解析孤儿**:`Promise.allSettled` 过滤 rejected,不报错(§5)。
- **链接 UI 保存失败**:toast;本地多选状态回滚或重拉。
- **导入非法 `creatorIds`**(非字符串数组):服务端 `campaignRecordDataSchema` → 400;预览端 `buildPreview*` 不强校验 `creatorIds` 形状(非必填,透传),由服务端兜底。
- **CSV `creatorIds` 列格式错**(空值/非法字符):拆分后空段过滤;全空 → `creatorIds` 不写入(undefined)。

## 9. 测试策略(TDD)

遵循 [[web-chart-test-convention]](jsdom mock,断言 shell 文本)与项目 TDD 约定。

- **服务端 `data.schema.test.ts`**(基线 Task 2 增例):`campaignRecordDataSchema` 接受 `creatorIds: string[]`;拒绝非数组(如 `"cre-mia"`);无该字段仍通过。`creatorRecordDataSchema` 无 `creatorIds`。
- **服务端 `data.service.test.ts`**(基线 Task 3 增例):`create`/`update`/`importMany` 透传 `creatorIds`(mock create 捕获 `data.creatorIds`)。
- **Web `creators.test.ts`**(基线 Task 6 增例):`listCampaignCollaborators(campaignId)` —— mock `getCampaign` 返回带 `creatorIds` 的 campaign + mock `dataApi.get` 返回若干 creator → 断言返回顺序与 id;孤儿 id(404)被跳过;空 `creatorIds` → 空数组。
- **Web `DataManagement.test.tsx`**(基线 Task 9 增例):Campaign 行可展开 → 展开后子表渲染合作达人(来自 mock `listCampaignCollaborators`);「管理合作达人」多选增删后调用 `dataApi.update`;种子调用前为 demo campaign 派生 `creatorIds`(可在 `seed` 单测或集成断言)。
- **Web `RecordFormModal` / 多选组件**:campaign 表单含 creator 多选;保存 payload 带 `creatorIds`。
- **Web `dataImport.test.ts`**(基线 Task 7 增例):CSV 行带 `creatorIds` 列 → 拆数组;JSON 项带 `creatorIds` 数组 → 保留。

## 10. 涉及文件(相对基线的增量)

**Shared**
- `packages/shared/src/types/campaign.ts` — `Campaign.creatorIds?: string[]`。

**服务端**(基线 data 模块内)
- `apps/server/src/modules/data/data.schema.ts` — `campaignRecordDataSchema` 增 `creatorIds`。
- `apps/server/src/modules/data/data.schema.test.ts` — 增例。
- (service/controller/routes/schema.prisma/migration:**无增量**,基线 Task 1/3/4 不变。)

**Web**
- `apps/web/src/api/creators.ts` — 新增 `listCampaignCollaborators`(基线 Task 6 内一并加)。
- `apps/web/src/editor/dataImport.ts` — `CAMPAIGN_FIELDS` 增 `creatorIds`;`buildPreviewFromRows` 解析该列(基线 Task 7 内调整)。
- `apps/web/src/editor/components/RecordFormModal.tsx` — campaign 表单增 `<CreatorMultiSelect>`(基线 Task 8 内调整)。
- `apps/web/src/editor/components/CreatorMultiSelect.tsx` — **新增**复用组件(达人多选)。
- `apps/web/src/routes/DataManagement.tsx` — Campaign 行可展开 + 合作达人子表 + demo 效果二级展开 + 「管理合作达人」;`seed()` 派生 `creatorIds`(基线 Task 9 内调整)。
- 对应测试增例。

## 11. 对已提交 9-task 计划的影响

| 基线 Task | 增量 |
|---|---|
| Task 1(Prisma DataRecord + 迁移) | 无 |
| Task 2(data.schema.ts) | `campaignRecordDataSchema` + `creatorIds`;增测例 |
| Task 3(data.service.ts) | 无逻辑改动(透传);可加 `creatorIds` 透传断言 |
| Task 4(controller/routes) | 无 |
| Task 5(dataLibrary client) | 无 |
| Task 6(Creator→shared + campaigns/creators 读库) | + `listCampaignCollaborators` |
| Task 7(DataTable + dataImport util) | `CAMPAIGN_FIELDS` + `creatorIds`;CSV 列解析 |
| Task 8(ImportPreviewModal + RecordFormModal) | RecordFormModal campaign 表单 + `CreatorMultiSelect` |
| Task 9(DataManagement 页面) | Campaign 行展开 + 合作达人子表 + demo 效果二级展开 + 「管理合作达人」;`seed()` 派生 `creatorIds` |

无新基线 task;增量并入既有 9 task。计划文件将在 writing-plans 阶段就地修订(在受影响 task 内追加 `creatorIds` 相关 step + 测试)。

## 12. 不在本次范围(再确认)

- ❌ 不导入/存储执行效果明细(曝光/帖数/GMV/CPS/漏斗/GEO/…)——仍 mock 生成器,demo 展开用。
- ❌ 不做批量按 id 取达人的服务端端点(v1 用并行 get-by-id + settle;后续可加 `GET /data?ids=`)。
- ❌ 不改 `listCampaignCreators` / `listCreatorPerformance` / 编辑器绑定模型 / `reportData` 快照语义。
- ❌ 不做合作达人在达人库侧的反向视图(「该达人参与了哪些 campaign」)——单向 campaign→达人 即可。
