# Campaign 字段全量镜像（数据管理）— 设计

- 日期：2026-07-15
- 状态：已批准（设计），待实现
- 关联：`2026-07-14-data-management-design.md`、`2026-07-14-data-management-drill-down-design.md`

## 1. 背景与动机

数据管理（数据管理-Campaign）的 Campaign 实体当前是一个 **11 字段的精简 camelCase 模型**，作为 JSON 存储在 `DataRecord` 表（`kind = CAMPAIGN`，字段在 `data Json` 列里）：

```
id, name, advertiser, businessLine, platform, platforms?, startDate, endDate,
budget, status?, owner?  (+ metrics?, creatorIds?)
```

外部/上游 campaign 系统（涉及 项目中台 / 集团CRM / `dm_contracts` / 合同中台）的实际表结构是一份 **~77 字段的 snake_case 规格**。本次目标：让 app 的 Campaign 记录 **全量 1:1 镜像** 这份外部规格，作为对接/导入外部 campaign payload 的忠实承载。

### 关键架构事实

- **没有独立的 Campaign 表**。Campaign = `DataRecord` 行 + `data Json` payload。字段定义的真正来源是 TS interface（`packages/shared`）+ zod schema（`apps/server`），不是 Prisma 模型。
- Prisma `DataRecord.id` 是 `String @id`（opaque，应用生成 / 导入按 id upsert）。
- `campaignPlatformSchema` / `campaignMetricSchema` 是 `apps/server/src/modules/data/data.schema.ts` 内的局部 const；`packages/shared` **不依赖 zod**。
- 当前 Campaign 字段标签散落在三处：`RecordFormModal.tsx`（表单）、`dataImport.ts`（导入）、`DataManagement.tsx`（表格）——重复且易漂移。

## 2. 已确认决策

1. **全量 1:1 镜像**：规格全部字段加到 Campaign JSON 记录，保留外部 snake_case 字段名。
2. **纯替换**：丢弃旧 11 个 camelCase 字段；`Campaign` 类型 / `campaignRecordDataSchema` = 规格字段 + app 字段。`status` 取规格的 tinyint 审批状态。
3. **粗粒度类型**：`varchar/text/timestamp/date/datetime/json文本` → `string`；`int/int unsigned/tinyint/tinyint(1)/decimal/bigint` → `number`；除 `id` 外全部 optional；不拆 tinyint 枚举。
4. **保留 3 个 app 侧字段**：`creatorIds` / `platforms` / `metrics`（已合并的达人钻取 + 多平台协作 + 指标导入依赖），作为镜像之外的最小追加。

字段总数：**规格 77 + app 3 = 80**。

## 3. 字段规格（单一来源）

下表为 77 个规格字段。app 字段：`creatorIds?: string[]`、`platforms?: CampaignPlatform[]`、`metrics?: CampaignMetric[]`（沿用既有类型，不变）。

| key | 中文 label | SQL 类型 | 粗类型 | 必填 |
|---|---|---|---|---|
| id | ID | int unsigned | number | ✅ |
| project_name | 项目名称 | varchar(255) | string | |
| flow_type | 项目流程类型(1策略含采买/2策略不含采买/3纯采买/4纯执行/5采买+执行) | tinyint unsigned | number | |
| adser_id | 广告主ID | int | number | |
| roi_budget | ROI预算 | decimal(11,2) | number | |
| roi_expect_value | ROI预期值 | decimal(11,2) | number | |
| target_sales | 目标销售额 | decimal(11,2) | number | |
| target_uv | 目标UV | int | number | |
| project_start_time | 项目开始时间 | timestamp | string | |
| project_end_time | 项目结束时间 | timestamp | string | |
| contract_id | 合同ID(dm_contracts.id) | int | number | |
| project_remark | 项目备注 | text | string | |
| create_time | 添加时间 | timestamp | string | |
| update_time | 更新时间 | timestamp | string | |
| creator_id | 创建人ID | int | number | |
| project_type | 项目类型(1品效CPS/2品宣CPT) | tinyint | number | |
| run_status | 运行状态(0未开始/1进行中/2已结束) | tinyint | number | |
| real_time_orders | 实时订单数 | decimal(11,2) | number | |
| real_time_amount | 实时成交金额(分) | decimal(11,2) | number | |
| real_time_commission | 佣金 | decimal(11,2) | number | |
| real_time_cost | 实时成本 | decimal(11,2) | number | |
| real_time_roi | 实时ROI | decimal(11,2) | number | |
| real_time_uv | 完成UV | int unsigned | number | |
| status | 审批状态(0待审批/1通过/2拒绝/3无须审核) | tinyint | number | |
| put_platform | 投放平台(与集团crm一致) | varchar(1000) | string | |
| put_type | 投放类型(与集团crm一致) | varchar(1000) | string | |
| involvement | 绩效-参与度(百分制40/60/100,未选0) | tinyint | number | |
| compute_type | 绩效-计算类型(0未选/1ROI/2品宣/3直播) | tinyint(1) | number | |
| base_reward | 绩效-基础奖励值 | decimal(16,2) | number | |
| settle_status | 绩效-结算状态(0未结算/1申请结算/2已结算) | tinyint(1) | number | |
| settle_by | 绩效-当前结算状态修改人 | int | number | |
| internal_remark | 绩效-内部备注 | text | string | |
| ads_union_type | 广告主联盟类型(0其他/1京东/2欧莱雅) | tinyint | number | |
| activity_code | 活动编号(品宣专用) | varchar(255) | string | |
| brand_id | 品牌ID | int | number | |
| group_project_id | 项目中台project_id | int | number | |
| group_source | 来源(0自建/1分发) | tinyint(1) | number | |
| project_biding_status | 项目招标状态(1招标中/2未中标/3已中标) | tinyint | number | |
| submit_requirement | 提报要求(json) | text | string | |
| cpt_budget | 项目预算 | decimal(11,2) | number | |
| quote_end_time | 报价结束时间 | datetime | string | |
| promotion_product | 推广商品 | varchar(255) | string | |
| comment_analysis | 达人作品评论分析 | text | string | |
| work_requirements | 发文要求 | text | string | |
| has_contract | 是否有合同(1有/2无) | tinyint(1) | number | |
| contract_center_id | 合同中台id | int | number | |
| company_id | 公司id | int | number | |
| company_name | 公司名称 | varchar(100) | string | |
| customer_id | 客户id | int | number | |
| customer_name | 客户名称 | varchar(100) | string | |
| cooperation_certificate | 合作凭证 | varchar(255) | string | |
| cooperation_certificate_sourcefile | 合作凭证原始文件 | varchar(255) | string | |
| auto_push_adser | 自动推送给广告主(0否/1是) | tinyint | number | |
| submit_expert_num | 提报达人数 | int | number | |
| promotion_cycle_start | 推广时间开始 | date | string | |
| promotion_cycle_end | 推广时间结束 | date | string | |
| last_push_time | 最新推送时间 | datetime | string | |
| parent_project_id | 父项目ID | int | number | |
| task_type | 任务类型 | tinyint | number | |
| require_same | 不同平台配置项是否相同 | tinyint(1) | number | |
| is_send_message | 是否发送过提报要求信息 | tinyint(1) | number | |
| is_support_subproject | 是否支持子项目(兼容历史) | tinyint(1) | number | |
| cooperation_mode | 合作模式 | tinyint | number | |
| business_line_id | 业务线ID | int | number | |
| is_subproject | 是否是子项目 | tinyint(1) | number | |
| is_can_submit | 是否可继续提报 | tinyint(1) | number | |
| expert_update_time | 达人作品更新时间 | datetime | string | |
| union_id | 联盟ID | int | number | |
| is_support_gifting | 是否支持礼物模式 | tinyint | number | |
| recruitment_type | 招募类型 | tinyint | number | |
| gifting_type | 寄品配置(1样品/2规则) | tinyint | number | |
| findly_template_id | findly模板id | bigint | number | ⚠️ 见下 |
| brief | brief信息 | text | string | |
| adser_introduction | 商家对外介绍 | text | string | |
| task_advantages | 任务优势 | text | string | |
| task_images | 任务详情图片 | varchar(2000) | string | |
| task_detail | 任务详情介绍 | text | string | |

> ⚠️ `findly_template_id` 为 `bigint`。粗类型映射为 `number`，但 JS number 在 >2^53 时丢精度。若该 id 实际可能超大，实现时改用 `string` 保留精度（实现计划阶段确认）。

## 4. 设计（按层）

### 4.1 数据模型层

**`packages/shared/src/types/campaign.ts`**
- 重写 `interface Campaign`：80 字段（77 规格 + 3 app），粗类型。删除旧 camelCase 字段。
- 新增 `CAMPAIGN_FIELD_DEFS`：`readonly { key: keyof Campaign; label: string; type: 'string' | 'number'; required?: boolean }[]`，77 个规格字段，label 取自上表中文。**作为 form/import/table 标签的单一来源**，消灭三处重复。
- `CampaignPlatform` / `CampaignMetric` / `CampaignInfo` 等既有类型保留。

**`apps/server/src/modules/data/data.schema.ts`**
- 重写 `campaignRecordDataSchema`：80 字段；`id: z.number()`，其余 `z.string().optional()` / `z.number().optional()`；`platforms`/`metrics` 复用既有 `campaignPlatformSchema`/`campaignMetricSchema`（保留这两个 const）。

### 4.2 id 存储映射

- 规格的 `id` 是 `int unsigned`（外部 PK）。`DataRecord.id` 仍是 `String`（行主键、路由 `/data/:id` 用）。
- 规则：**`DataRecord.id = String(campaign.id)`**；读回时 `data` 内 `campaign.id` 仍是 number。
- 区分两个 id：**记录 id（string，路由/API/导入 upsert 用）** 与 **campaign 外部 id（number，业务字段）**。
- 表单新建无外部 id 时，service 生成数字 id（实现计划阶段核对现有 `data.service.ts` 的 id 生成 / upsert 逻辑后定）。

### 4.3 Web 层（从字典派生）

- `apps/web/src/editor/dataImport.ts`：`CAMPAIGN_FIELDS` = `CAMPAIGN_FIELD_DEFS` 的 key 全集（+ app 字段）；`CAMPAIGN_REQUIRED = ['id']`（可选追加 `project_name`）；CSV 模板行 = 合理子集。
- `apps/web/src/editor/components/RecordFormModal.tsx`：`CAMPAIGN_FORM_FIELDS` = 从字典选 **~15–20 个可编辑关键字段**（项目名称、广告主ID、ROI预算、目标销售额、项目起止时间、投放平台/类型、运行状态、项目备注 等），label 取自字典；**不是 80 个全堆表单**。
- `apps/web/src/routes/DataManagement.tsx`：表格表头/单元格改用新列（`project_name` / `company_name` / `put_platform` / 项目周期(`project_start_time`~`project_end_time`) / `cpt_budget` 或 `roi_budget` / `run_status`）。`CollaboratorPanel` / `ManageCollaboratorsModal` 继续用 `platforms` + `creatorIds`（仍在）。
- `apps/web/src/api/mock/campaigns.ts`：`MOCK_CAMPAIGNS` 改成新字段形态。
- 其他消费者：`business/kinds/campaign.tsx`、`report/CampaignReport.tsx`、`ImportCampaignModal.tsx`、`DataConfigOverlay.tsx`、`datasource/` —— 把旧字段引用映射到新字段（`name`→`project_name` 等）。

### 4.4 测试

- `data.schema.test.ts` / `data.service.test.ts` / `data.routes.test.ts` 及相关 web 测试：更新到新 schema。
- **新增 drift-guard 测试**：断言 `keyof Campaign` 与 `campaignRecordDataSchema` 的 key 集合一致，防止 shared interface 与 server zod 漂移。

## 5. 不做（Out of Scope）

- 不建真实 DB 表、不加 Prisma 迁移（字段都在 JSON `data` 列）。
- 不拆 tinyint 枚举（粗粒度）。
- 不做 80 字段全量表单 / 全量表格列（表单 ~15–20 关键字段，其余仅导入/API）。
- 不改动 `DataRecord` 表结构与 `DataRecordKind` 枚举。
- 不实现外部系统（项目中台/集团CRM）的真实对接/拉取——本次仅让模型能忠实承载其 payload。

## 6. 实现计划阶段需确认的开放项

1. `data.service.ts` 现有 id 生成 / `importMany` upsert-by-id 逻辑——确认 `String(campaign.id)` 映射点与表单新建 id 生成方式。
2. `findly_template_id`（bigint）实际量级——决定 `number` 还是 `string`。
3. 表单 ~15–20 关键字段的最终清单（基于业务优先级）。
4. `CAMPAIGN_REQUIRED` 是否除 `id` 外再加 `project_name`。
5. 工作树隔离：按用户工作流（concurrent dirty tree），实现应在 worktree 中进行。
