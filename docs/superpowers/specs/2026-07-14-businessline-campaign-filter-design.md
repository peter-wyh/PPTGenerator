# 新建项目：业务线置顶 + Campaign 按业务线过滤

- **日期**:2026-07-14
- **状态**:已通过设计评审,待写实现计划
- **范围**:纯前端改动(新建项目对话框 + 编辑器数据配置面板)

## 1. 背景

当前 `CreateProjectDialog` 是**场景驱动**:用户先选 场景 → campaign 场景下懒加载**全部** campaign(`listCampaigns()`)→ 选一个 campaign 后才回填 `businessLine`(campaign 场景下业务线下拉被 `!isCampaign` 隐藏)。

问题:campaign 下拉与业务线无关联,用户要先从 6 条无关 campaign 里翻找,且业务线在 campaign 场景不可手选。

用户要求:**新建项目时先选业务线,再让 campaign 下拉只显示该业务线的 campaign**。同样的过滤也要应用到编辑器「数据配置」面板(给报告绑定 campaign 的地方)。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 字段顺序 | 业务线(必填)→ 场景 → Campaign | 用户确认;与 Phase 1「业务线为根轴」愿景一致 |
| 过滤范围 | 新建对话框 + 编辑器数据配置面板 | 用户确认;项目定了业务线后,任何选 campaign 的地方都只看该业务线 |
| 过滤方式 | 客户端过滤 `listCampaigns()` 返回值 | mock 数据,零风险;真实后端对接(Phase 2+)再加 `businessLine` 入参 |
| 业务线在数据配置面板 | 只读(读 `projectMeta.businessLine`) | 项目级字段,创建时定;面板只做绑定不修改业务线 |
| 存量项目无业务线 | 数据配置面板显示全部 campaign(向后兼容) | 不破坏旧项目;不额外加提示,保持安静降级 |
| 已绑定 campaign 不匹配业务线 | 其 option 仍拼进下拉,避免 select 空白 | 改过业务线或旧数据时,不丢失既有绑定 |
| media-kit 业务线 | 复用顶层 `businessLine`,删除 `mkBusinessLine` | 单一真源;广告主 `mkAdvertiser` 保留(media-kit 独有) |

## 3. 不在本次范围(明确划界)

- ❌ **无服务端 schema 改动**——`businessLine` 已在 `projectMetaSchema`(`projects.schema.ts:252`)。
- ❌ **无 Phase 1 的 templateType 级联 / 默认模板套用**——独立工作,本次不并入。
- ❌ **`listCampaigns()` 不加参数**——客户端过滤即可。
- ❌ **ImportCampaignModal / MockData 路由**——不在用户选定范围内。

## 4. CreateProjectDialog 改动

### 4.1 字段顺序与必填

- `businessLine` select 上移到「场景」之前;**所有场景可见**(去掉 `!isCampaign` 条件渲染)。
- `canSubmit` 增加条件:`!!businessLine`(业务线必填)。

### 4.2 业务线变化重置

改业务线时 `setCampaignId('')`。已有「改场景清空 campaign」逻辑(`setScenario` 处),复用同一处。

### 4.3 Campaign 过滤

```ts
const visibleCampaigns = campaigns.filter((c) => c.businessLine === businessLine);
```

campaign 下拉改用 `visibleCampaigns`。

### 4.4 空业务线 campaign 提示

`visibleCampaigns.length === 0` 时下拉显示「该业务线暂无可选 Campaign」,`canSubmit` 维持 false(campaign 场景本就必填 `campaignId`)。

### 4.5 合并 media-kit 重复态

- 删除 `mkBusinessLine` state。
- media-kit 业务线直接用顶层 `businessLine`。
- 保留 `mkAdvertiser`(广告主仍 media-kit 独有)。

### 4.6 提交逻辑

- campaign 分支:`meta.businessLine = selectedCampaign.businessLine`(此时与用户选的业务线相等,无冲突),保留现有 `campaignId/advertiser/campaignInfo` 填充。
- 非 campaign 分支:`meta.businessLine = businessLine`。

## 5. DataConfigOverlay 改动

```ts
const bl = useEditorStore.getState().projectMeta?.businessLine;
const visibleCampaigns = campaigns?.filter((c) => !bl || c.businessLine === bl) ?? [];
// 已绑定 campaign 若不在过滤结果里,仍拼进下拉
const boundId = reportData.campaign?.id;
const boundMissing = boundId && !visibleCampaigns.some((c) => c.id === boundId)
  ? campaigns?.find((c) => c.id === boundId) ?? null
  : null;
const dropdownCampaigns = boundMissing ? [boundMissing, ...visibleCampaigns] : visibleCampaigns;
```

- Campaign 下拉用 `dropdownCampaigns`。
- 业务线在此面板**只读**,不提供修改入口。
- `bl` 为空 → `visibleCampaigns` = 全部(向后兼容)。

## 6. 涉及文件

- `apps/web/src/components/CreateProjectDialog.tsx` — 主改动(字段顺序、必填、过滤、重置、media-kit 合并)。
- `apps/web/src/editor/components/DataConfigOverlay.tsx` — 读取项目业务线、过滤 campaign 下拉。
- 测试(新增或就近补):
  - `CreateProjectDialog` 测试:业务线必填校验;选 FT 后 campaign 下拉仅 FT;切业务线清空 campaign;media-kit 复用顶层业务线。
  - `DataConfigOverlay` 测试:businessLine=FT 时仅 FT campaign;businessLine 为空时全部;已绑定非 FT campaign 仍可见。

## 7. 兼容性

- 存量项目无 `businessLine` → 数据配置面板显示全部 campaign,行为不变。
- 新建对话框未选业务线不可提交,不影响存量项目。
- 无 Prisma 迁移,无 schema 改动,无 shared 类型改动。

## 8. 测试策略

遵循 web-chart-test 约定(只断言 shell 文本,不测 chart 内部)。`listCampaigns` 在测试中以注入或 mock 形式提供固定 campaign 列表(已有 `fetchCampaigns` 注入先例见 `ImportCampaignModal`)。
