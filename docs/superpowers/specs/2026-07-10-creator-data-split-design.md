# 达人数据拆分 — 达人库（主）+ campaign 合作达人（子集）

**日期:** 2026-07-10
**范围:** mock 数据层 + 一个消费方页面（`MockData.tsx`）。无共享类型改动、无 UI 组件渲染逻辑改动、不触碰持久化 schema。

## 背景

当前 mock 的「达人维度数据」与「campaign 合作达人」**其实是同一批 7 个人**，且二者纠缠：

- `apps/web/src/api/mock/creators.ts` `CREATOR_META`（7 人花名册）与 `apps/web/src/api/mock/creatorPerformance.ts` `ROSTER`（同样 7 人，`{id,name,handle,tier}`）**重复维护两份**。
- 达人维度（`listCreators()` → `MOCK_CREATORS`）的 `metrics[]`（GMV/ROAS/转化/佣金）是从 campaign 表现 `rollupCreatorTotals` **反推**出来的——即达人维度数据依赖 campaign 合作数据，二者未分离。
- 存在循环依赖：`mock/creators.ts` import `rollupCreatorTotals` from `mock/creatorPerformance.ts`。

需要把达人数据明确拆成两份：

1. **达人库（单独达人维度）** —— 独立的达人池，承载达人自身**频道指标**，不依赖任何 campaign。
2. **campaign 合作达人** —— 某次 campaign 中参与合作的达人及其 campaign 维度表现（已存在）。

## 目标 / 非目标

**目标**

1. 达人库作为**主数据源 / 唯一花名册**（master roster），campaign 合作为其**子集**（共用 creatorId）。
2. 达人库 `metrics[]` 改为达人自身**频道指标**，与 campaign 表现彻底解耦。
3. 消除花名册重复维护（`ROSTER`）与循环依赖。
4. 扩充达人库规模（7 → 12），新增 5 名「库内有、未合作」的库专属达人。

**非目标（本次迭代）**

- 不改动 `CreatorComponents.tsx` 等任何业务组件的渲染逻辑。
- 不改动 `DataConfigOverlay.tsx` 的选人/取数逻辑（其 `buildDefaultStats` 只读 `followers`/`engagement`，零逻辑改动，仅可选项从 7→12）。
- 不改动 6 个 `CAMPAIGN_PROFILE`（其引用的 creatorId 不变 → campaign 表现数值不变）。
- 不改动共享类型 `Creator`（`metrics: CampaignMetric[]` 类型不变）。
- 不触碰服务端持久化 schema / Zod（`Creator` 为 mock 上游类型，非持久化；持久化的是 shared 的 `ReportCreator`）。

## 方案：子集模型 + 原地扩展解耦

达人库为 master，campaign 合作为子集；在现有文件内原地扩展并解耦，不新增文件。

### 1. 达人库 — `apps/web/src/api/mock/creators.ts`

**花名册扩容：** `CREATOR_META` 由 7 → **12 人**。

- **保留原 7 人**（id / name / handle / platform / tier / followers / engagement / category / region 全部不变），保证 campaign 引用与现有测试不破。
- **新增 5 人** 为库专属达人（不进入任何 `CAMPAIGN_PROFILE.creators`），贴近真实「达人库总有尚未合作的达人」。建议覆盖现有平台/层级/类目空白（如 Xiaohongshu、Bilibili、Weibo；micro 层等）。

**频道指标（替换 `rollupCreatorTotals`）：** `MOCK_CREATORS` 的 `metrics[]` 改为确定性生成的达人频道 KPI，沿用本仓库确定性生成风格（`creatorPerformance.ts` 的 `TIER_BASE` / `POST_JITTER` 模式）。

建议 4 项（与 `packages/shared/src/theme/presets.ts` 的 `CREATOR_METRIC_CATALOG` 语义对齐，且**不与** `Creator` 已有的 `followers`/`engagement` 核心字段重复）：

| label | 来源 key（catalog） | 量级示例 |
|---|---|---|
| Avg Reach | `reach` | 640K |
| Impressions | `impressions` | 12.6M |
| Follower Growth | `growth` | +38K |
| CPM | `cpm` | ¥120 |

生成规则（确定性，无 RNG）：

- 按 tier 基线（mega / macro / micro 三档量级递减）。
- 平台因子：视频平台（TikTok/Douyin/Bilibili/YouTube）reach/impressions 略高于图文平台。
- 确定性 jitter（按 creator 在库内 index 取，避免量级成等比）。
- 格式化：本地极简 `compact`/`fmt`/`money` 助手（各 ~3 行），**不再 import** `creatorPerformance.ts` → 打破循环依赖。
- `compare` 字段留空 `''`（频道指标无跨期对比语义；如需可后续补确定性 MoM 串）。

**导出不变：** 仍导出 `MOCK_CREATORS: Creator[]`（API 层 `listCreators` 零改动）。

### 2. campaign 合作达人 — `apps/web/src/api/mock/creatorPerformance.ts`

- **删除重复 `ROSTER`**（当前第 37–45 行），改为 `import { CREATOR_META } from './creators'`，按需投影为 `{ id, name, handle, tier }`（或直接用 `CREATOR_META` 查询）。
- `buildPerformance` 改为从达人库查 `tier`/`handle`/`name`（数据等价 → campaign 表现数值不变）。
- **删除 `rollupCreatorTotals`**（解耦后无人调用；grep 确认仅 `mock/creators.ts` 引用过）。
- 其余（`CAMPAIGN_PROFILE` / `buildPerformance` 主体 / `rollupCampaignMetrics` / `listCreatorPerformance` / `campaignWorkScreenshots` / `campaignCreatorWorks` / `campaignPlatforms`）**全部不变**。

### 3. campaign 列表 — `apps/web/src/api/mock/campaigns.ts`

无改动。`rollupCampaignMetrics(campaignId)`（campaign = Σ 合作达人）自洽性不变。

### 4. 消费方 — `apps/web/src/routes/MockData.tsx`

- 「达人数据」表格 4 列由 GMV/ROAS/转化/佣金 → 改为 **Avg Reach / Impressions / Follower Growth / CPM**（与达人库 `metrics[]` 对应）。
- section 标题由「达人数据」→「**达人库**」（明确两份数据的区别：达人库页 vs campaign 合作执行效果区）。
- campaign 合作侧（「达人执行效果」区 + 投放位汇总）不变。

### 5. 子集一致性

达人库为 master，约束（不强制运行时断言，落地后人工 / 测试核对）：

- 每个 `CAMPAIGN_PROFILE.creators` 中的 creatorId 必须存在于达人库（现有 7 人保留即满足）。
- 新增 5 人不出现在任何 campaign。

## 受影响文件

| 文件 | 改动 |
|---|---|
| `apps/web/src/api/mock/creators.ts` | `CREATOR_META` 7→12；`metrics[]` 改为频道指标（删 `rollupCreatorTotals` import，加本地 fmt + 生成器）；不再 import `creatorPerformance` |
| `apps/web/src/api/mock/creatorPerformance.ts` | 删 `ROSTER`（改 import `CREATOR_META`）；删 `rollupCreatorTotals` |
| `apps/web/src/routes/MockData.tsx` | 达人表 4 列改频道指标；section 标题「达人数据」→「达人库」 |

**无改动：** `api/creators.ts`（薄 API）、`api/mock/campaigns.ts`、`DataConfigOverlay.tsx`、`CreatorComponents.tsx`、`packages/shared/*`。

## 测试 / 验证

**现有测试（已核对，影响小）：**

- `tests/creator-performance.test.ts` —— 断言 `camp-glowlab-q4` 下 cre-mia(4)/cre-sofia(3)/cre-tom(2) 帖子数 + daily 自洽。**依赖原 7 人 + campaign profile 不变 → 本设计保留这些，预期不破。**
- `tests/campaign-work-screenshots.test.ts` —— 断言 `campaignWorkScreenshots('camp-glowlab-q4')` 返回 9 条。**campaign 侧不变 → 预期不破。**
- `tests/mock-data.test.tsx` —— mock 了 `listCreators`，与真实数据解耦；仅需把 section 标题断言 `达人数据 · 1` 同步为 `达人库 · 1`。

**新增（可选）：** 一条达人库一致性测试——达人库 12 人、所有 `CAMPAIGN_PROFILE.creators` 的 creatorId 均命中达人库、其中 7 人参与 ≥1 个 campaign。

**验证命令：**

- `pnpm -w typecheck`（类型无破坏：`Creator.metrics: CampaignMetric[]` 不变）。
- `pnpm --filter web test`（上述 3 个测试通过；新增一致性测试通过）。
- 手动：`/mock-data` 页达人库表展示 12 人 + 4 个频道指标列；campaign 执行效果区数值与改动前一致。
