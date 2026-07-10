# 达人数据拆分（达人库 + campaign 合作达人子集）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 mock 达人数据拆成两份——达人库（master 花名册，频道指标）+ campaign 合作达人（其子集），消除重复花名册与循环依赖。

**Architecture:** 子集模型。`mock/creators.ts` 升级为达人库（12 人，唯一花名册，`metrics[]` 改为确定性生成的频道 KPI）；`mock/creatorPerformance.ts` 删除重复 `ROSTER`、改为从达人库派生，并删除无人调用的 `rollupCreatorTotals`；`MockData.tsx` 表头/标题跟进。不触碰共享类型与持久化 schema。

**Tech Stack:** TypeScript, React, Vitest (jsdom), pnpm workspace (`@mediakit/web`).

**Spec:** `docs/superpowers/specs/2026-07-10-creator-data-split-design.md`

---

## 前置条件 & 隔离（执行前必读）

**阻断性前置条件：** 目标文件（`mock/creators.ts`、`mock/creatorPerformance.ts`、`api/creators.ts`、`tests/mock-data.test.tsx`）当前携带**另一项未提交的并发工作**——中文→英文注释翻译 + tier/platform 术语归一化（`头部`→`mega`、`KOC`→`micro`、`小红书`→`Instagram`）。那不是本任务。

在执行本计划前，**必须先把该项归一化改动提交（或 stash）**，原因有二：

1. **worktree 基线匹配**：本计划的代码块基于「归一化之后」的当前磁盘状态编写。若 worktree 从未含归一化的 commit 分支出来，基线将与代码块不符，执行代理会看到旧（中文）版本。
2. **干净提交**：本项目约定（见 memory）「never git-add a whole dirty file」+ 使用 worktree 隔离并发 feature。若在脏树上原地改，`git add <file>` 会把归一化与本任务的改动一起提交，无法分离（本环境不支持 `git add -p` 交互）。

**执行步骤：**
1. 先把归一化改动作为独立 commit 提交到 main（若归属用户的另一会话，与用户确认由谁提交）。
2. 用 `superpowers:using-git-worktrees` 从该 commit 创建隔离 worktree。
3. 在 worktree 内按任务执行；每个任务只 `git add` 该任务明确列出的文件，**绝不** `git add .` / `git add -A`。

> 若用户选择原地执行（不开 worktree），同样必须先提交归一化改动，否则提交会纠缠。

---

## File Structure

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `apps/web/src/api/mock/creators.ts` | 达人库 master：花名册 + 频道指标生成 | 扩 12 人；新增 `buildChannelMetrics`/`Tier`；`MOCK_CREATORS` 改用频道指标；删 `rollupCreatorTotals` import |
| `apps/web/src/api/mock/creatorPerformance.ts` | campaign 合作达人表现 | `ROSTER` 改为从 `CREATOR_META` 派生；导出 `campaignParticipantIds`；删 `rollupCreatorTotals` |
| `apps/web/src/routes/MockData.tsx` | mock 数据展示页 | 达人表 4 列→频道指标；section 标题「达人数据」→「达人库」 |
| `apps/web/tests/creator-library.test.ts` | **新建**：达人库一致性测试 | 覆盖人数/指标/子集关系 |
| `apps/web/tests/mock-data.test.tsx` | mock 数据页测试 | 标题断言跟进 |

无改动：`api/creators.ts`（薄 API）、`api/mock/campaigns.ts`、`DataConfigOverlay.tsx`、`CreatorComponents.tsx`、`packages/shared/*`、6 个 `CAMPAIGN_PROFILE`。

---

## Task 1: 频道指标生成器 `buildChannelMetrics`（TDD）

在 `mock/creators.ts` 新增确定性的频道 KPI 生成器，作为独立纯函数先行测试。此时 `MOCK_CREATORS` 仍用旧 `rollupCreatorTotals`（暂不动，避免一次性改太多）。

**Files:**
- Create: `apps/web/tests/creator-library.test.ts`
- Modify: `apps/web/src/api/mock/creators.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/creator-library.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { CREATOR_META, buildChannelMetrics } from '@/api/mock/creators';
import type { Creator } from '@/api/creators';

/** 解析 compact 格式（"2.40M"/"180.0K"/"567"）为数值。 */
const parseCompact = (s: string): number => {
  const m = s.match(/([\d.]+)\s*([MK]?)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return /M/i.test(m[2]) ? v * 1e6 : /K/i.test(m[2]) ? v * 1e3 : v;
};

const CHANNEL_LABELS = ['Avg Reach', 'Impressions', 'Follower Growth', 'CPM'];

describe('buildChannelMetrics (频道指标生成器)', () => {
  const mia = CREATOR_META.find((c) => c.id === 'cre-mia')!; // mega
  const tom = CREATOR_META.find((c) => c.id === 'cre-tom')!; // micro

  it('返回恰好 4 项指标，标签固定', () => {
    const m = buildChannelMetrics(mia, 0);
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.label)).toEqual(CHANNEL_LABELS);
  });

  it('每项都有 label/value/compare，compare 为空串', () => {
    for (const x of buildChannelMetrics(mia, 0)) {
      expect(typeof x.label).toBe('string');
      expect(typeof x.value).toBe('string');
      expect(x.value.length).toBeGreaterThan(0);
      expect(x.compare).toBe('');
    }
  });

  it('确定性：同输入→同输出（无 RNG / 无 Date）', () => {
    expect(buildChannelMetrics(mia, 0)).toEqual(buildChannelMetrics(mia, 0));
  });

  it('tier 量级：mega 的 Avg Reach > micro 的 Avg Reach', () => {
    const reach = (meta: Omit<Creator, 'metrics'>, i: number) =>
      parseCompact(buildChannelMetrics(meta, i).find((x) => x.label === 'Avg Reach')!.value);
    expect(reach(mia, 0)).toBeGreaterThan(reach(tom, 1));
  });

  it('Follower Growth 形如 +N(K/M)', () => {
    const g = buildChannelMetrics(mia, 0).find((x) => x.label === 'Follower Growth')!.value;
    expect(g.startsWith('+')).toBe(true);
  });

  it('CPM 形如 ¥N', () => {
    const c = buildChannelMetrics(mia, 0).find((x) => x.label === 'CPM')!.value;
    expect(c.startsWith('¥')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: FAIL — `buildChannelMetrics` 未导出 / 不存在（`CREATOR_META` 已存在，故查找不会失败，但 `buildChannelMetrics is not a function` 会抛错）。

- [ ] **Step 3: 实现 `buildChannelMetrics` + `Tier` + 助手**

在 `apps/web/src/api/mock/creators.ts` 顶部把 import 与类型补齐（保留现有 `import type { Creator } from '../creators'`，新增 shared 的 `CampaignMetric`）：

```ts
import type { CampaignMetric } from '@mediakit/shared';
import type { Creator } from '../creators';

/** Creator tier（与 creatorPerformance.ts 共享）。 */
export type Tier = 'mega' | 'macro' | 'micro';
```

> 注意：**不要**删除现有的 `import { rollupCreatorTotals } from './creatorPerformance';`——Task 2 才删它（此时 `MOCK_CREATORS` 还在用）。

在文件末尾（`MOCK_CREATORS` 定义**之后**）追加频道指标生成器：

```ts
/* ------------------------------ Channel metrics ------------------------------ */

/** Tier 频道基线（确定性量级，mega > macro > micro）。 */
const TIER_CHANNEL_BASE: Record<
  Tier,
  { reach: number; impressions: number; growth: number; cpm: number }
> = {
  mega: { reach: 2_400_000, impressions: 18_000_000, growth: 38_000, cpm: 120 },
  macro: { reach: 720_000, impressions: 5_400_000, growth: 11_000, cpm: 98 },
  micro: { reach: 180_000, impressions: 1_150_000, growth: 3_000, cpm: 74 },
};

/** 视频平台 reach/impressions 上浮（相对图文平台）。 */
const VIDEO_PLATFORMS = new Set(['TikTok', 'Douyin', 'Bilibili', 'YouTube']);

/** 确定性 per-index 抖动（同 creatorPerformance POST_JITTER 模式，无 RNG）。 */
const CHANNEL_JITTER = [1.0, 0.88, 1.12, 0.94, 1.06, 0.82, 1.15, 0.9, 1.03, 0.77, 1.09, 0.85];

const compact = (n: number): string => {
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};
const money = (n: number): string => `¥${Math.round(n).toLocaleString('en-US')}`;

/**
 * 生成达人的频道级 KPI 指标（确定性，**非** campaign 反推）。
 * @param meta 花名册条目（取 tier + platform）
 * @param index 该达人在达人库中的序号（驱动确定性抖动）
 */
export function buildChannelMetrics(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): CampaignMetric[] {
  const base = TIER_CHANNEL_BASE[meta.tier as Tier] ?? TIER_CHANNEL_BASE.micro;
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];
  const videoFactor = VIDEO_PLATFORMS.has(meta.platform) ? 1.15 : 0.9;
  return [
    { label: 'Avg Reach', value: compact(base.reach * jit * videoFactor), compare: '' },
    { label: 'Impressions', value: compact(base.impressions * jit * videoFactor), compare: '' },
    { label: 'Follower Growth', value: `+${compact(base.growth * jit)}`, compare: '' },
    { label: 'CPM', value: money(base.cpm * jit), compare: '' },
  ];
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: PASS（6 条全绿）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/api/mock/creators.ts apps/web/tests/creator-library.test.ts
git commit -m "$(cat <<'EOF'
feat(mock): add deterministic buildChannelMetrics generator for creator library

频道级 KPI(Avg Reach/Impressions/Follower Growth/CPM)，tier×platform 派生，无 RNG；
为达人库 metrics 解耦 campaign rollup 做准备。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 达人库扩至 12 人 + 切换 `MOCK_CREATORS` 到频道指标 + 打破循环依赖

新增 5 名「库内有、未合作」达人；`MOCK_CREATORS` 改用 `buildChannelMetrics`；删除 `rollupCreatorTotals` import（打破循环依赖 `creators → creatorPerformance → creators`）；更新文件头注释。

**Files:**
- Modify: `apps/web/src/api/mock/creators.ts`
- Modify: `apps/web/tests/creator-library.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/creator-library.test.ts` 顶部 import 行后增加 `MOCK_CREATORS`：

```ts
import { CREATOR_META, MOCK_CREATORS, buildChannelMetrics } from '@/api/mock/creators';
```

在文件末尾追加：

```ts
describe('达人库 roster', () => {
  it('共 12 名达人', () => {
    expect(MOCK_CREATORS).toHaveLength(12);
    expect(CREATOR_META).toHaveLength(12);
  });

  it('原 7 名 campaign 合作达人保留（id 与 tier 不变）', () => {
    const byId = Object.fromEntries(CREATOR_META.map((c) => [c.id, c]));
    const must = ['cre-mia', 'cre-sofia', 'cre-ava', 'cre-jamie', 'cre-leo', 'cre-nora', 'cre-tom'];
    for (const id of must) expect(byId[id], `missing ${id}`).toBeDefined();
    expect(byId['cre-mia'].tier).toBe('mega');
    expect(byId['cre-jamie'].tier).toBe('micro');
    expect(byId['cre-tom'].tier).toBe('micro');
  });

  it('新增 5 名库专属达人', () => {
    const byId = Object.fromEntries(CREATOR_META.map((c) => [c.id, c]));
    for (const id of ['cre-iris', 'cre-kenji', 'cre-priya', 'cre-marcus', 'cre-yuki']) {
      expect(byId[id], `missing ${id}`).toBeDefined();
    }
  });

  it('每个达人 metrics 恰好 4 项且标签固定（频道指标，非 campaign）', () => {
    const labels = ['Avg Reach', 'Impressions', 'Follower Growth', 'CPM'];
    for (const c of MOCK_CREATORS) {
      expect(c.metrics.map((m) => m.label)).toEqual(labels);
    }
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: FAIL — `expected 7 to equal 12`（人数）；`missing cre-iris` 等。

- [ ] **Step 3: 扩花名册至 12 人**

在 `apps/web/src/api/mock/creators.ts` 的 `CREATOR_META` 数组末尾（`cre-tom` 条目之后、闭合 `];` 之前）追加 5 条：

```ts
  {
    id: 'cre-iris',
    name: 'Iris Lin',
    handle: '@iris.lin',
    platform: 'Xiaohongshu',
    tier: 'macro',
    followers: '398K',
    engagement: '9.1%',
    category: 'Skincare',
    region: 'CN',
  },
  {
    id: 'cre-kenji',
    name: 'Kenji Mori',
    handle: '@kenjimori',
    platform: 'Bilibili',
    tier: 'mega',
    followers: '1.74M',
    engagement: '6.4%',
    category: 'Tech',
    region: 'CN',
  },
  {
    id: 'cre-priya',
    name: 'Priya Rao',
    handle: '@priya.rao',
    platform: 'Instagram',
    tier: 'micro',
    followers: '62K',
    engagement: '10.8%',
    category: 'Food',
    region: 'IN',
  },
  {
    id: 'cre-marcus',
    name: 'Marcus Bell',
    handle: '@marcusbell',
    platform: 'YouTube',
    tier: 'macro',
    followers: '521K',
    engagement: '5.8%',
    category: 'Fitness',
    region: 'US',
  },
  {
    id: 'cre-yuki',
    name: 'Yuki Tanaka',
    handle: '@yuki.tanaka',
    platform: 'Xiaohongshu',
    tier: 'micro',
    followers: '48K',
    engagement: '11.9%',
    category: 'Fashion',
    region: 'JP',
  },
```

- [ ] **Step 4: 切换 `MOCK_CREATORS` 到频道指标 + 删循环依赖 import + 更新注释**

把文件**顶部**的 import 段：

```ts
import { rollupCreatorTotals } from './creatorPerformance';
import type { CampaignMetric } from '@mediakit/shared';
import type { Creator } from '../creators';
```

改为（删除 `rollupCreatorTotals` 那一行）：

```ts
import type { CampaignMetric } from '@mediakit/shared';
import type { Creator } from '../creators';
```

把文件**头部块注释**：

```ts
/**
 * Creator mock data (demo).
 * Extracted from original api/creators.ts to keep data & generation logic centralized.
 * metrics are aggregated across all campaigns the creator participated in (see creatorPerformance.rollupCreatorTotals).
 */
```

改为：

```ts
/**
 * Creator mock data (demo) — the 达人库 (creator library), the master roster.
 * metrics are creator-level channel KPIs (Avg Reach / Impressions / Follower Growth / CPM),
 * deterministically derived from tier × platform — NOT from any campaign.
 * Campaign-collaboration creator data lives in creatorPerformance.ts and references these ids.
 */
```

把 `MOCK_CREATORS` 的定义与上方注释：

```ts
/** Creator mock list (with aggregated metrics injected by rollupCreatorTotals). */
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c) => ({
  ...c,
  metrics: rollupCreatorTotals(c.id),
}));
```

改为（注意：`buildChannelMetrics` 已在 Task 1 定义于本文件末尾；函数提升对 `function` 声明有效，此处引用合法）：

```ts
/** Creator mock list (the 达人库) with channel-level metrics injected by buildChannelMetrics. */
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c, i) => ({
  ...c,
  metrics: buildChannelMetrics(c, i),
}));
```

> `buildChannelMetrics` 用 `export function` 声明（hoisted），定义在文件后段也能被前面的 `MOCK_CREATORS` 引用——`const` 引用 `function` 在模块求值时已完成提升，无 TDZ 问题。

- [ ] **Step 5: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: PASS（10 条全绿）。

- [ ] **Step 6: 回归——确认 campaign 侧测试未被破坏**

Run: `pnpm --filter @mediakit/web test tests/creator-performance.test.ts tests/campaign-work-screenshots.test.ts`
Expected: PASS（campaign 表现数值未变——本任务未动 `CAMPAIGN_PROFILE` / `creatorPerformance.ts`）。

- [ ] **Step 7: 类型检查（确认删 import 后无残留引用）**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过（`rollupCreatorTotals` 在 creators.ts 已无引用；creatorPerformance.ts 仍自行定义它，暂不报错）。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/api/mock/creators.ts apps/web/tests/creator-library.test.ts
git commit -m "$(cat <<'EOF'
refactor(mock): 达人库扩至 12 人, metrics 改用频道指标, 打破循环依赖

- CREATOR_META 7→12（新增 5 名库专属达人: Xiaohongshu/Bilibili 等）
- MOCK_CREATORS.metrics 由 rollupCreatorTotals(campaign 反推) 改为 buildChannelMetrics(频道 KPI)
- 删除 creators→creatorPerformance 的 import, 消除循环依赖
- campaign 合作侧数据不变, creator-performance / work-screenshots 测试仍绿

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `creatorPerformance.ts` 派生花名册 + 导出 `campaignParticipantIds` + 删 `rollupCreatorTotals`

消除重复 `ROSTER`（改为从 `CREATOR_META` 派生，单一数据源）；导出 campaign 参与者 id 并集（供子集一致性测试）；删除解耦后无人调用的 `rollupCreatorTotals`。

**Files:**
- Modify: `apps/web/src/api/mock/creatorPerformance.ts`
- Modify: `apps/web/tests/creator-library.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/creator-library.test.ts` 顶部 import 段追加：

```ts
import { campaignParticipantIds } from '@/api/creatorPerformance';
```

在文件末尾追加：

```ts
describe('campaign 合作达人是达人库的子集', () => {
  it('每个 campaign 参与者 id 都存在于达人库', () => {
    const libIds = new Set(MOCK_CREATORS.map((c) => c.id));
    for (const id of campaignParticipantIds()) {
      expect(libIds.has(id), `campaign creator ${id} not in library`).toBe(true);
    }
  });

  it('恰好 7 名达人参与 campaign（5 名为库专属未合作）', () => {
    const participants = new Set(campaignParticipantIds());
    expect(participants.size).toBe(7);
    const libraryOnly = MOCK_CREATORS.filter((c) => !participants.has(c.id));
    expect(libraryOnly).toHaveLength(5);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: FAIL — `campaignParticipantIds is not a function`（未导出）。

- [ ] **Step 3: 改 `creatorPerformance.ts`——派生 `ROSTER`**

在 `apps/web/src/api/mock/creatorPerformance.ts`，删除现有的 tier 类型与手写花名册（约第 27–45 行）：

```ts
type Tier = 'mega' | 'macro' | 'micro';

/** Creator roster (id / name / handle / tier), aligned with creators.ts. */
interface CreatorRoster {
  id: string;
  name: string;
  handle: string;
  tier: Tier;
}

const ROSTER: Record<string, CreatorRoster> = {
  'cre-mia': { id: 'cre-mia', name: 'Mia Chen', handle: '@miaglowup', tier: 'mega' },
  'cre-sofia': { id: 'cre-sofia', name: 'Sofia Lane', handle: '@sofialane', tier: 'macro' },
  'cre-ava': { id: 'cre-ava', name: 'Ava Park', handle: '@avapark.daily', tier: 'macro' },
  'cre-jamie': { id: 'cre-jamie', name: 'Jamie Wu', handle: '@jamiewu', tier: 'micro' },
  'cre-leo': { id: 'cre-leo', name: 'Leo Sato', handle: '@leosato', tier: 'mega' },
  'cre-nora': { id: 'cre-nora', name: 'Nora Kim', handle: '@nora.kim', tier: 'macro' },
  'cre-tom': { id: 'cre-tom', name: 'Tom Reyes', handle: '@tomreyes', tier: 'micro' },
};
```

替换为（从达人库派生，单一数据源；`Tier` 改为从 creators.ts 复用以消除重复定义）：

```ts
import { CREATOR_META, type Tier } from './creators';

/** Creator roster, derived from the 达人库 (single source of truth in creators.ts). */
interface CreatorRoster {
  id: string;
  name: string;
  handle: string;
  tier: Tier;
}

const ROSTER: Record<string, CreatorRoster> = {};
for (const c of CREATOR_META) {
  ROSTER[c.id] = { id: c.id, name: c.name, handle: c.handle, tier: c.tier as Tier };
}
```

> `buildPerformance` 内仍用 `ROSTER[creatorId]` 查询，逻辑不变 → campaign 表现数值不变。

- [ ] **Step 4: 导出 `campaignParticipantIds`**

在 `creatorPerformance.ts` 中、`rollupCampaignMetrics` 附近（或文件导出函数区）追加：

```ts
/**
 * 所有参与过至少一个 campaign 的达人 id 并集（campaign 合作达人对达人库的子集视图）。
 * 供达人库一致性测试与「库内有、未合作」判定使用。
 */
export function campaignParticipantIds(): string[] {
  const ids = new Set<string>();
  for (const profile of Object.values(CAMPAIGN_PROFILE)) {
    for (const id of profile.creators) ids.add(id);
  }
  return [...ids];
}
```

- [ ] **Step 5: 删除 `rollupCreatorTotals`**

删除 `creatorPerformance.ts` 中整个 `rollupCreatorTotals` 函数及其上方文档注释（原约第 615–642 行）：

```ts
/**
 * Creator-level aggregate: across all campaigns the creator participated in, sum totals → key metrics (for creator list).
 * compare left empty (cross-campaign aggregate has no single-period comparison semantics).
 */
export function rollupCreatorTotals(creatorId: string): CampaignMetric[] {
  const picked: RawCreatorTotals[] = [];
  for (const raws of Object.values(MOCK_RAW)) {
    const r = raws.find((x) => x.perf.creatorId === creatorId);
    if (r) picked.push(r.totals);
  }
  const sum = picked.reduce(
    (a, t) => ({
      gmv: a.gmv + t.gmv,
      orders: a.orders + t.orders,
      commission: a.commission + t.commission,
      clicks: a.clicks + t.clicks,
      cpsSpend: a.cpsSpend + t.cpsSpend,
    }),
    { gmv: 0, orders: 0, commission: 0, clicks: 0, cpsSpend: 0 },
  );
  const roas = sum.cpsSpend ? sum.gmv / sum.cpsSpend : 0;
  return [
    { label: 'GMV', value: money(sum.gmv), compare: '' },
    { label: 'ROAS', value: roas.toFixed(2), compare: '' },
    { label: 'Conversions', value: fmt(sum.orders), compare: '' },
    { label: 'Commission', value: money(sum.commission), compare: '' },
  ];
}
```

> 删除后检查：`CampaignMetric` 类型是否仍被本文件使用？是——`rollupCampaignMetrics` 返回 `CampaignMetric[]`，故顶部 `import type { … CampaignMetric … }` 保留。

- [ ] **Step 6: 运行达人库测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/creator-library.test.ts`
Expected: PASS（12 条全绿，含两条子集测试）。

- [ ] **Step 7: 回归——campaign 侧测试**

Run: `pnpm --filter @mediakit/web test tests/creator-performance.test.ts tests/campaign-work-screenshots.test.ts`
Expected: PASS（`ROSTER` 数据等价、`buildPerformance` 未变、`campaignWorkScreenshots` 未变）。

- [ ] **Step 8: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/api/mock/creatorPerformance.ts apps/web/tests/creator-library.test.ts
git commit -m "$(cat <<'EOF'
refactor(mock): creatorPerformance 花名册改派生自达人库 + 删 rollupCreatorTotals

- ROSTER 不再手写, 从 CREATOR_META 派生(单一数据源, 消除重复)
- 导出 campaignParticipantIds(campaign 合作达人对达人库的子集视图)
- 删除解耦后无人调用的 rollupCreatorTotals
- campaign 表现数值不变, 现有测试仍绿

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `MockData.tsx` 表头/标题跟进 + 测试断言跟进

达人库展示页：4 列由 GMV/ROAS/转化/佣金 → 频道指标；section 标题「达人数据」→「达人库」；同步测试断言。

**Files:**
- Modify: `apps/web/src/routes/MockData.tsx`
- Modify: `apps/web/tests/mock-data.test.tsx`

- [ ] **Step 1: 更新测试断言（先红）**

在 `apps/web/tests/mock-data.test.tsx` 中，把：

```ts
    await waitFor(() => expect(screen.getByText('达人数据 · 1')).toBeInTheDocument());
```

改为：

```ts
    await waitFor(() => expect(screen.getByText('达人库 · 1')).toBeInTheDocument());
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/mock-data.test.tsx`
Expected: FAIL — `Unable to find element with text: 达人库 · 1`（标题仍是「达人数据」）。

- [ ] **Step 3: 改 `MockData.tsx` 达人区**

在 `apps/web/src/routes/MockData.tsx`，把达人数据 section 整段：

```tsx
      {/* 达人数据 */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          达人数据 · {creators.length}
        </h2>
        <DataTable
          loading={loadingCreators}
          headers={['达人', 'Handle', '平台', '层级', '粉丝', '互动率', '类目', '地区', 'GMV', 'ROAS', '转化', '佣金']}
          rows={creators.map((c) => [
            c.name,
            c.handle,
            c.platform,
            c.tier,
            c.followers,
            c.engagement,
            c.category,
            c.region,
            metric(c, 'GMV'),
            metric(c, 'ROAS'),
            metric(c, '转化'),
            metric(c, '佣金'),
          ])}
        />
      </section>
```

改为：

```tsx
      {/* 达人库 */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          达人库 · {creators.length}
        </h2>
        <DataTable
          loading={loadingCreators}
          headers={['达人', 'Handle', '平台', '层级', '粉丝', '互动率', '类目', '地区', 'Avg Reach', 'Impressions', 'Follower Growth', 'CPM']}
          rows={creators.map((c) => [
            c.name,
            c.handle,
            c.platform,
            c.tier,
            c.followers,
            c.engagement,
            c.category,
            c.region,
            metric(c, 'Avg Reach'),
            metric(c, 'Impressions'),
            metric(c, 'Follower Growth'),
            metric(c, 'CPM'),
          ])}
        />
      </section>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/mock-data.test.tsx`
Expected: PASS（3 条全绿；该测试 mock 了 `listCreators`，与真实 12 人数据解耦，仅校验标题/名称/粉丝渲染）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/routes/MockData.tsx apps/web/tests/mock-data.test.tsx
git commit -m "$(cat <<'EOF'
feat(mock-ui): 达人库展示页表头改频道指标 + 标题改「达人库」

MockData 达人区 4 列 GMV/ROAS/转化/佣金 → Avg Reach/Impressions/Follower Growth/CPM;
section 标题「达人数据」→「达人库」, 与 campaign 合作执行效果区区分。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 全量验证

**Files:** 无（仅验证）。

- [ ] **Step 1: 全量类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过，0 error。

- [ ] **Step 2: 全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: 全绿。重点确认：
- `tests/creator-library.test.ts`（新建，12 条）
- `tests/creator-performance.test.ts`（未改，仍绿）
- `tests/campaign-work-screenshots.test.ts`（未改，仍绿）
- `tests/mock-data.test.tsx`（断言已跟进）

- [ ] **Step 3: 手动核对（可选，截图回归）**

Run: `pnpm --filter @mediakit/web dev`，访问 mock 数据页：
- 「达人库」区：12 行，4 个频道指标列有值（非 `—`）。
- 「达人执行效果」区：选任一 campaign，帖子数/CPS/投放位汇总数值与改动前一致。

- [ ] **Step 4: 收尾**

无额外提交（本任务仅验证）。若前序任务均已提交，工作树应只剩非本任务的并发改动（归一化等，已在前置条件中处理）。

---

## Self-Review（写计划后自检）

**1. Spec coverage：**
- 子集模型 + 达人库 master → Task 2（扩库）+ Task 3（campaign 派生自库 + 子集测试）。✓
- 频道指标解耦 campaign → Task 1（生成器）+ Task 2（切换 MOCK_CREATORS）。✓
- 消除重复 ROSTER + 循环依赖 → Task 2（删 import）+ Task 3（ROSTER 派生）。✓
- 库扩至 12，5 名库专属 → Task 2。✓
- MockData 表头/标题 → Task 4。✓
- 不改共享类型/持久化 schema/6 个 campaign profile → 各任务均未触碰，typecheck 把关。✓
- 新增一致性测试 → Task 1/2/3 的 `creator-library.test.ts`。✓

**2. Placeholder scan：** 无 TBD/TODO；每个代码步骤均给出完整代码与精确命令。5 名新达人为具名 persona（非占位）。✓

**3. Type consistency：** `buildChannelMetrics(meta, index)` 签名在 Task 1 定义、Task 2 调用一致；`Tier` 在 Task 1 导出、Task 3 从 creators.ts 复用（删除 creatorPerformance 本地 `type Tier`）；`campaignParticipantIds()` 在 Task 3 导出、Task 3 测试调用一致；指标 4 标签在 Task 1/2/4 全程一致。✓

---

## 实现期修正（落地与计划的偏差）

实现中发现计划两处不准确，已在实现期修正（合并到 main，见 commit `ad25b4e`）：

1. **Task 2 — TDZ 修正（计划的 hoisting 注释错误）**：计划称 `buildChannelMetrics` 是 hoisted function，故 `MOCK_CREATORS` 可留在原位（`CREATOR_META` 之后）引用它。实际错误：`MOCK_CREATORS` 在模块加载时**立即** `CREATOR_META.map(...)` 求值，调用 `buildChannelMetrics`，而后者读取的 `const TIER_CHANNEL_BASE`/`CHANNEL_JITTER`/`VIDEO_PLATFORMS` 声明在文件**后段**（const 不提升 → TDZ）→ `ReferenceError: Cannot access 'TIER_CHANNEL_BASE' before initialization`。修正：将 `MOCK_CREATORS` 移到文件末尾（`buildChannelMetrics` 及其 const 依赖之后）。功能等价，导出不变。

2. **Task 3 — 漏算 `tests/rollup.test.ts`**：计划称「grep 确认仅 creators.ts 用过 `rollupCreatorTotals`」——该 grep 只扫了 `apps/web/src`，漏掉 `apps/web/tests/rollup.test.ts`（含 `describe('rollupCreatorTotals')` 块）。删除函数后 typecheck 报 `TS2305: Module has no exported member 'rollupCreatorTotals'`。修正：一并删除该测试块（保留 `rollupCampaignMetrics` 测试，仍绿）。

3. **合并期对齐（main 并发演进）**：实现期间 `main` 新增 8 个提交（全量英文化 + `$` 货币 via `formatMoney` + 多平台合作形式 + theme v2）。merge 时 4 个重叠文件（`creatorPerformance.ts`/`MockData.tsx`/`mock-data.test.tsx`/`rollup.test.ts`）逐个解决冲突；本分支 CPM 由 `¥` 改为 `formatMoney($)` 对齐 main 货币约定（并更新 `creator-library.test.ts` 断言 ¥→$）；达人区标题采纳 main 的英文 "Creators"（英文化优先于本分支的「达人库」改名，区分度由 "Creators" vs "Creator Performance" 两 section 保证）。

> 教训：删除某符号前 grep 其引用时，**必须含 `tests/` 目录**，不能只扫 `src/`。
