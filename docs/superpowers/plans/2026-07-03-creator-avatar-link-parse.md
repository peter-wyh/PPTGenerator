# 达人头像卡 · 链接解析 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `creator-avatar-card` 属性面板粘贴达人链接，前端 mock 确定性解析并自动填充 handle / 粉丝 / 获赞 / 互动率等字段。

**Architecture:** 新建纯前端解析模块 `creatorLink.ts`（FNV-1a 哈希派生稳定 mock 数据，无网络请求）→ 扩展 `CreatorAvatarCardData` 可选字段 → 卡片渲染 KPI 行 → PropertyPanel 新增 `CreatorLinkImporter` 面板调用解析器写入 store。

**Tech Stack:** React 18 + TypeScript + Zustand + Vitest + @testing-library/react。测试在 `apps/web/tests/`，命令 `pnpm --filter @mediakit/web test`，单文件 `pnpm --filter @mediakit/web exec vitest run tests/<file>`，类型检查 `pnpm --filter @mediakit/web typecheck`。

**Spec:** `docs/superpowers/specs/2026-07-03-creator-avatar-link-parse-design.md`

**支撑平台：** TikTok / Instagram / YouTube / 微博（不含小红书）。

---

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/index.ts` | `CreatorAvatarCardData` 类型 | 修改：加可选字段 |
| `apps/web/src/editor/creatorLink.ts` | `detectPlatform` + `parseCreatorLink`（纯函数 mock） | 新建 |
| `apps/web/tests/editor.creator-link.test.ts` | 解析器纯函数测试 | 新建 |
| `apps/web/src/editor/components/CreatorComponents.tsx` | 卡片渲染 KPI 行 | 修改 |
| `apps/web/tests/editor.creator.test.tsx` | 增加 KPI 渲染断言 | 修改 |
| `apps/web/src/editor/registry.tsx` | `propertySchema` 增 4 个 text 字段 | 修改 |
| `apps/web/src/editor/PropertyPanel.tsx` | 新增 `CreatorLinkImporter` 子面板 | 修改 |
| `apps/web/tests/editor.creator-link-importer.test.tsx` | 面板交互测试 | 新建 |

---

## Task 1: 扩展 `CreatorAvatarCardData` 类型

**Files:**
- Modify: `packages/shared/src/index.ts:236-243`

- [ ] **Step 1: 给 `CreatorAvatarCardData` 增加可选字段**

把现有接口替换为：

```ts
export interface CreatorAvatarCardData {
  variant: CreatorAvatarVariant;
  avatar: string;
  name: string;
  platform: CreatorPlatform;
  tier: CreatorTier;
  intro: string;
  /** 链接解析产出（可选；向后兼容老数据）。 */
  sourceUrl?: string;
  handle?: string;
  followers?: string;
  likes?: string;
  engagement?: string;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过，0 error。

- [ ] **Step 3: 提交**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): CreatorAvatarCardData 增加链接解析可选字段"
```

---

## Task 2: `detectPlatform` — 平台识别（TDD）

**Files:**
- Create: `apps/web/src/editor/creatorLink.ts`
- Test: `apps/web/tests/editor.creator-link.test.ts`

- [ ] **Step 1: 写失败测试（创建测试文件）**

新建 `apps/web/tests/editor.creator-link.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { detectPlatform } from '@/editor/creatorLink';

describe('detectPlatform', () => {
  it('识别四个支持平台的主域', () => {
    expect(detectPlatform('https://www.tiktok.com/@miaglowup')).toBe('tiktok');
    expect(detectPlatform('https://instagram.com/sofialane')).toBe('instagram');
    expect(detectPlatform('https://youtube.com/@leosato')).toBe('youtube');
    expect(detectPlatform('https://youtu.be/abcd1234')).toBe('youtube');
    expect(detectPlatform('https://weibo.com/u/123456')).toBe('weibo');
    expect(detectPlatform('https://m.weibo.cn/status/X')).toBe('weibo');
  });

  it('容忍无协议 / www / m 前缀 / 大小写', () => {
    expect(detectPlatform('tiktok.com/@x')).toBe('tiktok');
    expect(detectPlatform('WWW.TIKTOK.COM/x')).toBe('tiktok');
    expect(detectPlatform('http://m.instagram.com/p/1')).toBe('instagram');
  });

  it('不支持的平台返回 null（含小红书）', () => {
    expect(detectPlatform('https://www.xiaohongshu.com/user/abc')).toBeNull();
    expect(detectPlatform('https://xhslink.com/abc')).toBeNull();
    expect(detectPlatform('https://example.com')).toBeNull();
    expect(detectPlatform('')).toBeNull();
    expect(detectPlatform('not a url at all')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link.test.ts`
Expected: FAIL — `Failed to resolve import "@/editor/creatorLink"`。

- [ ] **Step 3: 实现最小代码**

新建 `apps/web/src/editor/creatorLink.ts`：

```ts
import type { CreatorAvatarCardData, CreatorPlatform } from '@mediakit/shared';

/** 平台 → 命中 host 关键词（小写）。 */
const PLATFORM_HOSTS: { platform: CreatorPlatform; hosts: string[] }[] = [
  { platform: 'tiktok', hosts: ['tiktok.com'] },
  { platform: 'instagram', hosts: ['instagram.com'] },
  { platform: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { platform: 'weibo', hosts: ['weibo.com', 'weibo.cn'] },
];

/** 从达人链接识别平台；不支持返回 null。 */
export function detectPlatform(url: string): CreatorPlatform | null {
  const noProto = (url ?? '').toLowerCase().replace(/^https?:\/\//, '');
  const host = noProto.split('/')[0].replace(/^(www\.|m\.)/, '');
  for (const { platform, hosts } of PLATFORM_HOSTS) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return platform;
  }
  return null;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link.test.ts`
Expected: PASS（3 个用例全过）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/creatorLink.ts apps/web/tests/editor.creator-link.test.ts
git commit -m "feat(web): detectPlatform 识别达人链接平台"
```

---

## Task 3: `parseCreatorLink` — 确定性解析（TDD）

**Files:**
- Modify: `apps/web/src/editor/creatorLink.ts`
- Modify: `apps/web/tests/editor.creator-link.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor.creator-link.test.ts` 顶部 import 加上 `parseCreatorLink`：

```ts
import { detectPlatform, parseCreatorLink } from '@/editor/creatorLink';
```

文件末尾追加：

```ts
import { vi } from 'vitest';

describe('parseCreatorLink', () => {
  it('拒绝不支持的平台', async () => {
    await expect(parseCreatorLink('https://www.xiaohongshu.com/u/a')).rejects.toThrow();
  });

  it('返回约定的字段且 platform 正确', async () => {
    const r = await parseCreatorLink('https://www.tiktok.com/@miaglowup');
    expect(r.platform).toBe('tiktok');
    expect(r.handle).toMatch(/^@/);
    expect(typeof r.name).toBe('string');
    expect(r.name!.length).toBeGreaterThan(0);
    expect(typeof r.followers).toBe('string');
    expect(typeof r.likes).toBe('string');
    expect(r.engagement).toMatch(/%$/);
    expect(r.intro).toContain(r.handle!);
    expect(r.sourceUrl).toBe('https://www.tiktok.com/@miaglowup');
    expect(r.avatar).toContain('dicebear.com');
  });

  it('同一 URL 两次解析结果一致（确定性）', async () => {
    const url = 'https://instagram.com/sofialane';
    const a = await parseCreatorLink(url);
    const b = await parseCreatorLink(url);
    expect(a).toEqual(b);
  });

  it('不同 URL（同平台）派生不同结果', async () => {
    const a = await parseCreatorLink('https://www.tiktok.com/@aaa');
    const b = await parseCreatorLink('https://www.tiktok.com/@bbb');
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link.test.ts`
Expected: FAIL — `parseCreatorLink is not a function`。

- [ ] **Step 3: 实现 `parseCreatorLink`**

在 `apps/web/src/editor/creatorLink.ts` 末尾追加：

```ts
/* ----------------------------- 确定性 mock 数据 ----------------------------- */

const FIRST_NAMES = ['Mia', 'Sofia', 'Ava', 'Jamie', 'Leo', 'Nora', 'Tom', 'Ivy', 'Maya', 'Eli', 'Zoe', 'Kai'];
const LAST_NAMES = ['Chen', 'Lane', 'Park', 'Wu', 'Sato', 'Kim', 'Reyes', 'Li', 'Owens', 'Tan'];
const CATEGORIES = ['Beauty', 'Skincare', 'Lifestyle', 'Fashion', 'Tech', 'Food', 'Fitness', 'Travel'];
const SYLLABLES = ['mi', 'so', 'av', 'ja', 'le', 'no', 'to', 'iv', 'ma', 'el', 'zo', 'ka', 'lu', 're', 'na', 'da'];

/** FNV-1a 32 位确定性哈希。 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** 数字格式化为易读量级字符串（如 1.28M / 684K）。 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function makeHandle(seed: number): string {
  return (
    '@' +
    pick(SYLLABLES, seed) +
    pick(SYLLABLES, seed >> 4) +
    pick(SYLLABLES, seed >> 8)
  );
}

/**
 * 解析达人链接，返回 mock 字段。确定性：相同 URL → 相同结果。
 * 不支持的链接 reject（调用方提示「暂不支持」）。
 */
export function parseCreatorLink(
  url: string,
): Promise<Partial<CreatorAvatarCardData>> {
  const trimmed = (url ?? '').trim();
  const platform = detectPlatform(trimmed);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!platform) {
        reject(new Error('unsupported platform'));
        return;
      }
      const seed = fnv1a(trimmed);
      const name = `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed >> 3)}`;
      const handle = makeHandle(seed);
      const category = pick(CATEGORIES, seed >> 5);
      const followerBase = 50_000 + (seed % 2_500_000);
      const followers = formatCount(followerBase);
      const likes = formatCount(followerBase * (8 + (seed % 10)));
      const engagement = `${(3 + (seed % 10)).toFixed(1)}%`;
      resolve({
        platform,
        name,
        handle,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        followers,
        likes,
        engagement,
        intro: `${name} · ${category} Creator · ${handle}`,
        sourceUrl: trimmed,
      });
    }, 400);
  });
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link.test.ts`
Expected: PASS（全部用例，单条约 0.4s）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/creatorLink.ts apps/web/tests/editor.creator-link.test.ts
git commit -m "feat(web): parseCreatorLink 确定性 mock 解析达人链接"
```

---

## Task 4: 卡片渲染 KPI 行（TDD）

**Files:**
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`
- Modify: `apps/web/tests/editor.creator.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `apps/web/tests/editor.creator.test.tsx` 的 `render` describe 块内追加一个用例（在现有 avatar card 用例之后）：

```ts
  it('avatar card renders KPI line when followers/likes/engagement present (horizontal & vertical)', () => {
    const data = {
      variant: 'horizontal',
      avatar: '',
      name: 'Mia',
      platform: 'tiktok' as const,
      tier: 'macro' as const,
      intro: 'hi',
      followers: '1.28M',
      likes: '12.4M',
      engagement: '8.7%',
    };
    const { rerender } = render(<CreatorAvatarCard data={data} />);
    expect(screen.getByText(/粉丝 1\.28M/)).toBeInTheDocument();
    expect(screen.getByText(/获赞 12\.4M/)).toBeInTheDocument();
    expect(screen.getByText(/互动 8\.7%/)).toBeInTheDocument();

    // 切到竖排同样展示
    rerender(<CreatorAvatarCard data={{ ...data, variant: 'vertical' }} />);
    expect(screen.getByText(/粉丝 1\.28M/)).toBeInTheDocument();
  });

  it('avatar card omits KPI line when no stats, and compact never shows it', () => {
    const { rerender } = render(
      <CreatorAvatarCard
        data={{ variant: 'horizontal', avatar: '', name: 'Mia', platform: 'tiktok', tier: 'macro', intro: 'hi' }}
      />,
    );
    expect(screen.queryByText(/粉丝/)).toBeNull();

    rerender(
      <CreatorAvatarCard
        data={{
          variant: 'compact',
          avatar: '',
          name: 'Mia',
          platform: 'tiktok',
          tier: 'macro',
          intro: 'hi',
          followers: '1.28M',
        }}
      />,
    );
    expect(screen.queryByText(/粉丝/)).toBeNull();
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator.test.tsx`
Expected: FAIL — `Unable to find an element with text matching /粉丝 1.28M/`。

- [ ] **Step 3: 实现 KPI 行组件并在 horizontal/vertical 中渲染**

在 `apps/web/src/editor/components/CreatorComponents.tsx` 中，于 `Avatar` 函数之后插入：

```tsx
/** 粉丝/获赞/互动 KPI 单行；无任何字段时不渲染。 */
function StatsLine({ data }: { data: CreatorAvatarCardData }) {
  const parts: string[] = [];
  if (data.followers) parts.push(`粉丝 ${data.followers}`);
  if (data.likes) parts.push(`获赞 ${data.likes}`);
  if (data.engagement) parts.push(`互动 ${data.engagement}`);
  if (parts.length === 0) return null;
  return <div className="mt-1 text-[11px] text-foreground-secondary">{parts.join(' · ')}</div>;
}
```

在 `AvatarHorizontal` 的 `{data.intro && ...}` 那一行之后、`</div>` 结束前插入 `<StatsLine data={data} />`：

```tsx
function AvatarHorizontal({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full items-center gap-3 rounded-xl border border-border-default bg-surface-primary p-3">
      <Avatar data={data} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
          <span className="flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
            {PLATFORM_LABEL[data.platform] ?? data.platform}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</div>
        {data.intro && <div className="mt-1 line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
        <StatsLine data={data} />
      </div>
    </div>
  );
}
```

同样在 `AvatarVertical` 的 `{data.intro && ...}` 之后插入 `<StatsLine data={data} />`：

```tsx
function AvatarVertical({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-primary p-3 text-center">
      <Avatar data={data} size={80} />
      <div className="flex items-center gap-2">
        <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
        <span className="flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
          {PLATFORM_LABEL[data.platform] ?? data.platform}
        </span>
      </div>
      <div className="text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</div>
      {data.intro && <div className="line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
      <StatsLine data={data} />
    </div>
  );
}
```

`AvatarCompact` **不动**（空间紧张不显示）。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/CreatorComponents.tsx apps/web/tests/editor.creator.test.tsx
git commit -m "feat(web): 达人头像卡渲染粉丝/获赞/互动 KPI 行"
```

---

## Task 5: registry 增加可编辑字段

**Files:**
- Modify: `apps/web/src/editor/registry.tsx:187-193`

- [ ] **Step 1: 扩展 `creator-avatar-card` 的 propertySchema**

把 `apps/web/src/editor/registry.tsx` 中 `creator-avatar-card` 的 `propertySchema` 改为：

```tsx
    propertySchema: [
      { key: 'avatar', label: '头像 URL', kind: 'text' },
      { key: 'name', label: '名称', kind: 'text' },
      { key: 'platform', label: '平台', kind: 'select', options: PLATFORMS },
      { key: 'tier', label: '层级', kind: 'select', options: TIERS },
      { key: 'intro', label: '简介', kind: 'textarea' },
      { key: 'handle', label: 'Handle', kind: 'text' },
      { key: 'followers', label: '粉丝数', kind: 'text' },
      { key: 'likes', label: '获赞数', kind: 'text' },
      { key: 'engagement', label: '互动率', kind: 'text' },
    ],
```

- [ ] **Step 2: 类型检查 + 跑全量测试确认无回归**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: typecheck 通过；测试全绿（`editor.creator.test.tsx` 的 registry 用例 `propertySchema.length > 0` 仍成立）。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/registry.tsx
git commit -m "feat(web): creator-avatar-card propertySchema 增 handle/粉丝/获赞/互动"
```

---

## Task 6: PropertyPanel 链接解析面板（TDD）

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Test: `apps/web/tests/editor.creator-link-importer.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `apps/web/tests/editor.creator-link-importer.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useEditorStore } from '@/editor/store';
import { PropertyPanel } from '@/editor/PropertyPanel';
import type { ProjectDetail } from '@mediakit/shared';

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function panel() {
  return render(
    <MemoryRouter>
      <PropertyPanel />
    </MemoryRouter>,
  );
}

function addAndSelectCard() {
  const store = useEditorStore.getState();
  store.loadProject(emptyProject, 'p');
  store.addComponent('creator-avatar-card');
  const id = store.currentComponents()[0].id;
  store.updateComponentData(id, { tier: 'micro' });
  store.select(id);
  return id;
}

describe('CreatorLinkImporter', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('解析 TikTok 链接后写入字段，并保留 variant/tier', async () => {
    const id = addAndSelectCard();
    panel();
    expect(screen.getByPlaceholderText(/粘贴达人主页\/视频链接/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/粘贴达人主页\/视频链接/), 'https://www.tiktok.com/@miaglowup');
    await userEvent.click(screen.getByRole('button', { name: '解析' }));

    await waitFor(() => {
      const comp = useEditorStore.getState().currentComponents()[0];
      expect((comp.data as { followers?: string }).followers).toBeTruthy();
    });

    const data = useEditorStore.getState().currentComponents()[0].data as Record<string, unknown>;
    expect(data.platform).toBe('tiktok');
    expect(data.tier).toBe('micro'); // 保留
    expect(data.variant).toBe('horizontal'); // 保留
    expect(typeof data.handle).toBe('string');
    expect(typeof data.likes).toBe('string');
    expect(typeof data.engagement).toBe('string');
    expect(id).toBe(id);
  });

  it('不支持的平台显示错误且不动数据', async () => {
    addAndSelectCard();
    panel();
    await userEvent.type(screen.getByPlaceholderText(/粘贴达人主页\/视频链接/), 'https://www.xiaohongshu.com/u/a');
    await userEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(await screen.findByText(/暂仅支持/)).toBeInTheDocument();
    const data = useEditorStore.getState().currentComponents()[0].data as Record<string, unknown>;
    expect(data.followers).toBeUndefined();
  });

  it('空输入提示错误', async () => {
    addAndSelectCard();
    panel();
    await userEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(await screen.findByText('请粘贴达人链接')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link-importer.test.tsx`
Expected: FAIL — 找不到占位输入框（面板尚未实现）。

- [ ] **Step 3: 实现 `CreatorLinkImporter` 并挂载**

在 `apps/web/src/editor/PropertyPanel.tsx`：

1) 顶部 import 增补（在现有 import 之后）：

```ts
import { parseCreatorLink } from './creatorLink';
import type { CreatorAvatarCardData } from '@mediakit/shared';
```

（`useEffect` / `useState` 已在 line 1 导入。）

2) 在 `PropertyPanel` 的标题 `<div>...{LABELS[comp.type] ?? comp.type}</div>` 之后、`<FieldGroup title="位置与尺寸">` 之前，插入：

```tsx
      {comp.type === 'creator-avatar-card' && <CreatorLinkImporter comp={comp} />}
```

3) 在文件中（`BusinessFields` 之前或任意组件函数区）新增组件：

```tsx
/* --------------------------- 达人链接解析 ---------------------------- */

function CreatorLinkImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorAvatarCardData;
  const [url, setUrl] = useState(data.sourceUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(data.sourceUrl ?? '');
  }, [data.sourceUrl]);

  const onParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus('error');
      setError('请粘贴达人链接');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const parsed = await parseCreatorLink(trimmed);
      updateComponentData(comp.id, parsed);
      commit();
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('暂仅支持 TikTok / Instagram / YouTube / 微博 链接');
    }
  };

  return (
    <FieldGroup title="达人链接解析">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="粘贴达人主页/视频链接…"
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
      />
      <button
        onClick={onParse}
        disabled={status === 'loading'}
        className="mt-1 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
      >
        {status === 'loading' ? '解析中…' : '解析'}
      </button>
      {status === 'error' && <div className="mt-1 text-xs text-red">{error}</div>}
    </FieldGroup>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.creator-link-importer.test.tsx`
Expected: PASS（3 用例；含 ~0.4s 解析延迟，整体 < 默认 5s 超时）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.creator-link-importer.test.tsx
git commit -m "feat(web): 达人头像卡属性面板新增链接解析"
```

---

## Task 7: 全量回归与收尾

- [ ] **Step 1: 类型检查 + 全量测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: typecheck 0 error；全部测试通过（含新增 2 个测试文件、editor.creator.test.tsx 新增用例）。

- [ ] **Step 2: 视觉冒烟（可选，手动）**

Run: `pnpm --filter @mediakit/web dev`，打开编辑器 → 新建 creator-page 或拖入 creator-avatar-card → 选中 → 在「达人链接解析」粘贴一条 TikTok 链接 → 点「解析」→ 确认卡片出现 粉丝/获赞/互动 KPI 行，且变体/层级不变。

- [ ] **Step 3: 更新 CHANGELOG**

在 `docs/CHANGELOG.md` 顶部新增条目（按现有格式）：

```
- feat(web): 达人头像卡支持粘贴链接（TikTok/Instagram/YouTube/微博）自动解析 handle/粉丝/获赞/互动率字段（前端 mock）。
```

- [ ] **Step 4: 提交**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: changelog 达人头像卡链接解析"
```

---

## Self-Review 已检查项

- Spec §3 数据结构 → Task 1 ✓
- Spec §4 解析模块（detectPlatform + parseCreatorLink）→ Task 2/3 ✓
- Spec §5 PropertyPanel 面板 → Task 6 ✓
- Spec §6 卡片渲染 KPI 行 → Task 4 ✓
- Spec §7 registry 字段 → Task 5 ✓
- Spec §8 错误处理 → Task 6 测试覆盖（空输入 / 不支持平台）✓
- Spec §9 测试 → Task 2/3/4/6 ✓
- 命名一致性：`parseCreatorLink` / `detectPlatform` / `CreatorLinkImporter` / `StatsLine` 全程一致 ✓
- 无占位符；每个代码步骤含完整可粘贴代码 ✓
