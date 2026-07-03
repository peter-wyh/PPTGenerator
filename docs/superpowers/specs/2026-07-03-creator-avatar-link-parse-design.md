# 达人头像卡 · 链接解析迭代（迭代 1）

> 日期：2026-07-03
> 范围：`creator-avatar-card` 组件
> 目标：支持在属性面板粘贴达人链接，自动解析并填充相关达人字段。

## 1. 背景与现状

`creator-avatar-card` 是达人领域的业务组件，渲染层 `apps/web/src/editor/components/CreatorComponents.tsx`，数据结构 `CreatorAvatarCardData`（`packages/shared/src/index.ts`），属性编辑在 `apps/web/src/editor/PropertyPanel.tsx`。

当前字段：`variant / avatar / name / platform / tier / intro`，**编辑完全手动**，代码库中没有任何链接解析 / 抓取能力，唯一的达人数据是前端 mock（`apps/web/src/api/creators.ts`）。

本次为「链接解析」迭代的第一步：**前端 mock 占位**，跑通「粘链接 → 自动填字段」的链路与 UI。后续接入真实数据源时只替换解析器内部实现，接口与 UI 不变。

## 2. 决策

- **数据来源：前端 mock**（不新增后端接口、不抓真实页面）。
- **支持平台：TikTok / Instagram / YouTube / 微博**（本期不含小红书）。
- **解析策略：方案 A — 纯按 URL 确定性哈希生成数据。** 任意上述平台链接都能解析、永不报错、相同链接结果一致。零 fixture 维护。
- **字段范围：扩展示制数据** —— 在现有字段外增加影响力字段，并在卡片上展示。

## 3. 数据结构变更

`packages/shared/src/index.ts` 的 `CreatorAvatarCardData` 增加可选字段（向后兼容）：

```ts
export interface CreatorAvatarCardData {
  variant: CreatorAvatarVariant;
  avatar: string;
  name: string;
  platform: CreatorPlatform;
  tier: CreatorTier;
  intro: string;
  // —— 新增（链接解析产出，可选）——
  sourceUrl?: string;     // 解析来源链接，便于复解析 / 展示
  handle?: string;        // @handle
  followers?: string;     // 粉丝数，如 "1.28M"
  likes?: string;         // 获赞数，如 "12.4M"
  engagement?: string;    // 互动率，如 "8.7%"
}
```

约定：`tier` 不参与解析（编辑层人工判定），解析结果不含 `tier`。

## 4. 新建链接解析模块

新文件：`apps/web/src/editor/creatorLink.ts`，纯前端 mock，无网络请求。

导出：

```ts
detectPlatform(url: string): CreatorPlatform | null;
parseCreatorLink(url: string): Promise<Partial<CreatorAvatarCardData>>;
```

### 4.1 `detectPlatform`

按 URL host 匹配（大小写不敏感，支持带/不带 `www.`、`m.`、`http(s)://`）：

- `tiktok.com` → `tiktok`
- `instagram.com` → `instagram`
- `youtube.com` / `youtu.be` → `youtube`
- `weibo.com` / `weibo.cn` → `weibo`

其余 host（含 `xiaohongshu.com` / `xhslink.com`）→ `null`。

### 4.2 `parseCreatorLink`

- 先 `detectPlatform`；为 `null` → 抛错（调用方提示「暂不支持该平台」）。
- 否则用 URL 字符串做**确定性哈希**（FNV-1a 32 位；**禁止用 `Math.random` / `Date.now`**，须保证可重复测试）。
- 由哈希派生：
  - `platform`：来自 detectPlatform。
  - `handle`：`@` + 基于哈希的小写字母串（如 `@miaglowup`）。
  - `name`：首字母大写的姓名模板（给定名/姓池，按哈希取）。
  - `avatar`：seed 化的占位头像 URL（DiceBear `https://api.dicebear.com/7.x/initials/svg?seed=...`，纯前端、稳定、无鉴权）。
  - `followers`：在区间内映射成易读字符串（如 `1.28M` / `684K` / `86K`），随平台/哈希分层。
  - `likes`：同上，量级大于 followers。
  - `engagement`：百分比字符串（如 `8.7%`）。
  - `intro`：模板 `{name} · {category} Creator · {handle}`，category 按哈希从池取。
  - `sourceUrl`：回填输入的 URL。
- 返回前 `await` 一个 ~400ms 模拟延迟（与现有 `listCreators` 风格一致）。
- 相同 URL 两次调用必须返回相同结果。

## 5. PropertyPanel：链接解析面板

`apps/web/src/editor/PropertyPanel.tsx` 内新增 `CreatorLinkImporter` 子组件，仿现有 `BusinessFields` / `BindingEditor` 的特化区模式。当选中组件 `type === 'creator-avatar-card'` 时，在「属性」组上方渲染该面板。

```
┌ 达人链接解析 ──────────────────────┐
│ [粘贴达人主页/视频链接…        ] │
│ [解析]                            │
│ (loading…  /  红色错误文案)       │
└──────────────────────────────────┘
```

行为：

- 输入框受控，默认值取已有 `sourceUrl`。
- 点「解析」：
  1. 校验非空 → 否则提示「请粘贴达人链接」。
  2. 调 `parseCreatorLink`，期间禁用按钮 + loading 文案。
  3. 成功 → `updateComponentData(id, parsed)` 一次性写入 `platform/avatar/name/handle/followers/likes/engagement/intro/sourceUrl`，**保留 `variant` 与 `tier`**；随后 `commit()` 进 history。
  4. 失败（不支持平台 / 抛错）→ 面板内红色提示，不动数据。

`sourceUrl` 不进 `propertySchema`（由本面板专门管理，避免与文本字段重复编辑）。

## 6. 卡片渲染扩展

`apps/web/src/editor/components/CreatorComponents.tsx`：

- 新增一个小型 `Stats` 子组件：当存在 `followers/likes/engagement` 中任意一项时，渲染一行小字 KPI（如 `粉丝 1.28M · 获赞 12.4M · 互动 8.7%`），缺哪项省哪项。
- `AvatarHorizontal`：简介下方插入该行。
- `AvatarVertical`：简介下方插入该行。
- `AvatarCompact`：空间紧张，**不显示**新字段，保持现状。
- 无任何新字段时不渲染该行（老数据外观不变）。

## 7. registry 字段补充

`apps/web/src/editor/registry.tsx` 中 `creator-avatar-card` 的 `propertySchema` 增加 `handle / followers / likes / engagement` 四个 `text` 字段，便于解析后人工微调或单独编辑；保留现有 `avatar / name / platform / tier / intro`。

## 8. 错误处理 / 边界

- 空输入 → 「请粘贴达人链接」。
- 不支持平台 → 「暂仅支持 TikTok / Instagram / YouTube / 微博 链接」。
- 解析中禁用按钮，防重复点击。
- 老数据（无新字段）渲染与编辑均正常，向后兼容。

## 9. 测试

- `apps/web/src/editor/creatorLink.test.ts`（纯函数）：
  - `detectPlatform`：四平台 host 正例、`www./m.` 变体、`youtu.be`、不支持 host（含小红书）返回 `null`。
  - `parseCreatorLink`：同一 URL 两次调用 deep-equal（确定性）；返回对象含约定字段且 `platform` 正确；不支持的 URL reject。
- PropertyPanel 交互（可选，按现有 `MemoryRouter` 包裹写法）：粘贴支持平台链接 → 点解析 → loading → 选中组件 data 被填入解析字段、`variant/tier` 不变。

## 10. 不在本期范围（YAGNI）

- 真实后端抓取 / 第三方 API（后续迭代）。
- 小红书链接支持（本期明确排除）。
- 将 `sourceUrl` 渲染为可点击外链。
- 解析「作品列表 / 数据条」等其它达人组件（仅头像卡）。

## 11. 触点清单

1. `packages/shared/src/index.ts` — `CreatorAvatarCardData` 加可选字段。
2. `apps/web/src/editor/creatorLink.ts` — 新文件。
3. `apps/web/src/editor/components/CreatorComponents.tsx` — 卡片渲染 KPI 行。
4. `apps/web/src/editor/PropertyPanel.tsx` — 新增 `CreatorLinkImporter`。
5. `apps/web/src/editor/registry.tsx` — `propertySchema` 补字段。
6. （测试）`apps/web/src/editor/creatorLink.test.ts`，可选交互测试。
