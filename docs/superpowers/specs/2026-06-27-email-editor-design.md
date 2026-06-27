# 邮件编辑器还原（Digchic）设计文档

**日期**：2026-06-27
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划
**还原来源**：`ai_studio_code-40.html`（Digchic 邮件编辑器，原生 JS 单文件）——1:1 还原其功能
**宿主**：`apps/web`（已交付的 React 前端）

---

## 1. 背景与目标

把 `ai_studio_code-40.html`（左侧表单 + 右侧 iframe 实时预览 + 复制 HTML 的邮件编辑器）**1:1 还原**为 `apps/web` 里的一个新路由 `/email-editor`，纯前端、不接后端，打开即与原文件表现一致。

### 1.1 范围（含）

- 左 480px 表单栏：折叠分区 **Header / Top Deals×3 / Featured / Fashion×6 / Beauty×3**，每项 brand/text/image/link 等字段；图片输入带预览
- 右 iframe `srcDoc` 实时预览生成的邮件 HTML
- 右上「复制代码」按钮 → `navigator.clipboard.writeText`
- 数据在内存，预填原文件的 `emailData`（默认展开第一区）
- 复用 app 视觉 token（主色 `#FF099E`，但生成的邮件 HTML 内部样式按原文件品红 `#FF099E`）

### 1.2 非目标（YAGNI）

- 后端持久化 / 模板保存加载 / 多模板切换 / 邮件发送
- 图片上传（仅 URL）
- 改动原文件的邮件 HTML 模板结构（忠实复刻，不重新设计邮件版式）

---

## 2. 数据模型（port 自原 `emailData`）

新增到 `packages/shared/src/index.ts`：

```ts
export interface EmailDealItem {
  brand: string
  text: string
  img: string
  link: string
}

export interface EmailProductItem {
  brand: string
  name: string
  discount: string
  img: string
  link: string
}

export interface EmailFeatureDetail {
  img: string
  text: string
}

export interface EmailFeature {
  title: string
  intro: string
  mainImg: string
  prodName: string
  btnText: string
  btnLink: string
  details: EmailFeatureDetail[]
}

export interface EmailData {
  header: { logo: string; subtitle: string }
  hero: { title: string }
  topDeals: EmailDealItem[]      // 3 项
  date: string
  feature: EmailFeature          // details 3 项
  fashion: EmailProductItem[]    // 6 项
  beauty: EmailProductItem[]     // 3 项
}
```

预填数据 = 原文件 `emailData` 的值（logo/subtitle/title/各 brand/text/img/link 等），作为 `defaultEmailData` 常量。

---

## 3. 状态：Zustand `emailEditor` store（`apps/web/src/email-editor/store.ts`）

```ts
interface EmailEditorState {
  data: EmailData
  update: (updater: (draft: EmailData) => void) => void  // 不可变更新
  setField: (path: (string|number)[], value: string) => void  // 通用字段写
  reset: () => void
}
```

- `update` 接受一个对 `data` 做结构化克隆后修改的回调（或用展开）。表单组件按区/项绑字段调 `setField`。
- 受控输入直接读 `data.header.logo` 等；onChange → `setField(['header','logo'], val)`。

> 用 Zustand 与 app 一致；不引 immer（YAGNI），用展开/结构化克隆即可。

---

## 4. `generateEmailHtml(data: EmailData): string`（核心纯函数）

`apps/web/src/email-editor/generateHtml.ts`，port 自原文件 `generateHTML()` + `renderGrid()`：

- 返回完整 `<!DOCTYPE html>...</html>` 字符串
- table 布局、内联样式、`width=600` 居中容器
- 区块顺序：HEADER（logo+subtitle）→ HERO（title）→ TOP DEALS（3 列）→ DATE → FEATURED（品红标题条 + 主图 + 3 details + 按钮）→ FASHION（3×2 grid）→ BEAUTY（3 grid）→ FOOTER（黑底）
- 品红 `#FF099E` 用于 brand 文字、按钮、featured 标题条；折扣红 `#d32f2f`
- 含 `<style>` 移动端 `@media (max-width:600px)` stack 适配
- `renderGrid(list)`：每 3 个一行 `<tr>`，每项 brand/name/discount/img/「VISIT NOW」按钮

**契约**：纯函数，相同 `data` → 相同字符串；无副作用。可单测。

---

## 5. UI 组件（`apps/web/src/email-editor/`）

| 组件 | 职责 |
|---|---|
| `EmailEditor.tsx` | 两栏布局：左 `<EmailSidebar>` + 右 `<EmailPreview>` |
| `EmailSidebar.tsx` | 渲染 5 个 `<Section>`（Header/Top Deals/Featured/Fashion/Beauty），默认展开第一个 |
| `Section.tsx` | 折叠卡：点击 header 切换 `active`，body 渲染输入组（复用既有 `Input`） |
| `FieldImage.tsx` | 图片 URL 输入 + 下方 `<img>` 预览（src 变化显示/隐藏） |
| `EmailPreview.tsx` | `<iframe srcDoc={generateEmailHtml(data)} title="preview">` + 绝对定位「复制代码」按钮（复制成功文案变「已复制 ✓」2s） |

样式：沿用 app token（卡片白底 6px 圆角、`#dcdfe6` 边框、`#fafafa` 内容区），与原文件视觉一致。

---

## 6. 路由 & 入口

- 新路由 `/email-editor`，挂 **Layout 下**（复用登录态 + 顶栏「← 返回 /projects」），主区渲染 `<EmailEditor>`。
- `apps/web/src/routes/Projects.tsx` 顶栏区加一个「邮件编辑器」按钮 → `navigate('/email-editor')`。
- `router.tsx` 在受保护 children 加 `{ path: 'email-editor', element: <EmailEditor /> }`。

> 放 Layout 下（非公开路由）以与 app 认证一致；原文件无认证，但宿主 app 全站登录，不破例。

---

## 7. 复制

`navigator.clipboard.writeText(generateEmailHtml(data))`：
- 成功 → 按钮文案临时变「已复制 ✓」2s 后恢复「复制代码」
- 失败（拒绝/无权限）→ 文案变「复制失败」2s
- 用 `useState` 管理按钮态，不进 store

---

## 8. 测试（vitest + @testing-library）

- **`generateHtml.test.ts`**（核心）：给定 `defaultEmailData` → 输出含 `logo URL`、各 brand（如 `LAURA GELLER`）、`<table`、`VISIT NOW`、`@media`、`#FF099E`；改某字段 → 输出相应变化。
- **`EmailEditor.test.tsx`**：改 Header logo 输入 → iframe `srcDoc` 重新渲染（断言 srcDoc 含新值）；Section 折叠/展开。
- **复制**：`vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })`，点按钮 → `writeText` 被调，参数含 `<table`。

---

## 9. 不在范围（显式）

后端持久化 / 模板 CRUD / 多模板 / 发送 / 图片上传 / 邮件版式重设计。

---

## 10. 原文件参考行号（供 plan）

`emailData` 定义 `ai_studio_code-40.html:156`｜`generateHTML` `:220`｜`renderGrid` `:224`｜`initEditor`（表单构建）`:337`｜`createInput` `:341`｜`createSection` `:375`｜`refresh`（srcdoc）`:472`｜`copyHTML` `:476`。
