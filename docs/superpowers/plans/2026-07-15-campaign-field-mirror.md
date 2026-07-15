# Campaign 字段全量镜像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把数据管理 Campaign 实体从 11 个 camelCase 字段全量替换为外部规格的 77 个 snake_case 字段（+3 个 app 侧字段），粗粒度类型，作为对接外部 campaign 系统的忠实 JSON 承载。

**Architecture:** Campaign 仍是 `DataRecord` 行（`kind=CAMPAIGN`）的 `data Json` payload，无 Prisma 迁移。字段定义三处对齐：`packages/shared` 的 `interface Campaign` + 新增 `CAMPAIGN_FIELD_DEFS` 字段字典（UI 标签单一来源）；`apps/server` 的 `campaignRecordDataSchema`（zod 校验源）。新增 `campaignToReportCampaign` 映射 helper 桥接编辑器报告层。drift-guard 测试锁定 schema↔字典一致。

**Tech Stack:** TypeScript, zod, Vitest, React, pnpm monorepo（`@mediakit/shared` / `@mediakit/server` / `@mediakit/web`）。

**关键决策（来自 spec + 规划期发现）：**
- `id` 保持 `string`（字符串化外部 id）。理由：`DataRecord.id` 本身是 String；整个 mock + 合作达人 + 效果生态（`MOCK_RAW`/`CAMPAIGN_PROFILE`/`MOCK_PERFORMANCE`/`MOCK_PLACEMENT_SUMMARY` 四张查找表 + `MOCK_CAMPAIGNS` slug id + 表单 `camp-${uuid}` 生成器 + 全部测试）都按字符串 campaign id 关联，改为 number 需重键全部 demo 数据、零功能收益。这是对"int→number 粗粒度规则"在主键上的**有记录的例外**，77 个业务字段仍忠实镜像。
- 数值字段用 `z.coerce.number().optional()`：CSV 导入（字符串）、表单（字符串）、JSON（数值）三种输入形态都能通过校验，无需在每个输入边界写转换代码。
- `status` 取规格的审批状态（number）；UI 运行状态显示用 `run_status`。

**前置：在 worktree 中执行**（用户工作流：concurrent dirty tree）。实现前用 `superpowers:using-git-worktrees` 起 worktree（`worktree.baseRef=head`，按既有 worktree 约定 symlink node_modules）。spec：`docs/superpowers/specs/2026-07-15-campaign-field-mirror-design.md`。

---

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/types/campaign.ts` | `interface Campaign` + `CAMPAIGN_FIELD_DEFS` 字典 + `campaignToReportCampaign` | 改 |
| `apps/server/src/modules/data/data.schema.ts` | `campaignRecordDataSchema`（zod 校验源） | 改 |
| `apps/server/src/modules/data/data.schema.test.ts` | schema 测试 + drift-guard | 改 |
| `apps/server/src/modules/data/data.service.test.ts` | service 测试 fixture（service 本身不改） | 改 |
| `apps/web/src/editor/dataImport.ts` | 导入字段/必填/模板/预览列 | 改 |
| `apps/web/src/editor/components/RecordFormModal.tsx` | 表单字段子集 | 改 |
| `apps/web/src/routes/DataManagement.tsx` | 表格表头/单元格/抽屉标题 | 改 |
| `apps/web/src/api/mock/campaigns.ts` | `MOCK_CAMPAIGNS` 新形态 | 改 |
| `apps/web/src/editor/components/DataConfigOverlay.tsx` | 用 `campaignToReportCampaign` 替换内联映射 | 改 |
| `apps/web/src/editor/components/ImportCampaignModal.tsx` | `c.name`→`c.project_name` | 改 |
| `apps/web/src/editor/business/kinds/campaign.tsx` | 验证（grep 无 campaign 字段引用，应安全） | 验证 |
| `apps/web/src/editor/components/report/CampaignReport.tsx` | 验证（`r.status`/`d.name` 疑为报告行，应安全） | 验证 |

不改：`apps/server/src/modules/data/data.service.ts`（id 仍 string，无需 String() 映射）、`apps/web/src/api/campaigns.ts`（`r.data` 透传）、`apps/web/src/api/dataLibrary.ts`（泛型）、`ReportCampaign`/`CampaignInfo` 等编辑器报告类型、Prisma schema/migrations。

---

## Task 1: 重写 `interface Campaign` + 字段字典 + 报告映射 helper（shared）

**Files:**
- Modify: `packages/shared/src/types/campaign.ts:36-54`（替换 `interface Campaign`），并在其后追加字典与 helper。

- [ ] **Step 1: 替换 `interface Campaign`（L36-54）**

把现有 `export interface Campaign { ... }`（含 id/name/advertiser/businessLine/platform/platforms/startDate/endDate/budget/status/owner/metrics/creatorIds）整体替换为：

```ts
/** 上游 Campaign 实体（全量镜像外部 campaign 规格；JSON 存储于 DataRecord.data）。 */
export interface Campaign {
  /** ID（外部 campaign 主键，字符串化存储；DataRecord.id 同此值）。 */
  id: string;
  /* —— 基础信息 —— */
  project_name?: string;            // 项目名称
  flow_type?: number;               // 项目流程类型 1策略(含采买)2策略(不含采买)3纯采买4纯执行5采买+执行
  adser_id?: number;                // 广告主ID
  roi_budget?: number;              // ROI预算
  roi_expect_value?: number;        // ROI预期值
  target_sales?: number;            // 目标销售额
  target_uv?: number;               // 目标UV
  project_start_time?: string;      // 项目开始时间
  project_end_time?: string;        // 项目结束时间
  contract_id?: number;             // 合同ID(dm_contracts.id)
  project_remark?: string;          // 项目备注
  create_time?: string;             // 添加时间
  update_time?: string;             // 更新时间
  creator_id?: number;              // 创建人ID
  project_type?: number;            // 项目类型 1品效(CPS)2品宣(CPT)
  run_status?: number;              // 运行状态 0未开始1进行中2已结束
  /* —— 实时数据 —— */
  real_time_orders?: number;        // 实时订单数
  real_time_amount?: number;        // 实时成交金额(分)
  real_time_commission?: number;    // 佣金
  real_time_cost?: number;          // 实时成本
  real_time_roi?: number;           // 实时ROI
  real_time_uv?: number;            // 完成UV
  /* —— 审批/投放 —— */
  status?: number;                  // 审批状态 0待审批1通过2拒绝3无须审核
  put_platform?: string;            // 投放平台(与集团crm一致)
  put_type?: string;                // 投放类型(与集团crm一致)
  /* —— 绩效 —— */
  involvement?: number;             // 参与度 百分制40/60/100 未选0
  compute_type?: number;            // 计算类型 0未选1ROI2品宣3直播
  base_reward?: number;             // 基础奖励值
  settle_status?: number;           // 结算状态 0未结算1申请结算2已结算
  settle_by?: number;               // 当前结算状态修改人
  internal_remark?: string;         // 内部备注
  /* —— 联盟/品牌/中台 —— */
  ads_union_type?: number;          // 广告主联盟类型 0其他1京东2欧莱雅
  activity_code?: string;           // 活动编号(品宣专用)
  brand_id?: number;                // 品牌ID
  group_project_id?: number;        // 项目中台project_id
  group_source?: number;            // 来源 0自建1分发
  project_biding_status?: number;   // 项目招标状态 1招标中2未中标3已中标
  submit_requirement?: string;      // 提报要求(json 文本)
  /* —— 预算/报价/推广 —— */
  cpt_budget?: number;              // 项目预算
  quote_end_time?: string;          // 报价结束时间
  promotion_product?: string;       // 推广商品
  comment_analysis?: string;        // 达人作品评论分析
  work_requirements?: string;       // 发文要求
  /* —— 合同/公司/客户 —— */
  has_contract?: number;            // 是否有合同 1有2无
  contract_center_id?: number;      // 合同中台id
  company_id?: number;              // 公司id
  company_name?: string;            // 公司名称
  customer_id?: number;             // 客户id
  customer_name?: string;           // 客户名称
  cooperation_certificate?: string;          // 合作凭证
  cooperation_certificate_sourcefile?: string; // 合作凭证原始文件
  /* —— 推送/提报/周期 —— */
  auto_push_adser?: number;         // 自动推送给广告主 0否1是
  submit_expert_num?: number;       // 提报达人数
  promotion_cycle_start?: string;   // 推广时间开始
  promotion_cycle_end?: string;     // 推广时间结束
  last_push_time?: string;          // 最新推送时间
  parent_project_id?: number;       // 父项目ID
  /* —— 任务/配置开关 —— */
  task_type?: number;               // 任务类型
  require_same?: number;            // 不同平台配置项是否相同
  is_send_message?: number;         // 是否发送过提报要求信息
  is_support_subproject?: number;   // 是否支持子项目(兼容历史)
  cooperation_mode?: number;        // 合作模式
  business_line_id?: number;        // 业务线ID
  is_subproject?: number;           // 是否是子项目
  is_can_submit?: number;           // 是否可继续提报
  expert_update_time?: string;      // 达人作品更新时间
  union_id?: number;                // 联盟ID
  is_support_gifting?: number;      // 是否支持礼物模式
  recruitment_type?: number;        // 招募类型
  gifting_type?: number;            // 寄品配置 1样品2规则
  findly_template_id?: number;      // findly模板id(bigint;>2^53 可能丢精度,超大时改 string)
  /* —— 任务详情 —— */
  brief?: string;                   // brief信息
  adser_introduction?: string;      // 商家对外介绍
  task_advantages?: string;         // 任务优势
  task_images?: string;             // 任务详情图片
  task_detail?: string;             // 任务详情介绍
  /* —— app 侧字段(镜像之外:多平台协作/指标导入/达人钻取) —— */
  platforms?: CampaignPlatform[];
  metrics?: CampaignMetric[];
  creatorIds?: string[];
}
```

- [ ] **Step 2: 在 `interface Campaign` 之后追加字段字典 + 报告映射 helper**

```ts
/** Campaign 字段字典:77 个规格字段的 key/中文 label/粗类型;UI(form/import/table)标签单一来源。 */
export interface CampaignFieldDef {
  key: keyof Campaign;
  label: string;
  type: 'string' | 'number';
  required?: boolean;
}

export const CAMPAIGN_FIELD_DEFS: readonly CampaignFieldDef[] = [
  { key: 'id', label: 'ID', type: 'string', required: true },
  { key: 'project_name', label: '项目名称', type: 'string' },
  { key: 'flow_type', label: '项目流程类型', type: 'number' },
  { key: 'adser_id', label: '广告主ID', type: 'number' },
  { key: 'roi_budget', label: 'ROI预算', type: 'number' },
  { key: 'roi_expect_value', label: 'ROI预期值', type: 'number' },
  { key: 'target_sales', label: '目标销售额', type: 'number' },
  { key: 'target_uv', label: '目标UV', type: 'number' },
  { key: 'project_start_time', label: '项目开始时间', type: 'string' },
  { key: 'project_end_time', label: '项目结束时间', type: 'string' },
  { key: 'contract_id', label: '合同ID', type: 'number' },
  { key: 'project_remark', label: '项目备注', type: 'string' },
  { key: 'create_time', label: '添加时间', type: 'string' },
  { key: 'update_time', label: '更新时间', type: 'string' },
  { key: 'creator_id', label: '创建人ID', type: 'number' },
  { key: 'project_type', label: '项目类型', type: 'number' },
  { key: 'run_status', label: '运行状态', type: 'number' },
  { key: 'real_time_orders', label: '实时订单数', type: 'number' },
  { key: 'real_time_amount', label: '实时成交金额', type: 'number' },
  { key: 'real_time_commission', label: '佣金', type: 'number' },
  { key: 'real_time_cost', label: '实时成本', type: 'number' },
  { key: 'real_time_roi', label: '实时ROI', type: 'number' },
  { key: 'real_time_uv', label: '完成UV', type: 'number' },
  { key: 'status', label: '审批状态', type: 'number' },
  { key: 'put_platform', label: '投放平台', type: 'string' },
  { key: 'put_type', label: '投放类型', type: 'string' },
  { key: 'involvement', label: '绩效-参与度', type: 'number' },
  { key: 'compute_type', label: '绩效-计算类型', type: 'number' },
  { key: 'base_reward', label: '绩效-基础奖励值', type: 'number' },
  { key: 'settle_status', label: '绩效-结算状态', type: 'number' },
  { key: 'settle_by', label: '绩效-结算修改人', type: 'number' },
  { key: 'internal_remark', label: '绩效-内部备注', type: 'string' },
  { key: 'ads_union_type', label: '广告主联盟类型', type: 'number' },
  { key: 'activity_code', label: '活动编号', type: 'string' },
  { key: 'brand_id', label: '品牌ID', type: 'number' },
  { key: 'group_project_id', label: '项目中台project_id', type: 'number' },
  { key: 'group_source', label: '来源', type: 'number' },
  { key: 'project_biding_status', label: '项目招标状态', type: 'number' },
  { key: 'submit_requirement', label: '提报要求', type: 'string' },
  { key: 'cpt_budget', label: '项目预算', type: 'number' },
  { key: 'quote_end_time', label: '报价结束时间', type: 'string' },
  { key: 'promotion_product', label: '推广商品', type: 'string' },
  { key: 'comment_analysis', label: '达人作品评论分析', type: 'string' },
  { key: 'work_requirements', label: '发文要求', type: 'string' },
  { key: 'has_contract', label: '是否有合同', type: 'number' },
  { key: 'contract_center_id', label: '合同中台id', type: 'number' },
  { key: 'company_id', label: '公司id', type: 'number' },
  { key: 'company_name', label: '公司名称', type: 'string' },
  { key: 'customer_id', label: '客户id', type: 'number' },
  { key: 'customer_name', label: '客户名称', type: 'string' },
  { key: 'cooperation_certificate', label: '合作凭证', type: 'string' },
  { key: 'cooperation_certificate_sourcefile', label: '合作凭证原始文件', type: 'string' },
  { key: 'auto_push_adser', label: '自动推送广告主', type: 'number' },
  { key: 'submit_expert_num', label: '提报达人数', type: 'number' },
  { key: 'promotion_cycle_start', label: '推广时间开始', type: 'string' },
  { key: 'promotion_cycle_end', label: '推广时间结束', type: 'string' },
  { key: 'last_push_time', label: '最新推送时间', type: 'string' },
  { key: 'parent_project_id', label: '父项目ID', type: 'number' },
  { key: 'task_type', label: '任务类型', type: 'number' },
  { key: 'require_same', label: '不同平台配置是否相同', type: 'number' },
  { key: 'is_send_message', label: '是否发送过提报要求', type: 'number' },
  { key: 'is_support_subproject', label: '是否支持子项目', type: 'number' },
  { key: 'cooperation_mode', label: '合作模式', type: 'number' },
  { key: 'business_line_id', label: '业务线ID', type: 'number' },
  { key: 'is_subproject', label: '是否子项目', type: 'number' },
  { key: 'is_can_submit', label: '是否可继续提报', type: 'number' },
  { key: 'expert_update_time', label: '达人作品更新时间', type: 'string' },
  { key: 'union_id', label: '联盟ID', type: 'number' },
  { key: 'is_support_gifting', label: '是否支持礼物模式', type: 'number' },
  { key: 'recruitment_type', label: '招募类型', type: 'number' },
  { key: 'gifting_type', label: '寄品配置', type: 'number' },
  { key: 'findly_template_id', label: 'findly模板id', type: 'number' },
  { key: 'brief', label: 'brief信息', type: 'string' },
  { key: 'adser_introduction', label: '商家对外介绍', type: 'string' },
  { key: 'task_advantages', label: '任务优势', type: 'string' },
  { key: 'task_images', label: '任务详情图片', type: 'string' },
  { key: 'task_detail', label: '任务详情介绍', type: 'string' },
];

/** 运行状态文案(报告层显示用)。 */
export const RUN_STATUS_TEXT: Record<number, string> = { 0: '未开始', 1: '进行中', 2: '已结束' };

/**
 * 数据管理 Campaign → 编辑器报告 ReportCampaign 映射。
 * 外部字段语义不与旧 report 字段一一对应,这里集中决策映射来源,避免散落在各组件。
 */
export function campaignToReportCampaign(c: Campaign): ReportCampaign {
  const budget = c.cpt_budget ?? c.roi_budget;
  return {
    id: c.id,
    name: c.project_name ?? c.id,
    advertiser: c.company_name,
    platform: c.put_platform,
    platforms: c.platforms,
    startDate: c.project_start_time,
    endDate: c.project_end_time,
    budget: budget != null ? String(budget) : undefined,
    status: c.run_status != null ? RUN_STATUS_TEXT[c.run_status] : undefined,
    metrics: c.metrics,
  };
}
```

> 注：`ReportCampaign` 已在本文件 L81 定义且**不改**；helper 放在 `Campaign` 定义之后、`ReportCampaign` 可在前向引用（TS interface 声明提升）。若 lint 报告顺序问题，把 helper 移到 `ReportCampaign` 定义之后即可。

- [ ] **Step 3: typecheck shared**

Run: `pnpm --filter @mediakit/shared typecheck`
Expected: PASS（确认 `key: keyof Campaign` 对所有 def key 合法、helper 类型正确）。

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/campaign.ts
git commit -m "feat(campaign): mirror 80-field spec in shared type + field dictionary"
```

---

## Task 2: 重写 `campaignRecordDataSchema` + drift-guard 测试（server）

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts:20-35`（替换 `campaignRecordDataSchema`）
- Test: `apps/server/src/modules/data/data.schema.test.ts`

- [ ] **Step 1: 先改测试（红）—— 更新 fixture + 加 drift-guard**

在 `data.schema.test.ts`：
- 顶部 import 追加 `CAMPAIGN_FIELD_DEFS`：

```ts
import {
  campaignRecordDataSchema,
  creatorRecordDataSchema,
  kindSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
} from './data.schema';
import { CAMPAIGN_FIELD_DEFS } from '@mediakit/shared';
```

- 把 `validCampaign`（L11-20）替换为（新 schema 仅 `id` 必填）：

```ts
const validCampaign = { id: 'camp-x' };
```

- 把"campaignRecordDataSchema(镜像 Campaign)" describe 块（L41-54）替换为：

```ts
describe('data.schema · campaignRecordDataSchema(镜像 Campaign)', () => {
  it('合法 campaign(仅 id)通过', () => {
    expect(campaignRecordDataSchema.parse(validCampaign)).toEqual(validCampaign);
  });
  it('缺必填 id → 报错', () => {
    const bad: Record<string, unknown> = { project_name: '无 id' };
    expect(() => campaignRecordDataSchema.parse(bad)).toThrow();
  });
  it('含可选 metrics/platforms/creatorIds 通过', () => {
    const c = {
      ...validCampaign,
      project_name: 'X',
      cpt_budget: 300000,
      metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }],
      platforms: [{ platform: 'TikTok', collaborationType: 'Content' }],
      creatorIds: ['cre-mia'],
    };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('数值字段 coerce 字符串输入', () => {
    const parsed = campaignRecordDataSchema.parse({ id: 'camp-x', cpt_budget: '300000', run_status: '1' });
    expect(parsed.cpt_budget).toBe(300000);
    expect(parsed.run_status).toBe(1);
  });
  it('metrics 项缺 compare → 报错', () => {
    const c = { ...validCampaign, metrics: [{ label: 'GMV', value: '$1' }] };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
});

describe('data.schema · drift-guard(schema ↔ 字段字典)', () => {
  it('campaignRecordDataSchema 的 key 集合 == CAMPAIGN_FIELD_DEFS 的 key 集合 + app 字段', () => {
    const appFields = ['platforms', 'metrics', 'creatorIds'];
    const schemaKeys = new Set(Object.keys(campaignRecordDataSchema.shape));
    const defKeys = new Set([...CAMPAIGN_FIELD_DEFS.map((d) => d.key), ...appFields]);
    expect(schemaKeys).toEqual(defKeys);
  });
  it('全字段 round-trip:所有 def key 写入后 parse 不被丢弃', () => {
    const full: Record<string, unknown> = { id: 'camp-full' };
    for (const d of CAMPAIGN_FIELD_DEFS) {
      if (d.key === 'id') continue;
      full[d.key] = d.type === 'number' ? 1 : 'x';
    }
    const parsed = campaignRecordDataSchema.parse(full);
    for (const d of CAMPAIGN_FIELD_DEFS) {
      expect(parsed).toHaveProperty(d.key);
    }
  });
});
```

> 已有的"端点入参 schema"和"creatorIds" describe 块保留（creatorIds 块仍有效：`{...validCampaign, creatorIds:[...]}`，validCampaign 现为 `{id:'camp-x'}`）。

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: FAIL（schema 仍是旧 11 字段；drift-guard key 集合不等；coerce 用例因旧 schema 无 cpt_budget 报错或 extra key）。

- [ ] **Step 3: 重写 `campaignRecordDataSchema`（L20-35）**

把 `/** Campaign 记录数据(镜像 shared Campaign)。 */ export const campaignRecordDataSchema = z.object({...})` 整段替换为：

```ts
/** Campaign 记录数据(全量镜像 shared Campaign;数值字段 coerce 兼容 CSV/表单/JSON 字符串输入)。 */
export const campaignRecordDataSchema = z.object({
  id: z.string(),
  project_name: z.string().optional(),
  flow_type: z.coerce.number().optional(),
  adser_id: z.coerce.number().optional(),
  roi_budget: z.coerce.number().optional(),
  roi_expect_value: z.coerce.number().optional(),
  target_sales: z.coerce.number().optional(),
  target_uv: z.coerce.number().optional(),
  project_start_time: z.string().optional(),
  project_end_time: z.string().optional(),
  contract_id: z.coerce.number().optional(),
  project_remark: z.string().optional(),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
  creator_id: z.coerce.number().optional(),
  project_type: z.coerce.number().optional(),
  run_status: z.coerce.number().optional(),
  real_time_orders: z.coerce.number().optional(),
  real_time_amount: z.coerce.number().optional(),
  real_time_commission: z.coerce.number().optional(),
  real_time_cost: z.coerce.number().optional(),
  real_time_roi: z.coerce.number().optional(),
  real_time_uv: z.coerce.number().optional(),
  status: z.coerce.number().optional(),
  put_platform: z.string().optional(),
  put_type: z.string().optional(),
  involvement: z.coerce.number().optional(),
  compute_type: z.coerce.number().optional(),
  base_reward: z.coerce.number().optional(),
  settle_status: z.coerce.number().optional(),
  settle_by: z.coerce.number().optional(),
  internal_remark: z.string().optional(),
  ads_union_type: z.coerce.number().optional(),
  activity_code: z.string().optional(),
  brand_id: z.coerce.number().optional(),
  group_project_id: z.coerce.number().optional(),
  group_source: z.coerce.number().optional(),
  project_biding_status: z.coerce.number().optional(),
  submit_requirement: z.string().optional(),
  cpt_budget: z.coerce.number().optional(),
  quote_end_time: z.string().optional(),
  promotion_product: z.string().optional(),
  comment_analysis: z.string().optional(),
  work_requirements: z.string().optional(),
  has_contract: z.coerce.number().optional(),
  contract_center_id: z.coerce.number().optional(),
  company_id: z.coerce.number().optional(),
  company_name: z.string().optional(),
  customer_id: z.coerce.number().optional(),
  customer_name: z.string().optional(),
  cooperation_certificate: z.string().optional(),
  cooperation_certificate_sourcefile: z.string().optional(),
  auto_push_adser: z.coerce.number().optional(),
  submit_expert_num: z.coerce.number().optional(),
  promotion_cycle_start: z.string().optional(),
  promotion_cycle_end: z.string().optional(),
  last_push_time: z.string().optional(),
  parent_project_id: z.coerce.number().optional(),
  task_type: z.coerce.number().optional(),
  require_same: z.coerce.number().optional(),
  is_send_message: z.coerce.number().optional(),
  is_support_subproject: z.coerce.number().optional(),
  cooperation_mode: z.coerce.number().optional(),
  business_line_id: z.coerce.number().optional(),
  is_subproject: z.coerce.number().optional(),
  is_can_submit: z.coerce.number().optional(),
  expert_update_time: z.string().optional(),
  union_id: z.coerce.number().optional(),
  is_support_gifting: z.coerce.number().optional(),
  recruitment_type: z.coerce.number().optional(),
  gifting_type: z.coerce.number().optional(),
  findly_template_id: z.coerce.number().optional(),
  brief: z.string().optional(),
  adser_introduction: z.string().optional(),
  task_advantages: z.string().optional(),
  task_images: z.string().optional(),
  task_detail: z.string().optional(),
  platforms: z.array(campaignPlatformSchema).optional(),
  metrics: z.array(campaignMetricSchema).optional(),
  creatorIds: z.array(z.string()).optional(),
});
```

> 说明：`z.coerce.number()` 接受字符串/数值并转为数值。注意 `Number('') === 0`（空串静默成 0，非 NaN），`Number('abc') === NaN`（非数字串被拒）。`dataImport.buildPreviewFromRows` 与 `RecordFormModal.save()` 已在写入前剔除空串，故空串不会把数值字段静默置 0；仅 JSON/API 直传显式 `""` 的边缘情况会成 0（demo 可接受）。`id` 保持 `z.string()`。

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: PASS（含 drift-guard 两个用例）。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(data): mirror campaign schema (80 fields) + drift-guard tests"
```

---

## Task 3: 更新 `data.service.test.ts` fixture（service 不改）

**Files:**
- Test: `apps/server/src/modules/data/data.service.test.ts`

> `data.service.ts` 无需改动（id 仍 string，`create`/`importMany` 的 `valid.id` 直接作 DataRecord.id）。仅更新测试 fixture 与断言到新 schema。

- [ ] **Step 1: 更新 fixture 与断言**

- `validCampaign`（L18-27）替换为：

```ts
const validCampaign = { id: 'camp-x', project_name: 'Campaign X' };
```

- `makeRecord`（L28-38）中 `data: validCampaign` 保持（已是新形态）。

- `create` 的"非法 data(缺 name)→ 400"用例（L70-74）改为缺 id：

```ts
  it('非法 data(缺 id)→ 400', async () => {
    const bad = { project_name: '无 id' };
    await expect(dataService.create('u1', 'campaign', bad)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.dataRecord.create).not.toHaveBeenCalled();
  });
```

- `create` 的合法用例断言（L68）保持 `(data.data as { id: string }).id).toBe('camp-x')`，仍成立。

- `importMany` 的"id 缺失 → skipped"用例（L91-94）改为：

```ts
  it('id 缺失 → skipped', async () => {
    const r = await dataService.importMany('u1', 'campaign', [{ project_name: 'no id' }]);
    expect(r.skipped).toBe(1);
  });
```

- `update` 用例（L120-127）中 `name: '改名'` 改为 `project_name: '改名'`，断言 `arg.data.data.project_name).toBe('改名')`：

```ts
  it('按记录既有 kind 校验 data 后更新', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.update.mockResolvedValue(makeRecord({ data: { ...validCampaign, project_name: '改名' } }));
    await dataService.update('camp-x', { ...validCampaign, project_name: '改名' });
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { where: { id: string }; data: { data: { project_name: string } } };
    expect(arg.where.id).toBe('camp-x');
    expect(arg.data.data.project_name).toBe('改名');
  });
```

- `update` 的"data 与记录 kind 不符"用例（L128-131）保持（塞 creator 数据进 campaign 记录仍报 400）。

- [ ] **Step 2: 跑 service 测试**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.service.test.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/data/data.service.test.ts
git commit -m "test(data): align service tests with mirrored campaign schema"
```

---

## Task 4: 更新导入字段定义（web `dataImport.ts`）

**Files:**
- Modify: `apps/web/src/editor/dataImport.ts:3-4,20-23,62-66`

- [ ] **Step 1: 改 `CAMPAIGN_FIELDS` / `CAMPAIGN_REQUIRED`（L3-4）**

```ts
import { CAMPAIGN_FIELD_DEFS } from '@mediakit/shared';

export const CAMPAIGN_FIELDS = [
  ...CAMPAIGN_FIELD_DEFS.map((d) => d.key as string),
  'creatorIds',
] as const;
export const CAMPAIGN_REQUIRED = ['id'];
```

> 文件顶部需新增上面那行 import。`CAMPAIGN_FIELDS` 由字典派生（77 规格 + creatorIds），保证与 schema 一致。

- [ ] **Step 2: 改预览列 `PREVIEW_COLUMNS.campaign`（L20-23）**

```ts
export const PREVIEW_COLUMNS: Record<DataKind, string[]> = {
  campaign: ['id', 'project_name', 'company_name', 'put_platform', 'project_start_time', 'project_end_time', 'cpt_budget', 'run_status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'],
};
```

- [ ] **Step 3: 改模板示例行 `downloadTemplate`（L62-66）**

```ts
  const example =
    kind === 'campaign'
      ? 'camp-example,示例 Campaign,GlowLab,TikTok,2026-01-01,2026-01-31,300000,1'
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
```

> 模板表头 = `CAMPAIGN_FIELDS`（全部 78 列）。示例行仅填 PREVIEW_COLUMNS 对应的几列顺序值——但注意 CSV 模板按 `fields.join(',')` 全列表头生成，示例行应与全列表头列数对齐。由于全列表头 78 列，示例行写全太长；保留示例行只给首列 + 让其余为空更实际。改为：

```ts
  const example = kind === 'campaign' ? 'camp-example,示例 Campaign,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,' : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
```

> ⚠️ 实现时按 `CAMPAIGN_FIELDS.length` 动态补足逗号更稳妥,避免手数错。建议:

```ts
  const example =
    kind === 'campaign'
      ? ['camp-example', '示例 Campaign', ...Array<string>(CAMPAIGN_FIELDS.length - 2).fill('')].join(',')
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
```

- [ ] **Step 4: typecheck + web 测试**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（`buildPreviewFromRows` 的 `creatorIds` 特殊分支仍有效；其余字段通用 `data[f] = v`）。

若有 `dataImport` 相关 web 测试（`find apps/web/src -name '*dataImport*test*'`），跑 `pnpm --filter @mediakit/web exec vitest run`，按需更新断言。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/dataImport.ts
git commit -m "feat(data-import): derive campaign import fields from dictionary"
```

---

## Task 5: 更新表单字段子集（web `RecordFormModal.tsx`）

**Files:**
- Modify: `apps/web/src/editor/components/RecordFormModal.tsx:1-6,20-31`

- [ ] **Step 1: 表单字段从字典选 ~15 个关键字段（L20-31）**

把 `CAMPAIGN_FORM_FIELDS` 替换为（label 取自字典；用字典里的 key 集合做白名单）：

```ts
import { CAMPAIGN_FIELD_DEFS, type CampaignFieldDef } from '@mediakit/shared';

const CAMPAIGN_FORM_KEYS = new Set([
  'id', 'project_name', 'adser_id', 'roi_budget', 'target_sales',
  'project_start_time', 'project_end_time', 'put_platform', 'put_type',
  'run_status', 'project_type', 'cpt_budget', 'business_line_id',
  'company_name', 'project_remark',
]);
const CAMPAIGN_FORM_FIELDS: CampaignFieldDef[] = CAMPAIGN_FIELD_DEFS.filter((d) => CAMPAIGN_FORM_KEYS.has(d.key as string));
```

> `FieldDef` 本地接口（L15-18）可保留用于 CREATOR；或把 campaign 分支改用 `CampaignFieldDef`。表单渲染逻辑（L98-111）只用 `f.key`/`f.label`，与 `CampaignFieldDef` 兼容。`fields` 变量（L47）类型为两种 FieldDef 的并集——若 TS 报错，把 `fields` 显式标为 `{ key: string; label: string }[]`：`const fields: { key: string; label: string }[] = kind === 'campaign' ? CAMPAIGN_FORM_FIELDS : CREATOR_FORM_FIELDS;`

- [ ] **Step 2: 确认表单 save 逻辑无需改**

`save()`（L68-86）将每个字段以字符串写入 `fieldEdits`；数值字段经 server `z.coerce.number()` 转换，故表单侧无需类型转换。`creatorIds` 多选（L58-60, L113-118）保留。id 自动生成 `camp-${uuid}`（L53-54）保留（string，符合 id:string）。

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor/components/RecordFormModal.tsx
git commit -m "feat(record-form): campaign form uses ~15 key fields from dictionary"
```

---

## Task 6: 更新数据管理表格（web `DataManagement.tsx`）

**Files:**
- Modify: `apps/web/src/routes/DataManagement.tsx:77-95,213,230-237,281`

- [ ] **Step 1: 表头 + 行单元格（DataPanel `headers` L77-80、`rows` L89-95）**

`headers` campaign 分支（L79）改为：

```ts
      ? ['项目名称', '公司', '投放平台', '项目周期', '项目预算', '运行状态', 'Owner', '']
```

`rows` campaign 分支（L91-93）改为：

```ts
      return [d.project_name ?? '—', d.company_name ?? '—', d.put_platform ?? '—', `${d.project_start_time ?? ''} ~ ${d.project_end_time ?? ''}`, d.cpt_budget ?? '—', RUN_STATUS_TEXT[d.run_status ?? -1] ?? '—', r.ownerId, actions(r)];
```

> 顶部需 import `RUN_STATUS_TEXT`：在 L2 的 shared import 中加入。L2 现为 `import type { Campaign, Creator, CreatorCampaignPerformance } from '@mediakit/shared';`——改为值导入并加 `RUN_STATUS_TEXT`：

```ts
import { RUN_STATUS_TEXT, type Campaign, type Creator, type CreatorCampaignPerformance } from '@mediakit/shared';
```

- [ ] **Step 2: CampaignList `heads` + 单元格（L213, L230-237）**

`heads`（L213）改为：

```ts
  const heads = ['项目名称', '公司', '投放平台', '项目周期', '项目预算', '运行状态', 'Owner', ''];
```

单元格（L230-237）改为：

```tsx
                  <td className="px-3 py-2 font-medium text-foreground-primary">{d.project_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.company_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.put_platform ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.project_start_time ?? ''} ~ {d.project_end_time ?? ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.cpt_budget ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{RUN_STATUS_TEXT[d.run_status ?? -1] ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.ownerId}</td>
```

- [ ] **Step 3: CollaboratorDrawer 标题（L281）**

```tsx
            <div className="truncate text-xs text-foreground-muted">{record.data.project_name ?? record.data.id}</div>
```

> `CampaignList`/`CollaboratorPanel`/`ManageCollaboratorsModal` 用 `record.id`（string 记录 id）作 `campaignId` 查 mock（L301, L314-316, L390, L427）——保持不变；`platforms`/`creatorIds` 仍在 Campaign 上——保持不变。

- [ ] **Step 4: typecheck + web 测试**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS。
若有 DataManagement 测试，跑 `pnpm --filter @mediakit/web test` 并更新断言。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/DataManagement.tsx
git commit -m "feat(data-mgmt): campaign table columns use mirrored fields"
```

---

## Task 7: 更新 mock 数据（web `mock/campaigns.ts`）

**Files:**
- Modify: `apps/web/src/api/mock/campaigns.ts:14-99`

- [ ] **Step 1: 重写 6 个 mock campaign 到新字段形态**

把整个 `MOCK_CAMPAIGNS` 数组替换为（id 保持 slug 字符串，与 `campaignPlatforms`/`rollupCampaignMetrics`/mock 查找表一致；仅填关键字段，其余 optional 省略）：

```ts
export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-glowlab-q4',
    project_name: 'GlowLab Q4 Sensitive Skin Serum Launch',
    company_name: 'GlowLab',
    put_platform: 'TikTok',
    project_start_time: '2026-10-12',
    project_end_time: '2026-11-10',
    cpt_budget: 300000,
    run_status: 1,
    platforms: campaignPlatforms('camp-glowlab-q4'),
    metrics: rollupCampaignMetrics('camp-glowlab-q4'),
  },
  {
    id: 'camp-lumiere-launch',
    project_name: 'LUMIÈRE Anti-Aging Cream Launch',
    company_name: 'LUMIÈRE',
    put_platform: 'TikTok',
    project_start_time: '2026-09-01',
    project_end_time: '2026-09-30',
    cpt_budget: 520000,
    run_status: 2,
    platforms: campaignPlatforms('camp-lumiere-launch'),
    metrics: rollupCampaignMetrics('camp-lumiere-launch'),
  },
  {
    id: 'camp-nova-home-618',
    project_name: 'NOVA Home 618 Home Goods Mega Sale',
    company_name: 'NOVA Home',
    put_platform: 'Instagram',
    project_start_time: '2026-05-20',
    project_end_time: '2026-06-20',
    cpt_budget: 780000,
    run_status: 2,
    platforms: campaignPlatforms('camp-nova-home-618'),
    metrics: rollupCampaignMetrics('camp-nova-home-618'),
  },
  {
    id: 'camp-motion-spring',
    project_name: 'MOTION Spring Sports Seeding Campaign',
    company_name: 'MOTION',
    put_platform: 'YouTube',
    project_start_time: '2026-03-01',
    project_end_time: '2026-04-15',
    cpt_budget: 260000,
    run_status: 2,
    platforms: campaignPlatforms('camp-motion-spring'),
    metrics: rollupCampaignMetrics('camp-motion-spring'),
  },
  {
    id: 'camp-everyday-bf',
    project_name: 'EVERYDAY Black Friday Gift Explosion',
    company_name: 'EVERYDAY',
    put_platform: 'TikTok',
    project_start_time: '2026-11-20',
    project_end_time: '2026-12-25',
    cpt_budget: 440000,
    run_status: 0,
    platforms: campaignPlatforms('camp-everyday-bf'),
    metrics: rollupCampaignMetrics('camp-everyday-bf'),
  },
  {
    id: 'camp-wander-summer',
    project_name: 'WANDER Summer Travel Content Marketing',
    company_name: 'WANDER',
    put_platform: 'YouTube',
    project_start_time: '2026-07-01',
    project_end_time: '2026-08-31',
    cpt_budget: 360000,
    run_status: 1,
    platforms: campaignPlatforms('camp-wander-summer'),
    metrics: rollupCampaignMetrics('camp-wander-summer'),
  },
];
```

> 顶部注释（L7-8）提到 legacy `platform` 字段——更新或删除该注释（不再有 `platform`/`advertiser` 等旧字段）。`campaignPlatforms`/`rollupCampaignMetrics` 签名不变（仍接收 slug string id）。

- [ ] **Step 2: typecheck + web 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: PASS（mock 满足新 `Campaign` 接口；若有 mock 一致性测试引用旧字段，按断言更新）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/mock/campaigns.ts
git commit -m "feat(mock): campaigns use mirrored field shape"
```

---

## Task 8: 更新编辑器报告桥接（web `DataConfigOverlay.tsx` + `ImportCampaignModal.tsx`）

**Files:**
- Modify: `apps/web/src/editor/components/DataConfigOverlay.tsx:3,93-103,127-129,156-158,291`
- Modify: `apps/web/src/editor/components/ImportCampaignModal.tsx:77`

- [ ] **Step 1: `DataConfigOverlay.tsx` 用 helper 替换内联映射**

- import（L3 区域，shared import）加入 `campaignToReportCampaign`：

```ts
import { campaignToReportCampaign, Campaign, ... } from '@mediakit/shared';
```
（保留原有 `Campaign` 等导入；按该文件 L3 现有 `Campaign,` 行扩展。）

- L93-103 的内联 ReportCampaign 构造（`name: c.name, advertiser: c.advertiser, ...`）替换为：

```ts
      ...campaignToReportCampaign(c),
```
（若该对象还包含 `id` 之外的额外字段，保留它们；确认替换后对象仍为合法 `ReportCampaign`。）

- L127-129 与 L156-158 出现的 `name: c.name, ... platform: c.platform` ——先用 `pnpm --filter @mediakit/web typecheck` 定位这两处是否针对 Campaign 对象。若它们构造的是 `ReportCreator`/其它（`c` 为 creator），则不改；若构造 Campaign 派生对象，按需映射或复用 helper。**实现时以 typecheck 报错为准逐处修。**

- L291 `{c.name}（{c.advertiser}）` 改为：

```tsx
                        {c.project_name}（{c.company_name}）
```

- [ ] **Step 2: `ImportCampaignModal.tsx` L77**

```tsx
                    {c.project_name}
```

（`c.id`/`c.metrics` 不变。）

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS。若有遗留 Campaign 旧字段引用，按 typecheck 逐处映射（旧→新：`name`→`project_name`、`advertiser`→`company_name`、`platform`→`put_platform`、`startDate`→`project_start_time`、`endDate`→`project_end_time`、`budget`→`cpt_budget`/`roi_budget`、`businessLine`→`business_line_id`、`status`(显示)→`run_status`、`owner`→`creator_id`）。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor/components/DataConfigOverlay.tsx apps/web/src/editor/components/ImportCampaignModal.tsx
git commit -m "feat(editor): bridge mirrored campaign → report via campaignToReportCampaign"
```

---

## Task 9: 全量 typecheck + 测试 + 收尾验证

**Files:**
- Verify: `apps/web/src/editor/business/kinds/campaign.tsx`、`apps/web/src/editor/components/report/CampaignReport.tsx`（grep 无 campaign 字段引用，预期安全，以 typecheck 为准）

- [ ] **Step 1: 全仓 typecheck**

Run: `pnpm typecheck`
Expected: PASS。若 `business/kinds/campaign.tsx` 或 `CampaignReport.tsx` 报 Campaign 旧字段错，按 Task 8 的旧→新映射表修复并 `git commit -m "fix: remap remaining campaign field refs"`。

- [ ] **Step 2: 全仓测试**

Run: `pnpm test`
Expected: 全绿。若 web 有 DataManagement / dataImport / mock 一致性测试失败，按新字段更新断言。

- [ ] **Step 3: 手动冒烟（可选，确认 UI）**

启动 `pnpm dev`，打开数据管理页：Campaign 表格显示新列（项目名称/公司/投放平台/周期/预算/运行状态）；「新增/编辑」表单显示 ~15 个关键字段；「下载模板」生成 78 列表头；「导入示例数据」成功 seed 6 条 mock campaign；行「查看达人」展开合作达人子表仍正常（platforms/creatorIds 未变）。

- [ ] **Step 4: 最终 commit（如有 Step 1/2 修复）**

```bash
git add -A
git commit -m "test: align remaining campaign consumers with mirrored schema"
```

---

## Self-Review（plan 自检，执行前已完成）

- **Spec 覆盖**：77 规格 + 3 app 字段 → Task 1（interface+字典）、Task 2（schema）；id 字符串化决策 → 各 Task 遵循；粗粒度 coerce.number → Task 2；字段字典单一来源 → Task 1+4+5；id 映射（service 无需改）→ Task 3 说明；UI 表格/表单/导入/mock → Task 4-7；编辑器桥接 → Task 8。Out of scope（无 Prisma 迁移、不拆枚举、表单不全量）均体现。
- **占位符**：无 TBD/TODO；Task 8 Step 1 对 L127/L156 以 typecheck 为准（已给判定规则与映射表，非占位）。
- **类型一致**：`CampaignFieldDef.key: keyof Campaign`、`CAMPAIGN_FIELD_DEFS`、`campaignToReportCampaign`、`RUN_STATUS_TEXT` 在 Task 1 定义，Task 4/5/6/8 引用名一致；`z.coerce.number()` 与 interface `number` 一致；id 全链路 string。
- **风险点**：`z.coerce.number()` 对未剔除的空串会静默成 `0`（非 NaN）；导入/表单已在写入前剔除空串，故安全。执行时若发现某 JSON/API 输入路径可能直传 `""` 给数值字段，在该边界剔除空串或对相关字段加 `.catch(undefined)`。
