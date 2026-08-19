# 业务线报告指南(Guide)设计

日期:2026-08-19
状态:已评审(分节逐节确认)

## 背景与问题

不同业务线(FT/SM/CX/DG/KN/DM)、不同广告主的报告在内容与样式上存在系统性差异,涉及四个维度:

1. **品牌视觉** — 色板、字体、logo、组件风格
2. **章节结构** — 必含/排除章节、顺序、详略
3. **展示形式** — 可枚举的组件选型(如达人列表卡片 vs 表格)
4. **语调与术语** — 自称、称呼、行业用语、文案口吻

现状:

- `BusinessLine.designMd`(DB)承载设计规范,仅 AI 模式使用,拼在**用户提示词**尾部(`ai-generate.service.ts` `DESIGN_GUIDE_SUFFIX` 注入)
- recipe 模式(`recipe/campaign-report/tokens.ts`)固定 DG 色板,`tokens.ts` 注释预留 businessLine 覆盖未实现
- 章节 manifest(`manifest.ts`)全局唯一,无业务线差异
- 语调无任何分支,SYSTEM_PROMPT 全局一份

## 决策记录(用户拍板)

| 决策点 | 结论 |
|---|---|
| 差异维度 | 品牌视觉/章节/展示形式/语调术语四者全要 |
| 挂载层级 | 业务线为主,广告主**不**作为指南维度(仅 logo/署名等业务事实注入) |
| 承载形态 | **AI 提示词层**,不做结构化 tokens/manifest 后台配置 |
| 提示词归属 | 整合进**系统提示词**(按请求拼装,非拼在用户提示词) |
| 指南数量 | 一个业务线多份指南,按 scenario(报告场景)切分,一份 isDefault |
| 存储 | DB 表 + 数据管理后台维护(独立 Guide 菜单) |
| designMd 处置 | 注入路径废除(选项 B),非空内容一次性迁移为默认指南 |

展示形式的归属判据:**能枚举的进指南(配置),需要语义判断的交 AI**(单条洞察文案、达人卡片上的一句话点评)。AI 模式下指南是硬约束,非建议。

## 架构

### 三层提示词

```
system prompt = SYSTEM_PROMPT_CORE        通用规则,去业务化,全局一份代码常量
             + 业务线指南 0..1 份          Guide 表按 campaign 匹配,动态拼装
             + 业务事实注入                双 logo、"Prepared by {businessLine.name}" 等,
                                           规则在 CORE,值从 campaign 数据渲染

user prompt   = campaign 数据(JSON)       纯数据,不再拼 designMd
```

拼装函数:`buildSystemPrompt(campaign, guide)`,生成路径与 EDIT 续写路径共用,保证改稿与首稿风格一致。

### 数据模型

```prisma
model Guide {
  id             String   @id @default(cuid())
  businessLineId String
  scenario       String?      // 可空:月报/结案/复盘…,不填=不限场景
  name           String       // 展示名,如 "DG 月报指南"
  content        String   @db.Text  // Markdown 指南正文
  isDefault      Boolean  @default(false)
  isActive       Boolean  @default(true)   // 软停用,不物理删除
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 指南匹配算法(确定性,不依赖 AI)

```
优先级:scenario 精确匹配的激活指南
      > 该业务线 isDefault 激活指南
      > 无指南(仅 SYSTEM_PROMPT_CORE)
```

- scenario 来自 ai-generate 请求可选参数 `scenario: z.string().optional()`;前端生成面板暴露"报告类型"选择,首期可不传
- 匹配不到静默降级,不报错;响应回传 `guideUsed: {id, name}` 供前端提示
- 同优先级多条时按 `updatedAt DESC` 取最新
- 不做广告主级指南,不做指南逐段合并(整体替换)

## 指南内容规范(分节约定,非校验)

```markdown
# {业务线名} 报告指南

## 品牌视觉
精确色值(主/辅/背景/描边)、字体、logo 用法、组件风格(圆角/阴影/密度)

## 章节结构
必含章节及顺序;明确排除项(如"不提 ROI");各章节详略偏好

## 展示形式偏好
可枚举的选型规则,写成确定性规则
(如"达人列表:≤6 人卡片网格,>6 人表格;趋势图一律用面积图")

## 语调与术语
自称与称呼;术语表(用"推广"不用"投放");洞察口吻
```

缺节自动回落到 CORE 通用规则。指南与 CORE 冲突时**指南赢**;指南未覆盖处按 CORE。

### SYSTEM_PROMPT_CORE 改造

- 抽出业务属性内容(logo 具体规则、"Prepared by"字面量等)→ 通用占位 + 业务事实注入段
- 新增/扩展元规则:「业务线指南优先于本提示词默认样式」(现有 L103-146 规则的扩展)
- EDIT_SYSTEM_PROMPT 同样走 buildSystemPrompt

### recipe 模式(仅对齐语调)

视觉/章节/manifest 不动(DG 专用确定性渲染)。`narrative.ts` 生成洞察文案时注入所选指南的「## 语调与术语」节:字符串截取(`## 语调与术语` 至下一 `## ` 或文末),不做 Markdown 解析。

## 数据流

```
POST /api/html-templates/ai-generate (或 edit 变体)
  ↓ controller Zod 校验(新增可选 scenario)
  ↓ guideService.pickForCampaign(campaignId/businessLineId, scenario?)
      SELECT ... WHERE businessLineId=? AND isActive
      ORDER BY (scenario匹配) DESC, isDefault DESC, updatedAt DESC LIMIT 1
  ↓ buildSystemPrompt(campaign, guide) 拼装
  ↓ user prompt = campaign 数据(移除 designMd 拼接)
  ↓ AI 调用(gateway/reasoning 处理不变)
```

无缓存(单表 <百行,每次查一次 DB 可接受)。

## 后台管理

数据管理页独立 **Guide 菜单**,复用实体 CRUD 骨架(参照 MarketingEvent 先例):

- 列表:业务线筛选、名称、scenario、isDefault、isActive
- 新建/编辑抽屉:业务线下拉、名称、scenario 下拉+自定义、content Markdown 文本域、isDefault 开关
- **isDefault 唯一性**:设为默认时事务内自动取消同业务线其他指南的 isDefault
- isActive 停用不参与匹配,不物理删除(留痕)
- API:`GET/POST/PATCH /api/guides` + Zod schema,沿用 data 模块模式

## 迁移

一次性脚本(幂等):`BusinessLine.designMd` 非空 → 建该业务线一条
`Guide(isDefault: true, name: "{业务线名} 设计规范(迁移)")`;已存在同名迁移指南则跳过。designMd 字段保留不删,注入路径代码移除。

## 错误处理(全链路静默降级,生成永不因指南失败)

| 场景 | 行为 |
|---|---|
| 业务线无任何激活指南 | 仅 CORE,正常生成 |
| scenario 未匹配 | 降级 isDefault,响应带 guideUsed |
| content 为空串 | 视同无指南 |
| Guide 查询失败 | log warn,无指南继续 |
| isDefault 事务失败 | 400 返回,人工重试 |
| 迁移遇重复 | 幂等跳过 |

## 测试

- **guideService 单测**:匹配优先级、isActive 过滤、isDefault 唯一事务、空 content
- **buildSystemPrompt 单测**:含/不含指南拼装快照;CORE 无业务词残留(断言不含 "Prepared by" 字面量);EDIT 路径带指南
- **API 集成**:Guide CRUD Zod 校验;ai-generate 带/不带 scenario 的 guideUsed 回传
- **迁移脚本**:designMd→默认指南、幂等重跑
- **手动验收**:同 DG campaign 配/不配指南对比;HtmlStudio 编辑续写风格一致

## 明确不做(YAGNI)

- 广告主级指南、指南逐段合并
- recipe tokens/manifest 按业务线配置化(recipe 视觉/章节保持 DG 专用确定性渲染)
- 结构化 tokens(机器可读色板 JSON)、voiceMd 独立字段
- 指南缓存、指南版本历史
