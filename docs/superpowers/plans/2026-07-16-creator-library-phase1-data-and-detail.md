# 达人库丰富信息 — Phase 1(数据层 + 详情可见)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 `Creator`/`CreatorWork` 的画像与作品字段(简介/标签/联系方式/报价/内容形式/带货归因等),打通 Zod、结构化表 migration、mock 种子、CSV/JSON 导入,并在达人详情浮窗全量展示富数据,让"存了看得见"。

**Architecture:** shared 类型为单一真源 → 服务端 Zod 镜像 → 达人库页面走 `DataRecord`(opaque JSON)主路径,新字段自动透传;结构化 `Creator` 表(MySQL)加 `profile`/`stats` Json 列保持 `campaignsApi.dtoToCreator` 一致性;mock 确定性生成器注入种子;详情浮窗 `CreatorDetailDrawer` 重构为分区只读展示。**Phase 1 不含 PPT 消费映射**(转换点 `DataConfigOverlay.tsx` 内联,且 `ReportCreator` 缺 bio/tags 字段,留后续 plan)。

**Tech Stack:** TypeScript / Zod / Prisma(MySQL)/ React + Tailwind / Vitest(jsdom)

## 约定(测试与类型检查命令)

- **web 单测**(记忆 [[web-vitest-run-from-root]]):`apps/web/node_modules/.bin/vitest run <file>`
- **server 单测**:`apps/server/node_modules/.bin/vitest run <file>`
- **类型检查**:`pnpm -r typecheck`(若失效用各 app 的 `tsc --noEmit`)
- **提交**(记忆 [[ide-resets-git-index]]):`git add` + `git commit` 必须在**同一 bash 块**(原子),避免 IDE 清空 index;**只 add 本任务相关文件**,绝不 add 整个脏文件
- 测试断言遵守 [[web-chart-test-convention]]:jsdom 下只断言 shell 文本
- 不动 `ComponentType` 持久化 schema([[component-type-is-persisted-schema]])

## File Structure

| 文件 | 职责 | 本 plan 动作 |
|---|---|---|
| `packages/shared/src/types/campaign.ts` | `Creator`/`CreatorWork` 真源类型 | 加画像 4 字段 + 作品 6 字段 |
| `apps/server/src/modules/data/data.schema.ts` | Zod 校验(persisted) | 镜像新字段 |
| `apps/server/prisma/schema.prisma` | 结构化 `Creator` 表 | 加 `profile`/`stats` Json 列 |
| `apps/server/prisma/migrations/20260716000000_creator_profile_stats/migration.sql` | MySQL 迁移 | 新建 |
| `apps/web/src/api/campaignsApi.ts` | `CreatorDTO`/`dtoToCreator` | 补 `stats`/`profile` + 修 audience/works 未映射 |
| `apps/web/src/api/mock/creators.ts` | mock 种子 + 确定性生成器 | 加 4 画像生成器 + 扩展 `buildWorks` |
| `apps/web/src/editor/dataImport.ts` | CSV/JSON 导入字段 | `CREATOR_FIELDS` 加 `bio`/`tags` + 模板 |
| `apps/web/src/editor/components/CreatorDetailDrawer.tsx` | 详情浮窗 | 重构分区展示 |
| **测试**:`data.schema.test.ts` / `apps/web/tests/creators-seed.test.ts` / `apps/web/tests/dataImport.test.ts` / `apps/web/tests/CreatorDetailDrawer.test.tsx` | TDD | 各自追加用例 |

---

## Task 1: Shared 类型 — 画像 + 作品字段

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`(Creator 接口 L59-86;CreatorWork 接口 L138-151)

- [ ] **Step 1: 在 `Creator` 接口前新增画像子类型**

在 `campaign.ts` 的 `Creator` 接口(L58 注释 `/** 上游达人... */` 之前)插入:

```ts
/** 达人商务联系方式。 */
export interface CreatorContact {
  mcn?: string;           // MCN/机构
  agency?: string;        // 经纪公司
  email?: string;         // 商务邮箱
  phone?: string;         // 商务电话
  contactPerson?: string; // 商务联系人
}

/** 达人合作报价(多档 + 货币 + 说明)。 */
export interface CreatorRate {
  currency?: string; // CNY / USD …
  post?: string;     // 图文报价
  video?: string;    // 短视频报价
  live?: string;     // 直播报价
  note?: string;     // 报价说明
}
```

- [ ] **Step 2: `Creator` 接口加 4 字段**

在 `Creator` 接口的 `stats?: CreatorStatItem[];`(L85)之后、闭合 `}`(L86)之前加:

```ts
  /** 达人简介 / Bio。 */
  bio?: string;
  /** 内容标签(风格/品类)。 */
  tags?: string[];
  /** 商务联系方式。 */
  contact?: CreatorContact;
  /** 合作报价。 */
  rate?: CreatorRate;
```

- [ ] **Step 3: 新增 `CreatorWorkAttribution` 子类型**

在 `CreatorWork` 接口(L137 注释 `/** 达人作品... */` 之前)插入:

```ts
/** 作品带货效果归因。 */
export interface CreatorWorkAttribution {
  clicks?: string;   // 点击
  orders?: string;   // 下单
  gmv?: string;      // 成交额
  ctr?: string;      // 点击率 %
  cvr?: string;      // 转化率 %
}
```

- [ ] **Step 4: `CreatorWork` 接口加 6 字段**

在 `CreatorWork` 的 `engagementRate?: string;`(L150)之后、闭合 `}`(L151)之前加:

```ts
  /** 内容形式:image|video|live|long|series。 */
  contentType?: string;
  /** 话题标签 / 关键词。 */
  hashtags?: string[];
  /** 带货 / 挂车链接。 */
  productLink?: string;
  /** 带货效果归因。 */
  attribution?: CreatorWorkAttribution;
  /** 视频 / 内容时长(如 "01:23")。 */
  duration?: string;
  /** 是否置顶 / 精选。 */
  featured?: boolean;
```

- [ ] **Step 5: 类型检查**

Run: `pnpm -r typecheck`
Expected: PASS(纯加法,全可选;无消费方破坏)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/campaign.ts && git commit -m "feat(shared): Creator/CreatorWork 扩展画像与作品字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 服务端 Zod — 镜像新字段

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`(`creatorWorkSchema` L80-93;`creatorRecordDataSchema` L105-120)
- Test: `apps/server/src/modules/data/data.schema.test.ts`

- [ ] **Step 1: 写失败测试 — 画像 + 作品新字段 round-trip**

在 `data.schema.test.ts` 末尾追加:

```ts
import { creatorRecordDataSchema } from './data.schema';

describe('creatorRecordDataSchema rich fields', () => {
  const baseCreator = {
    id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'macro',
    followers: '100K', engagement: '7%', category: 'Beauty', region: 'US',
    metrics: [{ label: 'Avg Reach', value: '720K', compare: '' }],
  };

  it('accepts bio/tags/contact/rate', () => {
    const parsed = creatorRecordDataSchema.parse({
      ...baseCreator,
      bio: '简介文本',
      tags: ['美妆', '种草'],
      contact: { mcn: 'MCN-A', email: 'biz@x.com', phone: '+1-555', contactPerson: 'Ann' },
      rate: { currency: 'USD', post: '$1,000', video: '$3,000', live: '$8,000', note: '打包可议' },
    });
    expect(parsed.bio).toBe('简介文本');
    expect(parsed.tags).toEqual(['美妆', '种草']);
    expect(parsed.contact?.mcn).toBe('MCN-A');
    expect(parsed.rate?.video).toBe('$3,000');
  });

  it('accepts works with contentType/hashtags/productLink/attribution/duration/featured', () => {
    const parsed = creatorRecordDataSchema.parse({
      ...baseCreator,
      works: [{
        id: 'w1', title: 'T',
        contentType: 'video',
        hashtags: ['#glow'],
        productLink: 'https://shop.example.com/p',
        attribution: { clicks: '1.2K', orders: '34', gmv: '$2,100', ctr: '3.4%', cvr: '2.8%' },
        duration: '01:12', featured: true,
      }],
    });
    expect(parsed.works?.[0].contentType).toBe('video');
    expect(parsed.works?.[0].attribution?.gmv).toBe('$2,100');
    expect(parsed.works?.[0].featured).toBe(true);
  });

  it('rejects malformed contact (email too long)', () => {
    expect(() => creatorRecordDataSchema.parse({
      ...baseCreator,
      contact: { email: 'x'.repeat(400) },
    })).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/server/node_modules/.bin/vitest run src/modules/data/data.schema.test.ts`
Expected: FAIL(`bio`/`tags`/`contact`/`rate` 与作品新字段尚未在 schema 中 → parse 结果无这些键,断言失败)

- [ ] **Step 3: 实现画像 sub-schema + 扩展 `creatorRecordDataSchema`**

在 `data.schema.ts` 的 `creatorStatItemSchema`(L102)之后插入:

```ts
/** CreatorContact / CreatorRate:镜像 shared。 */
const creatorContactSchema = z.object({
  mcn: z.string().optional(),
  agency: z.string().optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(64).optional(),
  contactPerson: z.string().max(120).optional(),
});
const creatorRateSchema = z.object({
  currency: z.string().max(8).optional(),
  post: z.string().max(64).optional(),
  video: z.string().max(64).optional(),
  live: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
});
```

`creatorWorkSchema` 加作品字段(在 `engagementRate` 之后):

```ts
  contentType: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  productLink: z.string().max(2048).optional(),
  attribution: z.object({
    clicks: z.string().optional(),
    orders: z.string().optional(),
    gmv: z.string().optional(),
    ctr: z.string().optional(),
    cvr: z.string().optional(),
  }).optional(),
  duration: z.string().optional(),
  featured: z.boolean().optional(),
```

`creatorRecordDataSchema` 加画像字段(在 `stats:` 之后、闭合 `)` 之前):

```ts
  bio: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  contact: creatorContactSchema.optional(),
  rate: creatorRateSchema.optional(),
```

- [ ] **Step 4: 运行测试确认通过**

Run: `apps/server/node_modules/.bin/vitest run src/modules/data/data.schema.test.ts`
Expected: PASS(3 用例全过)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts && git commit -m "feat(server): Zod 镜像 Creator 画像/作品新字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 结构化表 migration + dtoToCreator 修复

> 背景:`model Creator`(schema.prisma L201)无 `stats` 列(类型有 `stats?`,走结构化表会丢);顶级新字段(bio/tags/contact/rate)无落点。DB 是 **MySQL**(反引号标识符、`JSON` 类型)。`dtoToCreator`(campaignsApi L70)当前**只映射 metrics,连 audience/works 都丢了** —— 顺带修复。

**Files:**
- Modify: `apps/server/prisma/schema.prisma`(`model Creator` L201-230)
- Create: `apps/server/prisma/migrations/20260716000000_creator_profile_stats/migration.sql`
- Modify: `apps/web/src/api/campaignsApi.ts`(`CreatorDTO` L53-67;`dtoToCreator` L70-84)
- Test: `apps/web/tests/creators-seed.test.ts`(dtoToCreator 形状断言,见 Step 6)

- [ ] **Step 1: schema.prisma 加两列**

在 `model Creator` 的 `works Json?`(L217)之后加:

```prisma
  stats      Json?
  profile    Json?
```

- [ ] **Step 2: 手写 migration SQL(规避 P3014 阴影 DB,见 [[prisma-migrate-dev-needs-shadow-db]])**

创建 `apps/server/prisma/migrations/20260716000000_creator_profile_stats/migration.sql`:

```sql
-- 达人库结构化表:补缺失的 stats 列 + 新增 profile 聚合列(bio/tags/contact/rate)。
ALTER TABLE `Creator` ADD COLUMN `stats` JSON NULL;
ALTER TABLE `Creator` ADD COLUMN `profile` JSON NULL;
```

- [ ] **Step 3: 应用 migration + 重新生成 client**

Run:
```
npx prisma migrate deploy --schema apps/server/prisma/schema.prisma
npx prisma generate --schema apps/server/prisma/schema.prisma
```
Expected: `migrate deploy` 应用该迁移(ADD COLUMN 不需 CREATE DATABASE,不触发 P3014);`generate` 更新 client 类型含 `stats`/`profile`。
> 若 `migrate deploy` 报迁移已部分应用,用 `npx prisma migrate resolve --schema apps/server/prisma/schema.prisma --applied 20260716000000_creator_profile_stats` 标记已应用。

- [ ] **Step 4: `CreatorDTO` 加 `stats`/`profile` 字段**

`apps/web/src/api/campaignsApi.ts` 的 `CreatorDTO`(L53-67),在 `works: unknown;`(L66)之后加:

```ts
  stats: unknown;
  profile: unknown;
```

- [ ] **Step 5: 修复 `dtoToCreator` — 补全 audience/works/stats/profile 映射**

替换 `dtoToCreator`(L70-84)为:

```ts
export function dtoToCreator(dto: CreatorDTO): Creator {
  const profile = (dto.profile ?? null) as {
    bio?: string; tags?: string[];
    contact?: Creator['contact']; rate?: Creator['rate'];
  } | null;
  return {
    id: dto.id,
    name: dto.name,
    handle: dto.handle,
    platform: dto.platform,
    tier: dto.tier as Creator['tier'],
    followers: dto.followers,
    engagement: dto.engagement,
    category: dto.category,
    region: dto.region,
    avatar: dto.avatar ?? creatorAvatarUrl(dto.name),
    metrics: (dto.metrics as Creator['metrics']) ?? [],
    audience: (dto.audience as Creator['audience']) ?? undefined,
    works: (dto.works as Creator['works']) ?? undefined,
    stats: (dto.stats as Creator['stats']) ?? undefined,
    bio: profile?.bio,
    tags: profile?.tags,
    contact: profile?.contact,
    rate: profile?.rate,
  };
}
```

> `Creator` 类型 import 已存在于文件顶部(L9)。`audience`/`works`/`stats` 之前被丢弃,现补回。

- [ ] **Step 6: 写测试 — dtoToCreator 不再丢富数据**

在 `apps/web/tests/creators-seed.test.ts` 末尾追加:

```ts
import { dtoToCreator, type CreatorDTO } from '@/api/campaignsApi';

describe('dtoToCreator maps rich fields', () => {
  it('preserves audience/works/stats + profile(bio/tags/contact/rate)', () => {
    const dto: CreatorDTO = {
      id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'macro',
      followers: '100K', engagement: '7%', category: 'Beauty', region: 'US', avatar: null,
      metrics: [], audience: { genderSplit: [{ label: 'Female', value: 55 }] },
      works: [{ id: 'w1', title: 'T' }],
      stats: [{ label: 'Followers', value: '100K', color: '#000' }],
      profile: { bio: '简介', tags: ['美妆'], contact: { mcn: 'M' }, rate: { post: '$1K' } },
    };
    const c = dtoToCreator(dto);
    expect(c.audience?.genderSplit?.[0].value).toBe(55);
    expect(c.works?.[0].id).toBe('w1');
    expect(c.stats?.[0].label).toBe('Followers');
    expect(c.bio).toBe('简介');
    expect(c.tags).toEqual(['美妆']);
    expect(c.contact?.mcn).toBe('M');
    expect(c.rate?.post).toBe('$1K');
  });

  it('tolerates null profile / missing json', () => {
    const c = dtoToCreator({
      id: 'cre-y', name: 'Y', handle: '@y', platform: 'IG', tier: 'micro',
      followers: '1K', engagement: '5%', category: 'Food', region: 'US', avatar: null,
      metrics: null as unknown, audience: null as unknown, works: null as unknown,
      stats: null as unknown, profile: null as unknown,
    } as CreatorDTO);
    expect(c.metrics).toEqual([]);
    expect(c.audience).toBeUndefined();
    expect(c.bio).toBeUndefined();
  });
});
```

- [ ] **Step 7: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/creators-seed.test.ts`
Expected: PASS

- [ ] **Step 8: 类型检查**

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/20260716000000_creator_profile_stats apps/web/src/api/campaignsApi.ts apps/web/tests/creators-seed.test.ts && git commit -m "feat(prisma): Creator 表加 profile/stats Json 列 + 修复 dtoToCreator 丢字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: mock 种子 — 画像生成器

**Files:**
- Modify: `apps/web/src/api/mock/creators.ts`(在 `buildStats` L300 之后加生成器;`MOCK_CREATORS` L303-313 注入)
- Test: `apps/web/tests/creators-seed.test.ts`

- [ ] **Step 1: 写失败测试 — 种子含画像字段**

在 `creators-seed.test.ts` 追加:

```ts
import { MOCK_CREATORS } from '@/api/mock/creators';

describe('MOCK_CREATORS rich profile', () => {
  it('every creator has bio/tags/contact/rate', () => {
    for (const c of MOCK_CREATORS) {
      expect(typeof c.bio).toBe('string');
      expect(c.bio!.length).toBeGreaterThan(0);
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.tags!.length).toBeGreaterThanOrEqual(2);
      expect(c.contact).toBeTruthy();
      expect(c.contact?.email).toBeTruthy();
      expect(c.rate).toBeTruthy();
      expect(c.rate?.currency).toMatch(/^(USD|CNY)$/);
    }
  });

  it('rate currency matches region mapping', () => {
    const cn = MOCK_CREATORS.find((c) => c.region === 'CN');
    const us = MOCK_CREATORS.find((c) => c.region === 'US');
    expect(cn?.rate?.currency).toBe('CNY');
    expect(us?.rate?.currency).toBe('USD');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/web/node_modules/.bin/vitest run tests/creators-seed.test.ts`
Expected: FAIL(`bio`/`tags`/`contact`/`rate` 尚未生成 → undefined)

- [ ] **Step 3: 实现 4 个确定性生成器**

在 `creators.ts` 的 `buildStats`(L300)之后、`MOCK_CREATORS` 之前插入:

```ts
/* ------------------------------ Profile(bio/tags/contact/rate) ------------------------------ */

/** 按 category 取内容标签池。 */
const TAG_POOL: Record<string, string[]> = {
  Beauty: ['美妆种草', '试色', '日常分享', '好物推荐'],
  Skincare: ['护肤科普', '成分党', '敏感肌', '测评'],
  Lifestyle: ['生活方式', '好物分享', '日常记录', '家居'],
  Tech: ['数码评测', '开箱', '硬核科普', '上手体验'],
  Fashion: ['穿搭', 'OOTD', '时尚单品', '季节穿搭'],
  Fitness: ['健身打卡', '减脂餐', '训练干货', '形体管理'],
  Food: ['美食探店', '家常菜', '食谱', '零食测评'],
};
const DEFAULT_TAGS = ['好物推荐', '日常分享', '测评'];

/** 按 region 取货币。 */
const CURRENCY_BY_REGION: Record<string, string> = {
  CN: 'CNY', 'US / UK': 'USD', US: 'USD', JP: 'USD', KR: 'USD', IN: 'USD',
};

/** tier → 报价基线(图文/短视频/直播,美元量级,确定性)。 */
const TIER_RATE_BASE: Record<Tier, { post: number; video: number; live: number }> = {
  mega: { post: 4500, video: 12000, live: 30000 },
  macro: { post: 1500, video: 4000, live: 10000 },
  micro: { post: 350, video: 900, live: 2200 },
};

/** 生成达人简介(确定性模板)。 */
export function buildBio(meta: Omit<Creator, 'metrics'>, index: number): string {
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];
  const reachK = Math.round((TIER_CHANNEL_BASE[meta.tier as Tier] ?? TIER_CHANNEL_BASE.micro).reach / 1000 * jit);
  return `${meta.name}(${meta.handle})是 ${meta.region} 的 ${meta.category} 领域 ${meta.tier} 达人,单条平均触达约 ${(reachK / 1000).toFixed(1)}M,内容以${(TAG_POOL[meta.category] ?? DEFAULT_TAGS)[0]}见长。`;
}

/** 生成内容标签(确定性取 2-4 个)。 */
export function buildTags(meta: Omit<Creator, 'metrics'>, index: number): string[] {
  const pool = TAG_POOL[meta.category] ?? DEFAULT_TAGS;
  const n = 2 + (index % 3); // 2..4
  return pool.slice(0, n);
}

/** 生成商务联系方式(确定性)。 */
export function buildContact(meta: Omit<Creator, 'metrics'>, index: number): NonNullable<Creator['contact']> {
  const handleUser = meta.handle.replace(/^@/, '');
  return {
    mcn: `MCN-${meta.category}-${(index % 4) + 1}`,
    email: `biz@${handleUser}.com`,
    phone: `+1-555-0${String(100 + index).slice(-3)}`,
    contactPerson: ['Ann', 'Ben', 'Cara', 'Dan'][index % 4],
  };
}

/** 生成合作报价(确定性,tier 基线 + region 货币)。 */
export function buildRate(meta: Omit<Creator, 'metrics'>, index: number): NonNullable<Creator['rate']> {
  const base = TIER_RATE_BASE[meta.tier as Tier] ?? TIER_RATE_BASE.micro;
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];
  const currency = CURRENCY_BY_REGION[meta.region] ?? 'USD';
  const sym = currency === 'CNY' ? '¥' : '$';
  return {
    currency,
    post: `${sym}${(base.post * jit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    video: `${sym}${(base.video * jit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    live: `${sym}${(base.live * jit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    note: '打包合作可议价,具体视 brief 而定',
  };
}
```

- [ ] **Step 4: 注入 `MOCK_CREATORS`**

`MOCK_CREATORS`(L303-313)在 `stats: buildStats(c, i),` 之后加 4 行:

```ts
  bio: buildBio(c, i),
  tags: buildTags(c, i),
  contact: buildContact(c, i),
  rate: buildRate(c, i),
```

- [ ] **Step 5: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/creators-seed.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/mock/creators.ts apps/web/tests/creators-seed.test.ts && git commit -m "feat(mock): 达人种子注入 bio/tags/contact/rate 画像

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: mock 种子 — 作品字段扩展

**Files:**
- Modify: `apps/web/src/api/mock/creators.ts`(`buildWorks` L262-283)
- Test: `apps/web/tests/creators-seed.test.ts`

- [ ] **Step 1: 写失败测试 — 作品含新字段**

在 `creators-seed.test.ts` 追加:

```ts
describe('MOCK_CREATORS works rich fields', () => {
  it('every work has contentType/hashtags/productLink/attribution/duration/featured', () => {
    for (const c of MOCK_CREATORS) {
      for (const w of c.works ?? []) {
        expect(['image', 'video', 'live', 'long', 'series']).toContain(w.contentType);
        expect(Array.isArray(w.hashtags)).toBe(true);
        expect(w.hashtags!.length).toBeGreaterThan(0);
        expect(w.attribution).toBeTruthy();
        expect(w.attribution?.gmv).toBeTruthy();
      }
      // 每个达人恰好一条 featured
      expect((c.works ?? []).filter((w) => w.featured).length).toBe(1);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/web/node_modules/.bin/vitest run tests/creators-seed.test.ts`
Expected: FAIL(作品无 `contentType` 等 → undefined,断言失败)

- [ ] **Step 3: 扩展 `buildWorks` 返回对象**

`buildWorks`(L262-283)的 `return pool.map((title, i) => { ... return { ... } })` 中,在 `engagementRate: ...` 之后、闭合 `}` 之前补字段。最终 return 块为:

```ts
    const impressionsNum = base * jit;
    const isVideo = VIDEO_PLATFORMS.has(meta.platform);
    return {
      id: `${meta.id}-work-${i + 1}`,
      title,
      cover: `https://picsum.photos/seed/${encodeURIComponent(meta.name + '-' + i)}/400/400`,
      platform: meta.platform,
      publishedAt: `2026-0${(i % 6) + 1}-${String(((index + i) % 28) + 1).padStart(2, '0')}`,
      impressions: compact(impressionsNum),
      likes: compact(impressionsNum * 0.08),
      comments: compact(impressionsNum * 0.005),
      shares: compact(impressionsNum * 0.012),
      engagementRate: `${(8 * jit).toFixed(1)}%`,
      contentType: isVideo ? 'video' : 'image',
      hashtags: [`#${meta.category.toLowerCase()}`, `#collab${i + 1}`],
      productLink: i % 2 === 0 ? `https://shop.example.com/p/${meta.id}-${i + 1}` : undefined,
      attribution: {
        clicks: compact(impressionsNum * 0.04),
        orders: compact(impressionsNum * 0.04 * 0.03),
        gmv: money(impressionsNum * 0.04 * 0.03 * 45),
        ctr: `${(4 * jit).toFixed(1)}%`,
        cvr: `${(3 * jit).toFixed(1)}%`,
      },
      duration: isVideo ? `${1 + (i % 5)}:${String((10 + i * 7) % 60).padStart(2, '0')}` : undefined,
      featured: i === 0,
    };
```

> `featured: i === 0` 保证每达人恰一条精选。`money` 已在文件顶部定义(L175)。`duration` 视频平台给 "M:SS",图文为 undefined。

- [ ] **Step 4: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/creators-seed.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/mock/creators.ts apps/web/tests/creators-seed.test.ts && git commit -m "feat(mock): 作品扩展 contentType/hashtags/attribution/duration/featured

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: CSV/JSON 导入 — bio/tags

> CSV 表达不了嵌套对象(contact/rate/作品扩展),只加可扁平化的 `bio`(文本)+ `tags`(分号分隔)。contact/rate/作品扩展留给 JSON 导入(已透传)。

**Files:**
- Modify: `apps/web/src/editor/dataImport.ts`(`CREATOR_FIELDS` L5;`buildPreviewFromRows` L30-47 特殊处理;`downloadTemplate` L59-74 example)
- Test: `apps/web/tests/dataImport.test.ts`

- [ ] **Step 1: 写失败测试 — bio 单值 / tags 分号分隔**

在 `dataImport.test.ts` 追加(对齐既有 import):

```ts
import { buildPreviewFromRows } from '@/editor/dataImport';

describe('creator import bio/tags', () => {
  const validBase = {
    id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'macro',
    followers: '100K', engagement: '7%', category: 'Beauty', region: 'US',
  };

  it('parses tags from semicolon-separated string into array', () => {
    const rows = [{ ...validBase, bio: '简介文本', tags: '美妆;种草;测评' }];
    const [item] = buildPreviewFromRows('creator', rows);
    expect(item.valid).toBe(true);
    expect(item.data.bio).toBe('简介文本');
    expect(item.data.tags).toEqual(['美妆', '种草', '测评']);
  });

  it('omits tags when empty', () => {
    const rows = [{ ...validBase, tags: '' }];
    const [item] = buildPreviewFromRows('creator', rows);
    expect(item.data.tags).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/web/node_modules/.bin/vitest run tests/dataImport.test.ts`
Expected: FAIL(`CREATOR_FIELDS` 不含 `bio`/`tags` → 取不到值)

- [ ] **Step 3: `CREATOR_FIELDS` 加 bio/tags**

`dataImport.ts` L5:

```ts
export const CREATOR_FIELDS = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'avatar', 'bio', 'tags'] as const;
```

- [ ] **Step 4: `buildPreviewFromRows` 加 tags 分号拆分**

`buildPreviewFromRows` 的 `if (f === 'creatorIds')` 分支(L37-39)之后,加一个 `tags` 分支:

```ts
      } else if (f === 'tags') {
        const tags = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (tags.length) data.tags = tags;
      } else {
```

(即把原 `else { data[f] = v; }` 改为 `else if (tags) ... else ...`;`bio` 走默认 `data[f] = v`。)

- [ ] **Step 5: 更新模板 example**

`downloadTemplate`(L65)creator example 改为含 bio/tags:

```ts
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,,美妆达人,美妆;种草',
```

(第 10 列 avatar 留空,第 11 列 bio="美妆达人",第 12 列 tags="美妆;种草",与 `CREATOR_FIELDS` 顺序对齐)

- [ ] **Step 6: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/dataImport.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/dataImport.ts apps/web/tests/dataImport.test.ts && git commit -m "feat(import): 达人 CSV 导入支持 bio / tags(分号分隔)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 详情浮窗 — 头部简介 + 标签 + 报价 + 联系方式

**Files:**
- Modify: `apps/web/src/editor/components/CreatorDetailDrawer.tsx`(头部 L48-58;基本字段网格 L60-68)
- Test: `apps/web/tests/CreatorDetailDrawer.test.tsx`

- [ ] **Step 1: 写失败测试 — bio/tags/rate/contact 渲染**

在 `CreatorDetailDrawer.test.tsx` 追加(对齐既有 render helper;遵守 [[web-chart-test-convention]] 仅断言文本):

```ts
import { render, screen } from '@testing-library/react';
import { CreatorDetailDrawer } from '@/editor/components/CreatorDetailDrawer';
import type { Creator } from '@mediakit/shared';

const fullCreator: Creator = {
  id: 'cre-x', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'macro',
  followers: '100K', engagement: '7%', category: 'Beauty', region: 'US',
  metrics: [{ label: 'Avg Reach', value: '720K', compare: '' }],
  bio: '美妆领域 macro 达人',
  tags: ['美妆种草', '试色'],
  contact: { mcn: 'MCN-A', email: 'biz@mia.com', phone: '+1-555', contactPerson: 'Ann' },
  rate: { currency: 'USD', post: '$1,000', video: '$3,000', live: '$8,000' },
};

describe('CreatorDetailDrawer rich profile', () => {
  it('renders bio + tags + rate + contact', () => {
    render(<CreatorDetailDrawer creator={fullCreator} onClose={() => {}} />);
    expect(screen.getByText('美妆领域 macro 达人')).toBeInTheDocument();
    expect(screen.getByText('美妆种草')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();   // post
    expect(screen.getByText('$3,000')).toBeInTheDocument();   // video
    expect(screen.getByText('$8,000')).toBeInTheDocument();   // live
    expect(screen.getByText('biz@mia.com')).toBeInTheDocument();
    expect(screen.getByText('MCN-A')).toBeInTheDocument();
  });

  it('does not crash when rich fields missing', () => {
    const minimal: Creator = {
      id: 'cre-y', name: 'Y', handle: '@y', platform: 'IG', tier: 'micro',
      followers: '1K', engagement: '5%', category: 'Food', region: 'US',
      metrics: [],
    };
    expect(() => render(<CreatorDetailDrawer creator={minimal} onClose={() => {}} />)).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/web/node_modules/.bin/vitest run tests/CreatorDetailDrawer.test.tsx`
Expected: FAIL(浮窗未渲染 bio/tags/rate/contact)

- [ ] **Step 3: 头部加 bio + tags chips**

`CreatorDetailDrawer.tsx` 头部(原 L49-58 的 `<div className="min-w-0 flex-1">` 块),在 handle 行之后加 bio 与 tags:

```tsx
          <div className="min-w-0 flex-1">
            <div className="font-headings text-lg font-semibold text-foreground-primary">{creator.name}</div>
            <div className="truncate text-sm text-foreground-secondary">{creator.handle}</div>
            {creator.bio && (
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{creator.bio}</p>
            )}
            {creator.tags && creator.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {creator.tags.map((t) => (
                  <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-primary">{t}</span>
                ))}
              </div>
            )}
          </div>
```

> 颜色类名用项目既有 token(如 `text-primary`/`accent-soft`);若实际不同,对齐 `CreatorDetailDrawer` 现有 className(`text-foreground-primary` 等)。**执行时统一用文件内已有的 token**。

- [ ] **Step 4: 基本字段网格后加报价 + 联系方式分区**

在基本字段网格 `</div>`(原 L68)之后、频道 KPI 之前插入:

```tsx
        {/* 合作报价 */}
        {creator.rate && (creator.rate.post || creator.rate.video || creator.rate.live) && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">合作报价{creator.rate.currency ? ` (${creator.rate.currency})` : ''}</div>
            <div className="grid grid-cols-3 gap-2">
              {creator.rate.post && <RateCell label="图文" value={creator.rate.post} />}
              {creator.rate.video && <RateCell label="短视频" value={creator.rate.video} />}
              {creator.rate.live && <RateCell label="直播" value={creator.rate.live} />}
            </div>
            {creator.rate.note && <div className="mt-2 text-[11px] text-foreground-muted">{creator.rate.note}</div>}
          </div>
        )}

        {/* 联系方式 */}
        {creator.contact && (creator.contact.mcn || creator.contact.email || creator.contact.phone || creator.contact.contactPerson) && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">商务联系方式</div>
            <div className="space-y-1 text-sm">
              {creator.contact.mcn && <ContactRow label="MCN" value={creator.contact.mcn} />}
              {creator.contact.email && <ContactRow label="邮箱" value={creator.contact.email} />}
              {creator.contact.phone && <ContactRow label="电话" value={creator.contact.phone} />}
              {creator.contact.contactPerson && <ContactRow label="联系人" value={creator.contact.contactPerson} />}
            </div>
          </div>
        )}
```

- [ ] **Step 5: 在文件底部加两个小辅助组件**

在 `CreatorDetailDrawer` 函数之后、文件闭合前加:

```tsx
function RateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <div className="text-[11px] text-foreground-muted">{label}</div>
      <div className="text-sm font-semibold text-foreground-primary">{value}</div>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-foreground-muted">{label}</span>
      <span className="text-foreground-primary">{value}</span>
    </div>
  );
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/CreatorDetailDrawer.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/components/CreatorDetailDrawer.tsx apps/web/tests/CreatorDetailDrawer.test.tsx && git commit -m "feat(ui): 达人详情浮窗展示 bio/tags/报价/联系方式

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 详情浮窗 — 受众画像 + 作品列表 + 频道统计

**Files:**
- Modify: `apps/web/src/editor/components/CreatorDetailDrawer.tsx`(频道 KPI 之后追加分区)
- Test: `apps/web/tests/CreatorDetailDrawer.test.tsx`

- [ ] **Step 1: 写失败测试 — audience/works/stats 渲染**

在 `CreatorDetailDrawer.test.tsx` 追加(扩展 `fullCreator` 或新建):

```ts
const dataCreator: Creator = {
  ...fullCreator,
  audience: {
    genderSplit: [{ label: 'Female', value: 55 }, { label: 'Male', value: 45 }],
    ageRange: [{ label: '25-34', value: 40 }],
    topCities: [{ label: 'New York', value: 32 }],
  },
  works: [{
    id: 'w1', title: 'Glow Routine', contentType: 'video',
    impressions: '1.2M', likes: '96K', engagementRate: '8.0%',
    hashtags: ['#beauty'], attribution: { gmv: '$2,100' }, featured: true,
  }],
  stats: [{ key: 'followers', label: 'Followers', value: '100K', color: '#000' }],
};

describe('CreatorDetailDrawer audience/works/stats', () => {
  it('renders audience slices, works, stats', () => {
    render(<CreatorDetailDrawer creator={dataCreator} onClose={() => {}} />);
    // 受众
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('25-34')).toBeInTheDocument();
    // 作品
    expect(screen.getByText('Glow Routine')).toBeInTheDocument();
    expect(screen.getByText('$2,100')).toBeInTheDocument();
    // 统计
    expect(screen.getAllByText('Followers').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `apps/web/node_modules/.bin/vitest run tests/CreatorDetailDrawer.test.tsx`
Expected: FAIL(未渲染 audience/works/stats)

- [ ] **Step 3: 在频道 KPI 分区后追加三个分区**

`CreatorDetailDrawer.tsx`,在频道 KPI 的 `)}`(原 L83)之后、`</aside>`(L84)之前插入:

```tsx
        {/* 受众画像 */}
        {creator.audience && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">受众画像</div>
            {(creator.audience.genderSplit?.length ?? 0) > 0 && (
              <SliceGroup title="性别" slices={creator.audience.genderSplit!} />
            )}
            {(creator.audience.ageRange?.length ?? 0) > 0 && (
              <SliceGroup title="年龄" slices={creator.audience.ageRange!} />
            )}
            {(creator.audience.topCities?.length ?? 0) > 0 && (
              <SliceGroup title="Top 城市" slices={creator.audience.topCities!} />
            )}
          </div>
        )}

        {/* 作品列表 */}
        {(creator.works?.length ?? 0) > 0 && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">作品</div>
            <div className="space-y-2">
              {creator.works!.map((w) => (
                <div key={w.id} className="flex gap-3 rounded-lg border border-border-subtle p-3">
                  {w.cover && <img src={w.cover} alt={w.title} className="h-14 w-14 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground-primary">{w.title}</span>
                      {w.featured && <span className="rounded bg-accent-soft px-1 text-[10px] text-accent-primary">精选</span>}
                      {w.contentType && <span className="text-[10px] text-foreground-muted">{w.contentType}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-foreground-secondary">
                      {w.impressions && <span>曝光 {w.impressions}</span>}
                      {w.likes && <span>赞 {w.likes}</span>}
                      {w.engagementRate && <span>互动率 {w.engagementRate}</span>}
                      {w.attribution?.gmv && <span>GMV {w.attribution.gmv}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 频道统计 */}
        {(creator.stats?.length ?? 0) > 0 && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">频道统计</div>
            <div className="grid grid-cols-2 gap-2">
              {creator.stats!.map((s, i) => (
                <div key={`${s.label}-${i}`} className="rounded-lg border border-border-subtle p-3">
                  <div className="text-[11px] text-foreground-muted">{s.label}</div>
                  <div className="text-sm font-semibold text-foreground-primary">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 4: 加 `SliceGroup` 辅助组件**

在文件底部(Task 7 的辅助组件旁)加:

```tsx
function SliceGroup({ title, slices }: { title: string; slices: { label: string; value: number; color?: string }[] }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] text-foreground-muted">{title}</div>
      <div className="space-y-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-foreground-secondary">{s.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-surface-hover">
              <div className="h-full rounded" style={{ width: `${Math.min(100, s.value)}%`, background: s.color ?? '#6366f1' }} />
            </div>
            <span className="w-10 shrink-0 text-right text-foreground-secondary">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `apps/web/node_modules/.bin/vitest run tests/CreatorDetailDrawer.test.tsx`
Expected: PASS

- [ ] **Step 6: 全量回归 + 类型检查**

Run:
```
apps/web/node_modules/.bin/vitest run tests/CreatorDetailDrawer.test.tsx tests/creators-seed.test.ts tests/dataImport.test.ts
pnpm -r typecheck
```
Expected: 全 PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/components/CreatorDetailDrawer.tsx apps/web/tests/CreatorDetailDrawer.test.tsx && git commit -m "feat(ui): 达人详情浮窗展示受众画像/作品列表/频道统计

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 1 验收清单

- [ ] `pnpm -r typecheck` 通过
- [ ] server `data.schema.test.ts` 全过(画像 + 作品 Zod)
- [ ] web `creators-seed.test.ts` 全过(种子画像 + 作品 + dtoToCreator)
- [ ] web `dataImport.test.ts` 全过(bio/tags)
- [ ] web `CreatorDetailDrawer.test.tsx` 全过(画像 + 受众/作品/统计)
- [ ] `migration deploy` 成功,`Creator` 表有 `stats`/`profile` 列
- [ ] 手动冒烟:达人库「导入示例数据」→ 点开任意达人 → 浮窗显示 bio/tags/报价/联系方式/受众/作品/统计

## 后续(不在本 plan)

- **Phase 2**:表单混合录入(`RecordFormModal` 重构 + 5 个子编辑器:TagsInput/RateEditor/AudienceEditor/WorksEditor/StatsEditor/ContactEditor)
- **Phase 3**:列表检索(`CreatorPage` 搜索 + 平台/层级/品类/标签筛选 + 排序 + 分页)
- **PPT 消费映射**:扩 `ReportCreator`(加 bio/tags)+ 在 `DataConfigOverlay.tsx` 内联转换处补映射 + `CreatorComponents` 作品组件消费 `attribution`/`contentType`/`featured`
