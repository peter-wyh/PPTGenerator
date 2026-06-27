# 邮件编辑器还原（Digchic）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 新增 `/email-editor` 路由，1:1 还原 `ai_studio_code-40.html`：左侧表单分区编辑 + 右侧 iframe `srcDoc` 实时预览 + 复制 HTML，纯前端、内存数据预填原文件。

**Architecture:** Zustand `emailEditor` store 持 `EmailData` + `setField(path,value)`；`generateEmailHtml(data)` 是 port 自原文件的纯函数（table+内联样式邮件 HTML）；UI 为左表单栏（折叠 Section + Input + 图片预览）+ 右 iframe 预览 + 复制按钮。路由挂 Layout 下，从项目页入口进入。

**Tech Stack:** React 18 · TypeScript · Zustand · TailwindCSS · vitest · @testing-library/react。（复用既有 `Input` 组件、`packages/shared`。）

**对应 spec：** `docs/superpowers/specs/2026-06-27-email-editor-design.md`。**原文件参考行号**：`emailData` `ai_studio_code-40.html:156`｜`generateHTML` `:220`｜`renderGrid` `:224`｜`initEditor` `:337`｜`createInput` `:341`｜`createSection` `:375`｜`refresh` `:472`｜`copyHTML` `:476`。

---

## 前置条件

- `apps/web` 已交付（auth / router / Layout / `Input` 组件）。
- **建议在独立分支执行**（`git checkout -b email-editor`），不在 `main` 写代码。

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `packages/shared/src/index.ts` | 修改 | 加 `EmailData` 及子类型 |
| `apps/web/src/email-editor/defaultData.ts` | 新建 | `defaultEmailData`（原文件 emailData 值） |
| `apps/web/src/email-editor/generateHtml.ts` | 新建 | `generateEmailHtml(data): string`（port 自原 generateHTML+renderGrid） |
| `apps/web/src/email-editor/store.ts` | 新建 | Zustand store（data + setField + reset） |
| `apps/web/src/email-editor/Section.tsx` | 新建 | 折叠卡 |
| `apps/web/src/email-editor/FieldImage.tsx` | 新建 | 图片 URL 输入 + 预览 |
| `apps/web/src/email-editor/EmailSidebar.tsx` | 新建 | 5 个 Section 的表单 |
| `apps/web/src/email-editor/EmailPreview.tsx` | 新建 | iframe srcDoc + 复制按钮 |
| `apps/web/src/email-editor/EmailEditor.tsx` | 新建 | 两栏布局 |
| `apps/web/src/router.tsx` | 修改 | 加 `/email-editor` 路由 |
| `apps/web/src/routes/Projects.tsx` | 修改 | 加「邮件编辑器」入口按钮 |
| `apps/web/tests/email-editor/{generateHtml,editor}.test.tsx` | 新建 | 测试 |

---

## Task 1: shared 类型 + defaultEmailData + generateEmailHtml（核心纯函数，TDD）

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/email-editor/defaultData.ts`、`apps/web/src/email-editor/generateHtml.ts`
- Create: `apps/web/tests/email-editor/generateHtml.test.ts`

- [ ] **Step 1: 在 `packages/shared/src/index.ts` 末尾追加邮件类型**

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
  topDeals: EmailDealItem[]
  date: string
  feature: EmailFeature
  fashion: EmailProductItem[]
  beauty: EmailProductItem[]
}
```

- [ ] **Step 2: 创建 `apps/web/src/email-editor/defaultData.ts`（原文件 emailData 值）**

```ts
import type { EmailData } from '@ppt-generator/shared'

export const defaultEmailData: EmailData = {
  header: {
    logo: 'https://gd-hbimg.huaban.com/4a592b4730e2b4ebf6c9ab7dc6a27aaa139812c47d29-3Wrjs3',
    subtitle: 'EMPOWERING BRANDS, ELEVATING CREATORS',
  },
  hero: { title: 'DEALS OF THE WEEK' },
  topDeals: [
    {
      brand: 'LAURA GELLER',
      text: 'Up To 50% Off Site Wide + Extra 10% Off + 1/2 Off Blushes!',
      img: 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://www.laurageller.com',
    },
    {
      brand: 'CRICUT',
      text: 'Up to 50% off bundles, up to 80% OFF on Materials & Accessories.',
      img: 'https://images.pexels.com/photos/4226896/pexels-photo-4226896.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://cricut.com',
    },
    {
      brand: 'BURROW',
      text: 'Up to 60% Off Sale Moved to Wednesday, August 21st!',
      img: 'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://burrow.com',
    },
  ],
  date: '21th OF Aug',
  feature: {
    title: 'TOP FEATURED OFFER',
    intro: 'NEW from AirEssentials',
    mainImg: 'https://images.pexels.com/photos/9558577/pexels-photo-9558577.jpeg?auto=compress&cs=tinysrgb&w=600&h=700&dpr=1&fit=crop',
    prodName: 'AirEssentials Gathered Waist Dress',
    btnText: 'VISIT NOW',
    btnLink: '#',
    details: [
      { img: 'https://images.pexels.com/photos/720606/pexels-photo-720606.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: 'Light-as-air fabric' },
      { img: 'https://images.pexels.com/photos/4937222/pexels-photo-4937222.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: 'Fine knit structure' },
      { img: 'https://images.pexels.com/photos/4937224/pexels-photo-4937224.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: '4-way stretch' },
    ],
  },
  fashion: [
    { brand: 'SPANX', name: 'Longline Medium Impact Sports Bra', discount: '70% OFF', img: 'https://images.pexels.com/photos/3094215/pexels-photo-3094215.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'SPANX', name: 'AirEssentials Tie-Waist Bermuda', discount: '50% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1591195853828-11db59a44f6b&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'SPANX', name: 'Suit Yourself V-Neck Ribbed Bodysuit', discount: '50% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1583846783214-7229a91b20ed&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'MR PORTER', name: 'N.05 Round-Frame Acetate Sunglasses', discount: '30% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1577803645773-f96470509666&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: "David's Bridal", name: 'Tulle and Beaded Lace Wedding Dress', discount: '40% OFF', img: 'https://images.pexels.com/photos/258421/pexels-photo-258421.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'MR PORTER', name: 'Pursuit Logo-Embossed Rubber Slides', discount: '25% OFF', img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=375&q=80', link: '#' },
  ],
  beauty: [
    { brand: 'LOOKFANTASTIC', name: 'Garnier Ambre Solaire Protection Spray', discount: '20% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1620916566398-39f1143ab7be&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'LOOKFANTASTIC', name: 'NARS Radiant Creamy Concealer', discount: '15% OFF', img: 'https://images.pexels.com/photos/4938506/pexels-photo-4938506.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'LOOKFANTASTIC', name: 'Estée Lauder Double Wear Stay-in-Place', discount: '20% OFF', img: 'https://images.pexels.com/photos/3334759/pexels-photo-3334759.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
  ],
}
```

- [ ] **Step 3: 写失败测试 `apps/web/tests/email-editor/generateHtml.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { generateEmailHtml } from '../../src/email-editor/generateHtml'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('generateEmailHtml', () => {
  const html = generateEmailHtml(defaultEmailData)

  it('is a full HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.includes('</html>')).toBe(true)
  })

  it('contains the logo and subtitle', () => {
    expect(html).toContain(defaultEmailData.header.logo)
    expect(html).toContain(defaultEmailData.header.subtitle)
  })

  it('contains brands from each section', () => {
    expect(html).toContain('LAURA GELLER')
    expect(html).toContain('AirEssentials Gathered Waist Dress')
    expect(html).toContain('SPANX')
    expect(html).toContain('LOOKFANTASTIC')
  })

  it('uses primary #FF099E and discount red', () => {
    expect(html).toContain('#FF099E')
    expect(html).toContain('#d32f2f')
  })

  it('includes the mobile stack media query', () => {
    expect(html).toContain('@media')
    expect(html).toContain('stack-column')
  })

  it('reflects edited data', () => {
    const edited = { ...defaultEmailData, hero: { title: 'MEGA SALE' } }
    expect(generateEmailHtml(edited)).toContain('MEGA SALE')
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test email-editor/generateHtml`
预期：FAIL（`generateEmailHtml` 未导出）。

- [ ] **Step 5: 创建 `apps/web/src/email-editor/generateHtml.ts`（port 自原文件）**

```ts
import type { EmailData, EmailProductItem } from '@ppt-generator/shared'

function renderGrid(list: EmailProductItem[]): string {
  let html = ''
  for (let i = 0; i < list.length; i++) {
    if (i % 3 === 0) html += '<tr>'
    html += `
                    <td class="stack-column" valign="top" width="33.33%" style="padding: 10px 5px;">
                        <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FF099E;text-transform:uppercase;margin:0 0 5px 0;">${list[i].brand}</p>
                        <h4 style="font-family:Arial,sans-serif;font-size:14px;font-weight:400;margin:0 0 5px 0;height:36px;overflow:hidden;line-height:1.2;color:#000000;">${list[i].name}</h4>
                        <p style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#d32f2f;margin:0 0 10px 0;">${list[i].discount}</p>
                        <a href="${list[i].link}" style="display:block;">
                            <img src="${list[i].img}" width="300" height="375" style="width:100%;height:375px;display:block;object-fit:cover;margin-bottom:15px;border-radius:2px;">
                        </a>
                        <div style="text-align:center;">
                            <a href="${list[i].link}" style="background-color:#FF099E;color:#ffffff;padding:10px 20px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;text-decoration:none;text-transform:uppercase;display:inline-block;border-radius:2px;">VISIT NOW</a>
                        </div>
                    </td>
                `
    if (i % 3 === 2 || i === list.length - 1) html += '</tr>'
  }
  return html
}

export function generateEmailHtml(d: EmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${d.hero.title}</title>
<style>
body{margin:0;padding:0;background-color:#ffffff;font-family:Arial,sans-serif;}
@media screen and (max-width: 600px) {
    .email-container{width:100%!important;}
    .stack-column{display:block!important;width:100%!important;padding-bottom:30px;}
    img{width:100%!important;height:auto!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center">
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="margin:0 auto;max-width:600px;">
            <tr><td align="center" style="padding:40px 0 10px 0;"><a href="#"><img src="${d.header.logo}" width="240" style="display:block;border:0;"></a></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;"><p style="font-size:11px;color:#666;letter-spacing:2px;margin:0;">${d.header.subtitle}</p><div style="height:1px;background:#e0e0e0;margin-top:20px;"></div></td></tr>
            <tr><td align="center" style="padding:0 32px 30px 32px;"><h1 style="font-size:48px;line-height:1;margin:0;text-transform:uppercase;">${d.hero.title}</h1></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                    ${d.topDeals
                      .map(
                        (item) => `
                    <td class="stack-column" valign="top" width="33.33%" style="padding-right:10px;">
                        <a href="${item.link}"><img src="${item.img}" width="170" height="110" style="width:100%;height:110px;object-fit:cover;margin-bottom:12px;background:#f4f4f4;"></a>
                        <p style="margin:0 0 5px 0;font-size:12px;font-weight:700;color:#FF099E;">${item.brand}</p>
                        <p style="margin:0;font-size:13px;line-height:1.4;">${item.text}</p>
                    </td>`,
                      )
                      .join('')}
                </tr></table>
            </td></tr>
            <tr><td align="center" style="padding-bottom:25px;"><div style="height:1px;background:#e0e0e0;margin-bottom:20px;"></div><span style="font-size:18px;font-weight:900;">${d.date}</span><div style="height:1px;background:#e0e0e0;margin-top:20px;"></div></td></tr>
            <tr><td bgcolor="#FF099E" align="center" style="padding:15px 32px;"><h2 style="margin:0;color:#fff;font-size:30px;">${d.feature.title}</h2></td></tr>
            <tr><td align="center" style="padding:30px 32px 40px 32px;">
                <p style="font-size:20px;margin:0 0 20px 0;">${d.feature.intro}</p>
                <a href="${d.feature.btnLink}"><img src="${d.feature.mainImg}" width="536" style="width:100%;height:auto;display:block;margin-bottom:30px;"></a>
                <h3 style="font-size:22px;margin:0 0 25px 0;">${d.feature.prodName}</h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                    ${d.feature.details
                      .map(
                        (det) => `
                    <td class="stack-column" valign="top" width="33.33%" align="center" style="padding:0 5px;">
                        <img src="${det.img}" width="300" height="400" style="width:100%;height:auto;margin-bottom:15px;">
                        <p style="margin:0;font-size:14px;font-weight:900;">${det.text}</p>
                    </td>`,
                      )
                      .join('')}
                </tr></table>
                <div style="padding-top:40px;"><a href="${d.feature.btnLink}" style="background:#FF099E;color:#fff;padding:14px 40px;text-decoration:none;font-weight:bold;display:inline-block;">${d.feature.btnText}</a></div>
            </td></tr>
            <tr><td style="padding:20px 32px 10px 32px;"><h3 style="margin:0;font-size:18px;border-bottom:1px solid #ccc;padding-bottom:10px;">FASHION</h3></td></tr>
            <tr><td align="center" style="padding:0 32px 40px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    ${renderGrid(d.fashion)}
                </table>
            </td></tr>
            <tr><td style="padding:20px 32px 10px 32px;"><h3 style="margin:0;font-size:18px;border-bottom:1px solid #ccc;padding-bottom:10px;">BEAUTY</h3></td></tr>
            <tr><td align="center" style="padding:0 32px 60px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    ${renderGrid(d.beauty)}
                </table>
            </td></tr>
            <tr><td bgcolor="#000000" align="center" style="padding:40px 32px;color:#999;font-size:13px;">
                <p style="margin-bottom:20px;color:#fff;">UNSUBSCRIBE | PRIVACY POLICY | WEB</p>
                <p>Thank you for your support.</p>
            </td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>`
}
```

- [ ] **Step 6: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test email-editor/generateHtml`
预期：6 passed。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/index.ts apps/web/src/email-editor/defaultData.ts apps/web/src/email-editor/generateHtml.ts apps/web/tests/email-editor/generateHtml.test.ts
git commit -m "$(cat <<'EOF'
feat(web): email-editor types + defaultData + generateEmailHtml

Port EmailData model and the original emailData values; generateEmailHtml
is a pure function (table+inline-style email HTML with mobile stack
media query) covered by 6 unit tests.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 2: emailEditor store + setField

**Files:**
- Create: `apps/web/src/email-editor/store.ts`
- Create: `apps/web/tests/email-editor/store.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/email-editor/store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useEmailEditorStore } from '../../src/email-editor/store'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('emailEditor store', () => {
  beforeEach(() => {
    useEmailEditorStore.setState({ data: structuredClone(defaultEmailData) })
  })

  it('setField updates a nested scalar by path', () => {
    useEmailEditorStore.getState().setField(['header', 'logo'], 'NEW_LOGO')
    expect(useEmailEditorStore.getState().data.header.logo).toBe('NEW_LOGO')
  })

  it('setField updates an array item field', () => {
    useEmailEditorStore.getState().setField(['topDeals', 0, 'brand'], 'NEWBRAND')
    expect(useEmailEditorStore.getState().data.topDeals[0].brand).toBe('NEWBRAND')
    // 其他项不变
    expect(useEmailEditorStore.getState().data.topDeals[1].brand).toBe('CRICUT')
  })

  it('setField updates feature nested detail', () => {
    useEmailEditorStore.getState().setField(['feature', 'details', 1, 'text'], 'x')
    expect(useEmailEditorStore.getState().data.feature.details[1].text).toBe('x')
  })

  it('reset restores defaultEmailData', () => {
    useEmailEditorStore.getState().setField(['header', 'logo'], 'X')
    useEmailEditorStore.getState().reset()
    expect(useEmailEditorStore.getState().data.header.logo).toBe(defaultEmailData.header.logo)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test email-editor/store`
预期：FAIL（store 未导出）。

- [ ] **Step 3: 创建 `apps/web/src/email-editor/store.ts`**

```ts
import { create } from 'zustand'
import type { EmailData } from '@ppt-generator/shared'
import { defaultEmailData } from './defaultData'

type Path = (string | number)[]

function setAtPath(obj: unknown, path: Path, value: string): unknown {
  if (path.length === 0) return value
  const [head, ...rest] = path
  const idx = typeof head === 'number' ? head : head
  if (Array.isArray(obj)) {
    const next = obj.slice()
    next[idx as number] = setAtPath(obj[idx as number], rest, value)
    return next
  }
  return { ...(obj as object), [idx]: setAtPath((obj as Record<string, unknown>)[idx as string], rest, value) }
}

interface EmailEditorState {
  data: EmailData
  setField: (path: Path, value: string) => void
  reset: () => void
}

export const useEmailEditorStore = create<EmailEditorState>((set) => ({
  data: structuredClone(defaultEmailData),
  setField: (path, value) => set((s) => ({ data: setAtPath(s.data, path, value) as EmailData })),
  reset: () => set({ data: structuredClone(defaultEmailData) }),
}))
```

> `setAtPath` 不可变更新（数组 slice / 对象展开），按 `string|number` 路径递归。`structuredClone` 深拷贝默认数据避免共享引用。

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test email-editor/store`
预期：4 passed。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/email-editor/store.ts apps/web/tests/email-editor/store.test.ts
git commit -m "$(cat <<'EOF'
feat(web): emailEditor zustand store + setField(path,value)

Immutable nested update by string|number path; reset restores defaults.
structuredClone keeps default data free of shared refs.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Section + FieldImage + EmailSidebar 表单

**Files:**
- Create: `apps/web/src/email-editor/Section.tsx`、`apps/web/src/email-editor/FieldImage.tsx`、`apps/web/src/email-editor/EmailSidebar.tsx`

- [ ] **Step 1: 创建 `apps/web/src/email-editor/Section.tsx`（折叠卡）**

```tsx
import { useState, type ReactNode } from 'react'

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3 overflow-hidden rounded border border-edge bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-neutral-50 px-4 py-3 text-left text-sm font-bold text-neutral-700 hover:bg-neutral-100"
      >
        <span>{title}</span>
        <span className="text-neutral-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 2: 创建 `apps/web/src/email-editor/FieldImage.tsx`（图片 URL + 预览）**

```tsx
import { Input } from '../components/Input'

export function FieldImage({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <div className="mt-1 rounded bg-neutral-100 p-1 text-center">
          <img src={value} alt="" className="mx-auto max-h-20 max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建 `apps/web/src/email-editor/EmailSidebar.tsx`（5 个 Section 的表单）**

```tsx
import { useEmailEditorStore } from './store'
import { Section } from './Section'
import { FieldImage } from './FieldImage'
import { Input } from '../components/Input'

export function EmailSidebar() {
  const data = useEmailEditorStore((s) => s.data)
  const setField = useEmailEditorStore((s) => s.setField)
  const f = setField // 别名缩短

  return (
    <aside className="w-[480px] shrink-0 overflow-y-auto border-r border-edge bg-neutral-50 p-5">
      <h2 className="mb-4 text-base font-bold text-neutral-700">邮件编辑器</h2>

      <Section title="1. 头部 Header" defaultOpen>
        <FieldImage label="Logo URL" value={data.header.logo} onChange={(v) => f(['header', 'logo'], v)} />
        <div className="mb-3"><Input label="Sub Title" value={data.header.subtitle} onChange={(e) => f(['header', 'subtitle'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Main Title" value={data.hero.title} onChange={(e) => f(['hero', 'title'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Date Text" value={data.date} onChange={(e) => f(['date'], e.target.value)} /></div>
      </Section>

      <Section title="2. 顶部精选 Top Deals (3)">
        {data.topDeals.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Item {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['topDeals', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Text" value={item.text} onChange={(e) => f(['topDeals', i, 'text'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['topDeals', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['topDeals', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="3. 主推大图 Featured">
        <div className="mb-3"><Input label="Title" value={data.feature.title} onChange={(e) => f(['feature', 'title'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Intro" value={data.feature.intro} onChange={(e) => f(['feature', 'intro'], e.target.value)} /></div>
        <FieldImage label="Main Img" value={data.feature.mainImg} onChange={(v) => f(['feature', 'mainImg'], v)} />
        <div className="mb-3"><Input label="Prod Name" value={data.feature.prodName} onChange={(e) => f(['feature', 'prodName'], e.target.value)} /></div>
        <div className="mb-3"><Input label="Btn Text" value={data.feature.btnText} onChange={(e) => f(['feature', 'btnText'], e.target.value)} /></div>
        {data.feature.details.map((det, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Detail {i + 1}</div>
            <FieldImage label="Img" value={det.img} onChange={(v) => f(['feature', 'details', i, 'img'], v)} />
            <div className="mb-3"><Input label="Text" value={det.text} onChange={(e) => f(['feature', 'details', i, 'text'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="4. 时尚区 Fashion (6)">
        {data.fashion.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Product {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['fashion', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Name" value={item.name} onChange={(e) => f(['fashion', i, 'name'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Discount" value={item.discount} onChange={(e) => f(['fashion', i, 'discount'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['fashion', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['fashion', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>

      <Section title="5. 美妆区 Beauty (3)">
        {data.beauty.map((item, i) => (
          <div key={i} className="mb-2 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-xs font-bold uppercase text-primary">Product {i + 1}</div>
            <div className="mb-3"><Input label="Brand" value={item.brand} onChange={(e) => f(['beauty', i, 'brand'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Name" value={item.name} onChange={(e) => f(['beauty', i, 'name'], e.target.value)} /></div>
            <div className="mb-3"><Input label="Discount" value={item.discount} onChange={(e) => f(['beauty', i, 'discount'], e.target.value)} /></div>
            <FieldImage label="Image" value={item.img} onChange={(v) => f(['beauty', i, 'img'], v)} />
            <div className="mb-3"><Input label="Link" value={item.link} onChange={(e) => f(['beauty', i, 'link'], e.target.value)} /></div>
          </div>
        ))}
      </Section>
    </aside>
  )
}
```

- [ ] **Step 4: typecheck 确认编译**

运行：`pnpm --filter @ppt-generator/web typecheck`
预期：0 错误。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/email-editor/Section.tsx apps/web/src/email-editor/FieldImage.tsx apps/web/src/email-editor/EmailSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(web): email-editor sidebar (collapsible sections + image fields)

Section toggle card; FieldImage (URL input + preview); EmailSidebar
renders all 5 sections (Header/Top Deals/Featured/Fashion/Beauty) bound
to the store via setField paths.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 4: EmailPreview（iframe srcDoc + 复制按钮）

**Files:**
- Create: `apps/web/src/email-editor/EmailPreview.tsx`
- Create: `apps/web/tests/email-editor/preview.test.tsx`

- [ ] **Step 1: 创建 `apps/web/src/email-editor/EmailPreview.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useEmailEditorStore } from './store'
import { generateEmailHtml } from './generateHtml'

export function EmailPreview() {
  const data = useEmailEditorStore((s) => s.data)
  const html = useMemo(() => generateEmailHtml(data), [data])
  const [btnLabel, setBtnLabel] = useState('复制代码')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(html)
      setBtnLabel('已复制 ✓')
    } catch {
      setBtnLabel('复制失败')
    }
    setTimeout(() => setBtnLabel('复制代码'), 2000)
  }

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-auto bg-neutral-200 p-8">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-8 top-8 z-10 rounded bg-primary px-5 py-2 text-sm font-bold text-white shadow hover:bg-primary-hover"
      >
        {btnLabel}
      </button>
      <iframe title="email-preview" srcDoc={html} className="h-[1200px] w-[650px] max-w-full border-none bg-white shadow-lg" />
    </div>
  )
}
```

- [ ] **Step 2: 写测试 `apps/web/tests/email-editor/preview.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEmailEditorStore } from '../../src/email-editor/store'
import { EmailPreview } from '../../src/email-editor/EmailPreview'
import { defaultEmailData } from '../../src/email-editor/defaultData'

describe('EmailPreview', () => {
  beforeEach(() => {
    useEmailEditorStore.setState({ data: structuredClone(defaultEmailData) })
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders an iframe whose srcDoc contains the logo', () => {
    const { container } = render(<EmailPreview />)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.srcDoc).toContain(defaultEmailData.header.logo)
  })

  it('updates srcDoc when data changes', () => {
    const { container } = render(<EmailPreview />)
    useEmailEditorStore.getState().setField(['hero', 'title'], 'MEGA SALE')
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.srcDoc).toContain('MEGA SALE')
  })

  it('copies generated HTML to clipboard on button click', async () => {
    render(<EmailPreview />)
    fireEvent.click(screen.getByText('复制代码'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      const arg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(arg).toContain('<table')
    })
  })
})
```

> jsdom 的 `iframe.srcDoc` 会作为属性反映，可直接断言内容。

- [ ] **Step 3: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test email-editor/preview`
预期：3 passed。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/email-editor/EmailPreview.tsx apps/web/tests/email-editor/preview.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): email preview (iframe srcDoc + copy button)

useMemo(generateEmailHtml) on data; iframe srcDoc live preview; copy
button writes HTML to clipboard with 2s label feedback. Covered by 3
tests (incl. clipboard mock).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: EmailEditor 装配 + 路由 + 项目页入口

**Files:**
- Create: `apps/web/src/email-editor/EmailEditor.tsx`
- Modify: `apps/web/src/router.tsx`（加 `/email-editor` 路由）
- Modify: `apps/web/src/routes/Projects.tsx`（加入口按钮）

- [ ] **Step 1: 创建 `apps/web/src/email-editor/EmailEditor.tsx`**

```tsx
import { EmailSidebar } from './EmailSidebar'
import { EmailPreview } from './EmailPreview'

export default function EmailEditor() {
  return (
    <div className="flex h-full">
      <EmailSidebar />
      <EmailPreview />
    </div>
  )
}
```

- [ ] **Step 2: 在 `apps/web/src/router.tsx` 受保护 children 加路由**

把 `ProtectedRoute` 的 children 数组扩展（在 `projects/:id` 后加一项）：

```tsx
      { element: <ProtectedRoute />, children: [
        { index: true, element: <Navigate to="/projects" replace /> },
        { path: 'projects', element: <Projects /> },
        { path: 'projects/:id', element: <ProjectShell /> },
        { path: 'email-editor', element: <EmailEditor /> },
      ]},
```

并在 `router.tsx` 顶部加 import：

```tsx
import EmailEditor from './email-editor/EmailEditor'
```

- [ ] **Step 3: 在 `apps/web/src/routes/Projects.tsx` 顶栏加入口按钮**

把 Projects 页顶部 `<div className="mb-4 flex items-center justify-between">` 块改为（「新建项目」左边加「邮件编辑器」）：

```tsx
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">我的项目</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/email-editor')}>邮件编辑器</Button>
          <Button onClick={() => setCreating(true)}>+ 新建项目</Button>
        </div>
      </div>
```

- [ ] **Step 4: 全量测试 + 类型检查 + 构建**

运行：`pnpm --filter @ppt-generator/web test`
预期：全部通过（既有 28 + email-editor generateHtml 6 + store 4 + preview 3 = 41 passed）。

运行：`pnpm --filter @ppt-generator/web typecheck`
预期：0 错误。

运行：`pnpm --filter @ppt-generator/web build`
预期：生成 `apps/web/dist/`，退出码 0。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/email-editor/EmailEditor.tsx apps/web/src/router.tsx apps/web/src/routes/Projects.tsx
git commit -m "$(cat <<'EOF'
feat(web): assemble email editor + /email-editor route + entry

EmailEditor two-pane; route under Layout (auth); Projects page gets a
'邮件编辑器' button entry. 41 web tests green, tsc/build pass.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: dev 冒烟 + changelog/PROJECT 收尾

**Files:**
- Modify: `docs/CHANGELOG.md`、`docs/PROJECT.md`

- [ ] **Step 1: dev 联调冒烟（后端要在 `:3017` 运行）**

确保后端起着。运行：`pnpm --filter @ppt-generator/web dev`，浏览器开 `http://localhost:5173`，`admin/admin123` 登录：
1. 项目列表页点「邮件编辑器」→ 进入 `/email-editor`。
2. 左表单 5 个折叠区，首区（Header）默认展开；右侧 iframe 实时显示与原文件一致的邮件预览。
3. 改 Header 的 Main Title → 右侧预览实时更新；展开「时尚区」改某 Product 的 Discount → 预览更新。
4. 图片字段贴新 URL → 下方预览缩略图 + iframe 邮件内图片更新。
5. 点右上「复制代码」→ 按钮变「已复制 ✓」2s → 粘贴到记事本得到完整邮件 HTML。
6. 顶栏「← 返回」回 `/projects`。

- [ ] **Step 2: 更新 `docs/CHANGELOG.md`（新日期段 `## 2026-06-27`）**

在「写入规则」段下、`## 2026-06-26` 之上插入：

````markdown
## 2026-06-27

### 新增

- 邮件编辑器（还原 `ai_studio_code-40.html`）：`/email-editor` 新路由，左侧表单分区（Header/Top Deals/Featured/Fashion/Beauty）+ 右侧 iframe `srcDoc` 实时预览 + 复制 HTML，纯前端、内存数据预填原文件，`apps/web/src/email-editor/*`
- `generateEmailHtml(data)` 纯函数（port 自原文件，table+内联样式+移动端 stack），`apps/web/src/email-editor/generateHtml.ts`
- 设计与实施计划：`docs/superpowers/specs/2026-06-27-email-editor-design.md`、`docs/superpowers/plans/2026-06-27-email-editor.md`
````

- [ ] **Step 3: 更新 `docs/PROJECT.md` 当前状态**

把「当前状态」标题改为 `**v0.5 — 邮件编辑器还原完成**（2026-06-27，分支 `email-editor`）`，并在编辑器 MVP 那行下方加一条：

- 邮件编辑器（还原 `ai_studio_code-40.html`）上线：`/email-editor`，表单 + iframe 实时预览 + 复制 HTML，纯前端

后续计划列表前可加「邮件模板持久化/多模板（可选）」。

- [ ] **Step 4: 提交 + 终验**

```bash
git add docs/CHANGELOG.md docs/PROJECT.md
git commit -m "$(cat <<'EOF'
docs: email editor restore — changelog + PROJECT status

Marks v0.5: Digchic email editor ported to /email-editor (form + live
iframe preview + copy HTML), pure frontend.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git status --short
```
预期：工作树干净（或仅 `ai_studio_code-40.html` 未跟踪）。

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-06-27-email-editor-design.md`）：
- ✅ §1.1 范围（表单分区/iframe 预览/复制/预填数据）→ Task 1–5
- ✅ §2 数据模型（EmailData 及子类型）→ Task 1 Step 1
- ✅ §3 store + setField → Task 2
- ✅ §4 generateEmailHtml（纯函数 + 移动端 media + 各区块）→ Task 1 Step 5（6 项单测覆盖）
- ✅ §5 UI 组件（EmailSidebar/Section/FieldImage/EmailPreview/EmailEditor）→ Task 3/4/5
- ✅ §6 路由 + 入口 → Task 5 Step 2/3
- ✅ §7 复制 + 按钮反馈 → Task 4 Step 1（3 项测试含 clipboard mock）
- ✅ §8 测试（generateHtml/editor/复制）→ Task 1/2/4 测试
- ✅ §9 不在范围（后端/模板/发送/上传）显式排除

**2. 占位符扫描**：无 TBD/TODO；每步含完整可编译代码 + 命令 + 预期。

**3. 类型一致性**：
- `EmailData`/子类型在 shared（Task 1）定义；defaultData（Task 1）、generateHtml（Task 1）、store（Task 2）、EmailSidebar（Task 3）引用一致。
- store `setField(path: (string|number)[], value: string)` 在 Task 2 定义、Task 3 表单全部按此调用（`['topDeals', i, 'brand']` 等路径）、Task 4 测试断言一致。
- `generateEmailHtml(data: EmailData)` 签名 Task 1 定义，Task 4 EmailPreview 消费一致。
- 路由 path `email-editor` 在 Task 5 router 与 Projects 入口 `navigate('/email-editor')` 一致。

**4. 已知裁剪（显式）**：后端持久化/模板 CRUD/多模板/发送/图片上传——均留后续（spec §9）。

**5. 风险与对策**：
- jsdom 不渲染 iframe 内容 → 测试断言 `iframe.srcDoc` 字符串属性（非实际渲染），可靠。
- `navigator.clipboard` 在 jsdom 不存在 → 测试 `vi.stubGlobal` 注入 mock。
- 表单字段多 → EmailSidebar 单文件较长但结构重复清晰（每区一组输入）；如执行时嫌大可按区拆，非必须。
- `structuredClone` 在旧 Node 不可用 → Node 20 已内置，安全。
