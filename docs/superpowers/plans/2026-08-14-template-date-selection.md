# 从模板新建报告 — 日期选择优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「从模板新建报告」选起止日期时，标出 Campaign 投放区间、自动给推荐默认、提供快捷预设、提交前校验——解决"不知道选什么对"。

**Architecture:** 方案 A。新建纯函数模块 `periodRange.ts`（validate/clamp/preset/default，无 DOM、不碰 `Date` 时钟）+ 受控组件 `<PeriodPicker>`（渲染区间提示+预设+两个原生 date input+行内错误）。`CreateFromTemplateDialog` 选中 ai-html 模板时拉 `getCampaign(campaignId)`，把 `startDate..min(endDate,今天)` 作为有效窗口传给 `<PeriodPicker>`，默认链=模板 reportPeriod 合法则用→否则最近 30 天；`getCampaign` 失败降级（不标区间但仍校验起≤止+非空）。请求体形状不变，服务端零改动。真实数据区间（方案 B）以后换 fetch 即可，组件接口不动。

**Tech Stack:** React 18 + TypeScript + Tailwind 3.4 + vitest + @testing-library/react（jsdom）。无组件库，对话框均为手写 Tailwind。

**Spec:** `docs/superpowers/specs/2026-08-14-template-date-selection-design.md`

**Scope:** Tasks 1–4 是核心 UX 修复（必做）。Task 5 是服务端防御性校验（可选，独立于 1–4，可跳过）。

---

## File Structure

**Create:**
- `apps/web/src/components/period-picker/periodRange.ts` — 纯函数 + 类型（`Period`/`Preset`/`PRESETS`/`earlierDate`/`laterDate`/`clampPeriod`/`validatePeriod`/`resolvePreset`/`computeDefaultPeriod`）。无 DOM，所有逻辑函数不读系统时钟。
- `apps/web/src/components/period-picker/periodRange.test.ts` — 上述纯函数单测。
- `apps/web/src/components/period-picker/today.ts` — `todayIso()`，唯一 impure（读时钟）的薄封装，独立成文件保持 `periodRange.ts` 纯净。
- `apps/web/src/components/period-picker/PeriodPicker.tsx` — 受控组件，不感知 Campaign。
- `apps/web/src/components/period-picker/PeriodPicker.test.tsx` — 组件测试。
- `apps/web/src/components/CreateFromTemplateDialog.test.tsx` — 集成测试（mock `templatesApi` + `getCampaign`）。

**Modify:**
- `apps/web/src/components/CreateFromTemplateDialog.tsx` — 替换两个 `<input type=date>` 与回填 effect，接入 `<PeriodPicker>` + Campaign 拉取。

**Optional (Task 5):**
- `apps/server/src/modules/projects/projects.schema.ts` — 新增 `fromTemplateSchema`。
- `apps/server/src/modules/projects/projects.routes.ts` — `/from-template` 挂 `validate`。
- `apps/server/src/modules/projects/projects.schema.test.ts` — schema 单测。

**职责边界：** `periodRange.ts` 是纯逻辑（易测、可被任何 picker 复用）；`PeriodPicker.tsx` 是纯渲染+校验反馈（不知道范围从哪来，`minDate/maxDate` 是 prop）；`CreateFromTemplateDialog.tsx` 负责"拉 Campaign→算窗口→算默认→喂给 picker"。方案 B 以后只需在 dialog 里把 `getCampaign` 换成数据区间端点，picker 与纯函数不动。

---

## 约定

- **跑 web 测试**（根 `pnpm test` 会递归且被 server 结果盖掉，root 无 vitest binary）：用 `pnpm --filter web exec vitest run <file>`。（若不可用，回退 `cd apps/web && pnpm exec vitest run <file>`。）
- **web 类型检查**（CI 唯一 gate，dev 不查）：`pnpm --filter web run typecheck`。
- **提交**：仓库 IDE 会跨 CLI 调用重置 git index，故每个 commit 必须 `git add <files> && git commit -m "..."` 一条原子命令。只 add 本任务文件，勿带入工作树里并发的其它改动。

---

## Task 1: 纯函数 `periodRange.ts` — 校验 + 日期比较 + 夹值

**Files:**
- Create: `apps/web/src/components/period-picker/periodRange.ts`
- Test: `apps/web/src/components/period-picker/periodRange.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/src/components/period-picker/periodRange.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { clampPeriod, earlierDate, laterDate, validatePeriod } from './periodRange';

describe('earlierDate / laterDate', () => {
  it('返回较早/较晚者；空串视为无界', () => {
    expect(earlierDate('2026-01-01', '2026-02-01')).toBe('2026-01-01');
    expect(laterDate('2026-01-01', '2026-02-01')).toBe('2026-02-01');
    expect(earlierDate('', '2026-02-01')).toBe('2026-02-01');
    expect(laterDate('', '2026-02-01')).toBe('2026-02-01');
    expect(earlierDate('', '')).toBe('');
  });
});

describe('clampPeriod', () => {
  it('把越界起止夹进 [min,max]', () => {
    expect(clampPeriod({ startDate: '2025-01-01', endDate: '2030-01-01' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });
  it('区间内保持不变', () => {
    expect(clampPeriod({ startDate: '2026-06-01', endDate: '2026-06-30' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });
});

describe('validatePeriod', () => {
  const ok = { ok: true, error: null };
  it('required 且空 → 不通过', () => {
    expect(validatePeriod({ startDate: '', endDate: '' }, { required: true }))
      .toEqual({ ok: false, error: '请选择起止日期' });
  });
  it('非 required 空值 → 通过', () => {
    expect(validatePeriod({ startDate: '', endDate: '' }, {})).toEqual(ok);
  });
  it('起始晚于结束 → 不通过', () => {
    expect(validatePeriod({ startDate: '2026-06-10', endDate: '2026-06-01' }, {}))
      .toEqual({ ok: false, error: '起始日期不能晚于结束日期' });
  });
  it('起始早于 min → 不通过', () => {
    expect(validatePeriod({ startDate: '2025-12-31', endDate: '2026-06-01' }, { min: '2026-01-01' }))
      .toEqual({ ok: false, error: '起始日期不能早于 2026-01-01' });
  });
  it('结束晚于 max(含未来) → 不通过', () => {
    expect(validatePeriod({ startDate: '2026-06-01', endDate: '2027-01-01' }, { max: '2026-12-31' }))
      .toEqual({ ok: false, error: '结束日期不能晚于 2026-12-31' });
  });
  it('合法区间 → 通过', () => {
    expect(validatePeriod({ startDate: '2026-06-01', endDate: '2026-06-30' }, { min: '2026-01-01', max: '2026-12-31', required: true }))
      .toEqual(ok);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web exec vitest run src/components/period-picker/periodRange.test.ts`
Expected: FAIL（`Failed to resolve import "./periodRange"` 或函数未定义）。

- [ ] **Step 3: 写最小实现**

创建 `apps/web/src/components/period-picker/periodRange.ts`：

```ts
/** 报告周期。空串表示未选。所有日期为本地 YYYY-MM-DD。 */
export type Period = { startDate: string; endDate: string };

export interface ValidationResult {
  ok: boolean;
  error: string | null;
}

/**
 * ISO YYYY-MM-DD 字符串词法比较即等价于 chronological（定宽格式）。
 * 空串视为"无界"：与无界比较返回另一侧非空值。
 */
export function earlierDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function laterDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** 把起止各自夹进 [min,max]；空 min/max 表示该侧无界。 */
export function clampPeriod(v: Period, min: string, max: string): Period {
  let { startDate, endDate } = v;
  if (min) {
    if (startDate && startDate < min) startDate = min;
    if (endDate && endDate < min) endDate = min;
  }
  if (max) {
    if (startDate && startDate > max) startDate = max;
    if (endDate && endDate > max) endDate = max;
  }
  return { startDate, endDate };
}

/** 校验周期。max 应由调用方预先夹今天（未来日期无数据）。 */
export function validatePeriod(
  v: Period,
  opts: { min?: string; max?: string; required?: boolean } = {},
): ValidationResult {
  const { min = '', max = '', required = false } = opts;
  if (required && (!v.startDate || !v.endDate)) {
    return { ok: false, error: '请选择起止日期' };
  }
  if (v.startDate && v.endDate && v.startDate > v.endDate) {
    return { ok: false, error: '起始日期不能晚于结束日期' };
  }
  if (v.startDate && min && v.startDate < min) {
    return { ok: false, error: `起始日期不能早于 ${min}` };
  }
  if (v.endDate && max && v.endDate > max) {
    return { ok: false, error: `结束日期不能晚于 ${max}` };
  }
  return { ok: true, error: null };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter web exec vitest run src/components/period-picker/periodRange.test.ts`
Expected: PASS（3 个 describe 全绿）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/period-picker/periodRange.ts apps/web/src/components/period-picker/periodRange.test.ts && git commit -m "feat(web): periodRange 纯函数 — validate/clamp/日期比较

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 纯函数 `periodRange.ts` — 预设 + 默认

**Files:**
- Modify: `apps/web/src/components/period-picker/periodRange.ts`（追加）
- Modify: `apps/web/src/components/period-picker/periodRange.test.ts`（追加）

- [ ] **Step 1: 追加失败测试**

在 `periodRange.test.ts` 顶部 import 行追加，并在文件末尾追加三个 describe：

```ts
// 顶部 import 改为：
import { clampPeriod, computeDefaultPeriod, earlierDate, laterDate, PRESETS, resolvePreset, validatePeriod } from './periodRange';

// 文件末尾追加：
describe('PRESETS', () => {
  it('包含五个标准预设,顺序固定', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['thisMonth', 'lastMonth', 'last7', 'last30', 'all']);
  });
});

describe('resolvePreset', () => {
  const min = '2026-01-01';
  const max = '2026-08-14';
  const today = '2026-08-14';
  it('全部 → 整个窗口', () => {
    expect(resolvePreset('all', min, max, today)).toEqual({ startDate: min, endDate: max });
  });
  it('最近30天 → [today-29, today] 与窗口求交', () => {
    expect(resolvePreset('last30', min, max, today)).toEqual({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });
  it('本月 → 本月历月与窗口求交', () => {
    expect(resolvePreset('thisMonth', min, max, today)).toEqual({ startDate: '2026-08-01', endDate: '2026-08-14' });
  });
  it('上月 → 上月历月与窗口求交', () => {
    expect(resolvePreset('lastMonth', min, max, today)).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });
  it('目标区间在窗口外 → null(禁用)', () => {
    expect(resolvePreset('thisMonth', '2020-01-01', '2020-12-31', today)).toBeNull();
  });
});

describe('computeDefaultPeriod', () => {
  it('窗口≥30天 → [max-29, max]', () => {
    expect(computeDefaultPeriod('2026-01-01', '2026-08-14')).toEqual({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });
  it('窗口<30天 → 退化为全窗口', () => {
    expect(computeDefaultPeriod('2026-08-10', '2026-08-14')).toEqual({ startDate: '2026-08-10', endDate: '2026-08-14' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web exec vitest run src/components/period-picker/periodRange.test.ts`
Expected: FAIL（`PRESETS`/`resolvePreset`/`computeDefaultPeriod` 未导出）。

- [ ] **Step 3: 追加实现**

在 `periodRange.ts` 末尾追加：

```ts
export type PresetId = 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'all';
export interface Preset {
  id: PresetId;
  label: string;
}

export const PRESETS: Preset[] = [
  { id: 'thisMonth', label: '本月' },
  { id: 'lastMonth', label: '上月' },
  { id: 'last7', label: '最近7天' },
  { id: 'last30', label: '最近30天' },
  { id: 'all', label: '全部' },
];

/** 本地 YYYY-MM-DD（仅用于把已知 Date 序列化，不读系统时钟）。 */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** base(YYYY-MM-DD) ± days 天。基于已知字符串构造 Date，确定性强。 */
function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** 某年某月(month0)的 [月初, 月末]。 */
function monthBounds(year: number, month0: number): Period {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0); // 下月第 0 天 = 本月最后一天
  return { startDate: iso(first), endDate: iso(last) };
}

/**
 * 按 today 算出预设目标区间，再与 [min,max] 求交。空交集返回 null（→ 禁用该预设）。
 * 预设一律相对 today，不相对 Campaign.max。
 */
export function resolvePreset(preset: PresetId, min: string, max: string, today: string): Period | null {
  const d = new Date(`${today}T00:00:00`);
  let target: Period;
  switch (preset) {
    case 'thisMonth':
      target = monthBounds(d.getFullYear(), d.getMonth());
      break;
    case 'lastMonth':
      target = monthBounds(d.getFullYear(), d.getMonth() - 1); // JS Date 自动处理 1 月回滚到上年 12 月
      break;
    case 'last7':
      target = { startDate: addDays(today, -6), endDate: today };
      break;
    case 'last30':
      target = { startDate: addDays(today, -29), endDate: today };
      break;
    case 'all':
      target = { startDate: min, endDate: max };
      break;
  }
  const start = laterDate(target.startDate, min);
  const end = earlierDate(target.endDate, max);
  if (start && end && start <= end) return { startDate: start, endDate: end };
  return null;
}

/**
 * 推荐默认：[max-29, max] ∩ [min,max]；窗口 <30 天则退化为全窗口 [min,max]。
 * max 由调用方夹今天后传入，故本函数不依赖 today，保持纯函数。
 */
export function computeDefaultPeriod(min: string, max: string): Period {
  if (!max) return { startDate: min, endDate: max };
  return { startDate: laterDate(addDays(max, -29), min), endDate: max };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter web exec vitest run src/components/period-picker/periodRange.test.ts`
Expected: PASS（全部 describe 绿）。

- [ ] **Step 5: 类型检查**

Run: `pnpm --filter web run typecheck`
Expected: 无新增错误（task 1 已存在的错误不算，但本任务应零引入）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/period-picker/periodRange.ts apps/web/src/components/period-picker/periodRange.test.ts && git commit -m "feat(web): periodRange — 预设 resolvePreset + computeDefaultPeriod

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: `<PeriodPicker>` 共享组件

**Files:**
- Create: `apps/web/src/components/period-picker/today.ts`
- Create: `apps/web/src/components/period-picker/PeriodPicker.tsx`
- Test: `apps/web/src/components/period-picker/PeriodPicker.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/src/components/period-picker/PeriodPicker.test.tsx`：

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodPicker } from './PeriodPicker';

describe('PeriodPicker', () => {
  it('有 min/max 时渲染投放区间提示', () => {
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-01', endDate: '2026-08-14' }}
        onChange={() => {}}
        minDate="2026-01-01"
        maxDate="2026-08-14"
        today="2026-08-14"
      />,
    );
    const hint = screen.getByText(/投放区间/);
    expect(hint.textContent).toContain('2026-01-01');
    expect(hint.textContent).toContain('2026-08-14');
  });

  it('点可用预设 → onChange 收到夹交后的区间', () => {
    const onChange = vi.fn();
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-01', endDate: '2026-08-14' }}
        onChange={onChange}
        minDate="2026-01-01"
        maxDate="2026-08-14"
        today="2026-08-14"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '最近30天' }));
    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });

  it('非法区间(起>止) → 行内报错 + onValidityChange(false)', () => {
    const onValidityChange = vi.fn();
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-14', endDate: '2026-08-01' }}
        onChange={() => {}}
        onValidityChange={onValidityChange}
      />,
    );
    expect(screen.getByText('起始日期不能晚于结束日期')).toBeTruthy();
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('无 min/max → 不显示投放区间提示(降级)', () => {
    render(<PeriodPicker value={{ startDate: '', endDate: '' }} onChange={() => {}} />);
    expect(screen.queryByText(/投放区间/)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web exec vitest run src/components/period-picker/PeriodPicker.test.tsx`
Expected: FAIL（`Failed to resolve import "./PeriodPicker"`）。

- [ ] **Step 3: 写 `today.ts`**

创建 `apps/web/src/components/period-picker/today.ts`：

```ts
/** 本地时区今天，YYYY-MM-DD。impure（读系统时钟）；独立成文件以保持 periodRange.ts 纯净。 */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
```

- [ ] **Step 4: 写组件**

创建 `apps/web/src/components/period-picker/PeriodPicker.tsx`：

```tsx
import { useEffect, useRef } from 'react';
import { PRESETS, resolvePreset, validatePeriod, type Period, type Preset } from './periodRange';
import { todayIso } from './today';

export interface PeriodPickerProps {
  value: Period;
  onChange: (v: Period) => void;
  /** 有效窗口下/上界，YYYY-MM-DD；缺省=该侧无界(降级模式)。 */
  minDate?: string;
  maxDate?: string;
  /** 为 true 时空值非法。 */
  required?: boolean;
  /** 预设列表，默认 PRESETS。 */
  presets?: Preset[];
  /** 预设相对基准日；缺省读系统时钟。测试时传定值。 */
  today?: string;
  /** 合法性变化时回调，供调用方 gate 提交按钮。 */
  onValidityChange?: (ok: boolean) => void;
}

export function PeriodPicker({
  value,
  onChange,
  minDate,
  maxDate,
  required,
  presets = PRESETS,
  today,
  onValidityChange,
}: PeriodPickerProps) {
  const min = minDate ?? '';
  const max = maxDate ?? '';
  const now = today ?? todayIso();
  const result = validatePeriod(value, { min, max, required });

  // 仅在合法性翻转时回调，避免每次渲染触发 setState 循环。
  const lastOk = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastOk.current !== result.ok) {
      lastOk.current = result.ok;
      onValidityChange?.(result.ok);
    }
  }, [result.ok, onValidityChange]);

  return (
    <div className="mt-3">
      {(min || max) && (
        <p className="text-[10px] text-foreground-muted">
          投放区间 {min || '—'} ~ {max || '—'}
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        {presets.map((p) => {
          const resolved = resolvePreset(p.id, min, max, now);
          const disabled = resolved === null;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => resolved && onChange(resolved)}
              className="rounded border border-border-default px-2 py-0.5 text-[11px] text-foreground-secondary enabled:hover:bg-surface-hover disabled:opacity-40"
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-foreground-secondary">
          起始日期
          <input
            aria-label="起始日期"
            type="date"
            value={value.startDate}
            min={min || undefined}
            max={max || undefined}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
          />
        </label>
        <label className="block text-xs text-foreground-secondary">
          结束日期
          <input
            aria-label="结束日期"
            type="date"
            value={value.endDate}
            min={min || undefined}
            max={max || undefined}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
          />
        </label>
      </div>
      {result.error && <p className="mt-1 text-[11px] text-red">{result.error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter web exec vitest run src/components/period-picker/PeriodPicker.test.tsx`
Expected: PASS（4 个 it 全绿）。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter web run typecheck`
Expected: 无新增错误。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/components/period-picker/today.ts apps/web/src/components/period-picker/PeriodPicker.tsx apps/web/src/components/period-picker/PeriodPicker.test.tsx && git commit -m "feat(web): PeriodPicker 共享组件(区间提示+预设+校验)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 接入 `CreateFromTemplateDialog`

**Files:**
- Modify: `apps/web/src/components/CreateFromTemplateDialog.tsx`
- Test: `apps/web/src/components/CreateFromTemplateDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/src/components/CreateFromTemplateDialog.test.tsx`：

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, TemplateSummary } from '@mediakit/shared';

const aiHtmlTpl = {
  id: 't1',
  name: 'AI 报告',
  status: 'PUBLISHED',
  meta: { styleType: 'ai-html', campaignId: 'c1', businessLine: 'BL', scenario: 's1', isDefault: false },
} as unknown as TemplateSummary;

// endDate 取 2020-12-31（早于任何运行时今天），保证 max=endDate 确定性。
const campaign = { id: 'c1', startDate: '2020-01-01', endDate: '2020-12-31' } as unknown as Campaign;

vi.mock('@/api/templates', () => ({
  templatesApi: { list: vi.fn().mockResolvedValue([aiHtmlTpl]) },
}));
vi.mock('@/api/campaigns', () => ({
  getCampaign: vi.fn().mockResolvedValue(campaign),
}));

import { CreateFromTemplateDialog } from './CreateFromTemplateDialog';
import { getCampaign } from '@/api/campaigns';

beforeEach(() => vi.clearAllMocks());

describe('CreateFromTemplateDialog', () => {
  it('ai-html 模板: 拉 Campaign 显示投放区间,默认填最近30天,提交带 reportPeriod', async () => {
    const onSubmit = vi.fn();
    render(<CreateFromTemplateDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await waitFor(() => expect(screen.getByText(/投放区间/)).toBeTruthy());
    expect(screen.getByText(/投放区间/).textContent).toContain('2020-01-01');
    expect(screen.getByText(/投放区间/).textContent).toContain('2020-12-31');

    fireEvent.click(screen.getByRole('button', { name: /创建报告/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].reportPeriod).toEqual({ startDate: '2020-12-02', endDate: '2020-12-31' });
  });

  it('getCampaign 失败 → 降级,不显示投放区间提示', async () => {
    (getCampaign as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(<CreateFromTemplateDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(getCampaign).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/投放区间/)).toBeNull());
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web exec vitest run src/components/CreateFromTemplateDialog.test.tsx`
Expected: FAIL（旧实现无"投放区间"文案 → happy path 的 waitFor 超时）。

- [ ] **Step 3: 改 `CreateFromTemplateDialog.tsx`**

**(a) 替换 import 区（第 1–7 行之后追加新 import）。** 在第 7 行 `import type { TemplateSummary } ...` 之后追加：

```ts
import { getCampaign } from '@/api/campaigns';
import { PeriodPicker } from './period-picker/PeriodPicker';
import { computeDefaultPeriod, earlierDate, validatePeriod, type Period } from './period-picker/periodRange';
import { todayIso } from './period-picker/today';
```

**(b) 替换 state（第 30–31 行）。** 把：

```ts
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
```

替换为：

```ts
  const [period, setPeriod] = useState<Period>({ startDate: '', endDate: '' });
  const [range, setRange] = useState<{ min: string; max: string } | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [periodValid, setPeriodValid] = useState(true);
```

**(c) 替换回填 effect（第 66–72 行整段）。** 把"选中模版变化时…回填起止日期"那个 `useEffect` 整段替换为：

```ts
  // 选中 ai-html 报告模版时,拉 Campaign 配置区间作有效窗口,并算推荐默认起止日期。
  // cancelled: deps 变化/卸载时丢弃过期响应,避免竞态覆盖。
  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    const cid = t?.meta?.campaignId;
    const live = (t?.meta?.styleType === 'ai-html' || t?.meta?.renderType === 'html-report') && !!cid;
    if (!live || !cid) {
      setRange(null);
      setPeriod({ startDate: '', endDate: '' });
      return;
    }
    let cancelled = false;
    setRangeLoading(true);
    const rp = (t?.meta as { reportPeriod?: { startDate?: string; endDate?: string } } | undefined)?.reportPeriod;
    getCampaign(cid)
      .then((c) => {
        if (cancelled || !c) return;
        const min = c.startDate;
        const max = earlierDate(c.endDate, todayIso()); // 未来日期无数据
        setRange({ min, max });
        const candidate = rp ? { startDate: rp.startDate ?? '', endDate: rp.endDate ?? '' } : null;
        const initial =
          candidate && validatePeriod(candidate, { min, max }).ok ? candidate : computeDefaultPeriod(min, max);
        setPeriod(initial);
      })
      .catch(() => {
        if (cancelled) return;
        // 降级:不标区间、不越界校验,但仍保留起≤止+非空校验(PeriodPicker required)。
        setRange(null);
        setPeriod({ startDate: rp?.startDate ?? '', endDate: rp?.endDate ?? '' });
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, templates]);
```

**(d) 替换 canSubmit + submit（第 77–89 行）。** 把：

```ts
  const canSubmit = !!selectedId && !loading && !fetching;

  const submit = () => {
    if (!selected) return;
    const isLiveReport =
      (selected.meta?.styleType === 'ai-html' || selected.meta?.renderType === 'html-report') &&
      !!selected.meta?.campaignId;
    onSubmit({
      templateId: selected.id,
      name: name.trim() || selected.name,
      ...(isLiveReport ? { reportPeriod: { startDate, endDate } } : {}),
    });
  };
```

替换为：

```ts
  const isLiveReport =
    !!selected &&
    (selected.meta?.styleType === 'ai-html' || selected.meta?.renderType === 'html-report') &&
    !!selected.meta?.campaignId;
  const canSubmit = !!selectedId && !loading && !fetching && (isLiveReport ? periodValid : true);

  const submit = () => {
    if (!selected) return;
    if (isLiveReport && !periodValid) return; // 错误已由 PeriodPicker 行内显示
    onSubmit({
      templateId: selected.id,
      name: name.trim() || selected.name,
      ...(isLiveReport ? { reportPeriod: { startDate: period.startDate, endDate: period.endDate } } : {}),
    });
  };
```

> 注意：`isLiveReport` 现在在 render 顶层声明（供 canSubmit 与下方 gate 共用），原 `submit` 内的局部 `isLiveReport` 已删除。

**(e) 替换日期 UI 块（第 229–254 行整段 `<div className="mt-3 grid grid-cols-2 gap-2">…</div>`）。** 把整个日期块替换为：

```tsx
        {isLiveReport && (
          <>
            <PeriodPicker
              value={period}
              onChange={setPeriod}
              minDate={range?.min}
              maxDate={range?.max}
              required
              onValidityChange={setPeriodValid}
            />
            {rangeLoading && <p className="text-[10px] text-foreground-muted">加载投放区间…</p>}
            <p className="text-[10px] text-foreground-muted">
              HTML 报告会按此时间段生成实时数据；创建后可在编辑器里改周期重算。
            </p>
          </>
        )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter web exec vitest run src/components/CreateFromTemplateDialog.test.tsx`
Expected: PASS（2 个 it 全绿）。

- [ ] **Step 5: 类型检查（CI gate）**

Run: `pnpm --filter web run typecheck`
Expected: 无新增错误。重点确认：`Period` 类型导入、`range`/`periodValid` 未用变量、`getCampaign`/`earlierDate`/`computeDefaultPeriod`/`todayIso`/`PeriodPicker` 导入路径正确。

- [ ] **Step 6: 跑相关测试回归**

Run: `pnpm --filter web exec vitest run src/components/CreateFromTemplateDialog.test.tsx src/components/period-picker/`
Expected: PASS（task 1–4 全绿）。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/components/CreateFromTemplateDialog.tsx apps/web/src/components/CreateFromTemplateDialog.test.tsx && git commit -m "feat(web): 从模板新建接入 PeriodPicker(投放区间+默认+预设+校验)

解决 ai-html 报告选起止日期盲选:拉 Campaign 配置区间作窗口,默认链
模板period优先→最近30天,预设夹交,提交前校验;失败降级不阻断。
请求体形状不变。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5（可选）: 服务端 `/from-template` 挂 Zod 校验

> 独立于 Task 1–4。UX 修复不依赖它，纯防御性，与 `/duplicate`（`duplicateSchema`）对齐。可整体跳过。

**Files:**
- Modify: `apps/server/src/modules/projects/projects.schema.ts`
- Modify: `apps/server/src/modules/projects/projects.routes.ts`
- Test: `apps/server/src/modules/projects/projects.schema.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/projects/projects.schema.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { fromTemplateSchema } from './projects.schema';

describe('fromTemplateSchema', () => {
  it('接受 templateId + name + 可选 reportPeriod', () => {
    const r = fromTemplateSchema.safeParse({
      templateId: 't1',
      name: 'n',
      reportPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(r.success).toBe(true);
  });
  it('reportPeriod 缺省也可', () => {
    expect(fromTemplateSchema.safeParse({ templateId: 't1', name: 'n' }).success).toBe(true);
  });
  it('缺 templateId → 失败', () => {
    expect(fromTemplateSchema.safeParse({ name: 'n' }).success).toBe(false);
  });
  it('templateId 空串 → 失败', () => {
    expect(fromTemplateSchema.safeParse({ templateId: '', name: 'n' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter server exec vitest run src/modules/projects/projects.schema.test.ts`
Expected: FAIL（`fromTemplateSchema` 未导出）。

- [ ] **Step 3: 加 schema**

在 `apps/server/src/modules/projects/projects.schema.ts` 中找到 `reportPeriodSchema`（约 463–467 行）定义之后，追加：

```ts
export const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string(),
  reportPeriod: reportPeriodSchema.optional(),
});
```

> `z` 与 `reportPeriodSchema` 已在该文件顶部/上文存在，无需新增 import。

- [ ] **Step 4: 路由挂 validate**

在 `apps/server/src/modules/projects/projects.routes.ts`：

1. 在 import 区确认/追加（与同文件 `duplicateSchema` 同款）：
```ts
import { fromTemplateSchema } from './projects.schema';
import { validate } from '../../middleware/validate'; // 若已 import validate 则不重复
```
2. 把 `/from-template` 路由（约第 20 行）：
```ts
router.post('/from-template', projectsController.createFromTemplate);
```
改为：
```ts
router.post('/from-template', validate({ body: fromTemplateSchema }), projectsController.createFromTemplate);
```

> 实施前先读 `projects.routes.ts` 顶部 import，确认 `validate` 的来源路径与 `duplicateSchema` 的 import 写法，按现有 pattern 对齐（不要臆造路径）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter server exec vitest run src/modules/projects/projects.schema.test.ts`
Expected: PASS。

- [ ] **Step 6: 服务端类型检查 + 现有测试回归**

Run: `pnpm --filter server run typecheck && pnpm --filter server exec vitest run src/modules/projects/`
Expected: 无新增类型错误；projects 模块现有测试仍全绿（路由加了 validate 不应破坏既有 controller 行为——body 形状未变）。

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/modules/projects/projects.schema.ts apps/server/src/modules/projects/projects.schema.test.ts apps/server/src/modules/projects/projects.routes.ts && git commit -m "feat(server): /from-template 挂 fromTemplateSchema 校验

与 /duplicate 对齐;UX 不依赖,纯防御。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review（写完计划后已自查）

**1. Spec 覆盖：**
- 标出有效投放区间 → Task 4（拉 Campaign → range → PeriodPicker hint）。✅
- 推荐默认（模板 period 优先 → 最近 30 天）→ Task 2 `computeDefaultPeriod` + Task 4 默认链。✅
- 快捷预设（本月/上月/最近7/30天/全部，夹交）→ Task 2 `PRESETS`/`resolvePreset` + Task 3 渲染。✅
- 提交前校验（非空/起≤止/不超窗）+ 行内反馈 + 阻断 → Task 1 `validatePeriod` + Task 3 行内错误/onValidityChange + Task 4 canSubmit/submit gate。✅
- 抽共享 `<PeriodPicker>` + 纯函数 → Task 1/2/3。✅
- 失败降级不阻断 → Task 4 `.catch` 分支 + Task 3 无 min/max 降级。✅
- 请求体形状不变 / 服务端零改动（核心）→ Task 4 submit 仍发 `{startDate,endDate}`；Task 5 可选。✅
- 方案 B 预留 → minDate/maxDate 是 prop，换 fetch 即可（已在 Architecture/File Structure 注明）。✅
- 非目标（迁移其余 4 处 picker / 换日历 / 真数据区间 / ISO 正则）→ 均未列入任务。✅

**2. 占位符扫描：** 无 TBD/TODO/"适当处理"；每个 code step 均含完整代码；命令含预期输出。Task 5 Step 4 的 `validate` import 路径要求"先读文件按现有 pattern 对齐"——这是显式核查指令而非占位（因 `duplicateSchema` 已在同文件验证过该 pattern 存在）。

**3. 类型/签名一致性：**
- `Period = { startDate: string; endDate: string }`：Task 1 定义 → Task 3 `PeriodPickerProps.value` → Task 4 `useState<Period>` 全程一致。✅
- `validatePeriod(v, {min,max,required}) → {ok,error}`：Task 1 定义，Task 3（组件内 `validatePeriod(value,{min,max,required})`）、Task 4（默认链 `validatePeriod(candidate,{min,max})`）调用签名一致。✅
- `resolvePreset(id, min, max, today) → Period | null`：Task 2 定义，Task 3 `resolvePreset(p.id, min, max, now)` 一致。✅
- `computeDefaultPeriod(min, max) → Period`：Task 2 定义，Task 4 `computeDefaultPeriod(min, max)` 一致。✅
- `getCampaign(id) → Promise<Campaign | undefined>`（`Campaign.startDate/endDate: string`）：Task 4 用 `c.startDate`/`c.endDate`，与 `api/campaigns.ts` + shared type 一致。✅
- `onValidityChange(ok)`：Task 3 定义，Task 4 `onValidityChange={setPeriodValid}`（`useState<boolean>` setter 签名匹配）。✅

无矛盾。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-template-date-selection.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 每个 task 派一个 fresh subagent，task 间我来 review，迭代快。
2. **Inline Execution** — 本会话内用 executing-plans 批量执行，带 checkpoint review。

> 建议在隔离 worktree 里执行（用户常在 main 上跑并发未提交改动；参考 memory「Isolate feature work in worktree」），避免 commit 时混入并发改动。Task 1–4 是核心，Task 5 可选。

Which approach?
