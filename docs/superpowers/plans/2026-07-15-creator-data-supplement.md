# 补齐达人库 Creator 数据(audience + works + stats)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给达人库 `Creator` 记录补 `audience?`/`works?`/`stats?` 三个可选字段(对齐组件所需形状),服务端 Zod 镜像,mock 种子确定性生成——纯数据层,浮窗/importer 不动。

**Architecture:** shared 类型扩展(AudienceSlice/CreatorAudience/CreatorWork + Creator 加 3 字段 + ReportCreator.audience 改用 CreatorAudience)→ 服务端 `creatorRecordDataSchema` 镜像 → mock `MOCK_CREATORS` 注入确定性生成的 audience/works/stats。无 UI、无 DB 迁移(opaque JSON 内)。

**Tech Stack:** TypeScript(Zod @ server,纯类型 @ shared);确定性 mock 生成(无 RNG,沿用 `buildChannelMetrics` 的 tier×jitter 模式)。vitest/jsdom 测试。

**基线与隔离:** worktree `worktree-data-management`(`node_modules` + prisma client 就绪,无需 install/generate)。每 task `git add <files> && git commit -m "..."`(worktree 干净,普通原子提交)。web 测试/类型检查用 `pnpm --filter @mediakit/web exec ...`(scoped,非根 `pnpm test`)。

**⚠️ spec 偏差(已在 spec §6 caveat 预见):** spec 倾向 works 种子复用 `allCreatorWorks()`;但 explore 确认 `mock/creatorPerformance.ts` 已 `import { CREATOR_META } from './creators'`,反向 import 会形成**循环依赖**,而 `MOCK_CREATORS` 在模块顶层 eagerly 求值 → 会 break。故 `buildWorks` 改为**内联确定性生成器**(自包含于 creators.ts,不 import creatorPerformance)。works 数据不再与编辑器 allCreatorWorks 字节相同,但形状一致、数据合理(满足"数据层"目标)。

**spec:** `docs/superpowers/specs/2026-07-15-creator-data-supplement-design.md`。

---

## File Structure

- `packages/shared/src/types/campaign.ts` — 加 `AudienceSlice`/`CreatorAudience`/`CreatorWork`;`Creator` 加 `audience?`/`works?`/`stats?`;`ReportCreator.audience` 内联 → `CreatorAudience`(DRY,类型等价)。
- `apps/server/src/modules/data/data.schema.ts` — `creatorRecordDataSchema` 加 3 字段镜像(+ `audienceSliceSchema`/`creatorAudienceSchema`/`creatorWorkSchema`/`creatorStatItemSchema` 子 schema)。
- `apps/server/src/modules/data/data.schema.test.ts` — 新字段 Zod 用例。
- `apps/web/src/api/mock/creators.ts` — 加 `buildAudience`/`buildWorks`(内联)/`buildStats`;`MOCK_CREATORS` 注入。
- `apps/web/tests/creators-seed.test.ts`(新)— seed 形状用例。

---

## Task 1: Shared 类型扩展

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`

> 类型层改动;无运行时行为,以 typecheck 为准(下游 Task 2 Zod / Task 3 seed 会消费这些类型)。

- [ ] **Step 1: 加新类型 + 扩展 Creator + ReportCreator.audience 改引用**

在 `packages/shared/src/types/campaign.ts` 的 `CampaignMetric` 之后(或 `CreatorStatItem` 附近)加:

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

在 `Creator` interface 末尾(`metrics: CampaignMetric[];` 之后)加 3 个可选字段:

```ts
  /** 受众画像(性别/年龄/城市)。 */
  audience?: CreatorAudience;
  /** 作品列表 + 作品数据。 */
  works?: CreatorWork[];
  /** 频道维度 stat 项(creator-stats-strip 用)。 */
  stats?: CreatorStatItem[];
```

把 `ReportCreator` 的内联 `audience` 字段(当前 `audience?: { genderSplit?: { label: string; value: number; color?: string }[]; ageRange?: ...; topCities?: ... }`)替换为引用提取的类型:

```ts
  /** 受众画像(性别/年龄/城市分布,用于 fan-gender / fan-age / fan-city 组件一键填充)。 */
  audience?: CreatorAudience;
```

(形状等价,零行为变化;消费方读 `cr.audience?.genderSplit` 等不变。)

- [ ] **Step 2: typecheck(shared + web,确认 ReportCreator.audience 改动无回归)**

```bash
pnpm --filter @mediakit/shared run typecheck && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected: 均干净(shared 编译;web 的 ReportCreator.audience 消费方——pageBinding/importers——类型等价,不报错)。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/campaign.ts
git commit -m "feat(shared): Creator gains audience/works/stats; extract CreatorAudience"
```

---

## Task 2: 服务端 Zod 镜像

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`
- Test: `apps/server/src/modules/data/data.schema.test.ts`

- [ ] **Step 1: 写失败测试(在 data.schema.test.ts 的 creator describe 内补用例)**

在 `apps/server/src/modules/data/data.schema.test.ts` 的 `describe('data.schema · creatorRecordDataSchema(镜像 Creator)', ...)` 块内(已有「合法 creator」「缺 metrics」「缺 tier」用例)追加:

```ts
  const validCreatorWithRich = {
    ...validCreator,
    audience: {
      genderSplit: [{ label: 'Female', value: 53 }, { label: 'Male', value: 47 }],
      ageRange: [{ label: '25-34', value: 40 }],
      topCities: [{ label: '上海', value: 32, color: '#6366f1' }],
    },
    works: [
      { id: 'w1', title: 'Routine', cover: 'https://x/c.png', platform: 'TikTok', publishedAt: '2026-01-01', impressions: '1.2M', likes: '96K', comments: '1.2K', shares: '3K', engagementRate: '8.0%' },
    ],
    stats: [
      { key: 'followers', label: 'Followers', value: '1.28M', color: '#6366f1' },
      { label: 'Engagement', value: '8.7%', color: '#10b981' },
    ],
  };

  it('合法 creator 含 audience/works/stats → 通过', () => {
    expect(creatorRecordDataSchema.parse(validCreatorWithRich)).toEqual(validCreatorWithRich);
  });

  it('audience.genderSplit 项缺 label → 报错', () => {
    const bad = { ...validCreator, audience: { genderSplit: [{ value: 50 }] } };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('works 项缺必填 id → 报错', () => {
    const bad = { ...validCreator, works: [{ title: 'no id' }] };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('stats 项缺必填 color → 报错', () => {
    const bad = { ...validCreator, stats: [{ label: 'Followers', value: '1M' }] };
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });

  it('audience/works/stats 全缺(只基本字段)→ 仍通过(全可选)', () => {
    expect(creatorRecordDataSchema.parse(validCreator)).toEqual(validCreator);
  });
```

> 注:`validCreator` 是该 test 文件已有的 fixture(基本字段)。若其变量名不同,用文件里既有的那个。

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: FAIL。当前 `creatorRecordDataSchema` 不含 audience/works/stats,z.object 默认**剥离**未知键——`parse(validCreatorWithRich)` 返回值不含这三字段(`.toEqual` 失败);畸形用例(缺 label/id/color)也不报错(字段被忽略而非校验)。需本 task Step 3 的 sub-schemas 才能正确校验内部结构。

- [ ] **Step 3: 实现 sub-schemas + 加字段**

在 `apps/server/src/modules/data/data.schema.ts` 的 `creatorRecordDataSchema` 之前,加 sub-schemas(镜像 shared):

```ts
/** AudienceSlice / CreatorAudience:镜像 shared。 */
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

/** CreatorWork:镜像 shared。 */
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

/** CreatorStatItem:镜像 shared。 */
const creatorStatItemSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  value: z.string(),
  color: z.string(),
  selected: z.boolean().optional(),
});
```

在 `creatorRecordDataSchema` 的 `metrics: z.array(campaignMetricSchema),` 之后加 3 个可选字段:

```ts
  audience: creatorAudienceSchema.optional(),
  works: z.array(creatorWorkSchema).optional(),
  stats: z.array(creatorStatItemSchema).optional(),
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: PASS(含新用例;现有用例不回归)。

- [ ] **Step 5: typecheck + 全量 server 测试**

```bash
pnpm --filter @mediakit/server typecheck && pnpm --filter @mediakit/server test
```
Expected: typecheck 干净;全量 server 绿。

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(server): creatorRecordDataSchema mirrors audience/works/stats"
```

---

## Task 3: Mock 种子(buildAudience/buildWorks/buildStats + 注入 MOCK_CREATORS)

**Files:**
- Modify: `apps/web/src/api/mock/creators.ts`
- Test: `apps/web/tests/creators-seed.test.ts`(新)

> `buildWorks` 内联自包含(不 import creatorPerformance,避循环依赖——见 plan 头部偏差说明)。

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/creators-seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MOCK_CREATORS, buildAudience, buildWorks, buildStats } from '@/api/mock/creators';

const isSlice = (x: unknown) =>
  !!x && typeof x === 'object' && typeof (x as { label?: unknown }).label === 'string' && typeof (x as { value?: unknown }).value === 'number';

describe('MOCK_CREATORS seed — audience/works/stats', () => {
  it('每条 creator 含 audience(genderSplit/ageRange/topCities 均为 slice 数组)', () => {
    for (const c of MOCK_CREATORS) {
      const a = c.audience;
      expect(a, `${c.id} audience`).toBeTruthy();
      expect(Array.isArray(a!.genderSplit) && a!.genderSplit!.every(isSlice)).toBe(true);
      expect(Array.isArray(a!.ageRange) && a!.ageRange!.every(isSlice)).toBe(true);
      expect(Array.isArray(a!.topCities) && a!.topCities!.every(isSlice)).toBe(true);
    }
  });

  it('每条 creator 含 works(数组,项有 id+title)', () => {
    for (const c of MOCK_CREATORS) {
      expect(Array.isArray(c.works), `${c.id} works`).toBe(true);
      for (const w of c.works!) {
        expect(typeof w.id).toBe('string');
        expect(typeof w.title).toBe('string');
      }
    }
  });

  it('每条 creator 含 stats(数组,项有 label+value+color)', () => {
    for (const c of MOCK_CREATORS) {
      expect(Array.isArray(c.stats), `${c.id} stats`).toBe(true);
      for (const s of c.stats!) {
        expect(typeof s.label).toBe('string');
        expect(typeof s.value).toBe('string');
        expect(typeof s.color).toBe('string');
      }
    }
  });

  it('buildAudience/buildWorks/buildStats 对单条 meta 产出合法形状', () => {
    const meta = { id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US' };
    const a = buildAudience(meta, 0);
    expect(a.genderSplit!.length).toBeGreaterThan(0);
    const w = buildWorks(meta, 0);
    expect(w.length).toBeGreaterThan(0);
    const s = buildStats(meta, 0);
    expect(s.length).toBe(4);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
pnpm --filter @mediakit/web exec vitest run tests/creators-seed.test.ts
```
Expected: FAIL(`buildAudience`/`buildWorks`/`buildStats` 未导出;`MOCK_CREATORS` 条目无 audience/works/stats)。

- [ ] **Step 3: 实现 generators + 注入 MOCK_CREATORS**

在 `apps/web/src/api/mock/creators.ts` 的 `buildChannelMetrics` 之后、`MOCK_CREATORS` 之前,加(自包含,无新 import;复用文件内 `TIER_CHANNEL_BASE`/`CHANNEL_JITTER`/`compact`/`Tier`/`Creator`):

```ts
/* ------------------------------ Audience / Works / Stats ------------------------------ */

/** stat 配色(内联,避免 api→editor 跨层依赖)。 */
const STAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

/** 按地区取 top 城市池。 */
const CITY_POOL: Record<string, string[]> = {
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston'],
  'US / UK': ['New York', 'Los Angeles', 'Chicago', 'Houston'],
  CN: ['上海', '北京', '广州', '深圳'],
  JP: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu'],
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'],
};
const DEFAULT_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston'];

/** 生成达人受众画像(确定性:genderSplit/ageRange/topCities)。 */
export function buildAudience(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): NonNullable<Creator['audience']> {
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];
  const female = Math.round(52 * jit);
  const ageBase = [
    { label: '18-24', base: 22 },
    { label: '25-34', base: 40 },
    { label: '35-44', base: 25 },
    { label: '45+', base: 13 },
  ];
  const ageRaw = ageBase.map((a) => ({ label: a.label, v: a.base * jit }));
  const ageSum = ageRaw.reduce((s, x) => s + x.v, 0) || 1;
  const cities = CITY_POOL[meta.region] ?? DEFAULT_CITIES;
  const cityBase = [32, 27, 23, 18];
  return {
    genderSplit: [
      { label: 'Female', value: female },
      { label: 'Male', value: 100 - female },
    ],
    ageRange: ageRaw.map((a) => ({ label: a.label, value: Math.round((a.v / ageSum) * 100) })),
    topCities: cities.map((label, i) => ({ label, value: Math.round(cityBase[i] * jit) })),
  };
}

/** 生成达人作品列表(内联确定性;不依赖 creatorPerformance,避免循环依赖)。 */
const WORK_TITLE_POOL: Record<string, string[]> = {
  Beauty: ['Summer Glow Routine', 'Sensitive Skin Review', 'Get Ready With Me'],
  Skincare: ['AM Skincare Routine', 'Vitamin C Review', 'Skin Barrier Tips'],
  Lifestyle: ['Day in My Life', 'Apartment Tour', 'Weekend Vlog'],
  Tech: ['Unboxing & First Look', 'Hands-on Review', 'Setup Tour'],
  Fashion: ['Outfit Ideas', 'Seasonal Lookbook', 'Styling Tips'],
  Fitness: ['Full Body Workout', 'Meal Prep', 'Form Check'],
  Food: ['Easy Recipe', 'Restaurant Review', 'Grocery Haul'],
};
const DEFAULT_TITLES = ['Brand Collab', 'Product Review', 'Daily Vlog'];

export function buildWorks(meta: Omit<Creator, 'metrics'>, index: number): NonNullable<Creator['works']> {
  const pool = WORK_TITLE_POOL[meta.category] ?? DEFAULT_TITLES;
  return pool.map((title, i) => {
    const jit = CHANNEL_JITTER[(index + i) % CHANNEL_JITTER.length];
    const base = (TIER_CHANNEL_BASE[meta.tier as Tier] ?? TIER_CHANNEL_BASE.micro).impressions / 10;
    return {
      id: `${meta.id}-work-${i + 1}`,
      title,
      cover: `https://picsum.photos/seed/${encodeURIComponent(meta.name + '-' + i)}/400/400`,
      platform: meta.platform,
      publishedAt: `2026-0${(i % 6) + 1}-${String(((index + i) % 28) + 1).padStart(2, '0')}`,
      impressions: compact(base * jit),
      likes: compact(base * jit * 0.08),
      comments: compact(base * jit * 0.005),
      shares: compact(base * jit * 0.012),
      engagementRate: `${(8 * jit).toFixed(1)}%`,
    };
  });
}

/** 生成频道 stat 项(Followers/Engagement/Avg Reach/Impressions)。 */
export function buildStats(meta: Omit<Creator, 'metrics'>, index: number): NonNullable<Creator['stats']> {
  const m = buildChannelMetrics(meta, index); // [Avg Reach, Impressions, Follower Growth, CPM]
  return [
    { key: 'followers', label: 'Followers', value: meta.followers, color: STAT_COLORS[0] },
    { key: 'engagement', label: 'Engagement', value: meta.engagement, color: STAT_COLORS[1] },
    { key: 'reach', label: 'Avg Reach', value: m[0].value, color: STAT_COLORS[2] },
    { key: 'impressions', label: 'Impressions', value: m[1].value, color: STAT_COLORS[3] },
  ];
}
```

把 `MOCK_CREATORS` 改为注入 3 字段:

```ts
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c, i) => ({
  ...c,
  avatar: creatorAvatarUrl(c.name),
  metrics: buildChannelMetrics(c, i),
  audience: buildAudience(c, i),
  works: buildWorks(c, i),
  stats: buildStats(c, i),
}));
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
pnpm --filter @mediakit/web exec vitest run tests/creators-seed.test.ts
```
Expected: PASS。

- [ ] **Step 5: typecheck + 全量 web 测试**

```bash
pnpm --filter @mediakit/web exec tsc --noEmit && pnpm --filter @mediakit/web test
```
Expected: typecheck 干净;全量 web 绿(MOCK_CREATORS 消费方——seed 导入示例数据、data-management 列表——不受影响,新字段可选)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/mock/creators.ts apps/web/tests/creators-seed.test.ts
git commit -m "feat(web): seed creators with audience/works/stats (deterministic)"
```

---

## Self-Review

**1. Spec 覆盖:**
- §4 AudienceSlice/CreatorAudience/CreatorWork + Creator 3 字段 + ReportCreator.audience→CreatorAudience → Task 1 ✓
- §5 服务端 Zod 镜像(audience/works/stats sub-schemas)→ Task 2 ✓
- §6 种子 buildAudience/buildWorks/buildStats + MOCK_CREATORS 注入 → Task 3 ✓(buildWorks 内联而非 allCreatorWorks——spec §6 caveat 已预见,见 plan 头偏差说明)
- §3 不在范围(浮窗/importer 不动)→ 无 task,确认未碰 ✓
- §7 CSV 不带嵌套(JSON 带)→ 无需 task(CREATOR_FIELDS/dataImport 不变,可选字段自然处理)✓
- §8 测试(Zod 新字段 + seed 形状)→ Task 2 + Task 3 ✓
- §10 兼容性(全可选、无迁移、ReportCreator 等价替换)→ Task 1 typecheck 守护 ✓

**2. Placeholder 扫描:** 无 TBD;每步含完整代码或确切命令。Task 3 的 `formLabel` helper 标注了「删掉」(实现时清理)。✓

**3. 类型一致性:**
- `AudienceSlice`/`CreatorAudience`/`CreatorWork` 在 Task 1 定义;Task 2 Zod schema 字段名(label/value/color、id/title/cover…、key/label/value/color)与 shared 一一对应 ✓
- `CreatorStatItem`(shared 已有:`key?,label,value,color,selected?`)在 Task 1 复用、Task 2 Zod `creatorStatItemSchema` 镜像 ✓
- `buildAudience`/`buildWorks`/`buildStats` 返回类型用 `NonNullable<Creator['audience']>` 等,与 Task 1 字段类型一致 ✓
- `MOCK_CREATORS: Creator[]` 注入后类型仍为 `Creator[]`(新字段可选)✓

**4. 范围:** 单一聚焦数据层,3 个顺序 task(Task 2/3 依赖 Task 1 类型)。每 task 独立可测、可提交。✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-creator-data-supplement.md`. Two execution options:

**1. Subagent-Driven(推荐)** — 每 task 派 fresh subagent,task 间两阶段 review。
**2. Inline Execution** — 本 session 内 executing-plans 批量执行 + checkpoint。

选哪种?
