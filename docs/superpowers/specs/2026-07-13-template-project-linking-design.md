# Phase 1:模板分类关联 + 业务线驱动默认套用

- **日期**:2026-07-13
- **状态**:已通过设计评审,待写实现计划
- **范围**:Phase 1(共 3 期规划中的第 1 期)

## 1. 背景与最终目标

最终目标是**一条流水线**:业务提供一批 campaign 数据,系统按「业务线 + 所选模板」自动套用模板的内容框架与样式,填充数据后输出相对完整的 PDF。

探查代码后确认:这条链路的多数零件**已存在**(模板/项目共用 `pages`+`meta`、`createFromTemplate` 深拷贝、服务端按 businessLine+scenario 过滤模板、单 campaign 绑定到 `meta.reportData`、Puppeteer PDF 导出)。真正缺失的是:模板的「模版类型」分类、按业务线自动套用骨架、一批 campaign、seed 时自动填充。

因此拆成 3 期:

- **Phase 1(本期)**:模板分类关联 + 业务线驱动默认套用。= 用户原始需求 #1、#2,也是后续流水线的前提(没有它就无法「按业务线选模板」)。
- **Phase 2**:单 campaign 自动填充 → 完整 PDF(真实数据导入 + seed 自动填充 + 复用已有 PDF)。
- **Phase 3**:批量(N 个 campaign → N 份 PDF)。

## 2. 原始需求

1. 模板管理「新建模板」与我的项目「新建项目」某些字段需关联:**场景 与 模版类型 需对应**。
2. 新建项目需增加「业务线」;业务线相关项目的页面模板**默认内容框架和样式**取自模板管理中对应业务线的模板。

## 3. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 「模版类型」是什么 | 场景下细分的**新字段**(`templateType`),覆盖全部 3 个场景 | 用户确认 |
| 模版类型取值 | campaign-report=周报/月报/总结;campaign-proposal=简版/标准版/完整版;media-kit=品牌版/达人版/平台版 | 用户确认(后续可改) |
| 项目侧字段 | 新增 `templateType`;campaign-report 时与现有 `scenarioSub` **双写同值**,不删 `scenarioSub` | 避免破坏已持久化的 `scenarioSub` 与读取它的代码 |
| 默认模板匹配 | **显式默认模板**:`Template.meta.isDefault`,每格(businessLine×scenario×templateType)唯一 | 确定性强、业务可控 |
| businessLine | 新建项目中**始终可见、必填**;campaign 场景仍可由 campaign 自动回填(可改) | 它是默认套用的前提 |
| 套用范围 | 命中默认模板时拷贝模板的 `pages` + `meta.theme` + `width/height`;**不**拷 `reportData/campaignInfo` | 框架/样式归模板,数据归项目(Phase 2 填) |
| 字段存储 | 全部落 `meta` Json,**无 Prisma 迁移** | 回避 shadow DB / P3014;`isDefault` 唯一性由应用层保证 |

## 4. 数据模型

`Template.meta` 与 `Project.meta` 复用同一 `projectMetaSchema`(`apps/server/src/modules/projects/projects.schema.ts`)。新增两个可选字段,存量数据不受影响。

### 4.1 `projectMetaSchema`(两侧共享)— 加 `templateType`

```ts
businessLine: z.string().max(40).optional(),   // 已有
scenario: z.enum(['campaign-report','campaign-proposal','media-kit']).optional(),  // 已有
scenarioSub: z.enum(['weekly','monthly','wrap-up']).optional(),  // 已有,保留不动
templateType: z.string().max(40).optional(),   // ← 新增,松字符串(同 businessLine 先例)
// ...其余字段不变
```

- 松字符串而非 enum:模版类型取值随场景变化,且后续可能调整;前端字典约束合法性,后端只存值,改值不动 schema(遵循「已持久化字段不随意改名/收紧枚举」原则)。

### 4.2 `templateMetaSchema`(仅模板)— extends 加 `isDefault`

`apps/server/src/modules/templates/templates.schema.ts` 当前直接 import `projectMetaSchema`。改为:

```ts
import { projectMetaSchema } from '../projects/projects.schema';
export const templateMetaSchema = projectMetaSchema.extend({
  isDefault: z.boolean().optional(),   // ← 仅模板有
});
// createTemplateSchema / updateTemplateSchema 改用 templateMetaSchema
```

> `isDefault` 仍走共享 schema 的校验路径(因为 `Template.meta` 用 `templateMetaSchema`),但 `Project.meta` 仍用 `projectMetaSchema`,所以项目不会被写入 `isDefault`。Zod object 默认 strip 未知键,因此 `isDefault` 必须在 schema 中声明才能在 `Template` 侧存活。

### 4.3 共享类型

`packages/shared/src/types/theme.ts` 的 `ProjectMeta` 加 `templateType?: string`。

### 4.4 前端取值字典(单一真源)

`apps/web/src/projectsMeta.ts`:

```ts
export const TEMPLATE_TYPES: Record<Scenario, { id: string; label: string }[]> = {
  'campaign-report':   [['weekly','周报'],['monthly','月报'],['wrap-up','总结']],
  'campaign-proposal': [['lite','简版'],['standard','标准版'],['full','完整版']],
  'media-kit':         [['brand','品牌版'],['creator','达人版'],['platform','平台版']],
};
```

## 5. 场景 ↔ 模版类型 对应(需求 #1)

两侧都持有 `(scenario, templateType)`,**对应 = 两者值相等**。匹配键 = `(businessLine, scenario, templateType)`。

- **模板侧**(`TemplateFormDialog`):选 场景 → 级联出现对应模版类型下拉。
- **项目侧**(`CreateProjectDialog`):现有的「报告类型」(`scenarioSub`)下拉**升级为「模版类型」下拉**,泛化到全部 3 个场景(选场景后级联)。campaign-report 下仍显示周报/月报/总结。
  - 选中值写入 `meta.templateType`。
  - 若 `scenario === 'campaign-report'`,**同时**写 `meta.scenarioSub` 为同值(weekly/monthly/wrap-up),保持读取 `scenarioSub` 的既有代码可用。
  - campaign-proposal / media-kit 只写 `templateType`,`scenarioSub` 保持 undefined。

## 6. 默认模板与匹配(需求 #2 核心)

### 6.1 设为默认

- `TemplateFormDialog` 加复选框「设为该业务线×场景×模版类型的默认模板」。
  - **前置条件**:仅当 `businessLine`、`scenario`、`templateType` 三者都已选择时,复选框才可用(否则禁用并提示「请先选业务线/场景/模版类型」)。
  - `status=DRAFT` 模板不允许设默认(或设默认时自动提示先发布)——Phase 1 取「DRAFT 不允许设默认」,实现时若更顺手也可改为「设默认时自动转 PUBLISHED」,二选一在计划里定。
- 提交 → 服务端 `templates.service.setDefault(ownerId, id)` **事务**:
  1. 读出该模板的 `meta.{businessLine, scenario, templateType}`。
  2. 把所有同格(`businessLine` && `scenario` && `templateType` 相等)且 `status=PUBLISHED` 的模板的 `meta.isDefault` 置为 `false`。
  3. 置本模板 `meta.isDefault = true`。
- 唯一性由应用层保证(Prisma 无法对 Json 子字段做部分唯一索引)。

### 6.2 空白新建项目时套用

`apps/server/src/modules/projects/projects.service.ts` 的 `create()` 现状:创建 1 个空白页,`meta` 原样存。改为:

1. 入参增加(经 `createProjectSchema` 透传,前端已收集)`meta.{businessLine, scenario, templateType}`。
2. 若三者齐全 → 查询唯一模板:`status=PUBLISHED && meta.businessLine=X && meta.scenario=Y && meta.templateType=Z && meta.isDefault=true`。
   - **命中**:
     - 项目 `pages` = 深拷贝模板 `pages`(`JSON.parse(JSON.stringify(tpl.pages))`,复用 `createFromTemplate` 既有逻辑)。
     - 项目 `width/height` = 模板 `width/height`(框架按此画布设计)。
     - 项目 `meta.theme` = 模板 `meta.theme`(样式)。
     - 项目自有 `meta` 字段(`businessLine/scenario/templateType/advertiser/creator/campaignId/campaignInfo`)以**新建对话框提交的值为准**覆盖,不取模板的。
     - **不**拷模板 `meta.reportData`/`meta.campaignInfo`(数据归项目,Phase 2 填)。
     - 模板 `pages` 内的页面级 `campaignId/creatorId` 绑定随框架带过来(标识哪些页是 campaign 绑定页),值在 Phase 2 接入 campaign 时重绑。
   - **未命中**:维持现状(1 空白页)。返回 `seeded: false` 标记。
3. 返回 `ProjectDetail` 时附带 `seeded: boolean`,前端据此提示「已套用默认模板」或「未配置该业务线默认模板,已创建空白项目」。

### 6.3 JSON path 过滤

服务端过滤沿用既有写法(`templates.service.ts:75` 用 `path: '$.businessLine', string_contains`):

```ts
if (filters?.templateType) where.AND.push({ meta: { path: '$.templateType', string_contains: filters.templateType } });
if (filters?.isDefault !== undefined) where.AND.push({ meta: { path: '$.isDefault', equals: filters.isDefault } });
```

## 7. 业务线显式化

`CreateProjectDialog`:`businessLine` 从「仅 media-kit 手填 / campaign 自动回填」升级为**顶层、始终可见、必填**下拉(取自 `BUSINESS_LINES`)。

- campaign 场景:选了 campaign 后仍自动回填 `businessLine`(现有行为),但用户可改。
- 必填校验:未选不允许提交(它是默认套用的前提)。

## 8. 「从模板新建」对话框增强

`CreateFromTemplateDialog` 加 业务线 / 场景 / 模版类型 级联过滤(服务端 filter 已支持,补 `templateType` + `isDefault`),帮用户手动选模板时快速定位同格模板。默认模板可加视觉标记(如徽标)。

## 9. 涉及文件清单

**Server**
- `apps/server/src/modules/projects/projects.schema.ts` — `projectMetaSchema` 加 `templateType`;导出 `templateMetaSchema`
- `apps/server/src/modules/templates/templates.schema.ts` — 改用 `templateMetaSchema`
- `apps/server/src/modules/templates/templates.service.ts` — `list()` filter 加 `templateType`/`isDefault`;新增 `setDefault(ownerId, id)` 事务
- `apps/server/src/modules/templates/templates.controller.ts` / `.routes.ts` — 加 `setDefault` 路由(如 `PATCH /templates/:id/default`)
- `apps/server/src/modules/projects/projects.service.ts` — `create()` 加默认模板解析与骨架套用;返回 `seeded` 标记

**Web**
- `apps/web/src/projectsMeta.ts` — 加 `TEMPLATE_TYPES`
- `apps/web/src/components/CreateProjectDialog.tsx` — businessLine 必填顶层化;模版类型级联下拉(campaign-report 双写 scenarioSub);据 `seeded` 显示提示
- `apps/web/src/components/TemplateFormDialog.tsx` — 模版类型级联下拉 + isDefault 复选框
- `apps/web/src/components/CreateFromTemplateDialog.tsx` — 加级联过滤 + 默认徽标
- `apps/web/src/routes/Templates.tsx` — 列表加模版类型过滤列 + 默认徽标
- `apps/web/src/api/templates.ts` — list 透传 templateType/isDefault;`setDefault` 调用
- `apps/web/src/api/projects.ts` — create 透传 templateType;处理 `seeded` 返回

**Shared**
- `packages/shared/src/types/theme.ts`(`ProjectMeta`)— 加 `templateType?: string`

## 10. 兼容性

- 存量项目/模板无 `templateType`/`isDefault` → `undefined`,行为不变。
- `scenarioSub` 不删,campaign-report 双写。
- **无 Prisma 迁移**(全部落 `meta` Json)。
- 新增字段均为可选,不改名/不收紧既有枚举。

## 11. 测试

- `apps/server/tests/projects.schema.test.ts`:`projectMetaSchema` 接受/可选 `templateType`;`templateMetaSchema` 接受 `isDefault`;松字符串不拒绝未知模版类型值。
- 服务端:
  - `create()` 命中默认模板 → `pages`/`theme`/`width/height` 正确套用,自有 meta 不被模板覆盖,`seeded:true`。
  - `create()` 未命中 → 空白页,`seeded:false`。
  - `setDefault()` 置本模板默认、清同格其它 PUBLISHED 模板默认。
- Web(遵循 web-chart-test 约定,只断言 shell 文本):
  - `CreateProjectDialog`:businessLine 必填校验;场景切换后模版类型级联出现对应选项;campaign-report 选中后 scenarioSub 同步。
  - `TemplateFormDialog`:模版类型级联;isDefault 复选框提交。
  - `CreateFromTemplateDialog`:过滤生效。

## 12. 不在本期(Phase 2 / 3)

- 真实 campaign 数据导入(替 mock)。
- seed 时**自动填充**(模板 + 1 campaign → 已填充项目,替手动逐组件点)。
- 一批 campaign / 批量(N 个 campaign → N 份 PDF)。

## 13. 风险与备注

- **`isDefault` 唯一性竞态**:并发设同格默认可能短暂出现两个默认。Phase 1 用事务 + 应用层清理即可接受;若后续有并发压力再加 DB 约束。
- **默认模板被改 DRAFT/删除**:`isDefault=true` 的模板若被下线,新建项目会落到「未命中」分支(空白页 + 提示),不会报错。可接受。
- **画布尺寸**:套用默认模板时以模板 `width/height` 为准(框架为之设计);新建对话框的尺寸选择在「套用默认模板」场景下可隐藏或标注「由模板决定」,具体交互在实现计划里细化。
